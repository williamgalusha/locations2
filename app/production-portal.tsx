"use client";

import type { ChangeEvent, DragEvent, FormEvent, ReactNode, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReferenceBudgetView, ReferenceClientPortal, ReferenceLocationsView, ReferenceLoginScreen } from "./reference-ui";
import type { PortalAccessLevel, PortalRole } from "./credential-auth";
import { OptionsWorkspace } from "./options-workspace";
import { ScheduleWorkspace } from "./schedule-builder";
import { TravelDeskView } from "./travel-view";

export type Project = { id: string; name: string; client: string; code: string; status: string; shoot_start: string; shoot_end: string; currency: string; contact?: string; contact_email?: string; billing_address?: string; po_no?: string; budget_notes?: string; budget_changes?: string; markup_pct?: number; insurance_pct?: number };
export type BudgetLine = { id: string; category: string; description: string; estimate: number; actual: number; section_code?: string; item_code?: string; item_name?: string; rate?: number; quantity?: number; days?: number; tax_pct?: number; is_na?: number; na_note?: string };
export type BudgetSnapshot = Pick<BudgetLine, "id" | "category" | "description" | "estimate" | "section_code" | "item_code" | "item_name" | "rate" | "quantity" | "days" | "tax_pct" | "is_na" | "na_note">;
export type BudgetVersion = { id: string; name: string; status: string; snapshot: BudgetSnapshot[]; created_at: string };
type Expense = { id: string; budget_line_id: string; vendor: string; amount: number; spend_date: string; status: string; memo: string };
export type Location = { id: string; name: string; city: string; rate: number; status: string; image_url: string; tags: string; note: string; client_note: string; category?: string; square_feet?: string; availability?: string; blurb?: string; gallery?: string | string[]; deleted_at?: string; client_visible?: number; address?: string; latitude?: number | null; longitude?: number | null; maps_url?: string; street_view_url?: string; map_x?: number; map_y?: number };
export type GlobalLocation = Location & { project_id: string; project_name: string; project_client: string; project_code: string; project_status: string };
type Activity = { id: string; kind: string; message: string; actor: string; created_at: string };
type RecordData = Record<string, string>;
export type ModuleRecord = { id: string; module: string; data: RecordData; created_at: string; updated_at: string };
type FileAsset = { id: string; object_key: string; filename: string; content_type: string; size: number; category: string; status: string; budget_line_id?: string; expense_id?: string; vendor?: string; amount?: number; spend_date?: string; memo?: string; created_at: string };
type AuditNote = { severity: "critical" | "review" | "info"; title: string; detail: string; line_code?: string; amount?: number };
type BudgetAudit = { id: string; source: string; status: string; summary: string; notes: string | AuditNote[]; created_at: string };
type LibraryFile = { id: string; object_key: string; filename: string; content_type: string; size: number; category: string; description: string; uploaded_by: string; created_at: string };
type PickupPlan = { origin: string; destination: string; tripType: "to_airport" | "from_airport" | "general"; eventDateTime: string; pickupAt: string; arriveBy: string; estimatedDestinationAt: string; airportLeadMinutes: number; bufferMinutes: number; providerConfigured: boolean; driveMinutes: number; staticMinutes: number | null; trafficDelayMinutes: number | null; distanceMiles: number | null; source: "google_traffic" | "estimated" };
export type ClientCredential = { username: string; active: number | boolean; updated_at: string } | null;
export type ProjectSummary = Pick<Project, "id" | "name" | "client" | "code" | "status" | "shoot_start" | "shoot_end" | "currency"> & { estimate: number; committed: number; actual: number; backupCount: number; missingBackupCount: number };
export type PortalData = { projects: Project[]; projectSummaries: ProjectSummary[]; project: Project; budgetLines: BudgetLine[]; budgetVersions: BudgetVersion[]; expenses: Expense[]; locations: Location[]; globalLocations: GlobalLocation[]; activities: Activity[]; records: ModuleRecord[]; files: FileAsset[]; audits: BudgetAudit[]; clientCredential: ClientCredential };
type View = "control" | "budget" | "reconcile" | "backup" | "cc" | "production" | "crew" | "schedule" | "travel" | "callsheet" | "casting" | "art_buying" | "locations" | "client" | "settings" | "activity";
type AccountSection = "home" | "jobs" | "locations" | "templates";
type Composer = "budget" | "expense" | "location" | "project" | "production" | "crew" | "schedule" | "travel" | null;
export type User = { name: string; email: string; credential?: boolean; role?: PortalRole; accessLevel?: PortalAccessLevel; projectIds?: string[] } | null;
export type Mutate = (payload: Record<string, unknown>, success: string) => Promise<boolean>;

