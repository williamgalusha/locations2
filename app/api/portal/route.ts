import { env } from "cloudflare:workers";
import { authorizePortalRequest, canAccessPortalProject, ensurePortalAuthSchema, hashPortalPassword, normalizePortalUsername, type PortalAuthorization } from "../../credential-auth";

export const runtime = "edge";

const FALLBACK_PROJECT_ID = "prj_harbor";
const MODULES = new Set(["crew", "travel", "schedule", "production", "client_share"]);

type ActionBody = { action?: string; projectId?: unknown; [key: string]: unknown };

function database() {
  if (!env.DB) throw new Error("The production database is not connected.");
  return env.DB;
}

function safeProjectId(value: unknown) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate && /^[a-zA-Z0-9_-]{3,80}$/.test(candidate) ? candidate : FALLBACK_PROJECT_ID;
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function signedNumberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actorFromRequest(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email");
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const encoding = request.headers.get("oai-authenticated-user-full-name-encoding");
  if (encodedName && encoding === "percent-encoded-utf-8") {
    try { return decodeURIComponent(encodedName); } catch { /* use email */ }
  }
  return email || "Jamie Rivera";
}

async function ensureSchema() {
  const db = database();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, client TEXT NOT NULL,
      code TEXT NOT NULL, status TEXT NOT NULL, shoot_start TEXT NOT NULL,
      shoot_end TEXT NOT NULL, currency TEXT NOT NULL, created_at TEXT NOT NULL,
      contact TEXT NOT NULL DEFAULT '', contact_email TEXT NOT NULL DEFAULT '',
      billing_address TEXT NOT NULL DEFAULT '', po_no TEXT NOT NULL DEFAULT '',
      budget_notes TEXT NOT NULL DEFAULT '', budget_changes TEXT NOT NULL DEFAULT '',
      markup_pct REAL NOT NULL DEFAULT 10, insurance_pct REAL NOT NULL DEFAULT 5
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS budget_lines (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, category TEXT NOT NULL,
      description TEXT NOT NULL, estimate REAL NOT NULL, actual REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, section_code TEXT NOT NULL DEFAULT '',
      item_code TEXT NOT NULL DEFAULT '', item_name TEXT NOT NULL DEFAULT '',
      rate REAL NOT NULL DEFAULT 0, quantity REAL NOT NULL DEFAULT 1,
      days REAL NOT NULL DEFAULT 1, tax_pct REAL NOT NULL DEFAULT 0,
      is_na REAL NOT NULL DEFAULT 0, na_note TEXT NOT NULL DEFAULT ''
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS budget_versions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL,
      status TEXT NOT NULL, snapshot TEXT NOT NULL, created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, budget_line_id TEXT NOT NULL,
      vendor TEXT NOT NULL, amount REAL NOT NULL, spend_date TEXT NOT NULL,
      status TEXT NOT NULL, memo TEXT NOT NULL, created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL,
      city TEXT NOT NULL, rate REAL NOT NULL, status TEXT NOT NULL,
      image_url TEXT NOT NULL, tags TEXT NOT NULL, note TEXT NOT NULL,
      client_note TEXT NOT NULL, updated_at TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Uncategorized', square_feet TEXT NOT NULL DEFAULT '—',
      availability TEXT NOT NULL DEFAULT 'Availability Pending', blurb TEXT NOT NULL DEFAULT '',
      gallery TEXT NOT NULL DEFAULT '[]', deleted_at TEXT NOT NULL DEFAULT '',
      client_visible REAL NOT NULL DEFAULT 1
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, kind TEXT NOT NULL,
      message TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS module_records (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, module TEXT NOT NULL,
      data TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS file_assets (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, object_key TEXT NOT NULL,
      filename TEXT NOT NULL, content_type TEXT NOT NULL, size REAL NOT NULL,
      category TEXT NOT NULL, status TEXT NOT NULL,
      budget_line_id TEXT NOT NULL DEFAULT '', expense_id TEXT NOT NULL DEFAULT '',
      vendor TEXT NOT NULL DEFAULT '', amount REAL NOT NULL DEFAULT 0,
      spend_date TEXT NOT NULL DEFAULT '', memo TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS budget_audits (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source TEXT NOT NULL,
      status TEXT NOT NULL, summary TEXT NOT NULL, notes TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS budget_project_idx ON budget_lines (project_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS budget_version_project_idx ON budget_versions (project_id, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS expense_project_idx ON expenses (project_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS location_project_idx ON locations (project_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS activity_project_idx ON activities (project_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS module_project_idx ON module_records (project_id, module)"),
    db.prepare("CREATE INDEX IF NOT EXISTS file_project_idx ON file_assets (project_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS audit_project_idx ON budget_audits (project_id, created_at)"),
  ]);
  const additions = [
    ["projects", "contact TEXT NOT NULL DEFAULT ''"], ["projects", "contact_email TEXT NOT NULL DEFAULT ''"],
    ["projects", "billing_address TEXT NOT NULL DEFAULT ''"], ["projects", "po_no TEXT NOT NULL DEFAULT ''"],
    ["projects", "budget_notes TEXT NOT NULL DEFAULT ''"], ["projects", "budget_changes TEXT NOT NULL DEFAULT ''"],
    ["projects", "markup_pct REAL NOT NULL DEFAULT 10"], ["projects", "insurance_pct REAL NOT NULL DEFAULT 5"],
    ["budget_lines", "section_code TEXT NOT NULL DEFAULT ''"], ["budget_lines", "item_code TEXT NOT NULL DEFAULT ''"],
    ["budget_lines", "item_name TEXT NOT NULL DEFAULT ''"], ["budget_lines", "rate REAL NOT NULL DEFAULT 0"],
    ["budget_lines", "quantity REAL NOT NULL DEFAULT 1"], ["budget_lines", "days REAL NOT NULL DEFAULT 1"],
    ["budget_lines", "tax_pct REAL NOT NULL DEFAULT 0"], ["budget_lines", "is_na REAL NOT NULL DEFAULT 0"],
    ["budget_lines", "na_note TEXT NOT NULL DEFAULT ''"], ["locations", "category TEXT NOT NULL DEFAULT 'Uncategorized'"],
    ["locations", "square_feet TEXT NOT NULL DEFAULT '—'"], ["locations", "availability TEXT NOT NULL DEFAULT 'Availability Pending'"],
    ["locations", "blurb TEXT NOT NULL DEFAULT ''"], ["locations", "gallery TEXT NOT NULL DEFAULT '[]'"],
    ["locations", "deleted_at TEXT NOT NULL DEFAULT ''"], ["locations", "client_visible REAL NOT NULL DEFAULT 1"],
    ["file_assets", "budget_line_id TEXT NOT NULL DEFAULT ''"], ["file_assets", "expense_id TEXT NOT NULL DEFAULT ''"],
    ["file_assets", "vendor TEXT NOT NULL DEFAULT ''"], ["file_assets", "amount REAL NOT NULL DEFAULT 0"],
    ["file_assets", "spend_date TEXT NOT NULL DEFAULT ''"], ["file_assets", "memo TEXT NOT NULL DEFAULT ''"],
  ];
  for (const [table, column] of additions) {
    try { await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column}`).run(); } catch { /* column already exists */ }
  }
  await db.prepare("UPDATE budget_lines SET rate = estimate, quantity = 1, days = 1 WHERE rate = 0 AND estimate > 0").run();
}

async function seedIfNeeded() {
  const db = database();
  const createdAt = "2026-08-19T13:30:00.000Z";
  const primary = await db.prepare("SELECT id FROM projects WHERE id = ? LIMIT 1").bind(FALLBACK_PROJECT_ID).first();
  if (!primary) {
    await db.batch([
      db.prepare("INSERT INTO projects (id, name, client, code, status, shoot_start, shoot_end, currency, created_at, contact, contact_email, billing_address, po_no, budget_notes, budget_changes, markup_pct, insurance_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(FALLBACK_PROJECT_ID, "Aperture / Fall ’26", "Aperture Athletics", "AA-026", "Pre-production", "2026-09-14", "2026-09-17", "USD", createdAt, "Maya Chen", "maya@aperture.test", "120 Franklin St, Brooklyn, NY 11222", "TBC", "Four-day photo and motion production across New York.", "Crew and camera package adjusted following agency review.", 10, 5),
      db.prepare("INSERT INTO budget_lines (id, project_id, category, description, estimate, actual, created_at, section_code, item_code, item_name, rate, quantity, days, tax_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("bl_prepro", FALLBACK_PROJECT_ID, "Pre-production", "Prep, casting & tech scouts", 28500, 21750, createdAt, "A", "A1", "Production prep", 28500, 1, 1, 0),
      db.prepare("INSERT INTO budget_lines (id, project_id, category, description, estimate, actual, created_at, section_code, item_code, item_name, rate, quantity, days, tax_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("bl_crew", FALLBACK_PROJECT_ID, "Crew", "Director, camera & production crew", 78500, 62340, createdAt, "B", "B1", "Production crew", 78500, 1, 1, 0),
      db.prepare("INSERT INTO budget_lines (id, project_id, category, description, estimate, actual, created_at, section_code, item_code, item_name, rate, quantity, days, tax_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("bl_equipment", FALLBACK_PROJECT_ID, "Equipment", "Camera, lighting & grip", 41200, 38960, createdAt, "C", "C1", "Equipment package", 41200, 1, 1, 0),
      db.prepare("INSERT INTO budget_lines (id, project_id, category, description, estimate, actual, created_at, section_code, item_code, item_name, rate, quantity, days, tax_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("bl_locations", FALLBACK_PROJECT_ID, "Locations", "Permits, fees & site services", 32750, 19400, createdAt, "D", "D1", "Location fees", 32750, 1, 1, 0),
      db.prepare("INSERT INTO budget_lines (id, project_id, category, description, estimate, actual, created_at, section_code, item_code, item_name, rate, quantity, days, tax_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("bl_art", FALLBACK_PROJECT_ID, "Art department", "Set dressing, props & wardrobe", 38550, 24820, createdAt, "E", "E1", "Art department", 38550, 1, 1, 0),
      db.prepare("INSERT INTO budget_lines (id, project_id, category, description, estimate, actual, created_at, section_code, item_code, item_name, rate, quantity, days, tax_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("bl_post", FALLBACK_PROJECT_ID, "Post-production", "Edit, color, sound & delivery", 29000, 9600, createdAt, "F", "F1", "Post-production", 29000, 1, 1, 0),
      db.prepare("INSERT INTO expenses VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("ex_1", FALLBACK_PROJECT_ID, "bl_equipment", "Prism Camera Co.", 14860, "2026-08-18", "matched", "Camera package deposit", createdAt),
      db.prepare("INSERT INTO expenses VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("ex_2", FALLBACK_PROJECT_ID, "bl_locations", "City Film Office", 4200, "2026-08-18", "needs_review", "Street closure permit", createdAt),
      db.prepare("INSERT INTO expenses VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("ex_3", FALLBACK_PROJECT_ID, "bl_art", "North & Pine Rentals", 6840, "2026-08-17", "matched", "Hero set furniture", createdAt),
      db.prepare("INSERT INTO expenses VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("ex_4", FALLBACK_PROJECT_ID, "bl_crew", "Collective Payroll", 18300, "2026-08-16", "pending", "Week one payroll reserve", createdAt),
      db.prepare("INSERT INTO locations (id, project_id, name, city, rate, status, image_url, tags, note, client_note, updated_at, category, square_feet, availability, blurb, gallery, deleted_at, client_visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 1)").bind("loc_1", FALLBACK_PROJECT_ID, "The Glass House", "Hudson Valley, NY", 7200, "shortlisted", "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=85", "Modern|Daylight|Hero option", "South-facing glass, easy load-in, quiet road access.", "Strongest architectural match for the campaign boards.", createdAt, "Residential", "6,800", "First hold available", "Sculptural modernist home with exceptional south-facing daylight.", JSON.stringify(["https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=85"])),
      db.prepare("INSERT INTO locations (id, project_id, name, city, rate, status, image_url, tags, note, client_note, updated_at, category, square_feet, availability, blurb, gallery, deleted_at, client_visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 1)").bind("loc_2", FALLBACK_PROJECT_ID, "Ridge Court", "Cold Spring, NY", 5400, "approved", "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=85", "Athletic|Mountain view|Backup", "Private court with clean sightlines and basecamp space.", "Approved for the movement sequence and sunrise setup.", createdAt, "Athletic", "12,000", "Confirmed Sep 15", "Private court with clean sightlines and a dramatic mountain backdrop.", JSON.stringify(["https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=85"])),
      db.prepare("INSERT INTO locations (id, project_id, name, city, rate, status, image_url, tags, note, client_note, updated_at, category, square_feet, availability, blurb, gallery, deleted_at, client_visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 1)").bind("loc_3", FALLBACK_PROJECT_ID, "Foundry No. 4", "Brooklyn, NY", 8600, "review", "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=85", "Industrial|Rain cover|Power", "Large industrial floor, three-phase power, controllable daylight.", "Alternate for weather cover; art direction pass required.", createdAt, "Industrial", "18,500", "Second hold", "A large industrial floor with controllable daylight and three-phase power.", JSON.stringify(["https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=85"])),
      db.prepare("INSERT INTO activities VALUES (?, ?, ?, ?, ?, ?)").bind("ac_1", FALLBACK_PROJECT_ID, "location", "Ridge Court approved for sequence 03", "Maya Chen · Client", "2026-08-19T13:18:00.000Z"),
      db.prepare("INSERT INTO activities VALUES (?, ?, ?, ?, ?, ?)").bind("ac_2", FALLBACK_PROJECT_ID, "budget", "Camera package deposit reconciled", "Jamie Rivera", "2026-08-19T12:46:00.000Z"),
      db.prepare("INSERT INTO activities VALUES (?, ?, ?, ?, ?, ?)").bind("ac_3", FALLBACK_PROJECT_ID, "expense", "Street closure permit flagged for review", "Alex Morgan", "2026-08-19T11:32:00.000Z"),
    ]);
  }

  const secondary = await db.prepare("SELECT id FROM projects WHERE id = 'prj_morrow'").first();
  if (!secondary) {
    await db.batch([
      db.prepare("INSERT INTO projects (id, name, client, code, status, shoot_start, shoot_end, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("prj_morrow", "Morrow / Holiday ’26", "Morrow House", "MH-041", "On hold", "2026-10-03", "2026-10-05", "USD", createdAt),
      db.prepare("INSERT INTO budget_lines (id, project_id, category, description, estimate, actual, created_at, section_code, item_code, item_name, rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("mh_prepro", "prj_morrow", "Pre-production", "Casting, scout & prep", 18500, 9200, createdAt, "A", "A1", "Production prep", 18500),
      db.prepare("INSERT INTO budget_lines (id, project_id, category, description, estimate, actual, created_at, section_code, item_code, item_name, rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("mh_crew", "prj_morrow", "Crew", "Photo and motion units", 54500, 14750, createdAt, "B", "B1", "Production crew", 54500),
      db.prepare("INSERT INTO budget_lines (id, project_id, category, description, estimate, actual, created_at, section_code, item_code, item_name, rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind("mh_post", "prj_morrow", "Post-production", "Edit, grade & delivery", 22600, 0, createdAt, "C", "C1", "Post-production", 22600),
      db.prepare("INSERT INTO activities VALUES (?, ?, ?, ?, ?, ?)").bind("mh_ac1", "prj_morrow", "project", "Production placed on client hold", "Jamie Rivera", "2026-08-18T16:20:00.000Z"),
    ]);
  }

  const moduleCount = await db.prepare("SELECT COUNT(*) AS count FROM module_records WHERE project_id = ?").bind(FALLBACK_PROJECT_ID).first<{ count: number }>();
  if (!moduleCount?.count) {
    const records = [
      ["mr_c1", "crew", { name: "Alex Morgan", role: "Line Producer", email: "alex@production.test", phone: "917 555 0198", dietary: "—", callTime: "6:00 AM", callLocation: "Basecamp" }],
      ["mr_c2", "crew", { name: "Samira Cole", role: "Director of Photography", email: "samira@production.test", phone: "646 555 0134", dietary: "Vegetarian", callTime: "6:30 AM", callLocation: "Ridge Court" }],
      ["mr_c3", "crew", { name: "Theo Park", role: "1st AD", email: "theo@production.test", phone: "347 555 0112", dietary: "Gluten free", callTime: "5:45 AM", callLocation: "Basecamp" }],
      ["mr_t1", "travel", { type: "Flight", traveler: "Samira Cole", detail: "JFK → ALB · DL 4821", timing: "Sep 13 · 3:10 PM", status: "Confirmed" }],
      ["mr_t2", "travel", { type: "Hotel", traveler: "Theo Park", detail: "The Wick · 4 nights", timing: "Sep 13–17", status: "Booked" }],
      ["mr_s1", "schedule", { time: "05:45", event: "Production call", location: "Basecamp · Ridge Court" }],
      ["mr_s2", "schedule", { time: "06:30", event: "Crew call / breakfast", location: "Ridge Court" }],
      ["mr_s3", "schedule", { time: "07:20", event: "First setup — movement sequence", location: "North court" }],
      ["mr_p1", "production", { section: "Open items", item: "Confirm rain cover hold", owner: "Alex", status: "In progress" }],
      ["mr_p2", "production", { section: "Vendors", item: "Lock hero wardrobe delivery", owner: "Jamie", status: "Done" }],
      ["mr_sh1", "client_share", { kind: "Budget", label: "Production Estimate · V7", date: "Aug 19", status: "Shared" }],
      ["mr_sh2", "client_share", { kind: "Locations", label: "Location Shortlist · Round 2", date: "Aug 19", status: "Shared" }],
    ] as const;
    await db.batch(records.map(([id, module, data]) => db.prepare("INSERT INTO module_records VALUES (?, ?, ?, ?, ?, ?)").bind(id, FALLBACK_PROJECT_ID, module, JSON.stringify(data), createdAt, createdAt)));
  }

  const versionCount = await db.prepare("SELECT COUNT(*) AS count FROM budget_versions WHERE project_id = ?").bind(FALLBACK_PROJECT_ID).first<{ count: number }>();
  if (!versionCount?.count) {
    const v6 = [
      { id: "bl_prepro", category: "Pre-production", description: "Prep, casting & tech scouts", estimate: 27100 },
      { id: "bl_crew", category: "Crew", description: "Director, camera & production crew", estimate: 74200 },
      { id: "bl_equipment", category: "Equipment", description: "Camera, lighting & grip", estimate: 39800 },
      { id: "bl_locations", category: "Locations", description: "Permits, fees & site services", estimate: 28750 },
      { id: "bl_art", category: "Art department", description: "Set dressing, props & wardrobe", estimate: 36550 },
      { id: "bl_post", category: "Post-production", description: "Edit, color, sound & delivery", estimate: 29000 },
    ];
    const current = await db.prepare("SELECT id, category, description, estimate, section_code, item_code, item_name, rate, quantity, days, tax_pct, is_na, na_note FROM budget_lines WHERE project_id = ? ORDER BY created_at, category").bind(FALLBACK_PROJECT_ID).all();
    await db.batch([
      db.prepare("INSERT INTO budget_versions VALUES (?, ?, ?, ?, ?, ?)").bind("bv_v6", FALLBACK_PROJECT_ID, "V6 · Agency review", "archived", JSON.stringify(v6), "2026-08-16T15:20:00.000Z"),
      db.prepare("INSERT INTO budget_versions VALUES (?, ?, ?, ?, ?, ?)").bind("bv_v7", FALLBACK_PROJECT_ID, "V7 · Confirmed estimate", "confirmed", JSON.stringify(current.results), "2026-08-19T12:00:00.000Z"),
    ]);
  }
}

async function portalData(projectId: string, authorization: PortalAuthorization) {
  const db = database();
  const projectsResult = await db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
  const projects = projectsResult.results.filter((project) => canAccessPortalProject(authorization, String(project.id)));
  const chosen = projects.some((project) => project.id === projectId) ? projectId : String(projects[0]?.id ?? "");
  if (!chosen) throw new Error("No projects have been assigned to this login.");
  const [project, budgetResult, versionResult, expenseResult, locationResult, activityResult, moduleResult, fileResult, auditResult, clientCredential] = await Promise.all([
    db.prepare("SELECT * FROM projects WHERE id = ?").bind(chosen).first(),
    db.prepare("SELECT * FROM budget_lines WHERE project_id = ? ORDER BY created_at, category").bind(chosen).all(),
    db.prepare("SELECT * FROM budget_versions WHERE project_id = ? ORDER BY created_at DESC").bind(chosen).all(),
    db.prepare("SELECT * FROM expenses WHERE project_id = ? ORDER BY spend_date DESC, created_at DESC").bind(chosen).all(),
    db.prepare("SELECT * FROM locations WHERE project_id = ? ORDER BY CASE status WHEN 'approved' THEN 1 WHEN 'shortlisted' THEN 2 ELSE 3 END, updated_at DESC").bind(chosen).all(),
    db.prepare("SELECT * FROM activities WHERE project_id = ? ORDER BY created_at DESC LIMIT 40").bind(chosen).all(),
    db.prepare("SELECT * FROM module_records WHERE project_id = ? ORDER BY created_at").bind(chosen).all(),
    db.prepare("SELECT * FROM file_assets WHERE project_id = ? ORDER BY created_at DESC").bind(chosen).all(),
    db.prepare("SELECT * FROM budget_audits WHERE project_id = ? ORDER BY created_at DESC LIMIT 20").bind(chosen).all(),
    db.prepare("SELECT u.username, u.active, u.updated_at FROM portal_users u INNER JOIN portal_user_projects up ON up.user_id = u.id WHERE up.project_id = ? AND u.access_level = 'client' LIMIT 1").bind(chosen).first(),
  ]);
  const records = moduleResult.results.map((record) => ({ ...record, data: JSON.parse(String(record.data || "{}")) }));
  const budgetVersions = versionResult.results.map((version) => ({ ...version, snapshot: JSON.parse(String(version.snapshot || "[]")) }));
  return {
    projects,
    project,
    budgetLines: budgetResult.results,
    budgetVersions,
    expenses: expenseResult.results,
    locations: locationResult.results,
    activities: activityResult.results,
    files: fileResult.results,
    audits: auditResult.results,
    records,
    clientCredential: clientCredential || null,
  };
}

async function logActivity(projectId: string, kind: string, message: string, actor: string) {
  await database().prepare("INSERT INTO activities VALUES (?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), projectId, kind, message, actor, new Date().toISOString()).run();
}

export async function GET(request: Request) {
  try {
    await ensureSchema();
    await ensurePortalAuthSchema();
    await seedIfNeeded();
    const authorization = await authorizePortalRequest(request);
    if (!authorization) return Response.json({ error: "Please log in to open this production." }, { status: 401 });
    const projectId = safeProjectId(new URL(request.url).searchParams.get("project"));
    return Response.json(await portalData(projectId, authorization));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load production data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    await ensurePortalAuthSchema();
    await seedIfNeeded();
    const authorization = await authorizePortalRequest(request);
    if (!authorization) return Response.json({ error: "Please log in to make that change." }, { status: 401 });
    const body = (await request.json()) as ActionBody;
    const action = textValue(body.action);
    let projectId = safeProjectId(body.projectId);
    const actor = authorization.displayName || actorFromRequest(request);
    const db = database();
    const now = new Date().toISOString();

    if (action !== "create_project" && !canAccessPortalProject(authorization, projectId)) return Response.json({ error: "This login does not have access to that project." }, { status: 403 });
    if (authorization.role === "client" && action !== "update_location_status") return Response.json({ error: "Client logins can only update client-facing project selections." }, { status: 403 });

    if (action === "create_project") {
      if (authorization.accessLevel !== "admin" && authorization.accessLevel !== "full") return Response.json({ error: "Only administrators and full-access users can create projects." }, { status: 403 });
      projectId = `prj_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
      const name = textValue(body.name, "Untitled production");
      const client = textValue(body.client, "New client");
      const code = textValue(body.code, `JOB-${new Date().getFullYear()}`);
      const shootStart = textValue(body.shootStart, now.slice(0, 10));
      const shootEnd = textValue(body.shootEnd, shootStart);
      await db.batch([
        db.prepare("INSERT INTO projects (id, name, client, code, status, shoot_start, shoot_end, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(projectId, name, client, code, "Planning", shootStart, shootEnd, "USD", now),
        db.prepare("INSERT INTO budget_lines (id, project_id, category, description, estimate, actual, created_at, section_code, item_code, item_name, rate, quantity, days, tax_pct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), projectId, "Production", "Working production costs", 0, 0, now, "A", "A1", "Production", 0, 1, 1, 0),
        db.prepare("INSERT INTO budget_versions VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), projectId, "V1 · Initial estimate", "draft", "[]", now),
      ]);
      await logActivity(projectId, "project", `${name} created`, actor);
    } else if (action === "set_client_credential") {
      if (authorization.role !== "production") return Response.json({ error: "Only production users can manage client credentials." }, { status: 403 });
      const username = normalizePortalUsername(textValue(body.username));
      const password = typeof body.password === "string" ? body.password : "";
      if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) throw new Error("Use at least 3 letters or numbers for the client username.");
      const existing = await db.prepare("SELECT u.id, u.username FROM portal_users u INNER JOIN portal_user_projects up ON up.user_id = u.id WHERE up.project_id = ? AND u.access_level = 'client' LIMIT 1").bind(projectId).first<{ id: string; username: string }>();
      const conflict = await db.prepare("SELECT id FROM portal_users WHERE username = ? LIMIT 1").bind(username).first<{ id: string }>();
      if (conflict && conflict.id !== existing?.id) throw new Error("That username is already in use.");
      if (existing) {
        const updates = [db.prepare("UPDATE portal_users SET username = ?, display_name = ?, active = 1, updated_at = ? WHERE id = ?").bind(username, `${textValue(body.displayName, dataClientName(username))}`, now, existing.id)];
        if (password) {
          const credentials = await hashPortalPassword(password);
          updates.push(db.prepare("UPDATE portal_users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?").bind(credentials.hash, credentials.salt, now, existing.id));
        }
        await db.batch(updates);
      } else {
        if (!password) throw new Error("Enter a password when creating the client login.");
        const credentials = await hashPortalPassword(password);
        const userId = crypto.randomUUID();
        await db.batch([
          db.prepare("INSERT INTO portal_users (id, username, display_name, password_hash, password_salt, access_level, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'client', 1, ?, ?)").bind(userId, username, textValue(body.displayName, dataClientName(username)), credentials.hash, credentials.salt, now, now),
          db.prepare("INSERT INTO portal_user_projects (user_id, project_id, permission, created_at) VALUES (?, ?, 'client', ?)").bind(userId, projectId, now),
        ]);
      }
      await logActivity(projectId, "client", "Client portal login updated", actor);
    } else if (action === "disable_client_credential") {
      if (authorization.role !== "production") return Response.json({ error: "Only production users can manage client credentials." }, { status: 403 });
      await db.prepare("UPDATE portal_users SET active = 0, updated_at = ? WHERE id IN (SELECT user_id FROM portal_user_projects WHERE project_id = ? AND permission = 'client')").bind(now, projectId).run();
      await logActivity(projectId, "client", "Client portal login disabled", actor);
    } else if (action === "add_budget_line") {
      const category = textValue(body.category, "New category");
      const description = textValue(body.description, "Production cost");
      const rate = signedNumberValue(body.rate ?? body.estimate);
      const quantity = numberValue(body.quantity) || 1;
      const days = numberValue(body.days) || 1;
      const taxPct = numberValue(body.taxPct);
      const estimate = body.estimate === undefined ? rate * quantity * days * (1 + taxPct / 100) : signedNumberValue(body.estimate);
      const count = await db.prepare("SELECT COUNT(*) AS count FROM budget_lines WHERE project_id = ?").bind(projectId).first<{ count: number }>();
      const sectionCode = textValue(body.sectionCode, String.fromCharCode(65 + Number(count?.count || 0)));
      const itemCode = textValue(body.itemCode, `${sectionCode}1`);
      await db.prepare("INSERT INTO budget_lines (id, project_id, category, description, estimate, actual, created_at, section_code, item_code, item_name, rate, quantity, days, tax_pct, is_na, na_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), projectId, category, description, estimate, 0, now, sectionCode, itemCode, textValue(body.itemName, category), rate, quantity, days, taxPct, body.isNa === true ? 1 : 0, textValue(body.naNote)).run();
      await logActivity(projectId, "budget", `${category} added to the working budget`, actor);
    } else if (action === "update_budget_line") {
      const id = textValue(body.id);
      const category = textValue(body.category, "Production");
      const description = textValue(body.description, "Production cost");
      const estimate = signedNumberValue(body.estimate);
      await db.prepare("UPDATE budget_lines SET category = ?, description = ?, estimate = ?, section_code = ?, item_code = ?, item_name = ?, rate = ?, quantity = ?, days = ?, tax_pct = ?, is_na = ?, na_note = ? WHERE id = ? AND project_id = ?")
        .bind(category, description, estimate, textValue(body.sectionCode), textValue(body.itemCode), textValue(body.itemName, category), signedNumberValue(body.rate), numberValue(body.quantity) || 1, numberValue(body.days) || 1, numberValue(body.taxPct), body.isNa === true ? 1 : numberValue(body.isNa), textValue(body.naNote), id, projectId).run();
      await logActivity(projectId, "budget", `${category} updated in the working budget`, actor);
    } else if (action === "delete_budget_line") {
      await db.prepare("DELETE FROM budget_lines WHERE id = ? AND project_id = ?").bind(textValue(body.id), projectId).run();
      await logActivity(projectId, "budget", "Budget line removed", actor);
    } else if (action === "rename_budget_section") {
      const sectionCode = textValue(body.sectionCode);
      const category = textValue(body.category, "New Category");
      await db.prepare("UPDATE budget_lines SET category = ? WHERE project_id = ? AND section_code = ?").bind(category, projectId, sectionCode).run();
      await logActivity(projectId, "budget", `Section ${sectionCode} renamed ${category}`, actor);
    } else if (action === "set_budget_section_na") {
      const sectionCode = textValue(body.sectionCode);
      const isNa = body.isNa === true ? 1 : 0;
      await db.prepare("UPDATE budget_lines SET is_na = ?, na_note = ? WHERE project_id = ? AND section_code = ?").bind(isNa, textValue(body.naNote), projectId, sectionCode).run();
      await logActivity(projectId, "budget", `Section ${sectionCode} ${isNa ? "marked N/A" : "restored"}`, actor);
    } else if (action === "remove_budget_section") {
      const sectionCode = textValue(body.sectionCode);
      await db.prepare("DELETE FROM budget_lines WHERE project_id = ? AND section_code = ?").bind(projectId, sectionCode).run();
      await logActivity(projectId, "budget", `Section ${sectionCode} removed`, actor);
    } else if (action === "clear_budget") {
      await db.prepare("DELETE FROM budget_lines WHERE project_id = ?").bind(projectId).run();
      await logActivity(projectId, "budget", "Working budget cleared", actor);
    } else if (action === "reorder_budget_line") {
      const id = textValue(body.id);
      const targetId = textValue(body.targetId);
      const result = await db.prepare("SELECT id FROM budget_lines WHERE project_id = ? ORDER BY created_at, category").bind(projectId).all<{ id: string }>();
      const order = result.results.map((row) => row.id);
      const from = order.indexOf(id); const to = order.indexOf(targetId);
      if (from >= 0 && to >= 0 && from !== to) {
        order.splice(to, 0, order.splice(from, 1)[0]);
        const base = Date.now();
        await db.batch(order.map((lineId, index) => db.prepare("UPDATE budget_lines SET created_at = ? WHERE id = ? AND project_id = ?").bind(new Date(base + index).toISOString(), lineId, projectId)));
        await logActivity(projectId, "budget", "Budget line order updated", actor);
      }
    } else if (action === "replace_budget_snapshot") {
      const rows = Array.isArray(body.snapshot) ? body.snapshot.slice(0, 250) : [];
      const statements = [db.prepare("DELETE FROM budget_lines WHERE project_id = ?").bind(projectId)];
      rows.forEach((item, index) => {
        if (!item || typeof item !== "object") return;
        const row = item as Record<string, unknown>;
        const rate = signedNumberValue(row.rate ?? row.estimate);
        const quantity = numberValue(row.quantity) || 1;
        const days = numberValue(row.days) || 1;
        const taxPct = numberValue(row.tax_pct);
        const estimate = row.estimate === undefined ? rate * quantity * days * (1 + taxPct / 100) : signedNumberValue(row.estimate);
        statements.push(db.prepare("INSERT INTO budget_lines (id, project_id, category, description, estimate, actual, created_at, section_code, item_code, item_name, rate, quantity, days, tax_pct, is_na, na_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(textValue(row.id, crypto.randomUUID()), projectId, textValue(row.category, "Production"), textValue(row.description), estimate, 0, new Date(Date.now() + index).toISOString(), textValue(row.section_code), textValue(row.item_code), textValue(row.item_name), rate, quantity, days, taxPct, numberValue(row.is_na), textValue(row.na_note)));
      });
      await db.batch(statements);
      await logActivity(projectId, "budget", "Working budget restored from history", actor);
    } else if (action === "update_project_budget_meta") {
      const allowed: Record<string, string> = { name: "name", client: "client", code: "code", contact: "contact", contactEmail: "contact_email", billingAddress: "billing_address", poNo: "po_no", budgetNotes: "budget_notes", budgetChanges: "budget_changes", markupPct: "markup_pct", insurancePct: "insurance_pct" };
      const fields = Object.entries(allowed).filter(([input]) => body[input] !== undefined);
      if (fields.length) {
        const values = fields.map(([input]) => input === "markupPct" || input === "insurancePct" ? numberValue(body[input]) : textValue(body[input]));
        await db.prepare(`UPDATE projects SET ${fields.map(([, column]) => `${column} = ?`).join(", ")} WHERE id = ?`).bind(...values, projectId).run();
      }
      await logActivity(projectId, "budget", "Estimate details updated", actor);
    } else if (action === "save_budget_version") {
      const rows = await db.prepare("SELECT id, category, description, estimate, section_code, item_code, item_name, rate, quantity, days, tax_pct, is_na, na_note FROM budget_lines WHERE project_id = ? ORDER BY created_at, category").bind(projectId).all();
      const count = await db.prepare("SELECT COUNT(*) AS count FROM budget_versions WHERE project_id = ?").bind(projectId).first<{ count: number }>();
      const overage = body.kind === "overage";
      const name = textValue(body.name, overage ? `V${Number(count?.count ?? 0) + 1}` : `V${Number(count?.count ?? 0) + 1} · Working estimate`);
      const confirm = body.confirm === true;
      const statements = [];
      if (confirm && !overage) statements.push(db.prepare("UPDATE budget_versions SET status = 'archived' WHERE project_id = ? AND status = 'confirmed'").bind(projectId));
      statements.push(db.prepare("INSERT INTO budget_versions VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), projectId, name, overage ? "overage_confirmed" : confirm ? "confirmed" : "draft", JSON.stringify(rows.results), now));
      await db.batch(statements);
      await logActivity(projectId, "budget", `${name} saved${confirm ? " and confirmed" : ""}`, actor);
    } else if (action === "set_budget_version_status") {
      const id = textValue(body.id);
      const status = textValue(body.status, "archived");
      const statements = [];
      if (status === "confirmed") statements.push(db.prepare("UPDATE budget_versions SET status = 'archived' WHERE project_id = ? AND status = 'confirmed'").bind(projectId));
      statements.push(db.prepare("UPDATE budget_versions SET status = ? WHERE id = ? AND project_id = ?").bind(status, id, projectId));
      await db.batch(statements);
      await logActivity(projectId, "budget", `Budget version marked ${status}`, actor);
    } else if (action === "restore_budget_version") {
      const id = textValue(body.id);
      const version = await db.prepare("SELECT snapshot FROM budget_versions WHERE id = ? AND project_id = ?").bind(id, projectId).first<{ snapshot: string }>();
      const rows = version ? JSON.parse(String(version.snapshot || "[]")) as Record<string, unknown>[] : [];
      const statements = [db.prepare("DELETE FROM budget_lines WHERE project_id = ?").bind(projectId)];
      rows.slice(0, 250).forEach((row, index) => {
        const rate = signedNumberValue(row.rate ?? row.estimate); const quantity = numberValue(row.quantity) || 1; const days = numberValue(row.days) || 1; const taxPct = numberValue(row.tax_pct); const estimate = row.estimate === undefined ? rate * quantity * days * (1 + taxPct / 100) : signedNumberValue(row.estimate);
        statements.push(db.prepare("INSERT INTO budget_lines (id, project_id, category, description, estimate, actual, created_at, section_code, item_code, item_name, rate, quantity, days, tax_pct, is_na, na_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(textValue(row.id, crypto.randomUUID()), projectId, textValue(row.category, "Production"), textValue(row.description), estimate, 0, new Date(Date.now() + index).toISOString(), textValue(row.section_code), textValue(row.item_code), textValue(row.item_name), rate, quantity, days, taxPct, numberValue(row.is_na), textValue(row.na_note)));
      });
      const status = textValue(body.status, "confirmed");
      if (status === "confirmed") statements.push(db.prepare("UPDATE budget_versions SET status = 'archived' WHERE project_id = ? AND status = 'confirmed'").bind(projectId));
      statements.push(db.prepare("UPDATE budget_versions SET status = ? WHERE id = ? AND project_id = ?").bind(status, id, projectId));
      await db.batch(statements);
      await logActivity(projectId, "budget", "Budget version reactivated", actor);
    } else if (action === "delete_budget_version") {
      await db.prepare("DELETE FROM budget_versions WHERE id = ? AND project_id = ?").bind(textValue(body.id), projectId).run();
      await logActivity(projectId, "budget", "Budget version deleted", actor);
    } else if (action === "add_expense") {
      const budgetLineId = textValue(body.budgetLineId);
      const vendor = textValue(body.vendor, "New vendor");
      const amount = numberValue(body.amount);
      const spendDate = textValue(body.spendDate, now.slice(0, 10));
      const memo = textValue(body.memo, "Production expense");
      await db.batch([
        db.prepare("INSERT INTO expenses VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), projectId, budgetLineId, vendor, amount, spendDate, "pending", memo, now),
        db.prepare("UPDATE budget_lines SET actual = actual + ? WHERE id = ? AND project_id = ?").bind(amount, budgetLineId, projectId),
      ]);
      await logActivity(projectId, "expense", `${vendor} expense added for ${formatDollars(amount)}`, actor);
    } else if (action === "import_expenses") {
      const rows = Array.isArray(body.rows) ? body.rows.slice(0, 150) : [];
      const fallbackLine = textValue(body.budgetLineId);
      const statements = [];
      let total = 0;
      for (const item of rows) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const amount = numberValue(row.amount);
        if (!amount) continue;
        total += amount;
        statements.push(db.prepare("INSERT INTO expenses VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), projectId, fallbackLine, textValue(row.vendor, "Imported charge"), amount, textValue(row.date, now.slice(0, 10)), "needs_review", textValue(row.memo, "Imported from card statement"), now));
      }
      if (statements.length) {
        statements.push(db.prepare("UPDATE budget_lines SET actual = actual + ? WHERE id = ? AND project_id = ?").bind(total, fallbackLine, projectId));
        await db.batch(statements);
        await logActivity(projectId, "expense", `${statements.length - 1} card charges imported`, actor);
      }
    } else if (action === "update_expense_status") {
      const status = textValue(body.status, "pending");
      await db.prepare("UPDATE expenses SET status = ? WHERE id = ? AND project_id = ?").bind(status, textValue(body.id), projectId).run();
      await logActivity(projectId, "expense", `Expense marked ${status.replaceAll("_", " ")}`, actor);
    } else if (action === "update_expense_allocation") {
      const id = textValue(body.id);
      const budgetLineId = textValue(body.budgetLineId);
      const expense = await db.prepare("SELECT budget_line_id, amount, vendor FROM expenses WHERE id = ? AND project_id = ?").bind(id, projectId).first<{ budget_line_id: string; amount: number; vendor: string }>();
      const budgetLine = await db.prepare("SELECT item_code, item_name, category FROM budget_lines WHERE id = ? AND project_id = ?").bind(budgetLineId, projectId).first<{ item_code: string; item_name: string; category: string }>();
      if (!expense || !budgetLine) throw new Error("Choose a valid budget line for this expense.");
      if (expense.budget_line_id !== budgetLineId) {
        await db.batch([
          db.prepare("UPDATE expenses SET budget_line_id = ? WHERE id = ? AND project_id = ?").bind(budgetLineId, id, projectId),
          db.prepare("UPDATE budget_lines SET actual = MAX(0, actual - ?) WHERE id = ? AND project_id = ?").bind(Number(expense.amount), expense.budget_line_id, projectId),
          db.prepare("UPDATE budget_lines SET actual = actual + ? WHERE id = ? AND project_id = ?").bind(Number(expense.amount), budgetLineId, projectId),
        ]);
        await logActivity(projectId, "expense", `${expense.vendor} allocated to ${budgetLine.item_code || budgetLine.item_name || budgetLine.category}`, actor);
      }
    } else if (action === "update_backup_status") {
      const status = textValue(body.status, "needs_review");
      const allowed = new Set(["needs_review", "verified"]);
      if (!allowed.has(status)) throw new Error("Unsupported backup status.");
      await db.prepare("UPDATE file_assets SET status = ? WHERE id = ? AND project_id = ?").bind(status, textValue(body.id), projectId).run();
      await logActivity(projectId, "file", `Backup marked ${status.replaceAll("_", " ")}`, actor);
    } else if (action === "add_location") {
      const name = textValue(body.name, "Untitled location");
      const imageUrl = textValue(body.imageUrl);
      const gallery = Array.isArray(body.gallery) ? body.gallery.filter((item): item is string => typeof item === "string") : imageUrl ? [imageUrl] : [];
      await db.prepare("INSERT INTO locations (id, project_id, name, city, rate, status, image_url, tags, note, client_note, updated_at, category, square_feet, availability, blurb, gallery, deleted_at, client_visible) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?)")
        .bind(crypto.randomUUID(), projectId, name, textValue(body.city, "Location TBD"), numberValue(body.rate), textValue(body.status, "review"), imageUrl || gallery[0] || "", textValue(body.tags, "New scout|Review"), textValue(body.note, "Scouting notes to follow."), textValue(body.clientNote, "Awaiting client review."), now, textValue(body.category, "Uncategorized"), textValue(body.squareFeet, "—"), textValue(body.availability, "Availability Pending"), textValue(body.blurb), JSON.stringify(gallery), body.clientVisible === false ? 0 : 1).run();
      await logActivity(projectId, "location", `${name} added to the location board`, actor);
    } else if (action === "update_location_status") {
      const id = textValue(body.id);
      const status = textValue(body.status, "review");
      const location = await db.prepare("SELECT name FROM locations WHERE id = ? AND project_id = ?").bind(id, projectId).first<{ name: string }>();
      await db.prepare("UPDATE locations SET status = ?, updated_at = ? WHERE id = ? AND project_id = ?").bind(status, now, id, projectId).run();
      await logActivity(projectId, "location", `${location?.name ?? "Location"} marked ${status}`, actor);
    } else if (action === "update_location") {
      const id = textValue(body.id);
      await db.prepare("UPDATE locations SET name = ?, city = ?, rate = ?, image_url = ?, tags = ?, note = ?, client_note = ?, category = ?, square_feet = ?, availability = ?, blurb = ?, updated_at = ? WHERE id = ? AND project_id = ?")
        .bind(textValue(body.name, "Untitled location"), textValue(body.city, "Location TBD"), numberValue(body.rate), textValue(body.imageUrl), textValue(body.tags, "Review"), textValue(body.note), textValue(body.clientNote), textValue(body.category, "Uncategorized"), textValue(body.squareFeet, "—"), textValue(body.availability, "Availability Pending"), textValue(body.blurb), now, id, projectId).run();
      await logActivity(projectId, "location", `${textValue(body.name, "Location")} details updated`, actor);
    } else if (action === "update_location_gallery") {
      const gallery = Array.isArray(body.gallery) ? body.gallery.filter((item): item is string => typeof item === "string").slice(0, 100) : [];
      await db.prepare("UPDATE locations SET gallery = ?, image_url = ?, updated_at = ? WHERE id = ? AND project_id = ?").bind(JSON.stringify(gallery), gallery[0] || "", now, textValue(body.id), projectId).run();
      await logActivity(projectId, "location", "Location gallery updated", actor);
    } else if (action === "set_location_visibility") {
      await db.prepare("UPDATE locations SET client_visible = ?, updated_at = ? WHERE id = ? AND project_id = ?").bind(body.visible === true ? 1 : 0, now, textValue(body.id), projectId).run();
      await logActivity(projectId, "location", body.visible === true ? "Location added to client view" : "Location hidden from client view", actor);
    } else if (action === "delete_location") {
      await db.prepare("UPDATE locations SET deleted_at = ?, updated_at = ? WHERE id = ? AND project_id = ?").bind(now, now, textValue(body.id), projectId).run();
      await logActivity(projectId, "location", "Location moved to recently deleted", actor);
    } else if (action === "restore_location") {
      await db.prepare("UPDATE locations SET deleted_at = '', updated_at = ? WHERE id = ? AND project_id = ?").bind(now, textValue(body.id), projectId).run();
      await logActivity(projectId, "location", "Location restored", actor);
    } else if (action === "purge_location") {
      await db.prepare("DELETE FROM locations WHERE id = ? AND project_id = ?").bind(textValue(body.id), projectId).run();
      await logActivity(projectId, "location", "Location permanently deleted", actor);
    } else if (action === "import_locations") {
      const folders = Array.isArray(body.folders) ? body.folders.slice(0, 80) : [];
      const statements = [];
      for (const folder of folders) {
        if (!folder || typeof folder !== "object") continue;
        const record = folder as Record<string, unknown>;
        const gallery = Array.isArray(record.gallery) ? record.gallery.filter((item): item is string => typeof item === "string").slice(0, 100) : [];
        const name = textValue(record.name, "Imported location");
        statements.push(db.prepare("INSERT INTO locations (id, project_id, name, city, rate, status, image_url, tags, note, client_note, updated_at, category, square_feet, availability, blurb, gallery, deleted_at, client_visible) VALUES (?, ?, ?, ?, 0, 'review', ?, 'Imported|Review', ?, ?, ?, 'Uncategorized', '—', 'Availability Pending', '', ?, '', 1)").bind(crypto.randomUUID(), projectId, name, "Location TBD", gallery[0] || "", `Imported from ${name} image folder.`, "Awaiting client review.", now, JSON.stringify(gallery)));
      }
      if (statements.length) await db.batch(statements);
      await logActivity(projectId, "location", `${statements.length} location folders imported`, actor);
    } else if (action === "update_project_status") {
      const status = textValue(body.status, "Pre-production");
      await db.prepare("UPDATE projects SET status = ? WHERE id = ?").bind(status, projectId).run();
      await logActivity(projectId, "project", `Project status changed to ${status}`, actor);
    } else if (action === "add_module_record") {
      const module = textValue(body.module);
      if (!MODULES.has(module)) throw new Error("Unsupported production module.");
      const data = body.data && typeof body.data === "object" ? body.data : {};
      await db.prepare("INSERT INTO module_records VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), projectId, module, JSON.stringify(data), now, now).run();
      await logActivity(projectId, module, `${statusLabel(module)} record added`, actor);
    } else if (action === "update_module_record") {
      const module = textValue(body.module);
      if (!MODULES.has(module)) throw new Error("Unsupported production module.");
      const data = body.data && typeof body.data === "object" ? body.data : {};
      await db.prepare("UPDATE module_records SET data = ?, updated_at = ? WHERE id = ? AND project_id = ? AND module = ?").bind(JSON.stringify(data), now, textValue(body.id), projectId, module).run();
      await logActivity(projectId, module, `${statusLabel(module)} record updated`, actor);
    } else if (action === "import_travel_reservation") {
      const parsed = parseReservation(textValue(body.text), textValue(body.filename), textValue(body.traveler, "Traveler"));
      const records: Record<string, string>[] = [parsed.flight];
      if (body.autoHotel === true) records.push(parsed.hotel);
      if (body.autoCar === true) records.push(parsed.car);
      await db.batch(records.map((data) => db.prepare("INSERT INTO module_records VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), projectId, "travel", JSON.stringify(data), now, now)));
      await logActivity(projectId, "travel", `${parsed.flight.traveler} reservation imported; ${records.length} travel rows created`, actor);
    } else if (action === "delete_module_record") {
      await db.prepare("DELETE FROM module_records WHERE id = ? AND project_id = ?").bind(textValue(body.id), projectId).run();
      await logActivity(projectId, "project", "Production record removed", actor);
    } else if (action === "publish_client_item") {
      const data = { kind: textValue(body.kind, "Document"), label: textValue(body.label, "Production update"), versionId: textValue(body.versionId), date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date()), status: "Shared" };
      await db.prepare("INSERT INTO module_records VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), projectId, "client_share", JSON.stringify(data), now, now).run();
      await logActivity(projectId, "client", `${data.label} shared to the client portal`, actor);
    } else {
      return Response.json({ error: "Unknown portal action." }, { status: 400 });
    }

    return Response.json(await portalData(projectId, authorization));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save that change." }, { status: 500 });
  }
}

function dataClientName(username: string) {
  return username.replace(/[._-]+/g, " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function formatDollars(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function parseReservation(raw: string, filename: string, fallbackTraveler: string) {
  const source = `${filename}\n${raw.replace(/[\u0000-\u0008\u000e-\u001f]/g, " ")}`.slice(0, 200000);
  const compact = source.replace(/\s+/g, " ");
  const flight = compact.match(/\b([A-Z]{2})\s*[- ]?(\d{2,4})\b/i);
  const route = compact.match(/\b([A-Z]{3})\s*(?:→|->|TO|—|-)\s*([A-Z]{3})\b/i);
  const confirmation = compact.match(/(?:CONFIRMATION|CONFIRM|RECORD LOCATOR|LOCATOR|CONF)[\s#:.-]*([A-Z0-9]{5,10})/i);
  const traveler = compact.match(/(?:PASSENGER|TRAVELER|GUEST)[\s:.-]+([A-Z][A-Za-z' -]{2,45})/i);
  const date = compact.match(/\b(?:MON|TUE|WED|THU|FRI|SAT|SUN)?\s*,?\s*((?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[A-Z]*\s+\d{1,2}(?:,\s*\d{4})?)/i);
  const times = [...compact.matchAll(/\b(\d{1,2}:\d{2}\s*(?:AM|PM)?)\b/gi)].map((match) => match[1]);
  const from = route?.[1]?.toUpperCase() || "ORIGIN";
  const to = route?.[2]?.toUpperCase() || "DESTINATION";
  const travelDate = date?.[1] || "DATE TO CONFIRM";
  const who = traveler?.[1]?.trim() || fallbackTraveler;
  const provider = flight ? flight[1].toUpperCase() : "AIRLINE TO CONFIRM";
  const flightNumber = flight ? `${provider} ${flight[2]}` : "FLIGHT TO CONFIRM";
  const status = route || flight ? "Parsed · verify" : "Needs review";
  return {
    flight: { type: "Flight", traveler: who, provider, confirmation: confirmation?.[1]?.toUpperCase() || "—", from, to, departDate: travelDate, departTime: times[0] || "—", arriveTime: times[1] || "—", detail: `${from} → ${to} · ${flightNumber}`, timing: `${travelDate} · ${times[0] || "time TBD"}`, status, source: filename || "Pasted reservation" },
    hotel: { type: "Hotel", traveler: who, provider: "Hotel hold", confirmation: "AUTO-HOLD", from: to, to, departDate: travelDate, departTime: "—", arriveTime: "—", detail: `${to} hotel · aligned to production dates`, timing: `${travelDate}–production wrap`, status: "Suggested", source: filename || "Flight dates" },
    car: { type: "Car", traveler: who, provider: "Ground transport", confirmation: "AUTO-HOLD", from: `${to} airport`, to: "Production hotel", departDate: travelDate, departTime: times[1] || "On arrival", arriveTime: "—", detail: `${to} airport → production hotel`, timing: `${travelDate} · ${times[1] || "on arrival"}`, status: "Suggested", source: filename || "Flight arrival" },
  };
}
