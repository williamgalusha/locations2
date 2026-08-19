import { env } from "cloudflare:workers";

export const PORTAL_SESSION_COOKIE = "bill_portal_session";
export type PortalRole = "production" | "client";

type PortalSession = { username: string; role: PortalRole; expiresAt: number };

function portalEnvironment() {
  return env as unknown as Record<string, string | undefined>;
}

function encode(value: string) {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decode(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}

async function signature(payload: string) {
  const secret = portalEnvironment().PORTAL_SESSION_SECRET;
  if (!secret) throw new Error("Portal session security is not configured.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const result = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return encode(String.fromCharCode(...new Uint8Array(result)));
}

export function portalCredentials(role: PortalRole = "production") {
  const environment = portalEnvironment();
  if (role === "client") {
    return {
      username: environment.CLIENT_PORTAL_USERNAME || environment.PORTAL_USERNAME,
      password: environment.CLIENT_PORTAL_PASSWORD || environment.PORTAL_PASSWORD,
    };
  }
  return { username: environment.PORTAL_USERNAME, password: environment.PORTAL_PASSWORD };
}

export async function createPortalSession(username: string, role: PortalRole) {
  const payload = encode(JSON.stringify({ username, role, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 } satisfies PortalSession));
  return `${payload}.${await signature(payload)}`;
}

export async function verifyPortalSession(token?: string | null): Promise<PortalSession | null> {
  if (!token) return null;
  const [payload, suppliedSignature, ...rest] = token.split(".");
  if (!payload || !suppliedSignature || rest.length || suppliedSignature !== await signature(payload)) return null;
  try {
    const session = JSON.parse(decode(payload)) as Partial<PortalSession>;
    const role = session.role === "client" ? "client" : "production";
    return typeof session.username === "string" && typeof session.expiresAt === "number" && session.expiresAt > Date.now() ? { username: session.username, role, expiresAt: session.expiresAt } : null;
  } catch {
    return null;
  }
}