const groups: { label: string; items: { id: View; label: string }[] }[] = [
  { label: "Workspace", items: [{ id: "control", label: "Control Room" }] },
  { label: "Finance", items: [{ id: "budget", label: "Budget" }, { id: "reconcile", label: "Reconciliation" }, { id: "backup", label: "Backup" }, { id: "cc", label: "CC Log" }] },
  { label: "Operations", items: [{ id: "production", label: "Production Sheet" }, { id: "crew", label: "Headcount" }, { id: "schedule", label: "Schedule" }, { id: "travel", label: "Travel" }, { id: "callsheet", label: "Call Sheet" }] },
  { label: "Client", items: [{ id: "casting", label: "Casting" }, { id: "art_buying", label: "Art Buying" }, { id: "locations", label: "Locations" }, { id: "client", label: "Client Portal" }] },
  { label: "System", items: [{ id: "settings", label: "Project Settings" }, { id: "activity", label: "Activity" }] },
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${value}T12:00:00`));
const relativeTime = (value: string) => { const hours = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 3600000)); return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`; };
const initials = (name: string) => name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "BI";
const moduleRows = (data: PortalData, module: string) => data.records.filter((record) => record.module === module);
const pad = (value: number) => String(value).padStart(2, "0");
const LAST_PROJECT_KEY = "bill-last-project";
const LAST_PROJECT_TTL = 24 * 60 * 60 * 1000;
const lastProjectStorageKey = (email: string) => `${LAST_PROJECT_KEY}:${email.trim().toLowerCase()}`;

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
  const [entered, setEntered] = useState(Boolean(initialUser));
  const [accountHome, setAccountHome] = useState(initialUser?.role !== "client");
  const [accountSection, setAccountSection] = useState<AccountSection>("home");
  const [locationLibraryProjectId, setLocationLibraryProjectId] = useState<string | null>(null);
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
  const resumeChecked = useRef(false);
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
  useEffect(() => { if (user && !data) void loadProject(); }, [Boolean(user), Boolean(data)]);
  useEffect(() => {
    if (!entered || !user || !data || resumeChecked.current) return;
    resumeChecked.current = true;
    if (user.role === "client") return;
    try {
      const storageKey = lastProjectStorageKey(user.email);
      const recent = JSON.parse(window.localStorage.getItem(storageKey) || "null") as { projectId?: string; openedAt?: number } | null;
      const valid = recent?.projectId && typeof recent.openedAt === "number" && Date.now() - recent.openedAt < LAST_PROJECT_TTL && data.projects.some((project) => project.id === recent.projectId);
      if (!valid) { window.localStorage.removeItem(storageKey); return; }
      const requestedProject = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("project");
      if (requestedProject !== recent.projectId) return;
      if (recent.projectId === data.project.id) setAccountHome(false);
      else void loadProject(recent.projectId).then((loaded) => { if (loaded) setAccountHome(false); });
    } catch { window.localStorage.removeItem(lastProjectStorageKey(user.email)); }
  }, [entered, user, data]);

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

  function rememberProject(projectId: string) {
    if (!user || user.role === "client") return;
    window.localStorage.setItem(lastProjectStorageKey(user.email), JSON.stringify({ projectId, openedAt: Date.now() }));
  }

  function markProjectRoute(projectId: string) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#project=${encodeURIComponent(projectId)}`);
  }

  function openAccountHome(section: AccountSection = "home") {
    resumeChecked.current = true;
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setClientPreview(false); setProjectMenu(false); setAccountSection(section); setAccountHome(true);
  }

  function openLocationLibrary() {
    setLocationLibraryProjectId(null);
    openAccountHome("locations");
  }

  async function loadProject(projectId?: string) {
    setError("");
    try {
      const response = await fetch(`/api/portal${projectId ? `?project=${encodeURIComponent(projectId)}` : ""}`);
      const payload = await response.json() as PortalData & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not load production data.");
      setData(payload); setProjectMenu(false); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load production data."); return false; }
  }

  const totals = useMemo(() => {
    const estimate = data?.budgetLines.reduce((sum, line) => sum + Number(line.estimate), 0) ?? 0;
    const committed = data?.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0) ?? 0;
    const actual = data?.files.filter((file) => file.category.toLowerCase() === "backup").reduce((sum, file) => sum + Number(file.amount || 0), 0) ?? 0;
    return { estimate, committed, actual, remaining: estimate - committed, percent: estimate ? Math.round((committed / estimate) * 100) : 0 };
  }, [data]);

  async function mutate(payload: Record<string, unknown>, success: string) {
    if (!data && payload.action !== "create_project") return false;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId: data?.project.id, ...payload }) });
      const next = await response.json() as PortalData & { error?: string };
      if (!response.ok) throw new Error(next.error ?? "That change could not be saved.");
      setData(next); setComposer(null); setToast(success); window.setTimeout(() => setToast(""), 2600);
      return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "That change could not be saved."); return false; }
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
      if (result.audit?.source === "openai") setToast("Document review complete");
      else if (result.aiFailure) setToast(`Audit fallback · ${result.aiFailure}`);
      else setToast(result.aiConfigured ? "Audit completed with automated checks" : "Budget audit complete · document review not configured");
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
    const loaded = await loadProject();
    if (!loaded) throw new Error("Your login worked, but the portal could not open. Please try again.");
    setPreviewUser(payload.user); setActive(role === "client" ? "client" : "control"); setClientPreview(role === "client");
    if (role === "client") setAccountHome(false); else openAccountHome();
    setEntered(true);
  }

  async function enterFor(role: PortalRole = user?.role === "client" ? "client" : "production") {
    if (!data && !(await loadProject())) return;
    setActive(role === "client" ? "client" : "control"); setClientPreview(role === "client");
    if (role === "client") setAccountHome(false); else openAccountHome();
    setEntered(true);
  }

  async function openProjectFromAccount(projectId: string) {
    if (!(await loadProject(projectId))) return;
    const client = user?.role === "client";
    rememberProject(projectId);
    if (!client) markProjectRoute(projectId);
    setActive(client ? "client" : "control"); setClientPreview(client); setAccountHome(false);
  }

  async function openProjectLocations(projectId: string) {
    if (!(await loadProject(projectId))) return;
    rememberProject(projectId);
    setLocationLibraryProjectId(projectId);
    openAccountHome("locations");
  }

  async function logOut() {
    if (user?.credential) await fetch("/api/credential-login", { method: "DELETE" });
    setPreviewUser(null); setData(null); setEntered(false); setAccountHome(true); setAccountSection("home"); setUserControls(false);
    if (initialUser?.credential) window.location.reload();
  }

  if (!entered) return <ReferenceLoginScreen user={user} enter={enterFor} credentialLogin={credentialLogin} />;
  if (!user) return <ReferenceLoginScreen user={null} enter={enterFor} credentialLogin={credentialLogin} />;
  if (!data && !error) return null;
  if (!data) return <div className="portal-error"><span>BILL, INC.</span><h1>THE PRODUCTION COULD NOT OPEN.</h1><p>{error}</p><button onClick={() => loadProject()}>TRY AGAIN</button></div>;

  if (accountHome) return <>
    <PortalAccountWorkspace section={accountSection} setSection={(section) => { if (section === "locations") setLocationLibraryProjectId(null); setAccountSection(section); }} data={data} user={user} openProject={openProjectFromAccount} openProjectLocations={openProjectLocations} locationLibraryProjectId={locationLibraryProjectId} openLocationLibrary={openLocationLibrary} mutate={mutate} createProject={() => setComposer("project")} manageUsers={() => setUserControls(true)} updateProjectStatus={(projectId, status) => mutate({ action: "update_project_status", projectId, status }, status === "Closed" ? "Job closed" : "Job reopened")} theme={theme} toggleTheme={toggleTheme} logOut={logOut} />
    {composer && <ComposerModal type={composer} lines={data.budgetLines} saving={saving} close={() => setComposer(null)} submit={mutate} />}
    {userControls && <UserControlsDrawer user={user} project={data.project} projects={data.projects} theme={theme} compactRows={compactRows} reduceMotion={reduceMotion} close={() => setUserControls(false)} setTheme={setThemeMode} setCompactRows={setCompactMode} setReduceMotion={setMotionMode} logOut={logOut} externalLogout={!localPreview && !user.credential} />}
    {error && <div className="account-home-error">{error}<button onClick={() => setError("")}>DISMISS</button></div>}
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </>;

  const search = query.toLowerCase();
  const lines = data.budgetLines.filter((line) => `${line.category} ${line.description}`.toLowerCase().includes(search));
  const expenses = data.expenses.filter((expense) => `${expense.vendor} ${expense.memo}`.toLowerCase().includes(search));
  const locations = data.locations.filter((location) => `${location.name} ${location.city} ${location.tags}`.toLowerCase().includes(search));

  if (user.role === "client") return <ReferenceClientPortal data={data} totals={totals} preview setPreview={(value) => { if (!value) void logOut(); }} publish={mutate} theme={theme} toggleTheme={toggleTheme} clientOnly />;

  return <main className="portal-shell">
    <aside className="sidebar">
      <button type="button" className="brand" onClick={() => openAccountHome()} title="Portal home"><img src="/bill-inc.png" alt="BILL, INC." /></button>
      <div className="side-project"><span>{data.project.code}</span><strong>{data.project.name}</strong><small>{data.project.client}</small></div>
      <nav aria-label="Production workspace">{groups.map((group) => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map((item) => { const backed = new Set(data.files.filter((file) => file.category.toLowerCase() === "backup").map((file) => file.expense_id).filter(Boolean)); const missingBackup = data.expenses.filter((expense) => !backed.has(expense.id)).length; const comments = moduleRows(data, "budget_comment").filter((record) => record.data.status !== "resolved").length; return <button className={active === item.id ? "nav-item active" : "nav-item"} onClick={() => item.id === "locations" ? void openProjectLocations(data.project.id) : openView(item.id)} key={item.id}>{item.label}{item.id === "reconcile" && missingBackup > 0 && <i>{missingBackup}</i>}{item.id === "budget" && comments > 0 && <i>{comments}</i>}</button>; })}</div>)}</nav>
      <div className="sidebar-bottom"><div className="budget-meter"><span style={{ width: `${Math.min(totals.percent, 100)}%` }} /></div><p><b>{totals.percent}% COMMITTED</b><span>{money.format(totals.remaining)} LEFT</span></p><button className="side-user" onClick={() => setUserControls(true)} aria-haspopup="dialog" aria-expanded={userControls}><span>{initials(user.name)}</span><span><strong>{user.name}</strong><small>{user.email}</small></span><b>→</b></button></div>
    </aside>

    <section className="workspace">
      <header className="topbar">
        <div className="project-switch-wrap"><button className="project-switcher" onClick={() => setProjectMenu((value) => !value)}><span className="project-stamp">{data.project.code.slice(0, 2)}</span><span><small>CURRENT PRODUCTION</small><strong>{data.project.name}</strong></span><b>⌄</b></button>{projectMenu && <div className="project-menu"><p>PRODUCTIONS</p>{data.projects.map((project) => <button className={project.id === data.project.id ? "current" : ""} onClick={() => { rememberProject(project.id); markProjectRoute(project.id); void loadProject(project.id); }} key={project.id}><span><strong>{project.name}</strong><small>{project.client} · {project.code}</small></span>{project.id !== data.project.id && <b>→</b>}</button>)}{(user.accessLevel === "admin" || user.accessLevel === "full") && <button className="new-project" onClick={() => { setProjectMenu(false); setComposer("project"); }}>＋ NEW PRODUCTION</button>}</div>}</div>
        <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this production" aria-label="Search this production" /><kbd>⌘ K</kbd></label>
        <div className="top-actions"><span className="sync-state">● SAVED</span><button className="theme-button" onClick={toggleTheme} aria-label={`Use ${theme === "light" ? "dark" : "light"} mode`}>{theme === "light" ? "◐" : "◑"}</button><button className="present-button" onClick={() => { openView("client"); setClientPreview(true); }}>CLIENT VIEW ↗</button></div>
      </header>
      <div className="mobile-nav">{groups.flatMap((group) => group.items).map((item) => <button className={active === item.id ? "active" : ""} onClick={() => item.id === "locations" ? void openProjectLocations(data.project.id) : openView(item.id)} key={item.id}>{item.label}</button>)}</div>

      <div className="content">
        {error && <div className="inline-error">{error}<button onClick={() => setError("")}>DISMISS</button></div>}
        {active === "control" && <ControlRoom data={data} totals={totals} openView={openView} openComposer={setComposer} mutate={mutate} />}
        {active === "budget" && <ReferenceBudgetView data={data} lines={lines} totals={totals} expenses={data.expenses} openComposer={() => setComposer("budget")} mutate={mutate} auditBudget={auditBudget} auditing={auditing} />}
        {active === "reconcile" && <ReconcileView project={data.project} expenses={expenses} files={data.files} lines={data.budgetLines} openBackup={() => filePicker.current?.click()} mutate={mutate} />}
        {active === "backup" && <BackupView files={data.files} expenses={data.expenses} lines={data.budgetLines} audits={data.audits} filePicker={filePicker} uploadBackup={uploadBackup} chooseBackup={chooseBackup} removeFile={removeFile} mutate={mutate} auditBudget={auditBudget} saving={saving} auditing={auditing} />}
        {active === "cc" && <CCView expenses={expenses} lines={data.budgetLines} ccPicker={ccPicker} importStatement={importStatement} openComposer={setComposer} mutate={mutate} />}
        {active === "production" && <RecordView title="Production Sheet" kicker="Operations · Live list" copy="Open items, vendor decisions, and wrap-book notes in one shared sheet." records={moduleRows(data, "production")} columns={["section", "item", "owner", "status"]} open={() => setComposer("production")} remove={(id) => mutate({ action: "delete_module_record", id }, "Production item removed")} />}
        {active === "crew" && <HeadcountView crew={moduleRows(data, "crew")} schedule={moduleRows(data, "schedule")} open={() => setComposer("crew")} mutate={mutate} />}
        {active === "travel" && <TravelDeskView project={data.project} records={moduleRows(data, "travel")} crew={moduleRows(data, "crew")} exports={moduleRows(data, "travel_export")} picker={travelPicker} open={() => setComposer("travel")} mutate={mutate} />}
        {active === "schedule" && <ScheduleWorkspace key={`schedule-${data.project.id}-${moduleRows(data, "schedule_builder")[0]?.id || "new"}`} project={data.project} schedule={moduleRows(data, "schedule")} builderRecord={moduleRows(data, "schedule_builder")[0]} crew={moduleRows(data, "crew")} locations={data.locations} production={moduleRows(data, "production")} openRow={() => setComposer("schedule")} mutate={mutate} publish={() => mutate({ action: "publish_client_item", kind: "Schedule", label: `${data.project.name} · Shooting Schedule` }, "Schedule pushed to client portal")} />}
        {active === "callsheet" && <CallSheet project={data.project} crew={moduleRows(data, "crew")} schedule={moduleRows(data, "schedule")} travel={moduleRows(data, "travel")} locations={data.locations} publish={() => mutate({ action: "publish_client_item", kind: "Call Sheet", label: `${data.project.name} · Day 01 Call Sheet` }, "Call sheet pushed to client portal")} />}
        {active === "casting" && <OptionsWorkspace key={`casting-${data.project.id}-${moduleRows(data, "casting")[0]?.id || "new"}`} module="casting" title="Casting" project={data.project} record={moduleRows(data, "casting")[0]} mutate={mutate} />}
        {active === "art_buying" && <OptionsWorkspace key={`art-buying-${data.project.id}-${moduleRows(data, "art_buying")[0]?.id || "new"}`} module="art_buying" title="Art Buying" project={data.project} record={moduleRows(data, "art_buying")[0]} mutate={mutate} />}
        {active === "client" && <ReferenceClientPortal data={data} totals={totals} preview={clientPreview} setPreview={setClientPreview} publish={mutate} theme={theme} toggleTheme={toggleTheme} onAccountHome={() => openAccountHome()} />}
        {active === "settings" && <ProjectSettings project={data.project} saving={saving} mutate={mutate} />}
        {active === "activity" && <ActivityView activities={data.activities} />}
      </div>
    </section>

    {composer && <ComposerModal type={composer} lines={data.budgetLines} saving={saving} close={() => setComposer(null)} submit={mutate} />}
    {pendingBackup && <BackupAllocationModal file={pendingBackup} lines={data.budgetLines} saving={saving} close={() => setPendingBackup(null)} upload={saveBackupAllocation} />}
    {userControls && <UserControlsDrawer user={user} project={data.project} projects={data.projects} theme={theme} compactRows={compactRows} reduceMotion={reduceMotion} close={() => setUserControls(false)} setTheme={setThemeMode} setCompactRows={setCompactMode} setReduceMotion={setMotionMode} logOut={logOut} externalLogout={!localPreview && !user.credential} />}
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </main>;
}

function downloadAccountCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

