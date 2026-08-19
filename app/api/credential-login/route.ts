import { createPortalSession, portalCredentials, PORTAL_SESSION_COOKIE, type PortalRole } from "../../credential-auth";

export const runtime = "edge";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { username?: unknown; password?: unknown; role?: unknown };
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role: PortalRole = body.role === "client" ? "client" : "production";
  const configured = portalCredentials(role);
  if (!configured.username || !configured.password) return Response.json({ error: `${role === "client" ? "Client" : "Production"} login is not configured.` }, { status: 503 });
  if (username !== configured.username || password !== configured.password) return Response.json({ error: "That username or password is not correct." }, { status: 401 });
  const session = await createPortalSession(username, role);
  return Response.json({ ok: true, user: { name: username, email: role === "client" ? "Client portal" : "Production portal", credential: true, role } }, {
    headers: { "Set-Cookie": `${PORTAL_SESSION_COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800` },
  });
}

export async function DELETE() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": `${PORTAL_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` } });
}
