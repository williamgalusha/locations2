import { env } from "cloudflare:workers";
import { authorizePortalRequest, canAccessPortalProject } from "../../credential-auth";

export const runtime = "edge";

type BuilderAnswers = Record<string, string>;
type ScheduleRow = { time: string; endTime: string; runMinutes: string; event: string; board: string; look: string; talent: string; location: string; notes: string; type: string };
type Question = { id: string; prompt: string; reason: string; required: boolean };
type ScheduleResult = { ready: boolean; summary: string; assumptions: string[]; questions: Question[]; rows: ScheduleRow[]; source?: "assistant" | "rules"; warning?: string };

const rowSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    time: { type: "string" }, endTime: { type: "string" }, runMinutes: { type: "string" }, event: { type: "string" },
    board: { type: "string" }, look: { type: "string" }, talent: { type: "string" }, location: { type: "string" }, notes: { type: "string" },
    type: { type: "string", enum: ["call", "prep", "shoot", "social", "reset", "meal", "move", "wrap", "hold"] },
  },
  required: ["time", "endTime", "runMinutes", "event", "board", "look", "talent", "location", "notes", "type"],
};

const scheduleSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ready: { type: "boolean" },
    summary: { type: "string" },
    assumptions: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "object", additionalProperties: false, properties: { id: { type: "string" }, prompt: { type: "string" }, reason: { type: "string" }, required: { type: "boolean" } }, required: ["id", "prompt", "reason", "required"] } },
    rows: { type: "array", items: rowSchema },
  },
  required: ["ready", "summary", "assumptions", "questions", "rows"],
};

function database() {
  if (!env.DB) throw new Error("The production database is not connected.");
  return env.DB;
}

function runtimeValue(key: string) {
  const worker = env as unknown as Record<string, unknown>;
  const node: Record<string, string | undefined> = typeof process !== "undefined" ? process.env : {};
  return typeof worker[key] === "string" ? String(worker[key]) : node[key];
}

function safeProjectId(value: unknown) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate && /^[a-zA-Z0-9_-]{3,80}$/.test(candidate) ? candidate : "prj_harbor";
}

function text(value: unknown, fallback = "") { return typeof value === "string" ? value.trim().slice(0, 12000) : fallback; }

function objectOfStrings(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => typeof item === "string" ? [[key.slice(0, 80), item.slice(0, 12000)]] : []));
}

function outputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") return String((part as { text: string }).text);
  }
  return "";
}

function minutes(value: string, fallback: number) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : fallback;
}