const accountLabels: Record<AccountSection, string> = { home: "Portal Home", jobs: "Jobs", locations: "Location Library", templates: "Templates & Guides" };

function PortalAccountWorkspace({ section, setSection, data, user, openProject, openProjectLocations, locationLibraryProjectId, openLocationLibrary, mutate, createProject, manageUsers, updateProjectStatus, theme, toggleTheme, logOut }: { section: AccountSection; setSection: (section: AccountSection) => void; data: PortalData; user: NonNullable<User>; openProject: (projectId: string) => Promise<void>; openProjectLocations: (projectId: string) => Promise<void>; locationLibraryProjectId: string | null; openLocationLibrary: () => void; mutate: Mutate; createProject: () => void; manageUsers: () => void; updateProjectStatus: (projectId: string, status: string) => Promise<boolean>; theme: "light" | "dark"; toggleTheme: () => void; logOut: () => Promise<void> }) {
  const isAdmin = user.accessLevel === "admin";
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());
  const navigation: { id: AccountSection; label: string }[] = [{ id: "home", label: "Portal Home" }, { id: "jobs", label: "Jobs" }, { id: "locations", label: "Location Library" }, { id: "templates", label: "Templates & Guides" }];
  return <main className="portal-shell account-portal-shell">
    <aside className="sidebar account-sidebar"><button className="brand" onClick={() => setSection("home")}><img src="/bill-inc.png" alt="BILL, INC." /></button><div className="side-project"><span>GLOBAL WORKSPACE</span><strong>{isAdmin ? "Company Administration" : "Production Portal"}</strong><small>{data.projects.length} ACCESSIBLE JOB{data.projects.length === 1 ? "" : "S"}</small></div><nav aria-label="Portal workspace"><div className="nav-group"><p>Portal</p>{navigation.map((item) => <button className={section === item.id ? "nav-item active" : "nav-item"} onClick={() => setSection(item.id)} key={item.id}>{item.label}</button>)}</div>{isAdmin && <div className="nav-group"><p>Administration</p><button className="nav-item" onClick={createProject}>＋ Create Job</button><button className="nav-item" onClick={manageUsers}>Users &amp; Access</button></div>}</nav><div className="sidebar-bottom account-sidebar-bottom"><button className="side-user" onClick={manageUsers}><span>{initials(user.name)}</span><span><strong>{user.name}</strong><small>{isAdmin ? "Administrator" : user.email}</small></span><b>→</b></button><button className="account-side-logout" onClick={() => void logOut()}>LOG OUT →</button></div></aside>
    <section className="workspace"><header className="topbar account-topbar"><div className="account-topbar-title"><small>BILL, INC. PORTAL</small><strong>{accountLabels[section]}</strong></div><div className="account-topbar-date"><span>{today}</span><b>{user.email}</b></div><div className="top-actions"><span className="sync-state">● SECURE</span><button className="theme-button" onClick={toggleTheme} aria-label={`Use ${theme === "light" ? "dark" : "light"} mode`}>{theme === "light" ? "◐" : "◑"}</button></div></header><div className="account-mobile-nav">{navigation.map((item) => <button className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)} key={item.id}>{item.label}</button>)}</div><div className="content account-portal-content">
      {section === "home" && <PortalAccountHome data={data} user={user} setSection={setSection} createProject={createProject} manageUsers={manageUsers} />}
      {section === "jobs" && <AccountJobs data={data} user={user} openProject={openProject} createProject={createProject} updateProjectStatus={updateProjectStatus} />}
      {section === "locations" && (locationLibraryProjectId ? <ReferenceLocationsView project={data.project} projects={data.projects} locations={data.locations} switchProject={openProjectLocations} openGlobalLibrary={openLocationLibrary} mutate={mutate} /> : <GlobalLocationLibrary data={data} openProjectLocations={openProjectLocations} />)}
      {section === "templates" && <TemplatesGuidesView user={user} />}
    </div></section>
  </main>;
}

function PortalAccountHome({ data, user, setSection, createProject, manageUsers }: { data: PortalData; user: NonNullable<User>; setSection: (section: AccountSection) => void; createProject: () => void; manageUsers: () => void }) {
  const isAdmin = user.accessLevel === "admin";
  const summaries = data.projectSummaries || data.projects.map((project) => ({ ...project, estimate: 0, committed: 0, actual: 0, backupCount: 0, missingBackupCount: 0 }));
  const activeJobs = summaries.filter((project) => project.status.toLowerCase() !== "closed");
  const totals = summaries.reduce((result, project) => ({ estimate: result.estimate + project.estimate, committed: result.committed + project.committed, actual: result.actual + project.actual, missing: result.missing + project.missingBackupCount }), { estimate: 0, committed: 0, actual: 0, missing: 0 });
  const projectedProfit = totals.estimate - totals.committed;
  const actualGross = totals.estimate - totals.actual;
  const today = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());
  const exportPnl = () => downloadAccountCsv("bill-inc-profit-loss.csv", [["Job", "Client", "Job number", "Status", "Approved estimate / revenue", "Committed costs", "Projected gross profit", "Actual backed costs", "Actual gross position"], ...summaries.map((project) => [project.name, project.client, project.code, project.status, project.estimate, project.committed, project.estimate - project.committed, project.actual, project.estimate - project.actual]), ["TOTAL", "", "", "", totals.estimate, totals.committed, projectedProfit, totals.actual, actualGross]]);
  const exportAccounting = () => downloadAccountCsv("bill-inc-accounting-report.csv", [["Job", "Client", "Job number", "Committed costs", "Backed actuals", "Unbacked commitments", "Backup documents", "Missing backup items"], ...summaries.map((project) => [project.name, project.client, project.code, project.committed, project.actual, Math.max(0, project.committed - project.actual), project.backupCount, project.missingBackupCount]), ["TOTAL", "", "", totals.committed, totals.actual, Math.max(0, totals.committed - totals.actual), summaries.reduce((sum, project) => sum + project.backupCount, 0), totals.missing]]);

  return <section className={`account-home ${isAdmin ? "admin" : "team"}`}>
    <section className="account-home-intro"><p>{today}</p><h1>WELCOME, {user.name.toUpperCase()}</h1><span>{isAdmin ? "Company-wide production, access and accounting controls." : "Your assigned productions and shared company resources."}</span></section>

    <section className="account-destination-grid"><button onClick={() => setSection("jobs")}><span>01 · PRODUCTIONS</span><h2>JOBS</h2><p>Open the productions you can access, organized by year.</p><footer><b>{summaries.length} JOB{summaries.length === 1 ? "" : "S"}</b><strong>→</strong></footer></button><button onClick={() => setSection("locations")}><span>02 · COMPANY RESOURCE</span><h2>LOCATION<br />LIBRARY</h2><p>Search every saved location across your accessible productions.</p><footer><b>{data.globalLocations.filter((location) => !location.deleted_at).length} LOCATIONS</b><strong>→</strong></footer></button><button onClick={() => setSection("templates")}><span>03 · COMPANY RESOURCE</span><h2>TEMPLATES<br />&amp; GUIDES</h2><p>Production forms, working templates and company guidance.</p><footer><b>SHARED LIBRARY</b><strong>→</strong></footer></button></section>

    {isAdmin && <>
      <section className="admin-command-bar"><div><span>COMPANY CONTROL</span><strong>{activeJobs.length} ACTIVE JOB{activeJobs.length === 1 ? "" : "S"}</strong></div><button onClick={() => setSection("jobs")}>VIEW ALL JOBS →</button><button onClick={createProject}>＋ CREATE JOB</button><button onClick={manageUsers}>＋ ADD / MANAGE USERS</button></section>
      <section className="account-financial-metrics"><article><span>APPROVED ESTIMATES</span><strong>{money.format(totals.estimate)}</strong><small>Company-wide booked revenue</small></article><article><span>COMMITTED COSTS</span><strong>{money.format(totals.committed)}</strong><small>Working vendor commitments</small></article><article><span>PROJECTED GROSS PROFIT</span><strong>{money.format(projectedProfit)}</strong><small>Estimate less commitments</small></article><article><span>BACKED ACTUALS</span><strong>{money.format(totals.actual)}</strong><small>{totals.missing} items missing backup</small></article></section>
      <section className="account-reports"><header><div><span>COMPANY REPORTING</span><h2>PROFIT, LOSS + ACCOUNTING</h2></div><div><button onClick={exportPnl}>EXPORT P&amp;L CSV ↓</button><button onClick={exportAccounting}>EXPORT ACCOUNTING CSV ↓</button></div></header><div className="account-report-grid"><article><span>PROJECTED PROFIT</span><strong>{money.format(projectedProfit)}</strong><small>{totals.estimate ? Math.round(projectedProfit / totals.estimate * 100) : 0}% projected gross margin</small></article><article><span>ACTUAL GROSS POSITION</span><strong>{money.format(actualGross)}</strong><small>Estimate less uploaded backup</small></article><article><span>UNBACKED COMMITMENTS</span><strong>{money.format(Math.max(0, totals.committed - totals.actual))}</strong><small>{totals.missing} working costs need documentation</small></article></div></section>
    </>}

  </section>;
}

function globalLocationImage(location: GlobalLocation) {
  if (Array.isArray(location.gallery) && location.gallery[0]) return location.gallery[0];
  if (typeof location.gallery === "string" && location.gallery.trim()) {
    try { const parsed = JSON.parse(location.gallery); if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0]; } catch { const first = location.gallery.split("|").find(Boolean); if (first) return first; }
  }
  return location.image_url || "";
}

