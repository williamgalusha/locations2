import { env } from "cloudflare:workers";

export const PORTAL_SESSION_COOKIE = "bill_portal_session";
export type PortalRole = "production" | "client";
export type PortalAccessLevel = "admin" | "full" | "project" | "client";

export type PortalSession = {
  userId: string;
  username: string;
  displayName: string;
  role: PortalRole;
  accessLevel: PortalAccessLevel;
  expiresAt: number;
};

export type PortalAuthorization = {
  userId: string;
  username: string;
  displayName: string;
  role: PortalRole;
  accessLevel: PortalAccessLevel;
  projectIds: string[];
  isAdmin: boolean;
  chatGPT: boolean;
};

type PortalUserRow = {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  password_salt: string;
  access_level: PortalAccessLevel;
  active: number;
};

const PASSWORD_ITERATIONS = 210_000;

function portalEnvironment() {
  const worker = env as unknown as Record<string, unknown> & { DB?: D1Database };
  const node: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {};
  const runtimeValue = (key: string) => typeof worker[key] === "string" ? String(worker[key]) : node[key];
  return {
    DB: worker.DB,
    PORTAL_SESSION_SECRET: runtimeValue("PORTAL_SESSION_SECRET"),
    PORTAL_BOOTSTRAP_USERNAME: runtimeValue("PORTAL_BOOTSTRAP_USERNAME"),
    PORTAL_BOOTSTRAP_PASSWORD: runtimeValue("PORTAL_BOOTSTRAP_PASSWORD"),
  };
}

export function portalAuthDatabase() {
  const db = portalEnvironment().DB;
  if (!db) throw new Error("The production database is not connected.");
  return db;
}

function encodeBytes(value: Uint8Array) {
  return btoa(String.fromCharCode(...value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function encode(value: string) {
  return encodeBytes(new TextEncoder().encode(value));
}

function decode(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)));
}

function equalStrings(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return difference === 0;
}

async function signature(payload: string) {
  const secret = portalEnvironment().PORTAL_SESSION_SECRET;
  if (!secret) throw new Error("Portal session security is not configured.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const result = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return encodeBytes(new Uint8Array(result));
}

export function normalizePortalUsername(value: string) {
  return value.trim().toLowerCase();
}

export async function hashPortalPassword(password: string, suppliedSalt?: string) {
  if (password.length < 8) throw new Error("Passwords must be at least 8 characters.");
  const salt = suppliedSalt
    ? Uint8Array.from(atob(suppliedSalt.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(suppliedSalt.length / 4) * 4, "=")), (character) => character.charCodeAt(0))
    : crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS }, material, 256);
  return { hash: encodeBytes(new Uint8Array(bits)), salt: suppliedSalt || encodeBytes(salt) };
}

export async function verifyPortalPassword(password: string, hash: string, salt: string) {
  try {
    const candidate = await hashPortalPassword(password, salt);
    return equalStrings(candidate.hash, hash);
  } catch {
    return false;
  }
}

export async function ensurePortalAuthSchema() {
  const db = portalAuthDatabase();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS portal_users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
      access_level TEXT NOT NULL, active REAL NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS portal_user_projects (
      user_id TEXT NOT NULL, project_id TEXT NOT NULL, permission TEXT NOT NULL,
      created_at TEXT NOT NULL, PRIMARY KEY (user_id, project_id)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS portal_user_access_idx ON portal_users (access_level, active)"),
    db.prepare("CREATE INDEX IF NOT EXISTS portal_user_project_idx ON portal_user_projects (project_id, permission)"),
  ]);
}

export async function seedBootstrapAdmin() {
  const environment = portalEnvironment();
  const username = normalizePortalUsername(environment.PORTAL_BOOTSTRAP_USERNAME || "");
  const password = environment.PORTAL_BOOTSTRAP_PASSWORD || "";
  if (!username || !password) return false;
  const db = portalAuthDatabase();
  const existing = await db.prepare("SELECT id FROM portal_users WHERE username = ? LIMIT 1").bind(username).first<{ id: string }>();
  if (existing) return true;
  const credentials = await hashPortalPassword(password);
  const now = new Date().toISOString();
  await db.prepare("INSERT OR IGNORE INTO portal_users (id, username, display_name, password_hash, password_salt, access_level, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'admin', 1, ?, ?)")
    .bind(crypto.randomUUID(), username, username, credentials.hash, credentials.salt, now, now).run();
  return true;
}

