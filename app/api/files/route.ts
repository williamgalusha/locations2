import { env } from "cloudflare:workers";

export const runtime = "edge";

function database() {
  if (!env.DB) throw new Error("The production database is not connected.");
  return env.DB;
}

function bucket() {
  if (!env.FILES) throw new Error("The production file library is not connected.");
  return env.FILES;
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return Response.json({ error: "Missing file key." }, { status: 400 });
  const object = await bucket().get(key);
  if (!object) return Response.json({ error: "File not found." }, { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("content-disposition", `inline; filename="${key.split("/").pop() ?? "file"}"`);
  return new Response(object.body, { headers });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const projectId = String(form.get("projectId") ?? "").trim();
    const category = String(form.get("category") ?? "Backup").trim();
    if (!(file instanceof File) || !projectId) return Response.json({ error: "Choose a file and project." }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return Response.json({ error: "Files must be smaller than 20 MB." }, { status: 413 });
    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "upload";
    const objectKey = `${projectId}/${id}-${safeName}`;
    await bucket().put(objectKey, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
    const now = new Date().toISOString();
    await database().batch([
      database().prepare("INSERT INTO file_assets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, projectId, objectKey, file.name, file.type || "application/octet-stream", file.size, category, "To code", now),
      database().prepare("INSERT INTO activities VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), projectId, "file", `${file.name} uploaded to backup`, "Jamie Rivera", now),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as { id?: string; key?: string; projectId?: string };
    if (!body.id || !body.key || !body.projectId) return Response.json({ error: "Missing file details." }, { status: 400 });
    await bucket().delete(body.key);
    await database().prepare("DELETE FROM file_assets WHERE id = ? AND project_id = ?").bind(body.id, body.projectId).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Delete failed." }, { status: 500 });
  }
}