function GlobalLocationLibrary({ data, openProjectLocations }: { data: PortalData; openProjectLocations: (projectId: string) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"library" | "projects">("library");
  const [projectId, setProjectId] = useState("all");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [city, setCity] = useState("all");
  const allLocations = data.globalLocations || [];
  const locations = allLocations.filter((location) => !location.deleted_at);
  const deleted = allLocations.filter((location) => Boolean(location.deleted_at));
  const categories = [...new Set(locations.map((location) => location.category || "Uncategorized"))].sort();
  const cities = [...new Set(locations.map((location) => location.city).filter(Boolean))].sort();
  const statuses = [["all", "All"], ["approved", "Top Pick"], ["shortlisted", "Secondary"], ["rejected", "Not Interested"], ["review", "Unrated"]];
  const filtered = locations
    .filter((location) => projectId === "all" || location.project_id === projectId)
    .filter((location) => status === "all" || location.status === status)
    .filter((location) => category === "all" || (location.category || "Uncategorized") === category)
    .filter((location) => city === "all" || location.city === city)
    .filter((location) => `${location.name} ${location.city} ${location.address || ""} ${location.tags || ""} ${location.project_name} ${location.project_client} ${location.project_code}`.toLowerCase().includes(query.toLowerCase()));
  const selectedProject = data.projects.find((project) => project.id === projectId);
  const clearFilters = () => { setQuery(""); setProjectId("all"); setStatus("all"); setCategory("all"); setCity("all"); };
  const hasFilters = Boolean(query || projectId !== "all" || status !== "all" || category !== "all" || city !== "all");
  const projectRows = data.projects.map((project) => ({ project, count: locations.filter((location) => location.project_id === project.id).length })).filter(({ project }) => `${project.name} ${project.client} ${project.code}`.toLowerCase().includes(query.toLowerCase()));

  return <section className="account-home unified-location-library">
    <nav className="unified-location-tabs" aria-label="Location library views"><button className={view === "library" ? "active" : ""} onClick={() => { setView("library"); setQuery(""); }}>LIBRARY</button><button className={view === "projects" ? "active" : ""} onClick={() => { setView("projects"); setQuery(""); }}>PROJECTS</button></nav>
    {view === "projects" ? <section className="location-project-directory"><header><div><p>LOCATION LIBRARY</p><h1>PROJECTS</h1><span>Projects mirror the jobs in the production portal. Open one to work inside its location page.</span></div><b>{data.projects.length} PROJECT{data.projects.length === 1 ? "" : "S"}</b></header><label>SEARCH PROJECTS<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Client, project title or job number…" /></label><div>{projectRows.map(({ project, count }) => <article key={project.id}><div><span>{project.code}</span><h2>{project.name}</h2><p>{project.client} · {count} LOCATION{count === 1 ? "" : "S"}</p></div><button onClick={() => void openProjectLocations(project.id)}>OPEN →</button></article>)}</div>{projectRows.length === 0 && <div className="global-location-empty"><strong>NO PROJECTS MATCH</strong><span>Try a different client name, title or job number.</span></div>}</section> : <>
      <header className="unified-location-heading"><div><p>LOCATION LIBRARY</p><h1>ALL LOCATIONS</h1><span>{filtered.length} OF {locations.length} LOCATIONS</span></div><div><button disabled={!selectedProject} onClick={() => selectedProject && void openProjectLocations(selectedProject.id)}>＋ ADD LOCATION</button><button disabled={!selectedProject} onClick={() => selectedProject && void openProjectLocations(selectedProject.id)}>↧ IMPORT LOCATIONS</button></div></header>
      <div className="unified-location-body"><aside><label className="location-search">SEARCH<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search locations" /></label><section><p>STATUS</p>{statuses.map(([value, label]) => <button className={status === value ? "active" : ""} onClick={() => setStatus(value)} key={value}><i /><span>{label}</span><b>{value === "all" ? locations.length : locations.filter((location) => location.status === value).length}</b></button>)}</section><section><p>CATEGORY</p><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}><i /><span>All categories</span><b>{locations.length}</b></button>{categories.map((value) => <button className={category === value ? "active" : ""} onClick={() => setCategory(value)} key={value}><i /><span>{value}</span><b>{locations.filter((location) => (location.category || "Uncategorized") === value).length}</b></button>)}</section><section><p>CITY</p><button className={city === "all" ? "active" : ""} onClick={() => setCity("all")}><i /><span>All cities</span><b>{locations.length}</b></button>{cities.map((value) => <button className={city === value ? "active" : ""} onClick={() => setCity(value)} key={value}><i /><span>{value}</span><b>{locations.filter((location) => location.city === value).length}</b></button>)}</section>{hasFilters && <button className="unified-clear-filters" onClick={clearFilters}>CLEAR FILTERS ×</button>}</aside><main><section className="unified-project-context"><div><span>PROJECT CONTEXT</span><label><select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="all">FULL LIBRARY · ALL JOBS</option>{data.projects.map((project) => <option value={project.id} key={project.id}>{project.code} · {project.name} · {project.client}</option>)}</select></label></div>{selectedProject ? <><span>{filtered.length} LOCATION{filtered.length === 1 ? "" : "S"} IN VIEW</span><button onClick={() => void openProjectLocations(selectedProject.id)}>OPEN PROJECT PAGE →</button></> : <><span>SELECT A PROJECT TO ADD OR IMPORT</span><button onClick={() => setView("projects")}>MANAGE PROJECTS →</button></>}</section><div className="unified-location-grid">{filtered.map((location, index) => <article key={`${location.project_id}-${location.id}`}><button className="global-location-photo" onClick={() => void openProjectLocations(location.project_id)} style={{ backgroundImage: globalLocationImage(location) ? `url(${globalLocationImage(location)})` : undefined }}><span>{pad(index + 1)}</span><b>{location.status === "approved" ? "Top Pick" : location.status === "shortlisted" ? "Secondary" : location.status === "rejected" ? "Not Interested" : "Unrated"}</b></button><div><p>{location.city}</p><h2>{location.name}</h2><dl><div><dt>SQ FT</dt><dd>{location.square_feet || "—"}</dd></div><div><dt>/ DAY</dt><dd>{money.format(location.rate)}</dd></div><div><dt>STATUS</dt><dd>{location.availability || "Pending"}</dd></div></dl><small>{location.project_code} · {location.project_name}</small><button onClick={() => void openProjectLocations(location.project_id)}>OPEN LOCATION →</button></div></article>)}</div>{filtered.length === 0 && <div className="global-location-empty"><strong>NO LOCATIONS MATCH</strong><span>Try removing a filter or clearing your search.</span></div>}{deleted.length > 0 && <section className="unified-recently-deleted"><header><strong>RECENTLY DELETED / {deleted.length}</strong><span>OPEN THE PROJECT TO RESTORE OR PERMANENTLY DELETE</span></header>{deleted.map((location) => <div key={`${location.project_id}-${location.id}`}><span><strong>{location.name}</strong><small>{location.project_code} · {location.project_name}</small></span><button onClick={() => void openProjectLocations(location.project_id)}>MANAGE →</button></div>)}</section>}</main></div>
    </>}
  </section>;
}

function AccountJobs({ data, user, openProject, createProject, updateProjectStatus }: { data: PortalData; user: NonNullable<User>; openProject: (projectId: string) => Promise<void>; createProject: () => void; updateProjectStatus: (projectId: string, status: string) => Promise<boolean> }) {
  const isAdmin = user.accessLevel === "admin";
  const summaries = data.projectSummaries || data.projects.map((project) => ({ ...project, estimate: 0, committed: 0, actual: 0, backupCount: 0, missingBackupCount: 0 }));
  const years = [...new Set(summaries.map((project) => project.shoot_start?.slice(0, 4) || "Unscheduled"))].sort((a, b) => b.localeCompare(a));
  return <section className="account-home account-jobs-page"><header className="account-page-heading"><div><p>PORTAL · PRODUCTIONS</p><h1>JOBS</h1><span>{isAdmin ? "Every company production, organized by shoot year." : "The productions assigned to your account, organized by shoot year."}</span></div>{isAdmin && <button onClick={createProject}>＋ CREATE JOB</button>}</header><section className="account-job-library"><header><div><span>{isAdmin ? "ALL PRODUCTIONS" : "YOUR PRODUCTIONS"}</span><h2>JOBS BY YEAR</h2></div><b>{summaries.length} JOB{summaries.length === 1 ? "" : "S"}</b></header>{years.map((year) => <section className="account-year" key={year}><h3>{year}</h3><div>{summaries.filter((project) => (project.shoot_start?.slice(0, 4) || "Unscheduled") === year).map((project) => { const closed = project.status.toLowerCase() === "closed"; return <article className={closed ? "closed" : ""} key={project.id}><button className="account-job-open" onClick={() => void openProject(project.id)}><span>{project.code}</span><h4>{project.name}</h4><p>{project.client}</p><div><span>{project.shoot_start ? `${formatDate(project.shoot_start)}—${formatDate(project.shoot_end)}` : "DATES TBD"}</span><b>{project.status}</b></div><footer>{isAdmin ? <><span>EST. {compactMoney.format(project.estimate)}</span><span>COSTS {compactMoney.format(project.committed)}</span></> : <span>OPEN PROJECT</span>}<strong>→</strong></footer></button>{isAdmin && <button className="account-job-status" onClick={() => { if (closed || window.confirm(`Close ${project.name}? It will remain available in the ${year} archive.`)) void updateProjectStatus(project.id, closed ? "Planning" : "Closed"); }}>{closed ? "REOPEN JOB" : "CLOSE JOB"}</button>}</article>; })}</div></section>)}</section></section>;
}

function libraryFileSize(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function TemplatesGuidesView({ user }: { user: NonNullable<User> }) {
  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [category, setCategory] = useState("Templates");
  const [filter, setFilter] = useState("all");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const isAdmin = user.accessLevel === "admin";
  const categories = ["Templates", "Production Guides", "Forms", "Reference"];
  const visible = files.filter((file) => filter === "all" || file.category === filter);
  useEffect(() => { void loadLibrary(); }, []);
  async function loadLibrary() {
    setLoading(true); setMessage("");
    try { const response = await fetch("/api/library-files"); const payload = await response.json() as { files?: LibraryFile[]; error?: string }; if (!response.ok) throw new Error(payload.error || "The library could not be loaded."); setFiles(payload.files || []); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "The library could not be loaded."); }
    finally { setLoading(false); }
  }
  async function uploadFile(file?: File) {
    if (!file) return;
    setSaving(true); setMessage("");
    try { const form = new FormData(); form.set("file", file); form.set("category", category); form.set("description", description); const response = await fetch("/api/library-files", { method: "POST", body: form }); const payload = await response.json() as { files?: LibraryFile[]; error?: string }; if (!response.ok) throw new Error(payload.error || "The file could not be uploaded."); setFiles(payload.files || []); setDescription(""); setMessage(`${file.name} added to ${category}.`); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "The file could not be uploaded."); }
    finally { setSaving(false); }
  }
  async function removeFile(file: LibraryFile) {
    if (!window.confirm(`Remove ${file.filename} from the company library?`)) return;
    setSaving(true); setMessage("");
    try { const response = await fetch("/api/library-files", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: file.id }) }); const payload = await response.json() as { files?: LibraryFile[]; error?: string }; if (!response.ok) throw new Error(payload.error || "The file could not be removed."); setFiles(payload.files || []); setMessage(`${file.filename} removed.`); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "The file could not be removed."); }
    finally { setSaving(false); }
  }
  return <section className="account-home templates-guides-page"><header className="account-page-heading"><div><p>PORTAL · COMPANY RESOURCES</p><h1>TEMPLATES<br />&amp; GUIDES</h1><span>Production templates, forms, references and working guides in one shared library.</span></div><aside><strong>{files.length}</strong><span>SHARED FILE{files.length === 1 ? "" : "S"}</span></aside></header>{isAdmin && <section className="template-upload-panel" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void uploadFile(event.dataTransfer.files[0]); }}><div><span>ADMIN UPLOAD</span><h2>DROP A TEMPLATE OR GUIDE</h2><p>PDF, Word, Excel, image and other production files up to 20 MB.</p></div><label>CATEGORY<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option value={value} key={value}>{value.toUpperCase()}</option>)}</select></label><label>DESCRIPTION<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this file is used for…" /></label><button disabled={saving} onClick={() => picker.current?.click()}>{saving ? "UPLOADING…" : "＋ CHOOSE FILE"}</button><input ref={picker} hidden type="file" onChange={(event) => { void uploadFile(event.target.files?.[0]); event.target.value = ""; }} /></section>}<section className="template-library"><header><div><span>LIBRARY</span><h2>FILES</h2></div><nav><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>ALL <b>{files.length}</b></button>{categories.map((value) => <button className={filter === value ? "active" : ""} onClick={() => setFilter(value)} key={value}>{value.toUpperCase()} <b>{files.filter((file) => file.category === value).length}</b></button>)}</nav></header>{message && <div className="template-message">{message}</div>}{loading ? <div className="template-empty">OPENING COMPANY LIBRARY…</div> : visible.length ? <div className="template-file-grid">{visible.map((file, index) => <article key={file.id}><span>{pad(index + 1)}</span><div><p>{file.category}</p><h3>{file.filename}</h3><small>{file.description || "Company production resource"}</small></div><dl><div><dt>TYPE</dt><dd>{file.filename.split(".").pop()?.toUpperCase() || "FILE"}</dd></div><div><dt>SIZE</dt><dd>{libraryFileSize(file.size)}</dd></div><div><dt>ADDED BY</dt><dd>{file.uploaded_by}</dd></div></dl><footer><button onClick={() => window.open(`/api/library-files?key=${encodeURIComponent(file.object_key)}`, "_blank")}>VIEW / DOWNLOAD ↗</button>{isAdmin && <button disabled={saving} onClick={() => void removeFile(file)}>REMOVE</button>}</footer></article>)}</div> : <div className="template-empty"><strong>NO FILES YET</strong><span>{isAdmin ? "Drop the first template or production guide above." : "An administrator has not added any files to this section yet."}</span></div>}</section></section>;
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
  const backedExpenseIds = new Set(data.files.filter((file) => file.category.toLowerCase() === "backup").map((file) => file.expense_id).filter(Boolean));
  const review = data.expenses.filter((expense) => !backedExpenseIds.has(expense.id)).length;
  const modules: { tag: string; title: string; view: View; count: string }[] = [
    { tag: "Finance", title: "Budget", view: "budget", count: `${data.budgetVersions.length} versions` }, { tag: "Finance", title: "Reconciliation", view: "reconcile", count: `${review} to review` }, { tag: "Finance", title: "Backup", view: "backup", count: `${data.files.filter((file) => file.category.toLowerCase() === "backup").length} files` }, { tag: "Finance", title: "CC Log", view: "cc", count: `${data.expenses.length} charges` },
    { tag: "Operations", title: "Production Sheet", view: "production", count: `${moduleRows(data, "production").length} items` }, { tag: "Operations", title: "Headcount", view: "crew", count: `${moduleRows(data, "crew").length} people` }, { tag: "Operations", title: "Schedule", view: "schedule", count: `${moduleRows(data, "schedule").length} rows` }, { tag: "Logistics", title: "Travel Charts", view: "travel", count: `${moduleRows(data, "travel").length} records` },
    { tag: "Generated", title: "Call Sheet", view: "callsheet", count: "Synced live" }, { tag: "Creative", title: "Casting", view: "casting", count: `${moduleRows(data, "casting").length ? "Options ready" : "New sheet"}` }, { tag: "Creative", title: "Art Buying", view: "art_buying", count: `${moduleRows(data, "art_buying").length ? "Options ready" : "New sheet"}` }, { tag: "Scouting", title: "Locations", view: "locations", count: `${data.locations.length} options` }, { tag: "Client", title: "Client Portal", view: "client", count: `${moduleRows(data, "client_share").length} shared` },
  ];
  return <section className="control-room"><div className="control-title"><div><p className="kicker">BILL, INC. · PRODUCTION</p><h1>CONTROL ROOM</h1><p>{data.project.name} · {data.project.client}</p></div><div className="control-actions"><label className="status-select"><span /><select value={data.project.status} onChange={(event) => mutate({ action: "update_project_status", status: event.target.value }, "Project status updated")}><option>Planning</option><option>Pre-production</option><option>Production</option><option>Post-production</option><option>On hold</option><option>Delivered</option></select></label><button className="black-button" onClick={() => openComposer("expense")}>＋ EXPENSE</button></div></div>
    <div className="control-strip"><div><span>JOB</span><strong>{data.project.code}</strong></div><div><span>CLIENT</span><strong>{data.project.client}</strong></div><div><span>SHOOT</span><strong>{formatDate(data.project.shoot_start)}—{formatDate(data.project.shoot_end)}</strong></div><div><span>STATUS</span><strong>{data.project.status}</strong></div></div>
    <div className="control-finance"><article><p>APPROVED ESTIMATE</p><strong>{money.format(totals.estimate)}</strong><div className="wide-meter"><span style={{ width: `${Math.min(totals.percent, 100)}%` }} /></div><footer><span>COMMITTED <b>{money.format(totals.committed)}</b></span><span>ACTUAL <b>{money.format(totals.actual)}</b></span><span>REMAINING <b>{money.format(totals.remaining)}</b></span></footer></article><aside><p>SYNC STATUS</p><strong>CALL SHEET LIVE</strong><span>Crew and schedule changes flow through automatically.</span><button onClick={() => openView("callsheet")}>OPEN GENERATED CALL SHEET →</button></aside></div>
    <div className="section-label"><span>PRODUCTION MODULES</span><b>{modules.length} LIVE</b></div><div className="module-grid">{modules.map((module) => <button onClick={() => openView(module.view)} key={module.title}><div><span>{module.tag}</span><b>↗</b></div><h2>{module.title}</h2><footer><span>{module.count}</span><b>→</b></footer></button>)}</div>
    <div className="control-lower"><article className="attention"><Heading kicker="Needs attention" title="Keep the day moving" /><button onClick={() => openView("reconcile")}><span>!</span><strong>{review} working cost{review === 1 ? "" : "s"} without backup</strong><b>→</b></button><button onClick={() => openView("travel")}><span>↗</span><strong>Travel imports can create hotel and car holds</strong><b>→</b></button><button onClick={() => openView("locations")}><span>⌂</span><strong>Location board ready for client review</strong><b>→</b></button></article><article className="recent"><Heading kicker="Live activity" title="Latest across production" /><ActivityList activities={data.activities.slice(0, 4)} /></article></div></section>;
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