async function projectIdsForUser(userId: string) {
  const assignments = await portalAuthDatabase().prepare("SELECT project_id FROM portal_user_projects WHERE user_id = ? ORDER BY project_id").bind(userId).all<{ project_id: string }>();
  return assignments.results.map((assignment) => assignment.project_id);
}

export async function authenticatePortalUser(usernameValue: string, password: string, role: PortalRole) {
  await ensurePortalAuthSchema();
  await seedBootstrapAdmin();
  const username = normalizePortalUsername(usernameValue);
  const user = await portalAuthDatabase().prepare("SELECT * FROM portal_users WHERE username = ? AND active = 1 LIMIT 1").bind(username).first<PortalUserRow>();
  if (!user || !(await verifyPortalPassword(password, user.password_hash, user.password_salt))) return null;
  if (role === "client" && user.access_level !== "client") return null;
  if (role === "production" && user.access_level === "client") return null;
  const projectIds = await projectIdsForUser(user.id);
  if ((user.access_level === "client" || user.access_level === "project") && projectIds.length === 0) return null;
  return {
    userId: user.id,
    username: user.username,
    displayName: user.display_name,
    role,
    accessLevel: user.access_level,
    projectIds,
    isAdmin: user.access_level === "admin",
    chatGPT: false,
  } satisfies PortalAuthorization;
}

export function canAccessPortalProject(authorization: PortalAuthorization, projectId: string) {
  return authorization.accessLevel === "admin" || authorization.accessLevel === "full" || authorization.projectIds.includes(projectId);
}

export async function createPortalSession(authorization: PortalAuthorization) {
  const payload = encode(JSON.stringify({
    userId: authorization.userId,
    username: authorization.username,
    displayName: authorization.displayName,
    role: authorization.role,
    accessLevel: authorization.accessLevel,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  } satisfies PortalSession));
  return `${payload}.${await signature(payload)}`;
}

export async function verifyPortalSession(token?: string | null): Promise<PortalSession | null> {
  if (!token) return null;
  const [payload, suppliedSignature, ...rest] = token.split(".");
  if (!payload || !suppliedSignature || rest.length || !equalStrings(suppliedSignature, await signature(payload))) return null;
  try {
    const session = JSON.parse(decode(payload)) as Partial<PortalSession>;
    const role = session.role === "client" ? "client" : "production";
    const accessLevel = (["admin", "full", "project", "client"] as const).includes(session.accessLevel as PortalAccessLevel) ? session.accessLevel as PortalAccessLevel : role === "client" ? "client" : "project";
    if (typeof session.userId !== "string" || typeof session.username !== "string" || typeof session.expiresAt !== "number" || session.expiresAt <= Date.now()) return null;
    return { userId: session.userId, username: session.username, displayName: session.displayName || session.username, role, accessLevel, expiresAt: session.expiresAt };
  } catch {
    return null;
  }
}

function cookieValue(request: Request, name: string) {
  const match = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export async function authorizePortalRequest(request: Request): Promise<PortalAuthorization | null> {
  const chatEmail = request.headers.get("oai-authenticated-user-email");
  if (chatEmail) {
    const encodedName = request.headers.get("oai-authenticated-user-full-name");
    const encoded = request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8";
    let displayName = chatEmail;
    if (encodedName) {
      try { displayName = encoded ? decodeURIComponent(encodedName) : encodedName; } catch { displayName = chatEmail; }
    }
    return { userId: `chatgpt:${chatEmail}`, username: chatEmail, displayName, role: "production", accessLevel: "admin", projectIds: [], isAdmin: true, chatGPT: true };
  }
  const session = await verifyPortalSession(cookieValue(request, PORTAL_SESSION_COOKIE)).catch(() => null);
  if (!session) return null;
  await ensurePortalAuthSchema();
  const user = await portalAuthDatabase().prepare("SELECT * FROM portal_users WHERE id = ? AND username = ? AND active = 1 LIMIT 1").bind(session.userId, session.username).first<PortalUserRow>();
  if (!user || user.access_level !== session.accessLevel) return null;
  const projectIds = await projectIdsForUser(user.id);
  if ((user.access_level === "client" || user.access_level === "project") && projectIds.length === 0) return null;
  return { userId: user.id, username: user.username, displayName: user.display_name, role: session.role, accessLevel: user.access_level, projectIds, isAdmin: user.access_level === "admin", chatGPT: false };
}
