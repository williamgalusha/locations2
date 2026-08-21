"use client";

import type { ChangeEvent, DragEvent, FormEvent, ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReferenceBudgetView, ReferenceClientPortal, ReferenceLocationsView, ReferenceLoginScreen } from "./reference-ui";
import type { PortalAccessLevel, PortalRole } from "./credential-auth";

export type Project = { id: string; name: string; client: string; code: string; status: string; shoot_start: string; shoot_end: string; currency: string; contact?: string; contact_email?: string; billing_address?: string; po_no?: string; budget_notes?: string; budget_changes?: string; markup_pct?: number; insurance_pct?: number };
export type BudgetLine = { id: string; category: string; description: string; estimate: number; actual: number; section_code?: string; item_code?: string; item_name?: string; rate?: number; quantity?: number; days?: number; tax_pct?: number; is_na?: number; na_note?: string };
export type BudgetSnapshot = Pick<BudgetLine, "id" | "category" | "description" | "estimate" | "section_code" | "item_code" | "item_name" | "rate" | "quantity" | "days" | "tax_pct" | "is_na" | "na_note">;
export type BudgetVersion = { id: string; name: string; status: string; snapshot: BudgetSnapshot[]; created_at: string };
type Expense = { id: string; budget_line_id: string; vendor: string; amount: number; spend_date: string; status: string; memo: string };
export type Location = { id: string; name: string; city: string; rate: number; status: string; image_url: string; tags: string; note: string; client_note: string; category?: string; square_feet?: string; availability?: string; blurb?: string; gallery?: string | string[]; deleted_at?: string; client_visible?: number };
type Activity = { id: string; kind: string; message: string; actor: string; created_at: string };
type RecordData = Record<string, string>;
type ModuleRecord = { id: string; module: string; data: RecordData; created_at: string; updated_at: string };
type FileAsset = { id: string; object_key: string; filename: string; content_type: string; size: number; category: string; status: string; budget_line_id?: string; expense_id?: string; vendor?: string; amount?: number; spend_date?: string; memo?: string; created_at: string };
type AuditNote = { severity: "critical" | "review" | "info"; title: string; detail: string; line_code?: string; amount?: number };
type BudgetAudit = { id: string; source: string; status: string; summary: string; notes: string | AuditNote[]; created_at: string };
type PickupPlan = { origin: string; destination: string; tripType: "to_airport" | "from_airport" | "general"; eventDateTime: string; pickupAt: string; arriveBy: string; estimatedDestinationAt: string; airportLeadMinutes: number; bufferMinutes: number; providerConfigured: boolean; driveMinutes: number; staticMinutes: number | null; trafficDelayMinutes: number | null; distanceMiles: number | null; source: "google_traffic" | "estimated" };
export type ClientCredential = { username: string; active: number | boolean; updated_at: string } | null;
export type PortalData = { projects: Project[]; project: Project; budgetLines: BudgetLine[]; budgetVersions: BudgetVersion[]; expenses: Expense[]; locations: Location[]; activities: Activity[]; records: ModuleRecord[]; files: FileAsset[]; audits: BudgetAudit[]; clientCredential: ClientCredential };
type View = "control" | "budget" | "reconcile" | "backup" | "cc" | "production" | "crew" | "schedule" | "travel" | "callsheet" | "locations" | "client" | "activity";
type Composer = "budget" | "expense" | "location" | "project" | "production" | "crew" | "schedule" | "travel" | null;
export type User = { name: string; email: string; credential?: boolean; role?: PortalRole; accessLevel?: PortalAccessLevel; projectIds?: string[] } | null;
export type Mutate = (payload: Record<string, unknown>, success: string) => Promise<void>;