function ReconcileView({ project, expenses, files, lines, openBackup, mutate }: { project: Project; expenses: Expense[]; files: FileAsset[]; lines: BudgetLine[]; openBackup: () => void; mutate: Mutate }) {
  const codedLines = codedBudgetLines(lines);
  const lookup = new Map(codedLines.map((entry) => [entry.line.id, entry]));
  const [lineFilter, setLineFilter] = useState("all");
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const backupFiles = files.filter((file) => file.category.toLowerCase() === "backup");
  const backedExpenseIds = new Set(backupFiles.map((file) => file.expense_id).filter(Boolean));
  const actual = backupFiles.reduce((sum, file) => sum + Number(file.amount || 0), 0);
  const working = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const estimate = lines.reduce((sum, line) => sum + Number(line.estimate), 0);
  const remaining = estimate - working;
  const openCommitment = working - actual;
  const percent = estimate > 0 ? Math.round((working / estimate) * 100) : 0;
  const sections = [...new Set(codedLines.map((entry) => entry.section))];
  const visibleExpenses = lineFilter === "all" ? expenses : expenses.filter((expense) => expense.budget_line_id === lineFilter);
  const editingLine = codedLines.find(({ line }) => line.id === editingLineId);
  const publishReconciliation = () => mutate({ action: "publish_client_item", kind: "Reconciliation", label: `${project.name} · Top-Line Reconciliation`, estimate, working, actual, remaining, openCommitment, percent }, "Reconciliation snapshot pushed to the client portal");
  return <Page className="reconcile-page" kicker="Finance · Internal cost report" title="Reconciliation" copy="Edit working commitments by vendor. Actuals are calculated only from uploaded receipts and invoices." actions={<><button className="outline-button" onClick={publishReconciliation}>PUSH TO CLIENT PORTAL →</button><button className="black-button" onClick={openBackup}>＋ UPLOAD BACKUP</button></>}>
    <div className="dense-metrics"><Metric label="Estimate" value={money.format(estimate)} note="Approved budget" /><Metric label="Working" value={money.format(working)} note={`${expenses.length} vendor allocation${expenses.length === 1 ? "" : "s"}`} /><Metric label="Actual" value={money.format(actual)} note={`${backupFiles.length} linked document${backupFiles.length === 1 ? "" : "s"}`} /><Metric label="Remaining" value={money.format(estimate - working)} note="Estimate less working" /></div>
    <div className="reconcile-definition-bar"><span><b>WORKING</b> Your editable vendor commitments and forecasts.</span><span><b>ACTUAL</b> Amounts supported by uploaded backup.</span><span><b>NO BACKUP</b> A working cost without a receipt or invoice yet.</span></div>
    <div className="reconcile-caption"><span>COST REPORT BY BUDGET LINE</span><b>CLICK A WORKING NUMBER TO EDIT ITS VENDORS</b></div>
    <div className="work-table reconcile-summary"><div className="work-head"><span>Budget line</span><span>Estimate</span><span>Working</span><span>Vs. estimate</span><span>Actual</span><span>Open commitment</span></div>{sections.map((section) => { const sectionLines = codedLines.filter((entry) => entry.section === section); return <section className="reconcile-section-block" key={section}><header><b>{section}</b><strong>{sectionLines[0]?.line.category || "Production"}</strong><span>{sectionLines.length} {sectionLines.length === 1 ? "LINE" : "LINES"}</span></header>{sectionLines.map(({ line, code }) => { const lineCosts = expenses.filter((expense) => expense.budget_line_id === line.id); const lineBackup = backupFiles.filter((file) => file.budget_line_id === line.id); const lineWorking = lineCosts.reduce((sum, item) => sum + Number(item.amount), 0); const lineActual = lineBackup.reduce((sum, file) => sum + Number(file.amount || 0), 0); const workingDiff = lineWorking - Number(line.estimate); const openCommitment = lineWorking - lineActual; const isNa = Boolean(line.is_na); return <div className={`work-row reconcile-line-row ${lineFilter === line.id ? "selected" : ""}`} key={line.id}><button className="reconcile-line-ident" onClick={() => setLineFilter(lineFilter === line.id ? "all" : line.id)} aria-pressed={lineFilter === line.id}><b>{code}</b><span><strong>{line.item_name || line.category}</strong><small>{line.description}</small></span></button><span>{isNa ? "N/A" : money.format(line.estimate)}</span><button className="working-number-button" disabled={isNa} onClick={() => setEditingLineId(line.id)}><strong>{isNa ? "—" : money.format(lineWorking)}</strong>{!isNa && <small>{lineCosts.length} vendor{lineCosts.length === 1 ? "" : "s"} · EDIT</small>}</button><span className={workingDiff < 0 ? "positive" : workingDiff > 0 ? "negative" : "muted"}>{isNa || workingDiff === 0 ? "—" : signedMoney(workingDiff)}</span><span className="actual-from-backup"><strong>{isNa ? "—" : money.format(lineActual)}</strong>{!isNa && <small>{lineBackup.length} backup file{lineBackup.length === 1 ? "" : "s"}</small>}</span><span className={openCommitment < 0 ? "negative" : ""}>{isNa ? "—" : money.format(openCommitment)}</span></div>; })}</section>; })}<div className="work-total"><span>GRAND TOTAL</span><span>{money.format(estimate)}</span><span>{money.format(working)}</span><span className={working - estimate > 0 ? "negative" : "positive"}>{signedMoney(working - estimate)}</span><span>{money.format(actual)}</span><span>{money.format(working - actual)}</span></div></div>
    <div className="table-heading reconcile-transaction-heading"><Heading kicker="Supporting detail" title="Vendor allocations" /><div><label>SHOW<select value={lineFilter} onChange={(event) => setLineFilter(event.target.value)}><option value="all">ALL BUDGET LINES</option>{codedLines.map(({ line, code }) => <option value={line.id} key={line.id}>{code} · {line.item_name || line.category}</option>)}</select></label><span>{expenses.filter((expense) => !backedExpenseIds.has(expense.id)).length} WITHOUT BACKUP</span></div></div><p className="reconcile-register-note">Each row below contributes to Working. A row contributes to Actual only when a receipt or invoice is linked to it.</p><div className="work-table expense-work reconcile-expense-work"><div className="work-head"><span>Vendor / memo</span><span>Budget line</span><span>Working</span><span>Backup</span><span>Actual</span></div>{visibleExpenses.length ? visibleExpenses.map((expense) => { const allocated = lookup.get(expense.budget_line_id); const linkedBackup = backupFiles.filter((file) => file.expense_id === expense.id); const backedActual = linkedBackup.reduce((sum, file) => sum + Number(file.amount || 0), 0); return <div className="work-row" key={expense.id}><span><strong>{expense.vendor}</strong><small>{expense.memo || formatDate(expense.spend_date)}</small></span><span className="expense-allocation"><select aria-label={`Allocate ${expense.vendor} to budget line`} value={expense.budget_line_id} onChange={(event) => mutate({ action: "update_expense_allocation", id: expense.id, budgetLineId: event.target.value }, `${expense.vendor} allocated to ${lookup.get(event.target.value)?.code || "budget line"}`)}>{codedLines.map(({ line, code }) => <option value={line.id} key={line.id}>{code} · {line.item_name || line.category}</option>)}</select><small>{allocated?.line.description || "Choose a budget line"}</small></span><span><strong>{money.format(expense.amount)}</strong></span><span><b className={`backup-coverage-status ${linkedBackup.length ? "linked" : "missing"}`}>{linkedBackup.length ? "BACKUP LINKED" : "NO BACKUP"}</b></span><span><strong>{linkedBackup.length ? money.format(backedActual) : "—"}</strong></span></div>; }) : <Empty text="NO VENDOR ALLOCATIONS ON THIS LINE" note="Click the Working number above to add one or more vendors." />}</div>
    {editingLine && <WorkingAllocationsModal line={editingLine.line} code={editingLine.code} expenses={expenses.filter((expense) => expense.budget_line_id === editingLine.line.id)} files={backupFiles} close={() => setEditingLineId(null)} mutate={mutate} />}
  </Page>;
}