function timeLabel(total: number) {
  const safe = Math.max(0, Math.min(1439, Math.round(total)));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function objectiveRows(value: string) {
  return value.split(/\n|;/).map((item) => item.trim()).filter(Boolean).slice(0, 30);
}

function fallbackSchedule(answers: BuilderAnswers, current: ScheduleRow[], mode: string, editRequest: string): ScheduleResult {
  if (mode === "edit" && current.length) {
    return { ready: true, summary: "Schedule revision prepared for review", assumptions: ["The edit request is recorded in Notes until the schedule assistant is available."], questions: [], rows: current, source: "rules", warning: `The schedule assistant is temporarily unavailable. Your edit request was saved: ${editRequest}` };
  }
  const productionCall = minutes(answers.productionCall || "06:30", 390);
  const crewCall = minutes(answers.crewCall || "07:30", productionCall + 60);
  const clientCall = minutes(answers.clientCall || "08:30", crewCall + 60);
  const firstShot = minutes(answers.firstShot || "09:30", clientCall + 60);
  const meal = minutes(answers.mealTime || "13:00", firstShot + 210);
  const wrap = minutes(answers.cameraWrap || "17:00", meal + 240);
  const hardOut = minutes(answers.hardOut || "18:00", wrap + 60);
  const location = answers.shootLocation || "Location TBD";
  const talent = answers.talent.split(/,|\n/)[0]?.trim() || "";
  const objectives = objectiveRows(answers.objectives);
  const shots = objectives.length ? objectives : ["FIRST SHOT · HERO SETUP", "SECOND SETUP", "FINAL SETUP"];
  const available = Math.max(30, meal - firstShot);
  const shotMinutes = Math.max(10, Math.floor(available / Math.max(shots.length, 1)) - 10);
  const rows: ScheduleRow[] = [
    { time: timeLabel(productionCall), endTime: "", runMinutes: "", event: "PRODUCTION & CATERING · CALL TIME AT LOCATION", board: "", look: "", talent: "", location, notes: "", type: "call" },
    { time: timeLabel(Math.max(productionCall, crewCall - 15)), endTime: "", runMinutes: "", event: "BREAKFAST RTS", board: "", look: "", talent: "", location, notes: "", type: "meal" },
    { time: timeLabel(crewCall), endTime: "", runMinutes: "", event: "CREW CALL · SETUP FOR FIRST SHOT", board: "", look: "", talent: "", location, notes: "", type: "call" },
    { time: timeLabel(clientCall), endTime: "", runMinutes: "", event: "CLIENT CALL AT LOCATION", board: "", look: "", talent: "", location, notes: "", type: "call" },
  ];
  let cursor = firstShot;
  shots.forEach((shot, index) => {
    const end = Math.min(meal, cursor + shotMinutes);
    rows.push({ time: timeLabel(cursor), endTime: timeLabel(end), runMinutes: String(Math.max(0, end - cursor)), event: shot.toUpperCase(), board: String(index + 1).padStart(2, "0"), look: "", talent, location, notes: "", type: "shoot" });
    cursor = end;
    if (index < shots.length - 1 && cursor + 10 < meal) {
      rows.push({ time: timeLabel(cursor), endTime: timeLabel(cursor + 10), runMinutes: "10", event: "RESET / TALENT CHANGE", board: "", look: "", talent, location, notes: "", type: "reset" });
      cursor += 10;
    }
  });
  rows.push(
    { time: timeLabel(meal), endTime: timeLabel(meal + 60), runMinutes: "60", event: "LUNCH RTS", board: "", look: "", talent: "", location, notes: "", type: "meal" },
    { time: timeLabel(wrap), endTime: "", runMinutes: "", event: "CAMERA WRAP", board: "", look: "", talent: "", location, notes: "", type: "wrap" },
    { time: timeLabel(hardOut), endTime: "", runMinutes: "", event: "HARD OUT / WALKAWAY", board: "", look: "", talent: "", location, notes: "", type: "wrap" },
  );
  return { ready: true, summary: `${rows.length} schedule items built from current project facts`, assumptions: ["Breakfast is scheduled 15 minutes before crew call.", "Lunch is scheduled for 60 minutes.", "Reset time is placed between major setups.", "Review talent, board, look, and set assignments before applying."], questions: [], rows, source: "rules", warning: "The schedule assistant is temporarily unavailable, so a rules-based draft was created for review." };
}

function normalizeResult(value: unknown): ScheduleResult | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const questions = Array.isArray(source.questions) ? source.questions.flatMap((question): Question[] => {
    if (!question || typeof question !== "object") return [];
    const item = question as Record<string, unknown>;
    const prompt = text(item.prompt); if (!prompt) return [];
    return [{ id: text(item.id, crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80), prompt: prompt.slice(0, 500), reason: text(item.reason).slice(0, 500), required: item.required === true }];
  }) : [];
  const rows = Array.isArray(source.rows) ? source.rows.slice(0, 200).flatMap((row): ScheduleRow[] => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>; const event = text(item.event); if (!event) return [];
    return [{ time: text(item.time).slice(0, 5), endTime: text(item.endTime).slice(0, 5), runMinutes: text(item.runMinutes).slice(0, 6), event: event.slice(0, 500), board: text(item.board).slice(0, 120), look: text(item.look).slice(0, 200), talent: text(item.talent).slice(0, 300), location: text(item.location).slice(0, 500), notes: text(item.notes).slice(0, 1000), type: text(item.type, "shoot") }];
  }) : [];
  return { ready: source.ready === true, summary: text(source.summary).slice(0, 1000), assumptions: Array.isArray(source.assumptions) ? source.assumptions.filter((item): item is string => typeof item === "string").map((item) => item.slice(0, 600)).slice(0, 30) : [], questions, rows, source: "assistant" };
}

