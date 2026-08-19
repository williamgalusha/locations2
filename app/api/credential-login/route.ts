import { authenticatePortalUser, createPortalSession, PORTAL_SESSION_COOKIE, type PortalRole } from "../../credential-auth";

export const runtime = "edge";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { username?: unknown; password?: unknown; role?: unknown };
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role: PortalRole = body.role === "client" ? "client" : "production";
  const authorization = await authenticatePortalUser(username, password, role).catch(() => null);
  if (!authorization) return Response.json({ error: "That username or password is not correct for this portal." }, { status: 401 });
  const session = await createPortalSession(authorization);
  return Response.json({ ok: true, user: { name: authorization.displayName, email: authorization.username, credential: true, role, accessLevel: authorization.accessLevel, projectIds: authorization.projectIds } }, {
    headers: { "Set-Cookie": `${PORTAL_SESSION_COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800` },
  });
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": `${PORTAL_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } });
}