type WorkingAllocationDraft = { key: string; id?: string; vendor: string; memo: string; spendDate: string; amount: string; backed: boolean };

function WorkingAllocationsModal({ line, code, expenses, files, close, mutate }: { line: BudgetLine; code: string; expenses: Expense[]; files: FileAsset[]; close: () => void; mutate: Mutate }) {
  const linkedExpenseIds = new Set(files.map((file) => file.expense_id).filter(Boolean));
  const createDraft = (expense?: Expense): WorkingAllocationDraft => ({ key: expense?.id || crypto.randomUUID(), id: expense?.id, vendor: expense?.vendor || "", memo: expense?.memo || "", spendDate: expense?.spend_date || new Date().toISOString().slice(0, 10), amount: expense ? String(expense.amount) : "", backed: expense ? linkedExpenseIds.has(expense.id) : false });
  const [rows, setRows] = useState<WorkingAllocationDraft[]>(() => expenses.length ? expenses.map(createDraft) : [createDraft()]);
  const [savingRows, setSavingRows] = useState(false);
  const total = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const actual = files.filter((file) => file.budget_line_id === line.id).reduce((sum, file) => sum + Number(file.amount || 0), 0);
  const update = (key: string, field: keyof Pick<WorkingAllocationDraft, "vendor" | "memo" | "spendDate" | "amount">, value: string) => setRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row));
  async function save() {
    const valid = rows.filter((row) => row.vendor.trim() || Number(row.amount));
    if (valid.some((row) => !row.vendor.trim() || !Number.isFinite(Number(row.amount)) || Number(row.amount) < 0)) return;
    setSavingRows(true);
    const saved = await mutate({ action: "save_working_allocations", budgetLineId: line.id, rows: valid.map(({ id, vendor, memo, spendDate, amount }) => ({ id, vendor, memo, spendDate, amount: Number(amount) })) }, `${code} working costs updated`);
    setSavingRows(false);
    if (saved) close();
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section className="working-editor" role="dialog" aria-modal="true" aria-label={`Edit working costs for ${code}`}><header><div><p>{code} · WORKING COSTS</p><h2>{line.item_name || line.category}</h2><span>{line.description}</span></div><button onClick={close} aria-label="Close working cost editor">×</button></header><div className="working-editor-columns"><span>VENDOR</span><span>MEMO / PURPOSE</span><span>DATE</span><span>AMOUNT</span><span>BACKUP</span><span /></div><div className="working-editor-rows">{rows.map((row) => <div className="working-editor-row" key={row.key}><input value={row.vendor} onChange={(event) => update(row.key, "vendor", event.target.value)} placeholder="Vendor name" aria-label="Vendor name" /><input value={row.memo} onChange={(event) => update(row.key, "memo", event.target.value)} placeholder="Commitment or purpose" aria-label="Memo or purpose" /><input type="date" value={row.spendDate} onChange={(event) => update(row.key, "spendDate", event.target.value)} aria-label="Cost date" /><label className="working-editor-amount"><span>$</span><input type="number" min="0" step="0.01" value={row.amount} onChange={(event) => update(row.key, "amount", event.target.value)} placeholder="0.00" aria-label="Working amount" /></label><b className={`backup-coverage-status ${row.backed ? "linked" : "missing"}`}>{row.backed ? "LINKED" : "NONE"}</b><button disabled={row.backed} title={row.backed ? "Remove its backup document from the Backup page first" : "Remove vendor allocation"} onClick={() => setRows((current) => current.filter((candidate) => candidate.key !== row.key))}>{row.backed ? "LOCKED" : "REMOVE"}</button></div>)}</div><button className="add-working-row" onClick={() => setRows((current) => [...current, createDraft()])}>＋ ADD ANOTHER VENDOR</button><footer><div><span>ESTIMATE <b>{money.format(line.estimate)}</b></span><span>WORKING <b>{money.format(total)}</b></span><span>ACTUAL FROM BACKUP <b>{money.format(actual)}</b></span></div><button onClick={close}>CANCEL</button><button className="black-button" disabled={savingRows} onClick={save}>{savingRows ? "SAVING…" : "SAVE WORKING COSTS"}</button></footer></section></div>;
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
    <section className="budget-audit-panel"><header><div><span>DOCUMENT + COST AUDIT</span><h2>BUDGET AUDIT NOTES</h2></div><button disabled={auditing} onClick={auditBudget}>{auditing ? "AUDITING…" : "RUN NEW AUDIT ↗"}</button></header>{lastAudit ? <><div className="audit-summary"><span>{lastAudit.source === "openai" ? "DOCUMENT REVIEW" : "AUTOMATED CROSS-CHECK"}</span><strong>{lastAudit.summary}</strong><time>{new Date(lastAudit.created_at).toLocaleString()}</time></div><div className="audit-notes">{auditNotes.map((note, index) => <article className={note.severity} key={`${note.title}-${index}`}><b>{note.severity}</b><div><strong>{note.title}</strong><p>{note.detail}</p></div><span>{note.line_code || "—"}{typeof note.amount === "number" ? ` · ${money.format(note.amount)}` : ""}</span></article>)}</div></> : <div className="audit-empty"><strong>NO AUDIT RUN YET</strong><span>Run an audit to cross-check budget lines, costs, duplicate entries, receipt coverage and document metadata.</span></div>}</section>
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
  const [importing, setImporting] = useState(false); const [importError, setImportError] = useState("");
  const [tripType, setTripType] = useState<PickupPlan["tripType"]>("to_airport"); const [routeTraveler, setRouteTraveler] = useState(""); const [origin, setOrigin] = useState(""); const [destination, setDestination] = useState(""); const [eventDateTime, setEventDateTime] = useState(""); const [bufferMinutes, setBufferMinutes] = useState("15"); const [fallbackMinutes, setFallbackMinutes] = useState("60"); const [planning, setPlanning] = useState(false); const [planError, setPlanError] = useState(""); const [pickupPlan, setPickupPlan] = useState<PickupPlan | null>(null);
  const dateTimeLabel = (value: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  const timeLabel = (value: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
  const localInputValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  async function importFile(file: File) {
    setImporting(true); setImportError("");
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const fileData = isPdf ? await fileToDataUrl(file) : "";
      const text = isPdf ? "" : await file.text();
      await mutate({ action: "import_travel_reservation", filename: file.name, fileData, text, traveler, autoHotel, autoCar }, "Reservation parsed and travel chart updated");
    } catch (reason) { setImportError(reason instanceof Error ? reason.message : "That reservation could not be read."); }
    finally { setImporting(false); }
  }
  async function importPasted() {
    if (!pasted.trim()) return;
    setImporting(true); setImportError("");
    const saved = await mutate({ action: "import_travel_reservation", filename: "Pasted reservation", text: pasted, traveler, autoHotel, autoCar }, "Reservation parsed and travel chart updated");
    if (saved) setPasted("");
    setImporting(false);
  }
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
    <div className="travel-import"><button className={drag ? "drop active" : "drop"} disabled={importing} onClick={() => picker.current?.click()} onDragOver={(event) => { event.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}><strong>{importing ? "READING BOOKING…" : "DROP TRAVEL RESERVATION"}</strong><span>PDF, airline email, itinerary or confirmation text</span></button><div className="travel-options"><label>TRAVELER<input value={traveler} onChange={(event) => setTraveler(event.target.value)} placeholder="Name from headcount" /></label><label className="check"><input type="checkbox" checked={autoHotel} onChange={(event) => setAutoHotel(event.target.checked)} />Suggest hotel from flight dates</label><label className="check"><input type="checkbox" checked={autoCar} onChange={(event) => setAutoCar(event.target.checked)} />Suggest arrival car · route below</label></div><div className="paste-reservation"><textarea value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder="Or paste a confirmation email here…" /><button disabled={importing || !pasted.trim()} onClick={importPasted}>{importing ? "PARSING…" : "PARSE RESERVATION →"}</button></div></div>
    {importError && <div className="pickup-plan-error">{importError}</div>}
    <section className="pickup-planner" id="pickup-planner"><header><div><span>GROUND TRANSPORT · ROUTE PLANNING</span><h2>TRAFFIC-AWARE PICKUP PLANNER</h2></div><b>✈ AIRPORT ARRIVAL = 2 HOURS BEFORE FLIGHT</b></header><form onSubmit={calculatePickup}><label>TRIP TYPE<select value={tripType} onChange={(event) => { const next = event.target.value as PickupPlan["tripType"]; setTripType(next); setBufferMinutes(next === "from_airport" ? "30" : "15"); setPickupPlan(null); }}><option value="to_airport">To airport</option><option value="from_airport">From airport</option><option value="general">General transfer</option></select></label><label>TRAVELER<input value={routeTraveler} onChange={(event) => setRouteTraveler(event.target.value)} placeholder="Name from headcount" /></label><label className="wide">ORIGIN<input value={origin} onChange={(event) => { setOrigin(event.target.value); setPickupPlan(null); }} placeholder="Hotel, home or production address" required /></label><label className="wide">DESTINATION<input value={destination} onChange={(event) => { setDestination(event.target.value); setPickupPlan(null); }} placeholder="Airport, hotel or location" required /></label><label>{tripType === "to_airport" ? "FLIGHT DEPARTURE" : tripType === "from_airport" ? "FLIGHT ARRIVAL" : "REQUIRED ARRIVAL"}<input type="datetime-local" value={eventDateTime} onChange={(event) => { setEventDateTime(event.target.value); setPickupPlan(null); }} required /></label><label>{tripType === "from_airport" ? "BAGGAGE / EXIT BUFFER" : "PRODUCTION BUFFER"}<select value={bufferMinutes} onChange={(event) => setBufferMinutes(event.target.value)}><option value="0">No buffer</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label><label>FALLBACK DRIVE TIME<input type="number" min="5" max="360" value={fallbackMinutes} onChange={(event) => setFallbackMinutes(event.target.value)} /><small>Used only if live routing is unavailable</small></label><button className="black-button" disabled={planning}>{planning ? "CHECKING TRAFFIC…" : "CHECK DRIVE + CALCULATE →"}</button></form>{planError && <div className="pickup-plan-error">{planError}</div>}{pickupPlan && <div className="pickup-result"><div><span>SUGGESTED PICKUP</span><strong>{dateTimeLabel(pickupPlan.pickupAt)}</strong><small>{pickupPlan.tripType === "to_airport" ? `Airport arrival ${dateTimeLabel(pickupPlan.arriveBy)}` : `Destination ETA ${dateTimeLabel(pickupPlan.estimatedDestinationAt)}`}</small></div><div><span>DRIVE</span><strong>{pickupPlan.driveMinutes} MIN</strong><small>{pickupPlan.distanceMiles == null ? "Distance pending live route" : `${pickupPlan.distanceMiles} miles`}</small></div><div><span>TRAFFIC</span><strong>{pickupPlan.source === "google_traffic" ? "LIVE" : "ESTIMATE"}</strong><small>{pickupPlan.trafficDelayMinutes == null ? "Using fallback drive time" : `+${pickupPlan.trafficDelayMinutes} min vs. clear traffic`}</small></div><div><span>BUFFER</span><strong>{pickupPlan.tripType === "to_airport" ? "2 HR + " : ""}{pickupPlan.bufferMinutes} MIN</strong><small>{pickupPlan.tripType === "to_airport" ? "Preflight arrival + production buffer" : "Loading / production buffer"}</small></div><button onClick={savePickup}>＋ ADD TRANSFER TO CHART</button></div>}</section>
    <div className="work-table travel-work"><div className="work-head"><span>Traveler</span><span>Type</span><span>Route / property</span><span>Date / time</span><span>Confirmation</span><span>Status</span><span /></div>{records.map((record) => <div className="work-row" key={record.id}><span><strong>{record.data.traveler}</strong><small>{record.data.source || "Manual entry"}</small></span><span>{record.data.type}</span><span><strong>{record.data.detail}</strong><small>{record.data.from && record.data.to ? `${record.data.from} → ${record.data.to}` : ""}</small></span><span>{record.data.timing}</span><span>{record.data.confirmation || "—"}</span><span><b className="to-code">{record.data.status}</b></span><span>{record.data.type === "Flight" && <button className="plan-flight" onClick={() => prepareFlight(record)}>PLAN</button>}<button onClick={() => mutate({ action: "delete_module_record", id: record.id }, "Travel item removed")}>×</button></span></div>)}</div>
  </Page>;
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

function ProjectSettings({ project, saving, mutate }: { project: Project; saving: boolean; mutate: Mutate }) {
  const statuses = [...new Set([project.status, "Planning", "Pre-production", "Production", "Post-production", "On hold", "Complete"])];
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate({
      action: "update_project_details",
      name: String(form.get("name") || ""), client: String(form.get("client") || ""), code: String(form.get("code") || ""), status: String(form.get("status") || ""),
      shootStart: String(form.get("shootStart") || ""), shootEnd: String(form.get("shootEnd") || ""), currency: String(form.get("currency") || "USD"),
      contact: String(form.get("contact") || ""), contactEmail: String(form.get("contactEmail") || ""), billingAddress: String(form.get("billingAddress") || ""), poNo: String(form.get("poNo") || ""),
      budgetNotes: String(form.get("budgetNotes") || ""), budgetChanges: String(form.get("budgetChanges") || ""), markupPct: Number(form.get("markupPct") || 0), insurancePct: Number(form.get("insurancePct") || 0),
    }, "Project settings saved across the production");
  }
  return <Page className="project-settings-page" kicker="System · Job-wide controls" title="Project Settings" copy="Edit the production details used across budgets, schedules, call sheets, travel, locations and the client portal.">
    <form className="project-settings-form" key={project.id} onSubmit={save}>
      <section><header><span>01</span><div><h2>PRODUCTION IDENTITY</h2><p>The naming and job references used throughout the workspace.</p></div></header><div className="project-settings-grid"><label>PROJECT NAME<input name="name" defaultValue={project.name} required /></label><label>CLIENT / BRAND<input name="client" defaultValue={project.client} required /></label><label>JOB NUMBER<input name="code" defaultValue={project.code} required /></label><label>STATUS<select name="status" defaultValue={project.status}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label></div></section>
      <section><header><span>02</span><div><h2>SCHEDULE + FINANCIAL DEFAULTS</h2><p>Global dates and estimate settings used by production documents.</p></div></header><div className="project-settings-grid"><label>SHOOT START<input name="shootStart" type="date" defaultValue={project.shoot_start} required /></label><label>SHOOT END<input name="shootEnd" type="date" defaultValue={project.shoot_end} required /></label><label>CURRENCY<input name="currency" maxLength={3} defaultValue={project.currency || "USD"} required /></label><label>PO NUMBER<input name="poNo" defaultValue={project.po_no || ""} /></label><label>DEFAULT MARKUP %<input name="markupPct" type="number" step="0.01" defaultValue={project.markup_pct ?? 10} /></label><label>DEFAULT INSURANCE %<input name="insurancePct" type="number" step="0.01" defaultValue={project.insurance_pct ?? 5} /></label></div></section>
      <section><header><span>03</span><div><h2>CLIENT + BILLING</h2><p>Primary contact information carried into estimates and client materials.</p></div></header><div className="project-settings-grid"><label>CLIENT CONTACT<input name="contact" defaultValue={project.contact || ""} /></label><label>CONTACT EMAIL<input name="contactEmail" type="email" defaultValue={project.contact_email || ""} /></label><label className="settings-wide">BILLING ADDRESS<textarea name="billingAddress" defaultValue={project.billing_address || ""} /></label></div></section>
      <section><header><span>04</span><div><h2>PROJECT COPY</h2><p>Job-wide description and latest revision note used by the estimate.</p></div></header><div className="project-settings-grid"><label className="settings-wide">PROJECT SUMMARY / SCOPE<textarea name="budgetNotes" defaultValue={project.budget_notes || ""} /></label><label className="settings-wide">LATEST CHANGE NOTE<textarea name="budgetChanges" defaultValue={project.budget_changes || ""} /></label></div></section>
      <footer><div><span>APPLIES TO THIS JOB ONLY</span><strong>{project.name} · {project.code}</strong></div><button className="black-button" disabled={saving}>{saving ? "SAVING…" : "SAVE PROJECT SETTINGS →"}</button></footer>
    </form>
  </Page>;
}

function ActivityView({ activities }: { activities: Activity[] }) { return <Page kicker="System · Audit trail" title="Activity" copy="Every change across production in one running record."><div className="activity-full"><ActivityList activities={activities} /></div></Page>; }
function ActivityList({ activities }: { activities: Activity[] }) { return <div className="activity-list">{activities.map((activity) => <div key={activity.id}><span>{activity.kind.slice(0, 2).toUpperCase()}</span><span><strong>{activity.message}</strong><small>{activity.actor}</small></span><time>{relativeTime(activity.created_at)}</time></div>)}</div>; }
function Heading({ kicker, title }: { kicker: string; title: string }) { return <div className="small-heading"><p>{kicker}</p><h2>{title}</h2></div>; }
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <article className="metric"><p>{label}</p><strong>{value}</strong><span>{note}</span></article>; }
function Empty({ text, note }: { text: string; note: string }) { return <div className="empty"><strong>{text}</strong><span>{note}</span></div>; }
function Page({ kicker, title, copy, actions, className = "", children }: { kicker: string; title: string; copy: string; actions?: ReactNode; className?: string; children: ReactNode }) { return <section className={`page ${className}`.trim()}><header className="page-head"><div><p>{kicker}</p><h1>{title}</h1><span>{copy}</span></div>{actions && <div>{actions}</div>}</header>{children}</section>; }

function BackupAllocationModal({ file, lines, saving, close, upload }: { file: File; lines: BudgetLine[]; saving: boolean; close: () => void; upload: (values: Record<string, string>) => void }) {
  const codedLines = codedBudgetLines(lines); const suggestedVendor = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const values = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key, value]) => [key, String(value)])); upload(values); }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className="composer backup-allocation-modal" onSubmit={submit}><header><div><p>BACKUP ALLOCATION</p><h2>Code This Document</h2></div><button type="button" onClick={close}>×</button></header><div className="backup-file-summary"><span>{file.type.split("/").pop()?.toUpperCase() || "FILE"}</span><div><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(0)} KB</small></div></div><label>Budget line<select name="budgetLineId" required>{codedLines.map(({ line, code }) => <option value={line.id} key={line.id}>{code} · {line.item_name || line.category} — {line.description}</option>)}</select></label><Field label="Vendor" name="vendor" placeholder={suggestedVendor} /><div className="field-pair"><Field label="Amount" name="amount" type="number" placeholder="0.00" /><Field label="Receipt date" name="spendDate" type="date" /></div><Field label="Memo / purpose" name="memo" placeholder={`Backup: ${file.name}`} /><p className="backup-allocation-note">Saving creates the reconciliation cost and links this document to the selected budget line.</p><footer><button type="button" onClick={close}>CANCEL</button><button className="black-button" disabled={saving || !codedLines.length}>{saving ? "UPLOADING…" : "UPLOAD + ALLOCATE"}</button></footer></form></div>;
}