const groups: { label: string; items: { id: View; label: string }[] }[] = [
  { label: "Workspace", items: [{ id: "control", label: "Control Room" }] },
  { label: "Finance", items: [{ id: "budget", label: "Budget" }, { id: "reconcile", label: "Reconciliation" }, { id: "backup", label: "Backup" }, { id: "cc", label: "CC Log" }] },
  { label: "Operations", items: [{ id: "production", label: "Production Sheet" }, { id: "crew", label: "Headcount" }, { id: "schedule", label: "Schedule" }, { id: "travel", label: "Travel" }, { id: "callsheet", label: "Call Sheet" }] },
  { label: "Client", items: [{ id: "locations", label: "Locations" }, { id: "client", label: "Client Portal" }] },
  { label: "System", items: [{ id: "activity", label: "Activity" }] },
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
const relativeTime = (value: string) => { const hours = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 3600000)); return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`; };
const initials = (name: string) => name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "BI";
const moduleRows = (data: PortalData, module: string) => data.records.filter((record) => record.module === module);
const pad = (value: number) => String(value).padStart(2, "0");

function codedBudgetLines(lines: BudgetLine[]) {
  const ordered = [...lines].sort((a, b) => {
    const aKey = `${a.section_code || "ZZ"}-${a.item_code || "ZZ"}-${a.category}`;
    const bKey = `${b.section_code || "ZZ"}-${b.item_code || "ZZ"}-${b.category}`;
    return aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: "base" });
  });
  const sectionCounts = new Map<string, number>();
  return ordered.map((line) => {
    const section = line.section_code?.trim() || "A";
    const position = (sectionCounts.get(section) ?? 0) + 1;
    sectionCounts.set(section, position);
    return { line, section, code: line.item_code?.trim() || `${section}${position}` };
  });
}

export default function ProductionPortal({ initialUser }: { initialUser: User }) {
  const [previewUser, setPreviewUser] = useState<User>(null);
  const [entered, setEntered] = useState(false);
  const [data, setData] = useState<PortalData | null>(null);
  const [active, setActive] = useState<View>("control");
  const [composer, setComposer] = useState<Composer>(null);
  const [saving, setSaving] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [projectMenu, setProjectMenu] = useState(false);
  const [userControls, setUserControls] = useState(false);
  const [clientPreview, setClientPreview] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [compactRows, setCompactRows] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const filePicker = useRef<HTMLInputElement>(null);
  const ccPicker = useRef<HTMLInputElement>(null);
  const travelPicker = useRef<HTMLInputElement>(null);
  const user = previewUser ?? initialUser;
  const localPreview = !initialUser && Boolean(previewUser);

  useEffect(() => {
    const stored = window.localStorage.getItem("bill-theme");
    const next = stored === "dark" || stored === "light" ? stored : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(next); document.documentElement.dataset.theme = next;
    const compact = window.localStorage.getItem("bill-compact-rows") === "true";
    const reduced = window.localStorage.getItem("bill-reduce-motion") === "true";
    setCompactRows(compact); setReduceMotion(reduced);
    document.documentElement.dataset.density = compact ? "compact" : "comfortable";
    document.documentElement.dataset.reduceMotion = reduced ? "true" : "false";
  }, []);
  useEffect(() => { if (user) loadProject(); }, [Boolean(user)]);

  function setThemeMode(next: "light" | "dark") {
    setTheme(next); document.documentElement.dataset.theme = next; window.localStorage.setItem("bill-theme", next);
  }

  function toggleTheme() { setThemeMode(theme === "light" ? "dark" : "light"); }

  function setCompactMode(next: boolean) {
    setCompactRows(next); document.documentElement.dataset.density = next ? "compact" : "comfortable"; window.localStorage.setItem("bill-compact-rows", String(next));
  }

  function setMotionMode(next: boolean) {
    setReduceMotion(next); document.documentElement.dataset.reduceMotion = next ? "true" : "false"; window.localStorage.setItem("bill-reduce-motion", String(next));
  }

  async function loadProject(projectId?: string) {
    setError("");
    try {
      const response = await fetch(`/api/portal${projectId ? `?project=${encodeURIComponent(projectId)}` : ""}`);
      const payload = await response.json() as PortalData & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not load production data.");
      setData(payload); setProjectMenu(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load production data."); }
  }

  const totals = useMemo(() => {
    const estimate = data?.budgetLines.reduce((sum, line) => sum + Number(line.estimate), 0) ?? 0;
    const committed = data?.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0) ?? 0;
    const actual = data?.expenses.filter((expense) => expense.status === "matched").reduce((sum, expense) => sum + Number(expense.amount), 0) ?? 0;
    return { estimate, committed, actual, remaining: estimate - committed, percent: estimate ? Math.round((committed / estimate) * 100) : 0 };
  }, [data]);

  async function mutate(payload: Record<string, unknown>, success: string) {
    if (!data && payload.action !== "create_project") return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, projectId: data?.project.id }) });
      const next = await response.json() as PortalData & { error?: string };
      if (!response.ok) throw new Error(next.error ?? "That change could not be saved.");
      setData(next); setComposer(null); setToast(success); window.setTimeout(() => setToast(""), 2600);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "That change could not be saved."); }
    finally { setSaving(false); }
  }

  function chooseBackup(file?: File) {
    if (!file) return;
    setPendingBackup(file);
  }

  function uploadBackup(event: ChangeEvent<HTMLInputElement>) {
    chooseBackup(event.target.files?.[0]); event.target.value = "";
  }

  async function saveBackupAllocation(values: Record<string, string>) {
    if (!pendingBackup || !data) return;
    setSaving(true);
    try {
      const form = new FormData(); form.set("file", pendingBackup); form.set("projectId", data.project.id); form.set("category", "Backup");
      Object.entries(values).forEach(([key, value]) => form.set(key, value));
      const response = await fetch("/api/files", { method: "POST", body: form }); const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Upload failed.");
      setPendingBackup(null); await loadProject(data.project.id); setToast(`${pendingBackup.name} uploaded and allocated`); window.setTimeout(() => setToast(""), 2600);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Upload failed."); }
    finally { setSaving(false); }
  }

  async function removeFile(file: FileAsset) {
    if (!data) return;
    const response = await fetch("/api/files", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: file.id, key: file.object_key, projectId: data.project.id }) });
    if (response.ok) { await loadProject(data.project.id); setToast("File removed"); window.setTimeout(() => setToast(""), 2200); }
  }

  async function auditBudget() {
    if (!data) return;
    setAuditing(true); setError("");
    try {
      const response = await fetch("/api/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: data.project.id }) });
      const result = await response.json() as { error?: string; aiConfigured?: boolean; aiFailure?: string | null; audit?: { source?: string } };
      if (!response.ok) throw new Error(result.error ?? "Budget audit failed.");
      await loadProject(data.project.id);
      if (result.audit?.source === "openai") setToast("OpenAI budget audit complete");
      else if (result.aiFailure) setToast(`OpenAI fallback · ${result.aiFailure}`);
      else setToast(result.aiConfigured ? "OpenAI audit fell back to local rules" : "Budget audit complete · AI key not yet connected");
      window.setTimeout(() => setToast(""), result.aiFailure ? 6000 : 3200);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Budget audit failed."); }
    finally { setAuditing(false); }
  }

  async function importStatement(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file || !data || !data.budgetLines[0]) return;
    try {
      const csvLines = (await file.text()).split(/\r?\n/).filter(Boolean); const headers = parseCsvLine(csvLines.shift() ?? "").map((value) => value.toLowerCase());
      const column = (names: string[]) => headers.findIndex((header) => names.some((name) => header.includes(name)));
      const dateIndex = column(["date"]), vendorIndex = column(["merchant", "vendor", "description"]), amountIndex = column(["amount", "total"]);
      const rows = csvLines.map(parseCsvLine).map((values) => ({ date: normalizeDate(values[dateIndex] ?? ""), vendor: values[vendorIndex] ?? "Imported charge", amount: Math.abs(Number(String(values[amountIndex] ?? "0").replace(/[$,()]/g, (match) => match === "(" ? "-" : ""))) })).filter((row) => Number.isFinite(row.amount) && row.amount !== 0);
      await mutate({ action: "import_expenses", budgetLineId: data.budgetLines[0].id, rows }, `${rows.length} card charges imported`);
    } catch { setError("That CSV could not be read. Include date, merchant, and amount columns."); }
    finally { event.target.value = ""; }
  }

  function openView(view: View) { setActive(view); setQuery(""); if (view !== "client") setClientPreview(false); }

  async function credentialLogin(username: string, password: string, role: PortalRole) {
    const response = await fetch("/api/credential-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, role }) });
    const payload = await response.json() as { error?: string; user: User };
    if (!response.ok) throw new Error(payload.error || "That login could not be completed.");
    setPreviewUser(payload.user); setActive(role === "client" ? "client" : "control"); setClientPreview(role === "client"); setEntered(true);
  }

  function enterFor(role: PortalRole = user?.role === "client" ? "client" : "production") {
    setActive(role === "client" ? "client" : "control"); setClientPreview(role === "client"); setEntered(true);
  }

  async function logOut() {
    if (user?.credential) await fetch("/api/credential-login", { method: "DELETE" });
    setPreviewUser(null); setData(null); setEntered(false); setUserControls(false);
    if (initialUser?.credential) window.location.reload();
  }

  if (!entered) return <ReferenceLoginScreen user={user} enter={enterFor} credentialLogin={credentialLogin} />;
  if (!user) return <ReferenceLoginScreen user={null} enter={enterFor} credentialLogin={credentialLogin} />;
  if (!data && !error) return <div className="portal-loading"><span>B,</span><p>OPENING PRODUCTION WORKSPACE…</p></div>;
  if (!data) return <div className="portal-error"><span>BILL, INC.</span><h1>THE PRODUCTION COULD NOT OPEN.</h1><p>{error}</p><button onClick={() => loadProject()}>TRY AGAIN</button></div>;

  const search = query.toLowerCase();
  const lines = data.budgetLines.filter((line) => `${line.category} ${line.description}`.toLowerCase().includes(search));
  const expenses = data.expenses.filter((expense) => `${expense.vendor} ${expense.memo}`.toLowerCase().includes(search));
  const locations = data.locations.filter((location) => `${location.name} ${location.city} ${location.tags}`.toLowerCase().includes(search));

  if (user.role === "client") return <ReferenceClientPortal data={data} totals={totals} preview setPreview={(value) => { if (!value) void logOut(); }} publish={mutate} clientOnly />;

  return <main className="portal-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => openView("control")}><img src="/bill-inc.png" alt="BILL, INC." /></button>
      <div className="side-project"><span>{data.project.code}</span><strong>{data.project.name}</strong><small>{data.project.client}</small></div>
      <nav aria-label="Production workspace">{groups.map((group) => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map((item) => <button className={active === item.id ? "nav-item active" : "nav-item"} onClick={() => openView(item.id)} key={item.id}>{item.label}{item.id === "reconcile" && data.expenses.some((expense) => expense.status === "needs_review") && <i>{data.expenses.filter((expense) => expense.status === "needs_review").length}</i>}</button>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="budget-meter"><span style={{ width: `${Math.min(totals.percent, 100)}%` }} /></div><p><b>{totals.percent}% COMMITTED</b><span>{money.format(totals.remaining)} LEFT</span></p><button className="side-user" onClick={() => setUserControls(true)} aria-haspopup="dialog" aria-expanded={userControls}><span>{initials(user.name)}</span><span><strong>{user.name}</strong><small>{user.email}</small></span><b>→</b></button></div>
    </aside>

    <section className="workspace">
      <header className="topbar">
        <div className="project-switch-wrap"><button className="project-switcher" onClick={() => setProjectMenu((value) => !value)}><span className="project-stamp">{data.project.code.slice(0, 2)}</span><span><small>CURRENT PRODUCTION</small><strong>{data.project.name}</strong></span><b>⌄</b></button>{projectMenu && <div className="project-menu"><p>PRODUCTIONS</p>{data.projects.map((project) => <button className={project.id === data.project.id ? "current" : ""} onClick={() => loadProject(project.id)} key={project.id}><span><strong>{project.name}</strong><small>{project.client} · {project.code}</small></span>{project.id !== data.project.id && <b>→</b>}</button>)}{(user.accessLevel === "admin" || user.accessLevel === "full") && <button className="new-project" onClick={() => { setProjectMenu(false); setComposer("project"); }}>＋ NEW PRODUCTION</button>}</div>}</div>
        <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this production" aria-label="Search this production" /><kbd>⌘ K</kbd></label>
        <div className="top-actions"><span className="sync-state">● SAVED</span><button className="theme-button" onClick={toggleTheme} aria-label={`Use ${theme === "light" ? "dark" : "light"} mode`}>{theme === "light" ? "◐" : "◑"}</button><button className="present-button" onClick={() => { openView("client"); setClientPreview(true); }}>CLIENT VIEW ↗</button></div>
      </header>
      <div className="mobile-nav">{groups.flatMap((group) => group.items).map((item) => <button className={active === item.id ? "active" : ""} onClick={() => openView(item.id)} key={item.id}>{item.label}</button>)}</div>

      <div className="content">
        {error && <div className="inline-error">{error}<button onClick={() => setError("")}>DISMISS</button></div>}
        {active === "control" && <ControlRoom data={data} totals={totals} openView={openView} openComposer={setComposer} mutate={mutate} />}
        {active === "budget" && <ReferenceBudgetView data={data} lines={lines} totals={totals} expenses={data.expenses} openComposer={() => setComposer("budget")} mutate={mutate} auditBudget={auditBudget} auditing={auditing} />}
        {active === "reconcile" && <ReconcileView expenses={expenses} lines={data.budgetLines} openComposer={setComposer} mutate={mutate} />}
        {active === "backup" && <BackupView files={data.files} expenses={data.expenses} lines={data.budgetLines} audits={data.audits} filePicker={filePicker} uploadBackup={uploadBackup} chooseBackup={chooseBackup} removeFile={removeFile} mutate={mutate} auditBudget={auditBudget} saving={saving} auditing={auditing} />}
        {active === "cc" && <CCView expenses={expenses} lines={data.budgetLines} ccPicker={ccPicker} importStatement={importStatement} openComposer={setComposer} mutate={mutate} />}
        {active === "production" && <RecordView title="Production Sheet" kicker="Operations · Live list" copy="Open items, vendor decisions, and wrap-book notes in one shared sheet." records={moduleRows(data, "production")} columns={["section", "item", "owner", "status"]} open={() => setComposer("production")} remove={(id) => mutate({ action: "delete_module_record", id }, "Production item removed")} />}
        {active === "crew" && <HeadcountView crew={moduleRows(data, "crew")} schedule={moduleRows(data, "schedule")} open={() => setComposer("crew")} mutate={mutate} />}
        {active === "travel" && <TravelView records={moduleRows(data, "travel")} picker={travelPicker} open={() => setComposer("travel")} mutate={mutate} />}
        {active === "schedule" && <ScheduleView records={moduleRows(data, "schedule")} open={() => setComposer("schedule")} mutate={mutate} publish={() => mutate({ action: "publish_client_item", kind: "Schedule", label: `${data.project.name} · Shooting Schedule` }, "Schedule pushed to client portal")} />}
        {active === "callsheet" && <CallSheet project={data.project} crew={moduleRows(data, "crew")} schedule={moduleRows(data, "schedule")} travel={moduleRows(data, "travel")} locations={data.locations} publish={() => mutate({ action: "publish_client_item", kind: "Call Sheet", label: `${data.project.name} · Day 01 Call Sheet` }, "Call sheet pushed to client portal")} />}
        {active === "locations" && <ReferenceLocationsView project={data.project} locations={locations} open={() => setComposer("location")} mutate={mutate} />}
        {active === "client" && <ReferenceClientPortal data={data} totals={totals} preview={clientPreview} setPreview={setClientPreview} publish={mutate} />}
        {active === "activity" && <ActivityView activities={data.activities} />}
      </div>
    </section>

    {composer && <ComposerModal type={composer} lines={data.budgetLines} saving={saving} close={() => setComposer(null)} submit={mutate} />}
    {pendingBackup && <BackupAllocationModal file={pendingBackup} lines={data.budgetLines} saving={saving} close={() => setPendingBackup(null)} upload={saveBackupAllocation} />}
    {userControls && <UserControlsDrawer user={user} project={data.project} projects={data.projects} theme={theme} compactRows={compactRows} reduceMotion={reduceMotion} close={() => setUserControls(false)} setTheme={setThemeMode} setCompactRows={setCompactMode} setReduceMotion={setMotionMode} logOut={logOut} externalLogout={!localPreview && !user.credential} />}
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </main>;
}

type AccessUser = { id: string; username: string; displayName: string; accessLevel: Exclude<PortalAccessLevel, "client">; active: boolean; projectIds: string[]; updatedAt: string };
type AccessData = { users: AccessUser[]; projects: Pick<Project, "id" | "name" | "client" | "code">[] };
type AccessDraft = { id: string; username: string; displayName: string; password: string; accessLevel: Exclude<PortalAccessLevel, "client">; projectIds: string[] };
const emptyAccessDraft: AccessDraft = { id: "", username: "", displayName: "", password: "", accessLevel: "project", projectIds: [] };

function UserControlsDrawer({ user, project, projects, theme, compactRows, reduceMotion, close, setTheme, setCompactRows, setReduceMotion, logOut, externalLogout }: { user: NonNullable<User>; project: Project; projects: Project[]; theme: "light" | "dark"; compactRows: boolean; reduceMotion: boolean; close: () => void; setTheme: (theme: "light" | "dark") => void; setCompactRows: (value: boolean) => void; setReduceMotion: (value: boolean) => void; logOut: () => Promise<void>; externalLogout: boolean }) {
  const [access, setAccess] = useState<AccessData | null>(null);
  const [accessDraft, setAccessDraft] = useState<AccessDraft | null>(null);
  const [accessError, setAccessError] = useState("");
  const [accessSaving, setAccessSaving] = useState(false);
  const isAdmin = user.accessLevel === "admin";
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [close]);
  useEffect(() => { if (isAdmin) void loadAccess(); }, [isAdmin]);

  async function loadAccess() {
    setAccessError("");
    const response = await fetch("/api/access");
    const payload = await response.json() as AccessData & { error?: string };
    if (!response.ok) { setAccessError(payload.error || "Access controls could not be loaded."); return; }
    setAccess(payload);
  }

  async function saveAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessDraft) return;
    setAccessSaving(true); setAccessError("");
    try {
      const response = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save_user", ...accessDraft }) });
      const payload = await response.json() as AccessData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "That login could not be saved.");
      setAccess(payload); setAccessDraft(null);
    } catch (reason) { setAccessError(reason instanceof Error ? reason.message : "That login could not be saved."); }
    finally { setAccessSaving(false); }
  }

  async function setUserActive(accessUser: AccessUser, active: boolean) {
    setAccessSaving(true); setAccessError("");
    try {
      const response = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set_user_active", id: accessUser.id, active }) });
      const payload = await response.json() as AccessData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "That login could not be updated.");
      setAccess(payload);
    } catch (reason) { setAccessError(reason instanceof Error ? reason.message : "That login could not be updated."); }
    finally { setAccessSaving(false); }
  }

  const roleLabel = user.accessLevel === "admin" ? "Administrator" : user.accessLevel === "full" ? "Full access" : "Project access";

  return <div className="user-controls-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <aside className="user-controls-drawer" role="dialog" aria-modal="true" aria-labelledby="user-controls-title">
      <header><div><span>ACCOUNT</span><h2 id="user-controls-title">USER CONTROLS</h2></div><button onClick={close} aria-label="Close user controls">×</button></header>
      <section className="user-profile-card"><span>{initials(user.name)}</span><div><strong>{user.name}</strong><small>{user.email}</small></div><b>{user.accessLevel === "admin" ? "ADMIN" : "PRODUCTION"}</b></section>
      <section className="user-control-section"><p>ACCESS</p><dl><div><dt>ROLE</dt><dd>{roleLabel}</dd></div><div><dt>CURRENT PRODUCTION</dt><dd>{project.name}</dd></div><div><dt>JOB CODE</dt><dd>{project.code}</dd></div></dl></section>
      {isAdmin && <section className="user-control-section user-access-admin"><p>ADMIN ACCESS <button type="button" onClick={() => setAccessDraft({ ...emptyAccessDraft, projectIds: [project.id] })}>＋ ADD USER</button></p>{accessError && <div className="access-error">{accessError}</div>}{access ? <div className="access-user-list">{access.users.map((accessUser) => <div className={!accessUser.active ? "disabled" : ""} key={accessUser.id}><span><strong>{accessUser.displayName}</strong><small>@{accessUser.username} · {accessUser.accessLevel === "admin" ? "Administrator" : accessUser.accessLevel === "full" ? "All projects" : `${accessUser.projectIds.length} project${accessUser.projectIds.length === 1 ? "" : "s"}`}</small></span><button type="button" onClick={() => setAccessDraft({ id: accessUser.id, username: accessUser.username, displayName: accessUser.displayName, password: "", accessLevel: accessUser.accessLevel, projectIds: accessUser.projectIds })}>EDIT</button><button type="button" disabled={accessSaving} onClick={() => void setUserActive(accessUser, !accessUser.active)}>{accessUser.active ? "DISABLE" : "ENABLE"}</button></div>)}</div> : <small className="access-loading">LOADING PORTAL USERS…</small>}{accessDraft && <form className="access-user-form" onSubmit={saveAccess}><header><strong>{accessDraft.id ? "EDIT PRODUCTION USER" : "ADD PRODUCTION USER"}</strong><button type="button" onClick={() => setAccessDraft(null)}>×</button></header><label>DISPLAY NAME<input required value={accessDraft.displayName} onChange={(event) => setAccessDraft({ ...accessDraft, displayName: event.target.value })} /></label><label>USERNAME<input required value={accessDraft.username} autoCapitalize="none" onChange={(event) => setAccessDraft({ ...accessDraft, username: event.target.value })} /></label><label>{accessDraft.id ? "NEW PASSWORD · LEAVE BLANK TO KEEP" : "PASSWORD"}<input required={!accessDraft.id} minLength={8} type="password" autoComplete="new-password" value={accessDraft.password} onChange={(event) => setAccessDraft({ ...accessDraft, password: event.target.value })} /></label><label>ACCESS LEVEL<select value={accessDraft.accessLevel} onChange={(event) => setAccessDraft({ ...accessDraft, accessLevel: event.target.value as AccessDraft["accessLevel"] })}><option value="admin">Administrator · users + all projects</option><option value="full">Full access · all projects</option><option value="project">Selected projects only</option></select></label>{accessDraft.accessLevel === "project" && <fieldset><legend>PROJECT ACCESS</legend>{projects.map((item) => <label key={item.id}><input type="checkbox" checked={accessDraft.projectIds.includes(item.id)} onChange={(event) => setAccessDraft({ ...accessDraft, projectIds: event.target.checked ? [...accessDraft.projectIds, item.id] : accessDraft.projectIds.filter((id) => id !== item.id) })} /><span><strong>{item.name}</strong><small>{item.client} · {item.code}</small></span></label>)}</fieldset>}<footer><button type="button" onClick={() => setAccessDraft(null)}>CANCEL</button><button className="solid" disabled={accessSaving} type="submit">{accessSaving ? "SAVING…" : "SAVE ACCESS"}</button></footer></form>}</section>}
      <section className="user-control-section"><p>APPEARANCE</p><div className="theme-choice" role="group" aria-label="Color mode"><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")} aria-pressed={theme === "light"}><i>○</i><span>LIGHT MODE</span></button><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")} aria-pressed={theme === "dark"}><i>●</i><span>DARK MODE</span></button></div></section>
      <section className="user-control-section"><p>WORKSPACE PREFERENCES <span>SAVED ON THIS DEVICE</span></p><button className={compactRows ? "user-setting active" : "user-setting"} onClick={() => setCompactRows(!compactRows)} aria-pressed={compactRows}><span><strong>Compact data rows</strong><small>Fit more budget, backup and production lines on screen.</small></span><i>{compactRows ? "ON" : "OFF"}</i></button><button className={reduceMotion ? "user-setting active" : "user-setting"} onClick={() => setReduceMotion(!reduceMotion)} aria-pressed={reduceMotion}><span><strong>Reduce interface motion</strong><small>Minimize animation and movement throughout the workspace.</small></span><i>{reduceMotion ? "ON" : "OFF"}</i></button></section>
      <section className="user-control-section user-security"><p>SECURITY</p><div><span>SESSION</span><strong>AUTHENTICATED</strong></div><div><span>SIGN-IN METHOD</span><strong>{user.credential ? "PORTAL CREDENTIAL" : "CHATGPT ACCOUNT"}</strong></div></section>
      <footer>{externalLogout ? <a href="/signout-with-chatgpt?return_to=/">LOG OUT <span>→</span></a> : <button onClick={() => void logOut()}>LOG OUT <span>→</span></button>}<small>Preferences apply only to this browser.</small></footer>
    </aside>
  </div>;
}

function LoginScreen({ user, isLocal, enter, preview }: { user: User; isLocal: boolean; enter: () => void; preview: () => void }) {
  return <main className="login-screen"><div className="login-grid" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i style={{ animationDelay: `${index * 70}ms` }} key={index} />)}</div><header><strong>BILL, INC.</strong><span>PRODUCTION CONTROL</span></header><section><p>{user ? `WELCOME BACK · ${user.name.toUpperCase()}` : "ONE WORKSPACE. EVERY MOVING PART."}</p><h1>PRODUCTION,<br />UNDER CONTROL.</h1><span>Budgets, actuals, travel, crew, schedules, locations and client approvals—kept in sync from prep through wrap.</span><div>{user ? <button className="enter-control" onClick={enter}>ENTER PRODUCTION CONTROL <b>→</b></button> : <a href="/signin-with-chatgpt?return_to=/">SIGN IN WITH CHATGPT <b>→</b></a>}{isLocal && !user && <button onClick={preview}>PREVIEW WORKSPACE</button>}</div></section><footer><span>SECURE PRODUCTION PORTAL</span><span>© 2026 BILL, INC.</span></footer></main>;
}

function ControlRoom({ data, totals, openView, openComposer, mutate }: { data: PortalData; totals: { estimate: number; committed: number; actual: number; remaining: number; percent: number }; openView: (view: View) => void; openComposer: (composer: Composer) => void; mutate: Mutate }) {
  const review = data.expenses.filter((expense) => expense.status === "needs_review").length;
  const modules: { tag: string; title: string; view: View; count: string }[] = [
    { tag: "Finance", title: "Budget", view: "budget", count: `${data.budgetVersions.length} versions` }, { tag: "Finance", title: "Reconciliation", view: "reconcile", count: `${review} to review` }, { tag: "Finance", title: "Backup", view: "backup", count: `${data.files.filter((file) => file.category.toLowerCase() === "backup").length} files` }, { tag: "Finance", title: "CC Log", view: "cc", count: `${data.expenses.length} charges` },
    { tag: "Operations", title: "Production Sheet", view: "production", count: `${moduleRows(data, "production").length} items` }, { tag: "Operations", title: "Headcount", view: "crew", count: `${moduleRows(data, "crew").length} people` }, { tag: "Operations", title: "Schedule", view: "schedule", count: `${moduleRows(data, "schedule").length} rows` }, { tag: "Logistics", title: "Travel Charts", view: "travel", count: `${moduleRows(data, "travel").length} records` },
    { tag: "Generated", title: "Call Sheet", view: "callsheet", count: "Synced live" }, { tag: "Scouting", title: "Locations", view: "locations", count: `${data.locations.length} options` }, { tag: "Client", title: "Client Portal", view: "client", count: `${moduleRows(data, "client_share").length} shared` },
  ];
  return <section className="control-room"><div className="control-title"><div><p className="kicker">BILL, INC. · PRODUCTION</p><h1>CONTROL ROOM</h1><p>{data.project.name} · {data.project.client}</p></div><div className="control-actions"><label className="status-select"><span /><select value={data.project.status} onChange={(event) => mutate({ action: "update_project_status", status: event.target.value }, "Project status updated")}><option>Planning</option><option>Pre-production</option><option>Production</option><option>Post-production</option><option>On hold</option><option>Delivered</option></select></label><button className="black-button" onClick={() => openComposer("expense")}>＋ EXPENSE</button></div></div>
    <div className="control-strip"><div><span>JOB</span><strong>{data.project.code}</strong></div><div><span>CLIENT</span><strong>{data.project.client}</strong></div><div><span>SHOOT</span><strong>{formatDate(data.project.shoot_start)}—{formatDate(data.project.shoot_end)}</strong></div><div><span>STATUS</span><strong>{data.project.status}</strong></div></div>
    <div className="control-finance"><article><p>APPROVED ESTIMATE</p><strong>{money.format(totals.estimate)}</strong><div className="wide-meter"><span style={{ width: `${Math.min(totals.percent, 100)}%` }} /></div><footer><span>COMMITTED <b>{money.format(totals.committed)}</b></span><span>ACTUAL <b>{money.format(totals.actual)}</b></span><span>REMAINING <b>{money.format(totals.remaining)}</b></span></footer></article><aside><p>SYNC STATUS</p><strong>CALL SHEET LIVE</strong><span>Crew and schedule changes flow through automatically.</span><button onClick={() => openView("callsheet")}>OPEN GENERATED CALL SHEET →</button></aside></div>
    <div className="section-label"><span>PRODUCTION MODULES</span><b>{modules.length} LIVE</b></div><div className="module-grid">{modules.map((module) => <button onClick={() => openView(module.view)} key={module.title}><div><span>{module.tag}</span><b>↗</b></div><h2>{module.title}</h2><footer><span>{module.count}</span><b>→</b></footer></button>)}</div>
    <div className="control-lower"><article className="attention"><Heading kicker="Needs attention" title="Keep the day moving" /><button onClick={() => openView("reconcile")}><span>!</span><strong>{review} card charge{review === 1 ? "" : "s"} to review</strong><b>→</b></button><button onClick={() => openView("travel")}><span>↗</span><strong>Travel imports can create hotel and car holds</strong><b>→</b></button><button onClick={() => openView("locations")}><span>⌂</span><strong>Location board ready for client review</strong><b>→</b></button></article><article className="recent"><Heading kicker="Live activity" title="Latest across production" /><ActivityList activities={data.activities.slice(0, 4)} /></article></div></section>;
}

function BudgetView({ data, lines, totals, expenses, openComposer, mutate }: { data: PortalData; lines: BudgetLine[]; totals: { estimate: number; committed: number; actual: number; remaining: number; percent: number }; expenses: Expense[]; openComposer: (composer: Composer) => void; mutate: Mutate }) {
  const [compareId, setCompareId] = useState(data.budgetVersions.find((version) => version.status !== "confirmed")?.id ?? data.budgetVersions[0]?.id ?? "");
  const baseline = data.budgetVersions.find((version) => version.id === compareId);
  const baselineMap = new Map((baseline?.snapshot ?? []).map((line) => [line.id, Number(line.estimate)]));
  const actualFor = (id: string) => expenses.filter((expense) => expense.budget_line_id === id && expense.status === "matched").reduce((sum, expense) => sum + Number(expense.amount), 0);
  const committedFor = (id: string) => expenses.filter((expense) => expense.budget_line_id === id).reduce((sum, expense) => sum + Number(expense.amount), 0);
  return <Page kicker="Finance · Versioned estimate" title="Budget" copy="Edit in place, preserve every version, and make client-facing changes explicit." actions={<><button className="outline-button" onClick={() => mutate({ action: "save_budget_version", confirm: false }, "New draft budget version added")}>＋ ADD VERSION</button><button className="black-button" onClick={() => openComposer("budget")}>＋ LINE</button></>}>
    <div className="dense-metrics"><Metric label="Estimate" value={money.format(totals.estimate)} note="Working version" /><Metric label="Committed" value={money.format(totals.committed)} note={`${totals.percent}% of estimate`} /><Metric label="Actual" value={money.format(totals.actual)} note="Matched costs" /><Metric label="Remaining" value={money.format(totals.remaining)} note="After commitments" /></div>
    <div className="budget-toolbar"><div><span>WORKING ESTIMATE</span><strong>LIVE EDIT</strong></div><label>COMPARE TO<select value={compareId} onChange={(event) => setCompareId(event.target.value)}>{data.budgetVersions.map((version) => <option value={version.id} key={version.id}>{version.name}</option>)}</select></label><button onClick={() => mutate({ action: "save_budget_version", confirm: true }, "New budget version confirmed")}>CONFIRM AS NEW VERSION</button></div>
    <div className="work-table budget-editor"><div className="work-head"><span>Category / cost line</span><span>Estimate</span><span>Change</span><span>Committed</span><span>Actual</span><span>Variance</span></div>{lines.map((line) => <BudgetLineRow line={line} baseline={baselineMap.get(line.id)} committed={committedFor(line.id)} actual={actualFor(line.id)} mutate={mutate} key={line.id} />)}<div className="work-total"><span>TOTAL</span><span>{money.format(totals.estimate)}</span><span>{baseline ? signedMoney(totals.estimate - baseline.snapshot.reduce((sum, line) => sum + Number(line.estimate), 0)) : "—"}</span><span>{money.format(totals.committed)}</span><span>{money.format(totals.actual)}</span><span>{money.format(totals.remaining)}</span></div></div>
    <div className="version-history"><Heading kicker="Budget history" title="Versions & status" />{data.budgetVersions.map((version) => <div key={version.id}><span><strong>{version.name}</strong><small>{new Date(version.created_at).toLocaleDateString()}</small></span><b className={`version-status ${version.status}`}>{version.status}</b><span>{money.format(version.snapshot.reduce((sum, line) => sum + Number(line.estimate), 0))}</span><button onClick={() => mutate({ action: "set_budget_version_status", id: version.id, status: version.status === "archived" ? "confirmed" : "archived" }, "Budget version status updated")}>{version.status === "archived" ? "REACTIVATE" : "ARCHIVE"}</button></div>)}</div>
  </Page>;
}

function BudgetLineRow({ line, baseline, committed, actual, mutate }: { line: BudgetLine; baseline?: number; committed: number; actual: number; mutate: Mutate }) {
  const [draft, setDraft] = useState({ category: line.category, description: line.description, estimate: String(line.estimate) });
  useEffect(() => setDraft({ category: line.category, description: line.description, estimate: String(line.estimate) }), [line.category, line.description, line.estimate]);
  const change = baseline === undefined ? null : Number(draft.estimate) - baseline;
  const commit = () => { if (draft.category !== line.category || draft.description !== line.description || Number(draft.estimate) !== Number(line.estimate)) mutate({ action: "update_budget_line", id: line.id, ...draft, estimate: Number(draft.estimate) }, `${draft.category} updated`); };
  return <div className={`work-row ${change ? "changed-row" : ""}`}><span><input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} onBlur={commit} aria-label="Budget category" /><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} onBlur={commit} aria-label="Budget line description" /></span><span className="money-input"><b>$</b><input type="number" value={draft.estimate} onChange={(event) => setDraft({ ...draft, estimate: event.target.value })} onBlur={commit} aria-label="Estimate" /></span><span className={change && change < 0 ? "negative" : change ? "positive" : "muted"}>{change === null ? "NEW" : change === 0 ? "—" : signedMoney(change)}</span><span>{money.format(committed)}</span><span>{money.format(actual)}</span><span className={Number(draft.estimate) - committed < 0 ? "negative" : ""}>{money.format(Number(draft.estimate) - committed)}</span></div>;
}

function ReconcileView({ expenses, lines, openComposer, mutate }: { expenses: Expense[]; lines: BudgetLine[]; openComposer: (composer: Composer) => void; mutate: Mutate }) {
  const codedLines = codedBudgetLines(lines);
  const lookup = new Map(codedLines.map((entry) => [entry.line.id, entry]));
  const [lineFilter, setLineFilter] = useState("all");
  const actual = expenses.filter((expense) => expense.status === "matched").reduce((sum, expense) => sum + Number(expense.amount), 0);
  const working = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const estimate = lines.reduce((sum, line) => sum + Number(line.estimate), 0);
  const sections = [...new Set(codedLines.map((entry) => entry.section))];
  const visibleExpenses = lineFilter === "all" ? expenses : expenses.filter((expense) => expense.budget_line_id === lineFilter);
  return <Page kicker="Finance · Estimate / working / actual" title="Reconciliation" copy="A live cost report with every variance traceable to its underlying charge." actions={<button className="black-button" onClick={() => openComposer("expense")}>＋ EXPENSE</button>}>
    <div className="dense-metrics"><Metric label="Estimate" value={money.format(estimate)} note="Confirmed production budget" /><Metric label="Working" value={money.format(working)} note="All committed costs" /><Metric label="Actual" value={money.format(actual)} note="Matched and cleared" /><Metric label="Exposure" value={money.format(estimate - working)} note="Estimate less working" /></div>
    <div className="reconcile-caption"><span>COST REPORT BY BUDGET LINE</span><b>{codedLines.length} CODED LINES</b></div>
    <div className="work-table reconcile-summary"><div className="work-head"><span>Budget line</span><span>Estimate</span><span>Working</span><span>Working +/−</span><span>Actuals</span><span>Actuals +/−</span></div>{sections.map((section) => { const sectionLines = codedLines.filter((entry) => entry.section === section); return <section className="reconcile-section-block" key={section}><header><b>{section}</b><strong>{sectionLines[0]?.line.category || "Production"}</strong><span>{sectionLines.length} {sectionLines.length === 1 ? "LINE" : "LINES"}</span></header>{sectionLines.map(({ line, code }) => { const lineCosts = expenses.filter((expense) => expense.budget_line_id === line.id); const lineWorking = lineCosts.reduce((sum, item) => sum + Number(item.amount), 0); const lineActual = lineCosts.filter((item) => item.status === "matched").reduce((sum, item) => sum + Number(item.amount), 0); const workingDiff = lineWorking - Number(line.estimate); const actualDiff = lineActual - lineWorking; const isNa = Boolean(line.is_na); return <button className={`work-row reconcile-line-row ${lineFilter === line.id ? "selected" : ""}`} key={line.id} onClick={() => setLineFilter(lineFilter === line.id ? "all" : line.id)} aria-pressed={lineFilter === line.id}><span className="reconcile-line-ident"><b>{code}</b><span><strong>{line.item_name || line.category}</strong><small>{line.description}</small></span></span><span>{isNa ? "N/A" : money.format(line.estimate)}</span><span>{isNa ? "—" : money.format(lineWorking)}</span><span className={workingDiff < 0 ? "positive" : workingDiff > 0 ? "negative" : "muted"}>{isNa || workingDiff === 0 ? "—" : signedMoney(workingDiff)}</span><span>{isNa ? "—" : money.format(lineActual)}</span><span className={actualDiff < 0 ? "positive" : actualDiff > 0 ? "negative" : "muted"}>{isNa || actualDiff === 0 ? "—" : signedMoney(actualDiff)}</span></button>; })}</section>; })}<div className="work-total"><span>GRAND TOTAL</span><span>{money.format(estimate)}</span><span>{money.format(working)}</span><span className={working - estimate > 0 ? "negative" : "positive"}>{signedMoney(working - estimate)}</span><span>{money.format(actual)}</span><span className={actual - working > 0 ? "negative" : "positive"}>{signedMoney(actual - working)}</span></div></div>
    <div className="table-heading reconcile-transaction-heading"><Heading kicker="Transactions" title="Backup & coding" /><div><label>SHOW<select value={lineFilter} onChange={(event) => setLineFilter(event.target.value)}><option value="all">ALL BUDGET LINES</option>{codedLines.map(({ line, code }) => <option value={line.id} key={line.id}>{code} · {line.item_name || line.category}</option>)}</select></label><span>{expenses.filter((expense) => expense.status === "needs_review").length} NEED REVIEW</span></div></div><div className="work-table expense-work"><div className="work-head"><span>Vendor / memo</span><span>Allocated budget line</span><span>Date</span><span>Amount</span><span>Status</span></div>{visibleExpenses.length ? visibleExpenses.map((expense) => { const allocated = lookup.get(expense.budget_line_id); return <div className="work-row" key={expense.id}><span><strong>{expense.vendor}</strong><small>{expense.memo}</small></span><span className="expense-allocation"><select aria-label={`Allocate ${expense.vendor} to budget line`} value={expense.budget_line_id} onChange={(event) => mutate({ action: "update_expense_allocation", id: expense.id, budgetLineId: event.target.value }, `${expense.vendor} allocated to ${lookup.get(event.target.value)?.code || "budget line"}`)}>{codedLines.map(({ line, code }) => <option value={line.id} key={line.id}>{code} · {line.item_name || line.category}</option>)}</select><small>{allocated?.line.description || "Choose a budget line"}</small></span><span>{formatDate(expense.spend_date)}</span><span><strong>{money.format(expense.amount)}</strong></span><span><button className={`status-chip ${expense.status}`} onClick={() => mutate({ action: "update_expense_status", id: expense.id, status: expense.status === "matched" ? "needs_review" : "matched" }, "Expense coding updated")}>{titleCase(expense.status)}</button></span></div>; }) : <Empty text="NO TRANSACTIONS ON THIS LINE" note="Choose All Budget Lines or add an expense." />}</div>
  </Page>;
}

function BackupView({ files, expenses, lines, audits, filePicker, uploadBackup, chooseBackup, removeFile, mutate, auditBudget, saving, auditing }: { files: FileAsset[]; expenses: Expense[]; lines: BudgetLine[]; audits: BudgetAudit[]; filePicker: RefObject<HTMLInputElement | null>; uploadBackup: (event: ChangeEvent<HTMLInputElement>) => void; chooseBackup: (file?: File) => void; removeFile: (file: FileAsset) => void; mutate: Mutate; auditBudget: () => void; saving: boolean; auditing: boolean }) {
  const backupFiles = files.filter((file) => file.category.toLowerCase() === "backup"); const codedLines = codedBudgetLines(lines); const lineLookup = new Map(codedLines.map((entry) => [entry.line.id, entry])); const backedExpenseIds = new Set(backupFiles.map((file) => file.expense_id).filter(Boolean)); const missing = expenses.filter((expense) => !backedExpenseIds.has(expense.id)); const verified = backupFiles.filter((file) => file.status === "verified").length; const total = backupFiles.reduce((sum, file) => sum + Number(file.amount || 0), 0); const lastAudit = audits[0]; let auditNotes: AuditNote[] = []; try { auditNotes = Array.isArray(lastAudit?.notes) ? lastAudit.notes : JSON.parse(lastAudit?.notes || "[]"); } catch { auditNotes = []; }
  return <Page kicker="Finance · Backup register" title="Receipts & Invoices" copy="Every upload is coded to a budget line and checked against reconciliation." actions={<><button className="outline-button" disabled={auditing} onClick={auditBudget}>{auditing ? "AUDITING…" : "AUDIT BUDGET ↗"}</button><button className="black-button" onClick={() => filePicker.current?.click()}>{saving ? "UPLOADING…" : "＋ UPLOAD"}</button></>}>
    <input ref={filePicker} type="file" accept="image/*,application/pdf,.csv" hidden onChange={uploadBackup} />
    <div className="backup-metrics"><Metric label="Backup received" value={money.format(total)} note={`${backupFiles.length} document${backupFiles.length === 1 ? "" : "s"}`} /><Metric label="Verified" value={`${verified} / ${backupFiles.length}`} note="Reviewed documents" /><Metric label="Missing backup" value={String(missing.length)} note="Costs without a document" /><Metric label="Last audit" value={lastAudit ? formatDate(lastAudit.created_at.slice(0, 10)) : "—"} note={lastAudit ? `${auditNotes.length} audit notes` : "Not run yet"} /></div>
    <button className="upload-zone compact" onClick={() => filePicker.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseBackup(event.dataTransfer.files?.[0]); }}><strong>DROP RECEIPTS & INVOICES HERE</strong><span>You’ll choose the exact budget line, vendor, amount and date before upload.</span></button>
    <div className="backup-register-heading"><Heading kicker="Complete backend register" title="All backup" /><span>{backupFiles.length} DOCUMENTS · {verified} VERIFIED</span></div>
    <div className="work-table backup-file-work"><div className="work-head"><span>Vendor / file</span><span>Budget line</span><span>Date</span><span>Amount</span><span>Status</span><span>Document</span></div>{backupFiles.length ? backupFiles.map((file) => { const allocation = lineLookup.get(file.budget_line_id || ""); return <div className="work-row" key={file.id}><span><strong>{file.vendor || file.filename}</strong><small>{file.filename} · {(file.size / 1024).toFixed(0)} KB</small></span><span><strong>{allocation?.code || "UNASSIGNED"}</strong><small>{allocation?.line.item_name || "Budget line missing"}</small></span><span>{file.spend_date ? formatDate(file.spend_date) : "—"}</span><span><strong>{money.format(Number(file.amount || 0))}</strong></span><span><button className={`status-chip ${file.status}`} onClick={() => mutate({ action: "update_backup_status", id: file.id, status: file.status === "verified" ? "needs_review" : "verified" }, `${file.filename} ${file.status === "verified" ? "returned to review" : "verified"}`)}>{file.status === "verified" ? "VERIFIED" : "VERIFY"}</button></span><span><a href={`/api/files?key=${encodeURIComponent(file.object_key)}`} target="_blank">VIEW ↗</a><button aria-label={`Remove ${file.filename}`} onClick={() => removeFile(file)}>×</button></span></div>; }) : <Empty text="NO BACKUP YET" note="Upload the first receipt or invoice above." />}</div>
    <div className="backup-register-heading"><Heading kicker="Coverage check" title="Missing backup" /><span>{missing.length} COST{missing.length === 1 ? "" : "S"} WITHOUT DOCUMENTS</span></div>
    <div className="work-table backup-missing-work"><div className="work-head"><span>Vendor / memo</span><span>Budget line</span><span>Date</span><span>Amount</span><span>Coverage</span></div>{missing.length ? missing.map((expense) => { const allocation = lineLookup.get(expense.budget_line_id); return <div className="work-row" key={expense.id}><span><strong>{expense.vendor}</strong><small>{expense.memo}</small></span><span><strong>{allocation?.code || "UNASSIGNED"}</strong><small>{allocation?.line.item_name || "Budget line missing"}</small></span><span>{formatDate(expense.spend_date)}</span><span><strong>{money.format(expense.amount)}</strong></span><span><b className="backup-missing-chip">MISSING BACKUP</b></span></div>; }) : <div className="backup-coverage-clear"><strong>✓ COMPLETE</strong><span>Every current cost has linked backup.</span></div>}</div>
    <section className="budget-audit-panel"><header><div><span>AI + RULES AUDIT</span><h2>BUDGET AUDIT NOTES</h2></div><button disabled={auditing} onClick={auditBudget}>{auditing ? "AUDITING…" : "RUN NEW AUDIT ↗"}</button></header>{lastAudit ? <><div className="audit-summary"><span>{lastAudit.source === "openai" ? "OPENAI + DOCUMENT REVIEW" : "AUTOMATED CROSS-CHECK"}</span><strong>{lastAudit.summary}</strong><time>{new Date(lastAudit.created_at).toLocaleString()}</time></div><div className="audit-notes">{auditNotes.map((note, index) => <article className={note.severity} key={`${note.title}-${index}`}><b>{note.severity}</b><div><strong>{note.title}</strong><p>{note.detail}</p></div><span>{note.line_code || "—"}{typeof note.amount === "number" ? ` · ${money.format(note.amount)}` : ""}</span></article>)}</div></> : <div className="audit-empty"><strong>NO AUDIT RUN YET</strong><span>Run an audit to cross-check budget lines, costs, duplicate entries, receipt coverage and document metadata.</span></div>}</section>
  </Page>;
}

function CCView({ expenses, lines, ccPicker, importStatement, openComposer, mutate }: { expenses: Expense[]; lines: BudgetLine[]; ccPicker: RefObject<HTMLInputElement | null>; importStatement: (event: ChangeEvent<HTMLInputElement>) => void; openComposer: (composer: Composer) => void; mutate: Mutate }) {
  const lookup = new Map(lines.map((line) => [line.id, line.category]));
  return <Page kicker="Finance · Credit card log" title="Card Charges" copy="Import a statement and code charges directly into reconciliation." actions={<><button className="outline-button" onClick={() => ccPicker.current?.click()}>IMPORT CSV ↑</button><button className="black-button" onClick={() => openComposer("expense")}>＋ CHARGE</button></>}><input ref={ccPicker} type="file" accept=".csv,text/csv" hidden onChange={importStatement} /><div className="work-table cc-work"><div className="work-head"><span>Date</span><span>Merchant</span><span>Amount</span><span>Budget category</span><span>Status</span></div>{expenses.map((expense) => <div className="work-row" key={expense.id}><span>{formatDate(expense.spend_date)}</span><span><strong>{expense.vendor}</strong><small>{expense.memo}</small></span><span><strong>{money.format(expense.amount)}</strong></span><span>{lookup.get(expense.budget_line_id) ?? "Unassigned"}</span><span><button className={`status-chip ${expense.status}`} onClick={() => mutate({ action: "update_expense_status", id: expense.id, status: expense.status === "matched" ? "needs_review" : "matched" }, "Charge status updated")}>{titleCase(expense.status)}</button></span></div>)}</div></Page>;
}

function RecordView({ title, kicker, copy, records, columns, open, remove }: { title: string; kicker: string; copy: string; records: ModuleRecord[]; columns: string[]; open: () => void; remove: (id: string) => void }) {
  return <Page kicker={kicker} title={title} copy={copy} actions={<button className="black-button" onClick={open}>＋ ROW</button>}><div className={`work-table generic-work cols-${columns.length}`}><div className="work-head">{columns.map((column) => <span key={column}>{titleCase(column)}</span>)}<span /></div>{records.length ? records.map((record) => <div className="work-row" key={record.id}>{columns.map((column, index) => <span key={column}>{index === 0 ? <strong>{record.data[column] || "—"}</strong> : record.data[column] || "—"}</span>)}<span><button onClick={() => remove(record.id)}>×</button></span></div>) : <Empty text="NO ROWS YET" note="Add the first production record above." />}</div></Page>;
}

function HeadcountView({ crew, schedule, open, mutate }: { crew: ModuleRecord[]; schedule: ModuleRecord[]; open: () => void; mutate: Mutate }) {
  const general = generalCall(schedule);
  return <Page kicker="Operations · Synced crew roster" title="Headcount" copy="This roster is the call sheet crew list. Call times recalculate from the schedule." actions={<button className="black-button" onClick={open}>＋ CREW</button>}><div className="sync-banner"><span>↻ LIVE SYNC</span><strong>GENERAL CALL {general}</strong><p>Move the schedule and every automatic crew call moves with it.</p></div><div className="work-table crew-work"><div className="work-head"><span>Name / contact</span><span>Role</span><span>Dietary</span><span>Call rule</span><span>Calculated call</span><span>Location</span><span /></div>{crew.map((record) => { const offset = Number(record.data.callOffset || defaultOffset(record.data.role)); return <div className="work-row" key={record.id}><span><strong>{record.data.name}</strong><small>{record.data.email || record.data.phone}</small></span><span>{record.data.role}</span><span>{record.data.dietary || "—"}</span><span>{offset === 0 ? "General call" : `${offset > 0 ? "+" : ""}${offset} min`}</span><span><strong>{shiftTime(general, offset)}</strong><small>AUTO</small></span><span>{record.data.callLocation || "Basecamp"}</span><span><button onClick={() => mutate({ action: "delete_module_record", id: record.id }, "Crew member removed")}>×</button></span></div>; })}</div></Page>;
}

function TravelView({ records, picker, open, mutate }: { records: ModuleRecord[]; picker: RefObject<HTMLInputElement | null>; open: () => void; mutate: Mutate }) {
  const [autoHotel, setAutoHotel] = useState(true); const [autoCar, setAutoCar] = useState(true); const [traveler, setTraveler] = useState(""); const [pasted, setPasted] = useState(""); const [drag, setDrag] = useState(false);
  const [tripType, setTripType] = useState<PickupPlan["tripType"]>("to_airport"); const [routeTraveler, setRouteTraveler] = useState(""); const [origin, setOrigin] = useState(""); const [destination, setDestination] = useState(""); const [eventDateTime, setEventDateTime] = useState(""); const [bufferMinutes, setBufferMinutes] = useState("15"); const [fallbackMinutes, setFallbackMinutes] = useState("60"); const [planning, setPlanning] = useState(false); const [planError, setPlanError] = useState(""); const [pickupPlan, setPickupPlan] = useState<PickupPlan | null>(null);
  const dateTimeLabel = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  const timeLabel = (value: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
  const localInputValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  async function importFile(file: File) { const bytes = await file.arrayBuffer(); const text = file.type === "application/pdf" ? new TextDecoder("latin1").decode(bytes) : new TextDecoder().decode(bytes); await mutate({ action: "import_travel_reservation", filename: file.name, text, traveler, autoHotel, autoCar }, "Reservation parsed and travel chart updated"); }
  async function onFile(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (file) await importFile(file); event.target.value = ""; }
  async function onDrop(event: DragEvent<HTMLButtonElement>) { event.preventDefault(); setDrag(false); const file = event.dataTransfer.files?.[0]; if (file) await importFile(file); }
  async function calculatePickup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPlanning(true); setPlanError(""); setPickupPlan(null);
    try {
      const flightOrArrival = new Date(eventDateTime);
      if (!Number.isFinite(flightOrArrival.getTime())) throw new Error("Choose a valid date and time.");
      const response = await fetch("/api/travel-time", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin, destination, tripType, eventDateTime: flightOrArrival.toISOString(), bufferMinutes, fallbackMinutes }) });
      const result = await response.json() as PickupPlan & { error?: string };
      if (!response.ok) throw new Error(result.error || "Pickup time could not be calculated.");
      setPickupPlan(result);
    } catch (reason) { setPlanError(reason instanceof Error ? reason.message : "Pickup time could not be calculated."); }
    finally { setPlanning(false); }
  }
  async function savePickup() {
    if (!pickupPlan) return;
    const status = pickupPlan.source === "google_traffic" ? "Traffic planned" : "Estimated · verify";
    await mutate({ action: "add_module_record", module: "travel", data: { type: "Transfer", traveler: routeTraveler || traveler || "Traveler", provider: pickupPlan.source === "google_traffic" ? "Google live traffic" : "Routing estimate", confirmation: "PICKUP PLAN", from: pickupPlan.origin, to: pickupPlan.destination, departDate: pickupPlan.pickupAt.slice(0, 10), departTime: timeLabel(pickupPlan.pickupAt), arriveTime: timeLabel(pickupPlan.estimatedDestinationAt), detail: `${pickupPlan.origin} → ${pickupPlan.destination}`, timing: `${dateTimeLabel(pickupPlan.pickupAt)} pickup`, status, source: pickupPlan.source === "google_traffic" ? "Live traffic route" : "Fallback drive estimate", driveMinutes: String(pickupPlan.driveMinutes), distanceMiles: pickupPlan.distanceMiles == null ? "" : String(pickupPlan.distanceMiles), airportRule: pickupPlan.tripType === "to_airport" ? "Arrive 2 hours before flight" : "" } }, "Pickup plan added to travel chart and call sheet");
    setPickupPlan(null);
  }
  function prepareFlight(record: ModuleRecord) {
    const rawDate = record.data.departDate || ""; const rawTime = record.data.departTime || ""; const dated = /\b\d{4}\b/.test(rawDate) ? rawDate : `${rawDate}, ${new Date().getFullYear()}`; const parsed = new Date(`${dated} ${rawTime}`);
    setTripType("to_airport"); setRouteTraveler(record.data.traveler || ""); setDestination(`${record.data.from || "Departure"} Airport`); setBufferMinutes("15"); setPickupPlan(null); setPlanError(""); if (Number.isFinite(parsed.getTime())) setEventDateTime(localInputValue(parsed));
    document.getElementById("pickup-planner")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  return <Page kicker="Logistics · Synced reservations" title="Travel Charts" copy="Drop a confirmation, then calculate traffic-aware pickups that feed the call sheet." actions={<button className="black-button" onClick={open}>＋ MANUAL ROW</button>}>
    <input ref={picker} type="file" accept=".pdf,.eml,.txt,.html,message/rfc822,application/pdf" hidden onChange={onFile} />
    <div className="travel-import"><button className={drag ? "drop active" : "drop"} onClick={() => picker.current?.click()} onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}><strong>DROP TRAVEL RESERVATION</strong><span>PDF, airline email, itinerary or confirmation text</span></button><div className="travel-options"><label>TRAVELER<input value={traveler} onChange={(event) => setTraveler(event.target.value)} placeholder="Name from headcount" /></label><label className="check"><input type="checkbox" checked={autoHotel} onChange={(event) => setAutoHotel(event.target.checked)} />Suggest hotel from flight dates</label><label className="check"><input type="checkbox" checked={autoCar} onChange={(event) => setAutoCar(event.target.checked)} />Suggest arrival car · route below</label></div><div className="paste-reservation"><textarea value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder="Or paste a confirmation email here…" /><button disabled={!pasted.trim()} onClick={async () => { await mutate({ action: "import_travel_reservation", filename: "Pasted reservation", text: pasted, traveler, autoHotel, autoCar }, "Reservation parsed and travel chart updated"); setPasted(""); }}>PARSE RESERVATION →</button></div></div>
    <section className="pickup-planner" id="pickup-planner"><header><div><span>GROUND TRANSPORT · ROUTE PLANNING</span><h2>TRAFFIC-AWARE PICKUP PLANNER</h2></div><b>✈ AIRPORT ARRIVAL = 2 HOURS BEFORE FLIGHT</b></header><form onSubmit={calculatePickup}><label>TRIP TYPE<select value={tripType} onChange={(event) => { const next = event.target.value as PickupPlan["tripType"]; setTripType(next); setBufferMinutes(next === "from_airport" ? "30" : "15"); setPickupPlan(null); }}><option value="to_airport">To airport</option><option value="from_airport">From airport</option><option value="general">General transfer</option></select></label><label>TRAVELER<input value={routeTraveler} onChange={(event) => setRouteTraveler(event.target.value)} placeholder="Name from headcount" /></label><label className="wide">ORIGIN<input value={origin} onChange={(event) => { setOrigin(event.target.value); setPickupPlan(null); }} placeholder="Hotel, home or production address" required /></label><label className="wide">DESTINATION<input value={destination} onChange={(event) => { setDestination(event.target.value); setPickupPlan(null); }} placeholder="Airport, hotel or location" required /></label><label>{tripType === "to_airport" ? "FLIGHT DEPARTURE" : tripType === "from_airport" ? "FLIGHT ARRIVAL" : "REQUIRED ARRIVAL"}<input type="datetime-local" value={eventDateTime} onChange={(event) => { setEventDateTime(event.target.value); setPickupPlan(null); }} required /></label><label>{tripType === "from_airport" ? "BAGGAGE / EXIT BUFFER" : "PRODUCTION BUFFER"}<select value={bufferMinutes} onChange={(event) => setBufferMinutes(event.target.value)}><option value="0">No buffer</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label><label>FALLBACK DRIVE TIME<input type="number" min="5" max="360" value={fallbackMinutes} onChange={(event) => setFallbackMinutes(event.target.value)} /><small>Used only if live routing is unavailable</small></label><button className="black-button" disabled={planning}>{planning ? "CHECKING TRAFFIC…" : "CHECK DRIVE + CALCULATE →"}</button></form>{planError && <div className="pickup-plan-error">{planError}</div>}{pickupPlan && <div className="pickup-result"><div><span>SUGGESTED PICKUP</span><strong>{dateTimeLabel(pickupPlan.pickupAt)}</strong><small>{pickupPlan.tripType === "to_airport" ? `Airport arrival ${dateTimeLabel(pickupPlan.arriveBy)}` : `Destination ETA ${dateTimeLabel(pickupPlan.estimatedDestinationAt)}`}</small></div><div><span>DRIVE</span><strong>{pickupPlan.driveMinutes} MIN</strong><small>{pickupPlan.distanceMiles == null ? "Distance pending live route" : `${pickupPlan.distanceMiles} miles`}</small></div><div><span>TRAFFIC</span><strong>{pickupPlan.source === "google_traffic" ? "LIVE" : "ESTIMATE"}</strong><small>{pickupPlan.trafficDelayMinutes == null ? "Using fallback drive time" : `+${pickupPlan.trafficDelayMinutes} min vs. clear traffic`}</small></div><div><span>BUFFER</span><strong>{pickupPlan.tripType === "to_airport" ? "2 HR + " : ""}{pickupPlan.bufferMinutes} MIN</strong><small>{pickupPlan.tripType === "to_airport" ? "Preflight arrival + production buffer" : "Loading / production buffer"}</small></div><button onClick={savePickup}>＋ ADD TRANSFER TO CHART</button></div>}</section>
    <div className="work-table travel-work"><div className="work-head"><span>Traveler</span><span>Type</span><span>Route / property</span><span>Date / time</span><span>Confirmation</span><span>Status</span><span /></div>{records.map((record) => <div className="work-row" key={record.id}><span><strong>{record.data.traveler}</strong><small>{record.data.source || "Manual entry"}</small></span><span>{record.data.type}</span><span><strong>{record.data.detail}</strong><small>{record.data.from && record.data.to ? `${record.data.from} → ${record.data.to}` : ""}</small></span><span>{record.data.timing}</span><span>{record.data.confirmation || "—"}</span><span><b className="to-code">{record.data.status}</b></span><span>{record.data.type === "Flight" && <button className="plan-flight" onClick={() => prepareFlight(record)}>PLAN</button>}<button onClick={() => mutate({ action: "delete_module_record", id: record.id }, "Travel item removed")}>×</button></span></div>)}</div>
  </Page>;
}

function ScheduleView({ records, open, mutate, publish }: { records: ModuleRecord[]; open: () => void; mutate: Mutate; publish: () => void }) {
  const ordered = [...records].sort((a, b) => (a.data.time || "").localeCompare(b.data.time || ""));
  return <Page kicker="Operations · Live source" title="Schedule" copy="This timeline drives general call, crew calls, and the generated call sheet." actions={<><button className="outline-button" onClick={publish}>PUSH TO CLIENT →</button><button className="black-button" onClick={open}>＋ ROW</button></>}><div className="sync-banner"><span>↻ CALL SHEET SOURCE</span><strong>{ordered.length} SCHEDULED ITEMS</strong><p>Changes made here flow into the call sheet automatically.</p></div><div className="schedule-sheet"><div className="schedule-head"><span>TIME</span><span>EVENT</span><span>LOCATION</span><span /></div>{ordered.map((record) => <ScheduleRow record={record} mutate={mutate} key={record.id} />)}</div></Page>;
}

function ScheduleRow({ record, mutate }: { record: ModuleRecord; mutate: Mutate }) {
  const [data, setData] = useState(record.data); useEffect(() => setData(record.data), [record.data]);
  const save = () => { if (JSON.stringify(data) !== JSON.stringify(record.data)) mutate({ action: "update_module_record", module: "schedule", id: record.id, data }, "Schedule and call sheet updated"); };
  return <div className="schedule-row"><input type="time" value={data.time || ""} onChange={(event) => setData({ ...data, time: event.target.value })} onBlur={save} /><input value={data.event || ""} onChange={(event) => setData({ ...data, event: event.target.value })} onBlur={save} /><input value={data.location || ""} onChange={(event) => setData({ ...data, location: event.target.value })} onBlur={save} /><button onClick={() => mutate({ action: "delete_module_record", id: record.id }, "Schedule row removed")}>×</button></div>;
}

function CallSheet({ project, crew, schedule, travel, locations, publish }: { project: Project; crew: ModuleRecord[]; schedule: ModuleRecord[]; travel: ModuleRecord[]; locations: Location[]; publish: () => void }) {
  const ordered = [...schedule].sort((a, b) => (a.data.time || "").localeCompare(b.data.time || "")); const general = generalCall(ordered); const approved = locations.find((location) => location.status === "approved");
  return <Page kicker="Generated · No duplicate entry" title="Call Sheet" copy="Built live from headcount, schedule, travel and approved location data." actions={<><button className="outline-button" onClick={publish}>PUSH TO CLIENT →</button><button className="black-button" onClick={() => window.print()}>EXPORT PDF ↓</button></>}><div className="sync-banner"><span>✓ FULLY SYNCED</span><strong>LAST GENERATED NOW</strong><p>{crew.length} crew · {ordered.length} schedule rows · {travel.length} travel records</p></div><article className="call-sheet"><header><div><span>BILL, INC.</span><h2>{project.name}</h2><p>DAY 01 · {formatDate(project.shoot_start)} · {project.code}</p></div><div><span>GENERAL CALL</span><strong>{general}</strong><small>{approved?.name || "LOCATION TBD"}</small></div></header><section><h3>SCHEDULE</h3>{ordered.map((record) => <div className="call-row" key={record.id}><time>{record.data.time}</time><strong>{record.data.event}</strong><span>{record.data.location}</span></div>)}</section><section><h3>CREW · {crew.length}</h3>{crew.map((record) => { const call = shiftTime(general, Number(record.data.callOffset || defaultOffset(record.data.role))); return <div className="crew-row" key={record.id}><strong>{record.data.name}</strong><span>{record.data.role}</span><span>{call}</span><span>{record.data.callLocation || "Basecamp"}</span></div>; })}</section>{travel.length > 0 && <section><h3>TRAVEL / MOVEMENTS</h3>{travel.filter((record) => ["Flight", "Car", "Transfer"].includes(record.data.type)).map((record) => <div className="call-row" key={record.id}><time>{record.data.departTime || "—"}</time><strong>{record.data.traveler}</strong><span>{record.data.detail}</span></div>)}</section>}<footer><span>BILL, INC.</span><span>LIVE CALL SHEET · {project.code}</span><span>{project.client}</span></footer></article></Page>;
}

function LocationsView({ project, locations, open, mutate }: { project: Project; locations: Location[]; open: () => void; mutate: Mutate }) {
  const [preview, setPreview] = useState(false);
  if (preview) return <LocationPresentation project={project} locations={locations} close={() => setPreview(false)} mutate={mutate} />;
  return <Page kicker="Scouting · Location library" title="Locations" copy="Build the board once, then present it as a private site or print-ready PDF." actions={<><button className="outline-button" onClick={() => setPreview(true)}>CLIENT PREVIEW ↗</button><button className="black-button" onClick={open}>＋ LOCATION</button></>}><div className="location-toolbar"><span>{locations.length} OPTIONS · {locations.filter((location) => location.status === "approved").length} APPROVED</span><button onClick={() => { setPreview(true); window.setTimeout(() => window.print(), 150); }}>EXPORT BOARD PDF ↓</button></div><div className="location-grid">{locations.map((location) => <article className="location-card" key={location.id}><div className="location-image" style={location.image_url ? { backgroundImage: `linear-gradient(180deg, transparent 58%, rgba(0,0,0,.42)), url(${location.image_url})` } : undefined}><span>{titleCase(location.status)}</span></div><div className="location-body"><p>{location.city}</p><div><h2>{location.name}</h2><strong>{money.format(location.rate)}<small>/ DAY</small></strong></div><p>{location.note}</p><blockquote>{location.client_note}</blockquote><div className="tags">{location.tags.split("|").map((tag) => <span key={tag}>{tag}</span>)}</div><footer><button className={location.status === "approved" ? "active" : ""} onClick={() => mutate({ action: "update_location_status", id: location.id, status: "approved" }, `${location.name} approved`)}>✓ APPROVE</button><button className={location.status === "shortlisted" ? "active" : ""} onClick={() => mutate({ action: "update_location_status", id: location.id, status: "shortlisted" }, `${location.name} shortlisted`)}>＋ SHORTLIST</button></footer></div></article>)}</div></Page>;
}

function LocationPresentation({ project, locations, close, mutate }: { project: Project; locations: Location[]; close: () => void; mutate: Mutate }) {
  const [selected, setSelected] = useState(0); const location = locations[selected];
  if (!location) return <section className="location-presentation"><button onClick={close}>× EXIT</button><Empty text="NO LOCATIONS" note="Add a location before presenting." /></section>;
  return <section className="location-presentation"><header><div><strong>BILL, INC.</strong><span>{project.name} · LOCATION BOARD</span></div><div><button onClick={() => window.print()}>PDF ↓</button><button onClick={close}>× EXIT</button></div></header><main><div className="presentation-photo" style={{ backgroundImage: `linear-gradient(180deg, transparent 55%, rgba(0,0,0,.6)), url(${location.image_url})` }}><span>{pad(selected + 1)} / {pad(locations.length)}</span><div><p>{location.city}</p><h1>{location.name}</h1></div></div><aside><p>CLIENT NOTES</p><h2>{location.client_note}</h2><dl><div><dt>RATE</dt><dd>{money.format(location.rate)} / DAY</dd></div><div><dt>STATUS</dt><dd>{titleCase(location.status)}</dd></div><div><dt>PRODUCTION NOTE</dt><dd>{location.note}</dd></div></dl><div className="tags">{location.tags.split("|").map((tag) => <span key={tag}>{tag}</span>)}</div><footer><button onClick={() => mutate({ action: "update_location_status", id: location.id, status: "shortlisted" }, `${location.name} shortlisted`)}>SHORTLIST</button><button onClick={() => mutate({ action: "update_location_status", id: location.id, status: "approved" }, `${location.name} approved`)}>APPROVE</button></footer></aside></main><nav>{locations.map((item, index) => <button className={index === selected ? "active" : ""} onClick={() => setSelected(index)} key={item.id}><span>{pad(index + 1)}</span>{item.name}</button>)}</nav></section>;
}

function ClientPortal({ data, totals, preview, setPreview, publish }: { data: PortalData; totals: { estimate: number; committed: number; actual: number; remaining: number; percent: number }; preview: boolean; setPreview: (value: boolean) => void; publish: Mutate }) {
  const shares = moduleRows(data, "client_share"); const versions = data.budgetVersions; const [fromId, setFromId] = useState(versions[1]?.id ?? versions[0]?.id ?? ""); const [toId, setToId] = useState(versions[0]?.id ?? ""); const from = versions.find((version) => version.id === fromId); const to = versions.find((version) => version.id === toId); const comparison = compareBudgets(from?.snapshot ?? [], to?.snapshot ?? []);
  if (preview) return <section className="client-preview"><header><div><strong>BILL, INC.</strong><span /><b>{data.project.name}</b></div><button onClick={() => setPreview(false)}>× EXIT CLIENT MODE</button></header><main><div><p>CLIENT PORTAL · {data.project.client}</p><span>LIVE PRODUCTION HANDOFF</span></div><h1>{data.project.name}</h1><section className="client-budget-compare"><header><div><span>COMPARE ESTIMATES</span><strong>{from?.name || "Earlier"} → {to?.name || "Current"}</strong></div><div><label>FROM<select value={fromId} onChange={(event) => setFromId(event.target.value)}>{versions.map((version) => <option value={version.id} key={version.id}>{version.name}</option>)}</select></label><label>TO<select value={toId} onChange={(event) => setToId(event.target.value)}>{versions.map((version) => <option value={version.id} key={version.id}>{version.name}</option>)}</select></label></div></header><div className="compare-head"><span>Cost line</span><span>Previous</span><span>Current</span><span>Change</span></div>{comparison.map((row) => <div className={row.delta ? "compare-row changed" : "compare-row"} key={row.key}><span><strong>{row.category}</strong><small>{row.description}</small></span><span>{money.format(row.before)}</span><span>{money.format(row.after)}</span><span className={row.delta < 0 ? "negative" : row.delta > 0 ? "positive" : ""}>{row.delta ? signedMoney(row.delta) : "—"}</span></div>)}</section><div className="client-grid">{shares.map((share) => <article key={share.id}><header><span>{share.data.kind}</span><b>↗</b></header><h2>{share.data.label}</h2><p>Shared {share.data.date}</p><footer><span>OPEN DOCUMENT</span><b>→</b></footer></article>)}<article><header><span>SCOUTING</span><b>↗</b></header><h2>LOCATIONS</h2><p>{data.locations.length} options · {data.locations.filter((location) => location.status === "approved").length} approved</p><footer><span>OPEN BOARD</span><b>→</b></footer></article></div><footer><span>BILL, INC.</span><span>CLIENT PORTAL · {data.project.code}</span><span>{data.project.client}</span></footer></main></section>;
  return <Page kicker="Client · Publishing" title="Client Portal" copy="Publish selected documents and show budget changes—not just the latest total." actions={<button className="black-button" onClick={() => setPreview(true)}>VIEW CLIENT MODE ↗</button>}><div className="client-admin"><section><Heading kicker="Portal access" title={data.project.client} /><div className="portal-credentials"><div><span>ACCESS</span><strong>PRIVATE SITE</strong></div><div><span>PROJECT</span><strong>{data.project.code}</strong></div><div><span>SHARED ITEMS</span><strong>{shares.length}</strong></div></div><div className="push-actions"><button onClick={() => publish({ action: "publish_client_item", kind: "Budget comparison", label: `${from?.name || "Earlier"} → ${to?.name || "Current"}` }, "Budget comparison shared")}>PUSH BUDGET COMPARISON</button><button onClick={() => publish({ action: "publish_client_item", kind: "Cost Report", label: `${data.project.name} · Cost Report` }, "Cost report shared")}>PUSH COST REPORT</button><button onClick={() => publish({ action: "publish_client_item", kind: "Call Sheet", label: `${data.project.name} · Day 01` }, "Call sheet shared")}>PUSH CALL SHEET</button><button onClick={() => publish({ action: "publish_client_item", kind: "Locations", label: `${data.project.name} · Location Board` }, "Location board shared")}>PUSH LOCATIONS</button></div></section><aside><p>CLIENT BUDGET</p><strong>{money.format(totals.estimate)}</strong><div><span>COMMITTED</span><b>{totals.percent}%</b></div><div><span>REMAINING</span><b>{money.format(totals.remaining)}</b></div></aside></div><div className="shared-list"><div className="section-label"><span>PUBLISHED TO CLIENT</span><b>{shares.length} ITEMS</b></div>{shares.map((share) => <div key={share.id}><span>{share.data.kind}</span><strong>{share.data.label}</strong><small>{share.data.date}</small><b>{share.data.status}</b></div>)}</div></Page>;
}

function ActivityView({ activities }: { activities: Activity[] }) { return <Page kicker="System · Audit trail" title="Activity" copy="Every change across production in one running record."><div className="activity-full"><ActivityList activities={activities} /></div></Page>; }
function ActivityList({ activities }: { activities: Activity[] }) { return <div className="activity-list">{activities.map((activity) => <div key={activity.id}><span>{activity.kind.slice(0, 2).toUpperCase()}</span><span><strong>{activity.message}</strong><small>{activity.actor}</small></span><time>{relativeTime(activity.created_at)}</time></div>)}</div>; }
function Heading({ kicker, title }: { kicker: string; title: string }) { return <div className="small-heading"><p>{kicker}</p><h2>{title}</h2></div>; }
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article className="metric"><p>{label}</p><strong>{value}</strong><span>{note}</span></article>; }
function Empty({ text, note }: { text: string; note: string }) { return <div className="empty"><strong>{text}</strong><span>{note}</span></div>; }
function Page({ kicker, title, copy, actions, children }: { kicker: string; title: string; copy: string; actions?: ReactNode; children: ReactNode }) { return <section className="page"><header className="page-head"><div><p>{kicker}</p><h1>{title}</h1><span>{copy}</span></div>{actions && <div>{actions}</div>}</header>{children}</section>; }

function BackupAllocationModal({ file, lines, saving, close, upload }: { file: File; lines: BudgetLine[]; saving: boolean; close: () => void; upload: (values: Record<string, string>) => void }) {
  const codedLines = codedBudgetLines(lines); const suggestedVendor = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key, value]) => [key, String(value)])); upload(values); }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className="composer backup-allocation-modal" onSubmit={submit}><header><div><p>BACKUP ALLOCATION</p><h2>Code This Document</h2></div><button type="button" onClick={close}>×</button></header><div className="backup-file-summary"><span>{file.type.split("/").pop()?.toUpperCase() || "FILE"}</span><div><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(0)} KB</small></div></div><label>Budget line<select name="budgetLineId" required>{codedLines.map(({ line, code }) => <option value={line.id} key={line.id}>{code} · {line.item_name || line.category} — {line.description}</option>)}</select></label><Field label="Vendor" name="vendor" placeholder={suggestedVendor} /><div className="field-pair"><Field label="Amount" name="amount" type="number" placeholder="0.00" /><Field label="Receipt date" name="spendDate" type="date" /></div><Field label="Memo / purpose" name="memo" placeholder={`Backup: ${file.name}`} /><p className="backup-allocation-note">Saving creates the reconciliation cost and links this document to the selected budget line.</p><footer><button type="button" onClick={close}>CANCEL</button><button className="black-button" disabled={saving || !codedLines.length}>{saving ? "UPLOADING…" : "UPLOAD + ALLOCATE"}</button></footer></form></div>;
}

function ComposerModal({ type, lines, saving, close, submit }: { type: Exclude<Composer, null>; lines: BudgetLine[]; saving: boolean; close: () => void; submit: Mutate }) {
  const codedLines = codedBudgetLines(lines);
  function onSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries()); if (["production", "crew", "schedule", "travel"].includes(type)) { submit({ action: "add_module_record", module: type, data: values }, `${titleCase(type)} record added`); return; } const action = type === "project" ? "create_project" : type === "budget" ? "add_budget_line" : type === "expense" ? "add_expense" : "add_location"; submit({ ...values, action }, `${titleCase(type)} added`); }
  const title = type === "project" ? "New Production" : type === "budget" ? "New Budget Line" : type === "expense" ? "New Expense" : type === "location" ? "New Location" : type === "crew" ? "Add Crew Member" : type === "travel" ? "Add Travel Record" : type === "schedule" ? "Add Schedule Row" : "Add Production Item";
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className="composer" onSubmit={onSubmit}><header><div><p>QUICK ADD</p><h2>{title}</h2></div><button type="button" onClick={close}>×</button></header>
    {type === "project" && <><Field label="Project name" name="name" /><Field label="Client" name="client" /><div className="field-pair"><Field label="Job code" name="code" /><Field label="Shoot start" name="shootStart" type="date" /></div><Field label="Shoot end" name="shootEnd" type="date" /></>}
    {type === "budget" && <><Field label="Category" name="category" /><Field label="Description" name="description" /><Field label="Estimate" name="estimate" type="number" /></>}
    {type === "expense" && <><Field label="Vendor" name="vendor" /><label>Budget line<select name="budgetLineId">{codedLines.map(({ line, code }) => <option value={line.id} key={line.id}>{code} · {line.item_name || line.category} — {line.description}</option>)}</select></label><div className="field-pair"><Field label="Amount" name="amount" type="number" /><Field label="Spend date" name="spendDate" type="date" /></div><Field label="Memo" name="memo" /></>}
    {type === "location" && <><Field label="Location name" name="name" /><Field label="City / region" name="city" /><div className="field-pair"><Field label="Day rate" name="rate" type="number" /><Field label="Hero image URL" name="imageUrl" type="url" /></div><Field label="Tags (use | between tags)" name="tags" placeholder="Modern|Daylight|Easy load-in" /><Field label="Production note" name="note" /><Field label="Client-facing note" name="clientNote" /></>}
    {type === "production" && <><Field label="Section" name="section" /><Field label="Item" name="item" /><div className="field-pair"><Field label="Owner" name="owner" /><Field label="Status" name="status" /></div></>}
    {type === "crew" && <><Field label="Name" name="name" /><Field label="Role" name="role" /><div className="field-pair"><Field label="Email" name="email" type="email" /><Field label="Phone" name="phone" /></div><div className="field-pair"><Field label="Dietary" name="dietary" required={false} /><Field label="Call offset (minutes)" name="callOffset" type="number" placeholder="-15" /></div><Field label="Call location" name="callLocation" placeholder="Basecamp" /></>}
    {type === "schedule" && <><Field label="Time" name="time" type="time" /><Field label="Event" name="event" /><Field label="Location" name="location" /></>}
    {type === "travel" && <><label>Type<select name="type"><option>Flight</option><option>Hotel</option><option>Car</option><option>Transfer</option></select></label><Field label="Traveler" name="traveler" /><Field label="Route / property" name="detail" /><div className="field-pair"><Field label="Timing" name="timing" /><Field label="Confirmation" name="confirmation" required={false} /></div><Field label="Status" name="status" placeholder="Confirmed" /></>}
    <footer><button type="button" onClick={close}>CANCEL</button><button className="black-button" disabled={saving}>{saving ? "SAVING…" : "SAVE"}</button></footer></form></div>;
}

function Field({ label, name, type = "text", placeholder, required = true }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) { return <label>{label}<input name={name} type={type} step={type === "number" ? "any" : undefined} placeholder={placeholder} required={required && type !== "url"} /></label>; }
function parseCsvLine(line: string) { const result: string[] = []; let current = "", quoted = false; for (let index = 0; index < line.length; index++) { const char = line[index]; if (char === '"') { if (quoted && line[index + 1] === '"') { current += '"'; index++; } else quoted = !quoted; } else if (char === "," && !quoted) { result.push(current.trim()); current = ""; } else current += char; } result.push(current.trim()); return result; }
function normalizeDate(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10); }
function signedMoney(value: number) { return `${value > 0 ? "+" : value < 0 ? "−" : ""}${money.format(Math.abs(value))}`; }
function compareBudgets(before: BudgetSnapshot[], after: BudgetSnapshot[]) { const beforeMap = new Map(before.map((line) => [line.id, line])); const afterMap = new Map(after.map((line) => [line.id, line])); return [...new Set([...beforeMap.keys(), ...afterMap.keys()])].map((key) => { const a = beforeMap.get(key), b = afterMap.get(key); const previous = Number(a?.estimate ?? 0), current = Number(b?.estimate ?? 0); return { key, category: b?.category || a?.category || "New cost", description: b?.description || a?.description || "", before: previous, after: current, delta: current - previous }; }); }
function generalCall(schedule: ModuleRecord[]) { return [...schedule].sort((a, b) => (a.data.time || "").localeCompare(b.data.time || ""))[0]?.data.time || "06:00"; }
function defaultOffset(role: string) { const value = role.toLowerCase(); if (value.includes("producer") || value.includes("ad")) return -30; if (value.includes("camera") || value.includes("grip") || value.includes("electric")) return -15; if (value.includes("talent")) return 45; return 0; }
function shiftTime(value: string, offset: number) { const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i); if (!match) return value; let hour = Number(match[1]); const minute = Number(match[2]); const suffix = match[3]?.toUpperCase(); if (suffix === "PM" && hour < 12) hour += 12; if (suffix === "AM" && hour === 12) hour = 0; const total = (hour * 60 + minute + offset + 1440) % 1440; const h = Math.floor(total / 60), m = total % 60; return `${pad(h)}:${pad(m)}`; }
