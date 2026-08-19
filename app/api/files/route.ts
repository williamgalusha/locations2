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
  let uploadedKey = "";
  try {
    const form = await request.formData();
    const file = form.get("file");
    const projectId = String(form.get("projectId") ?? "").trim();
    const category = String(form.get("category") ?? "Backup").trim();
    const budgetLineId = String(form.get("budgetLineId") ?? "").trim();
    const vendor = String(form.get("vendor") ?? "").trim();
    const amount = Number(form.get("amount") ?? 0);
    const spendDate = String(form.get("spendDate") ?? "").trim();
    const memo = String(form.get("memo") ?? "").trim();
    const isBackup = category.toLowerCase() === "backup";
    if (!(file instanceof File) || !projectId) return Response.json({ error: "Choose a file and project." }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return Response.json({ error: "Files must be smaller than 20 MB." }, { status: 413 });
    if (isBackup && (!budgetLineId || !vendor || !Number.isFinite(amount) || amount <= 0 || !spendDate)) return Response.json({ error: "Choose a budget line and enter the receipt vendor, amount, and date." }, { status: 400 });
    const budgetLine = isBackup ? await database().prepare("SELECT item_code FROM budget_lines WHERE id = ? AND project_id = ?").bind(budgetLineId, projectId).first<{ item_code: string }>() : null;
    if (isBackup && !budgetLine) return Response.json({ error: "That budget line is not available for this production." }, { status: 400 });
    const id = crypto.randomUUID();
    const expenseId = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "upload";
    const objectKey = `${projectId}/${id}-${safeName}`;
    await bucket().put(objectKey, file.stream(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
    uploadedKey = objectKey;
    const now = new Date().toISOString();
    const statements = [
      database().prepare("INSERT INTO file_assets (id, project_id, object_key, filename, content_type, size, category, status, budget_line_id, expense_id, vendor, amount, spend_date, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, projectId, objectKey, file.name, file.type || "application/octet-stream", file.size, category, isBackup ? "needs_review" : "uploaded", isBackup ? budgetLineId : "", isBackup ? expenseId : "", isBackup ? vendor : "", isBackup ? amount : 0, isBackup ? spendDate : "", isBackup ? memo : "", now),
      database().prepare("INSERT INTO activities VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), projectId, "file", isBackup ? `${file.name} uploaded and allocated to ${budgetLine?.item_code || "budget"}` : `${file.name} uploaded to ${category}`, "Jamie Rivera", now),
    ];
    if (isBackup) statements.splice(1, 0,
      database().prepare("INSERT INTO expenses VALUES (?, ?, ?, ?, ?, ?, 'needs_review', ?, ?)").bind(expenseId, projectId, budgetLineId, vendor, amount, spendDate, memo || `Backup: ${file.name}`, now),
      database().prepare("UPDATE budget_lines SET actual = actual + ? WHERE id = ? AND project_id = ?").bind(amount, budgetLineId, projectId),
    );
    await database().batch(statements);
    return Response.json({ ok: true, key: objectKey, expenseId: isBackup ? expenseId : null, url: `/api/files?key=${encodeURIComponent(objectKey)}` });
  } catch (error) {
    if (uploadedKey) await bucket().delete(uploadedKey).catch(() => undefined);
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
