import {
  authorizePortalRequest,
  ensurePortalAuthSchema,
  hashPortalPassword,
  normalizePortalUsername,
  portalAuthDatabase,
  seedBootstrapAdmin,
  type PortalAccessLevel,
} from "../../credential-auth";

export const runtime = "edge";

type AccessUserRow = {
  id: string;
  username: string;
  display_name: string;
  access_level: PortalAccessLevel;
  active: number;
  created_at: string;
  updated_at: string;
};

async function adminRequest(request: Request) {
  await ensurePortalAuthSchema();
  await seedBootstrapAdmin();
  const authorization = await authorizePortalRequest(request);
  return authorization?.isAdmin ? authorization : null;
}

async function accessData() {
  const db = portalAuthDatabase();
  const [users, assignments, projects] = await Promise.all([
    db.prepare("SELECT id, username, display_name, access_level, active, created_at, updated_at FROM portal_users WHERE access_level != 'client' ORDER BY created_at, username").all<AccessUserRow>(),
    db.prepare("SELECT user_id, project_id FROM portal_user_projects WHERE permission = 'production' ORDER BY project_id").all<{ user_id: string; project_id: string }>(),
    db.prepare("SELECT id, name, client, code FROM projects ORDER BY created_at DESC").all<{ id: string; name: string; client: string; code: string }>(),
  ]);
  return {
    users: users.results.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      accessLevel: user.access_level,
      active: Boolean(user.active),
      projectIds: assignments.results.filter((assignment) => assignment.user_id === user.id).map((assignment) => assignment.project_id),
      updatedAt: user.updated_at,
    })),
    projects: projects.results,
  };
}

export async function GET(request: Request) {
  try {
    if (!(await adminRequest(request))) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    return Response.json(await accessData());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load portal access." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const administrator = await adminRequest(request);
    if (!administrator) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    const db = portalAuthDatabase();
    const now = new Date().toISOString();

    if (action === "save_user") {
      const id = typeof body.id === "string" ? body.id : "";
      const username = normalizePortalUsername(typeof body.username === "string" ? body.username : "");
      const displayName = typeof body.displayName === "string" && body.displayName.trim() ? body.displayName.trim() : username;
      const password = typeof body.password === "string" ? body.password : "";
      const accessLevel: PortalAccessLevel = body.accessLevel === "admin" || body.accessLevel === "full" ? body.accessLevel : "project";
      const requestedProjects = Array.isArray(body.projectIds) ? body.projectIds.filter((value): value is string => typeof value === "string") : [];
      if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) throw new Error("Use at least 3 letters or numbers for the username.");
      const existing = id ? await db.prepare("SELECT id, access_level FROM portal_users WHERE id = ? LIMIT 1").bind(id).first<{ id: string; access_level: PortalAccessLevel }>() : null;
      if (existing?.access_level === "client") throw new Error("Client logins are managed inside their project.");
      if (id === administrator.userId && accessLevel !== "admin") throw new Error("You cannot remove your own administrator access.");
      const conflict = await db.prepare("SELECT id FROM portal_users WHERE username = ? LIMIT 1").bind(username).first<{ id: string }>();
      if (conflict && conflict.id !== id) throw new Error("That username is already in use.");
      const projectResult = await db.prepare("SELECT id FROM projects").all<{ id: string }>();
      const validProjects = new Set(projectResult.results.map((project) => project.id));
      const projectIds = [...new Set(requestedProjects)].filter((projectId) => validProjects.has(projectId));
      if (accessLevel === "project" && projectIds.length === 0) throw new Error("Choose at least one project for project-only access.");

      let userId = id;
      if (existing) {
        await db.prepare("UPDATE portal_users SET username = ?, display_name = ?, access_level = ?, active = 1, updated_at = ? WHERE id = ?").bind(username, displayName, accessLevel, now, id).run();
        if (password) {
          const credentials = await hashPortalPassword(password);
          await db.prepare("UPDATE portal_users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?").bind(credentials.hash, credentials.salt, now, id).run();
        }
      } else {
        if (!password) throw new Error("Enter a password for the new user.");
        const credentials = await hashPortalPassword(password);
        userId = crypto.randomUUID();
        await db.prepare("INSERT INTO portal_users (id, username, display_name, password_hash, password_salt, access_level, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)").bind(userId, username, displayName, credentials.hash, credentials.salt, accessLevel, now, now).run();
      }

      await db.prepare("DELETE FROM portal_user_projects WHERE user_id = ? AND permission = 'production'").bind(userId).run();
      if (accessLevel === "project" && projectIds.length) {
        await db.batch(projectIds.map((projectId) => db.prepare("INSERT INTO portal_user_projects (user_id, project_id, permission, created_at) VALUES (?, ?, 'production', ?)").bind(userId, projectId, now)));
      }
    } else if (action === "set_user_active") {
      const id = typeof body.id === "string" ? body.id : "";
      const active = body.active === true;
      if (!id) throw new Error("Choose a portal user.");
      if (id === administrator.userId && !active) throw new Error("You cannot disable your own administrator login.");
      await db.prepare("UPDATE portal_users SET active = ?, updated_at = ? WHERE id = ? AND access_level != 'client'").bind(active ? 1 : 0, now, id).run();
    } else {
      return Response.json({ error: "Unknown access action." }, { status: 400 });
    }

    return Response.json(await accessData());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save portal access." }, { status: 500 });
  }
}
