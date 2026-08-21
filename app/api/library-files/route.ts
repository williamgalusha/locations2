import { env } from "cloudflare:workers";
import { authorizePortalRequest } from "../../credential-auth";

export const runtime = "edge";

function database() {
  if (!env.DB) throw new Error("The production database is not connected.");
  return env.DB;
}

function bucket() {
  if (!env.FILES) throw new Error("The production file library is not connected.");
  return env.FILES;
}

async function ensureLibrarySchema() {
  await database().batch([
    database().prepare(`CREATE TABLE IF NOT EXISTS library_files (
      id TEXT PRIMARY KEY, object_key TEXT NOT NULL UNIQUE, filename TEXT NOT NULL,
      content_type TEXT NOT NULL, size REAL NOT NULL, category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', uploaded_by TEXT NOT NULL, created_at TEXT NOT NULL
    )`),
    database().prepare("CREATE INDEX IF NOT EXISTS idx_library_files_category_created ON library_files (category, created_at)"),
  ]);
}

export async function GET(request: Request) {
  try {
    const authorization = await authorizePortalRequest(request);
    if (!authorization) return Response.json({ error: "Please log in to open the library." }, { status: 401 });
    if (authorization.role !== "production") return Response.json({ error: "The company library is available to production users only." }, { status: 403 });
    await ensureLibrarySchema();
    const key = new URL(request.url).searchParams.get("key");
    if (key) {
      if (!key.startsWith("library/")) return Response.json({ error: "That library file is not available." }, { status: 403 });
      const record = await database().prepare("SELECT filename FROM library_files WHERE object_key = ? LIMIT 1").bind(key).first<{ filename: string }>();
      if (!record) return Response.json({ error: "Library file not found." }, { status: 404 });
      const object = await bucket().get(key);
      if (!object) return Response.json({ error: "Library file not found." }, { status: 404 });
      const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("etag", object.httpEtag);
      headers.set("content-disposition", `inline; filename="${record.filename.replace(/[^a-zA-Z0-9._ -]+/g, "-")}"`);
      return new Response(object.body, { headers });
    }
    const files = await database().prepare("SELECT * FROM library_files ORDER BY category, created_at DESC").all();
    return Response.json({ files: files.results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The library could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let uploadedKey = "";
  try {
    const authorization = await authorizePortalRequest(request);
    if (!authorization) return Response.json({ error: "Please log in to upload library files." }, { status: 401 });
    if (!authorization.isAdmin) return Response.json({ error: "Only administrators can add company templates and guides." }, { status: 403 });
    await ensureLibrarySchema();
    const form = await request.formData();
    const file = form.get("file");
    const category = String(form.get("category") || "Templates").trim();
    const description = String(form.get("description") || "").trim();
    if (!(file instanceof File)) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return Response.json({ error: "Files must be smaller than 20 MB." }, { status: 413 });
    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "library-file";
    const objectKey = `library/${id}-${safeName}`;
    await bucket().put(objectKey, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
    uploadedKey = objectKey;
    await database().prepare("INSERT INTO library_files (id, object_key, filename, content_type, size, category, description, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, objectKey, file.name, file.type || "application/octet-stream", file.size, category, description, authorization.displayName, new Date().toISOString()).run();
    const files = await database().prepare("SELECT * FROM library_files ORDER BY category, created_at DESC").all();
    return Response.json({ files: files.results });
  } catch (error) {
    if (uploadedKey) await bucket().delete(uploadedKey).catch(() => undefined);
    return Response.json({ error: error instanceof Error ? error.message : "The file could not be uploaded." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authorization = await authorizePortalRequest(request);
    if (!authorization) return Response.json({ error: "Please log in to manage library files." }, { status: 401 });
    if (!authorization.isAdmin) return Response.json({ error: "Only administrators can remove company library files." }, { status: 403 });
    await ensureLibrarySchema();
    const body = await request.json() as { id?: string };
    if (!body.id) return Response.json({ error: "Choose a library file." }, { status: 400 });
    const file = await database().prepare("SELECT object_key FROM library_files WHERE id = ? LIMIT 1").bind(body.id).first<{ object_key: string }>();
    if (!file) return Response.json({ error: "Library file not found." }, { status: 404 });
    await bucket().delete(file.object_key);
    await database().prepare("DELETE FROM library_files WHERE id = ?").bind(body.id).run();
    const files = await database().prepare("SELECT * FROM library_files ORDER BY category, created_at DESC").all();
    return Response.json({ files: files.results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The file could not be removed." }, { status: 500 });
  }
}