function ComposerModal({ type, lines, saving, close, submit }: { type: Exclude<Composer, null>; lines: BudgetLine[]; saving: boolean; close: () => void; submit: Mutate }) {
  const codedLines = codedBudgetLines(lines);
  const [travelType, setTravelType] = useState("Flight");
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (type === "travel") {
      const data = { ...values } as Record<string, FormDataEntryValue>;
      if (travelType === "Flight") { data.detail = `${values.from || "Origin"} → ${values.to || "Destination"} · ${values.flightNumber || "Flight TBD"}`; data.timing = `${values.departDate || "Date TBD"} · ${values.departTime || "Time TBD"}`; }
      if (travelType === "Hotel") { data.provider = values.hotel || "Hotel TBD"; data.departDate = values.checkIn || ""; data.arriveDate = values.checkOut || ""; data.detail = `${values.hotel || "Hotel TBD"} · lodging`; data.timing = `${values.checkIn || "Check-in TBD"}–${values.checkOut || "Check-out TBD"}`; }
      if (["Car", "Transfer"].includes(travelType)) { data.detail = `${values.from || "Pickup TBD"} → ${values.to || "Drop-off TBD"}`; data.timing = `${values.departDate || "Date TBD"} · ${values.departTime || "Time TBD"}`; }
      void submit({ action: "add_module_record", module: type, data }, `${travelType} booking added`); return;
    }
    if (["production", "crew", "schedule"].includes(type)) { void submit({ action: "add_module_record", module: type, data: values }, `${titleCase(type)} record added`); return; }
    const action = type === "project" ? "create_project" : type === "budget" ? "add_budget_line" : type === "expense" ? "add_expense" : "add_location"; void submit({ ...values, action }, `${titleCase(type)} added`);
  }
  const title = type === "project" ? "New Production" : type === "budget" ? "New Budget Line" : type === "expense" ? "New Expense" : type === "location" ? "New Location" : type === "crew" ? "Add Crew Member" : type === "travel" ? "Add Travel Record" : type === "schedule" ? "Add Schedule Row" : "Add Production Item";
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><form className="composer" onSubmit={onSubmit}><header><div><p>QUICK ADD</p><h2>{title}</h2></div><button type="button" onClick={close}>×</button></header>
    {type === "project" && <><Field label="Project name" name="name" /><Field label="Client" name="client" /><div className="field-pair"><Field label="Job code" name="code" /><Field label="Shoot start" name="shootStart" type="date" /></div><Field label="Shoot end" name="shootEnd" type="date" /></>}
    {type === "budget" && <><Field label="Category" name="category" /><Field label="Description" name="description" /><Field label="Estimate" name="estimate" type="number" /></>}
    {type === "expense" && <><Field label="Vendor" name="vendor" /><label>Budget line<select name="budgetLineId">{codedLines.map(({ line, code }) => <option value={line.id} key={line.id}>{code} · {line.item_name || line.category} — {line.description}</option>)}</select></label><div className="field-pair"><Field label="Amount" name="amount" type="number" /><Field label="Spend date" name="spendDate" type="date" /></div><Field label="Memo" name="memo" /></>}
    {type === "location" && <><Field label="Location name" name="name" /><Field label="City / region" name="city" /><div className="field-pair"><Field label="Day rate" name="rate" type="number" /><Field label="Hero image URL" name="imageUrl" type="url" /></div><Field label="Tags (use | between tags)" name="tags" placeholder="Modern|Daylight|Easy load-in" /><Field label="Production note" name="note" /><Field label="Client-facing note" name="clientNote" /></>}
    {type === "production" && <><Field label="Section" name="section" /><Field label="Item" name="item" /><div className="field-pair"><Field label="Owner" name="owner" /><Field label="Status" name="status" /></div></>}
    {type === "crew" && <><Field label="Name" name="name" /><Field label="Role" name="role" /><div className="field-pair"><Field label="Email" name="email" type="email" /><Field label="Phone" name="phone" /></div><div className="field-pair"><Field label="Dietary" name="dietary" required={false} /><Field label="Call offset (minutes)" name="callOffset" type="number" placeholder="-15" /></div><Field label="Call location" name="callLocation" placeholder="Basecamp" /></>}
    {type === "schedule" && <><Field label="Time" name="time" type="time" /><Field label="Event" name="event" /><Field label="Location" name="location" /></>}
    {type === "travel" && <><label>Booking type<select name="type" value={travelType} onChange={(event) => setTravelType(event.target.value)}><option>Flight</option><option>Hotel</option><option>Car</option><option>Transfer</option></select></label><Field label="Traveler" name="traveler" />
      {travelType === "Flight" && <><div className="field-pair"><Field label="Airline" name="provider" /><Field label="Flight number" name="flightNumber" /></div><div className="field-pair"><Field label="Origin" name="from" /><Field label="Destination" name="to" /></div><div className="field-pair"><Field label="Departure date" name="departDate" type="date" /><Field label="Departure time" name="departTime" /></div><div className="field-pair"><Field label="Arrival date" name="arriveDate" type="date" /><Field label="Arrival time" name="arriveTime" /></div></>}
      {travelType === "Hotel" && <><Field label="Hotel" name="hotel" /><div className="field-pair"><Field label="Team" name="team" required={false} /><Field label="Role" name="role" required={false} /></div><div className="field-pair"><Field label="Room type" name="roomType" placeholder="Standard Room" /><Field label="Payment responsibility" name="paymentResponsibility" placeholder="Production / Guest / Client" /></div><Field label="Charges covered" name="charges" placeholder="Room & Tax / All Charges" /><div className="field-pair"><Field label="Check in" name="checkIn" type="date" /><Field label="Check out" name="checkOut" type="date" /></div><Field label="Confirmation #" name="confirmation" required={false} /><Field label="Hotel notes" name="notes" placeholder="Move hotel / accessibility / special request" required={false} /></>}
      {["Car", "Transfer"].includes(travelType) && <><Field label="Car company / provider" name="provider" /><div className="field-pair"><Field label="Pickup" name="from" /><Field label="Drop-off" name="to" /></div><div className="field-pair"><Field label="Pickup date" name="departDate" type="date" /><Field label="Pickup time" name="departTime" /></div><Field label="Vehicle" name="vehicle" placeholder="Sedan / SUV / Van" /><Field label="Dispatch notes" name="notes" required={false} /></>}
      {travelType === "Hotel" ? <Field label="Status" name="status" placeholder="Confirmed" /> : <div className="field-pair"><Field label="Confirmation" name="confirmation" required={false} /><Field label="Status" name="status" placeholder="Confirmed" /></div>}</>}
    <footer><button type="button" onClick={close}>CANCEL</button><button className="black-button" disabled={saving}>{saving ? "SAVING…" : "SAVE"}</button></footer></form></div>;
}