async function buildWithAssistant(input: Record<string, unknown>) {
  const apiKey = runtimeValue("OPENAI_API_KEY"); if (!apiKey) return null;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: runtimeValue("OPENAI_SCHEDULE_MODEL") || runtimeValue("OPENAI_AUDIT_MODEL") || "gpt-5.6-terra",
      reasoning: { effort: "low" }, store: false, max_output_tokens: 4600,
      instructions: `You are a senior commercial-production 1st AD building a practical shooting schedule. Use only the supplied production facts and user answers. Ask concise follow-up questions only when a missing fact materially changes feasibility or timing; otherwise make clearly listed assumptions. Never invent a person, location, board, look, or contractual restriction. Return a chronological day schedule in 24-hour HH:mm time. The schedule should follow this proven hierarchy: production/catering call, breakfast, department calls and prep, client call, first shot, detailed setup rows, simultaneous social or talent-change rows where relevant, resets/moves, meal, camera wrap, reset/strike, and hard out. Each detailed row supports time, endTime, runMinutes, event, board, look, talent, location/set, notes, and type. Keep the schedule dense and operational. For edit mode, preserve unaffected rows, apply the requested change, recalculate all impacted times, and flag conflicts in assumptions. Do not mention OpenAI or the reference brand in the output.`,
      text: { verbosity: "low", format: { type: "json_schema", name: "production_schedule", strict: true, schema: scheduleSchema } },
      input: [{ role: "user", content: [{ type: "input_text", text: JSON.stringify(input).slice(0, 220000) }] }],
    }),
  });
  if (!response.ok) throw new Error(`Schedule assistant returned HTTP ${response.status}.`);
  try { return normalizeResult(JSON.parse(outputText(await response.json() as Record<string, unknown>))); } catch { return null; }
}

export async function POST(request: Request) {
  try {
    const authorization = await authorizePortalRequest(request);
    if (!authorization) return Response.json({ error: "Please log in to build a schedule." }, { status: 401 });
    if (authorization.role !== "production") return Response.json({ error: "Client logins cannot change the production schedule." }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const projectId = safeProjectId(body.projectId);
    if (!canAccessPortalProject(authorization, projectId)) return Response.json({ error: "This login does not have access to that project." }, { status: 403 });
    const mode = body.mode === "edit" ? "edit" : "build";
    const answers = objectOfStrings(body.answers);
    const clarifications = objectOfStrings(body.clarifications);
    const notes = text(body.notes);
    const editRequest = text(body.editRequest);
    const currentSchedule = Array.isArray(body.currentSchedule) ? normalizeResult({ ready: true, summary: "", assumptions: [], questions: [], rows: body.currentSchedule })?.rows || [] : [];
    const db = database();
    const [project, crew, locations, production] = await Promise.all([
      db.prepare("SELECT id, name, client, code, status, shoot_start, shoot_end FROM projects WHERE id = ? LIMIT 1").bind(projectId).first<Record<string, unknown>>(),
      db.prepare("SELECT data FROM module_records WHERE project_id = ? AND module = 'crew' ORDER BY created_at").bind(projectId).all<{ data: string }>(),
      db.prepare("SELECT name, city, address, status, availability, note FROM locations WHERE project_id = ? AND deleted_at = '' ORDER BY updated_at, name").bind(projectId).all<Record<string, unknown>>(),
      db.prepare("SELECT data FROM module_records WHERE project_id = ? AND module = 'production' ORDER BY created_at").bind(projectId).all<{ data: string }>(),
    ]);
    if (!project) return Response.json({ error: "Production not found." }, { status: 404 });
    const parseRecords = (rows: { data: string }[]) => rows.flatMap((row) => { try { return [JSON.parse(row.data) as Record<string, unknown>]; } catch { return []; } });
    const input = { mode, project, answers, clarifications, notes, editRequest, currentSchedule, crew: parseRecords(crew.results), locations: locations.results, productionItems: parseRecords(production.results) };
    let result: ScheduleResult | null = null;
    let warning = "";
    try { result = await buildWithAssistant(input); } catch (error) { warning = error instanceof Error ? error.message : "Schedule assistant could not be reached."; }
    if (!result) result = fallbackSchedule(answers, currentSchedule, mode, editRequest);
    if (warning && !result.warning) result.warning = `${warning} A reviewable fallback was created instead.`;
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The schedule could not be built." }, { status: 500 });
  }
}