function Field({ label, name, type = "text", placeholder, required = true }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) { return <label>{label}<input name={name} type={type} step={type === "number" ? "any" : undefined} placeholder={placeholder} required={required && type !== "url"} /></label>; }
function parseCsvLine(line: string) { const result: string[] = []; let current = "", quoted = false; for (let index = 0; index < line.length; index++) { const char = line[index]; if (char === '"') { if (quoted && line[index + 1] === '"') { current += '"'; index++; } else quoted = !quoted; } else if (char === "," && !quoted) { result.push(current.trim()); current = ""; } else current += char; } result.push(current.trim()); return result; }
function normalizeDate(value: string) { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10); }
async function fileToDataUrl(file: File) {
  if (file.size > 8 * 1024 * 1024) throw new Error("Travel documents must be 8 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer()); let binary = "";
  for (let index = 0; index < bytes.length; index += 32768) binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  const contentType = file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : file.type || "application/octet-stream";
  return `data:${contentType};base64,${btoa(binary)}`;
}
function signedMoney(value: number) { return `${value > 0 ? "+" : value < 0 ? "−" : ""}${money.format(Math.abs(value))}`; }
function compareBudgets(before: BudgetSnapshot[], after: BudgetSnapshot[]) { const beforeMap = new Map(before.map((line) => [line.id, line])); const afterMap = new Map(after.map((line) => [line.id, line])); return [...new Set([...beforeMap.keys(), ...afterMap.keys()])].map((key) => { const a = beforeMap.get(key), b = afterMap.get(key); const previous = Number(a?.estimate ?? 0), current = Number(b?.estimate ?? 0); return { key, category: b?.category || a?.category || "New cost", description: b?.description || a?.description || "", before: previous, after: current, delta: current - previous }; }); }
function generalCall(schedule: ModuleRecord[]) { return [...schedule].sort((a, b) => (a.data.time || "").localeCompare(b.data.time || ""))[0]?.data.time || "06:00"; }
function defaultOffset(role: string) { const value = role.toLowerCase(); if (value.includes("producer") || value.includes("ad")) return -30; if (value.includes("camera") || value.includes("grip") || value.includes("electric")) return -15; if (value.includes("talent")) return 45; return 0; }
function shiftTime(value: string, offset: number) { const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i); if (!match) return value; let hour = Number(match[1]); const minute = Number(match[2]); const suffix = match[3]?.toUpperCase(); if (suffix === "PM" && hour < 12) hour += 12; if (suffix === "AM" && hour === 12) hour = 0; const total = (hour * 60 + minute + offset + 1440) % 1440; const h = Math.floor(total / 60), m = total % 60; return `${pad(h)}:${pad(m)}`; }
