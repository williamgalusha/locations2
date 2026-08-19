"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BudgetLine, BudgetSnapshot, Location, Mutate, PortalData, Project, User } from "./production-portal";
import type { PortalRole } from "./credential-auth";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pad = (value: number) => String(value).padStart(2, "0");
const cleanNumber = (value: unknown, fallback = 0) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; };
const titleCase = (value: string) => value.replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
const signedMoney = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${money.format(Math.abs(value))}`;
const galleryOf = (location: Location) => {
  if (Array.isArray(location.gallery)) { const images = location.gallery.filter(Boolean); if (images.length) return images; }
  if (typeof location.gallery === "string" && location.gallery.trim()) {
    try { const parsed = JSON.parse(location.gallery); if (Array.isArray(parsed)) { const images = parsed.filter((item): item is string => typeof item === "string" && Boolean(item)); if (images.length) return images; } } catch { const images = location.gallery.split("|").filter(Boolean); if (images.length) return images; }
  }
  return location.image_url ? [location.image_url] : [];
};

const SCENES = [
  { name: "Rain", duration: 2.8 }, { name: "Mess", duration: 1 }, { name: "Sort", duration: 5.6 },
  { name: "Commas", duration: 2.6 }, { name: "Hold", duration: 2 },
] as const;
const CUES = SCENES.reduce<Record<string, number>>((result, scene) => { result[scene.name] = Object.values(result).length ? Object.entries(result).reduce((sum, [name]) => sum + SCENES.find((entry) => entry.name === name)!.duration, 0) : 0; return result; }, {});
const LOOP = SCENES.reduce((sum, scene) => sum + scene.duration, 0);
const LETTERS = [
  { ch: "B", fx: 0 }, { ch: "I", fx: 166 }, { ch: "L", fx: 230 }, { ch: "L", fx: 370 },
  { ch: ",", fx: 510 }, { ch: "I", fx: 638 }, { ch: "N", fx: 702 }, { ch: "C", fx: 868 }, { ch: ".", fx: 1034 },
];
const seeded = (value: number) => { const result = Math.sin(value * 127.1) * 43758.5453; return result - Math.floor(result); };
const GLYPHS = (() => {
  const result: { ch: string; comma: boolean; finX: number; finY: number; pileX: number; pileY: number; pileR: number; fallD: number; sortD: number; comD: number; wobP: number }[] = [];
  let seed = 1;
  for (let row = 0; row < 10; row++) for (let column = 0; column < 4; column++) for (let index = 0; index < LETTERS.length; index++) {
    const current = seed++;
    result.push({ ch: LETTERS[index].ch, comma: index === 4, finX: 80 + column * 452 + LETTERS[index].fx * .374, finY: row * 108 + 11, pileX: 140 + seeded(current * 1.7) * 1560, pileY: 470 + seeded(current * 2.3) * 460, pileR: (seeded(current * 3.1) - .5) * 84, fallD: seeded(current * 4.7) * 2, sortD: seeded(current * 5.9) * 5, comD: seeded(current * 6.7) * 1.6, wobP: seeded(current * 8.3) * 6.28 });
  }
  return result;
})();
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const easeIn = (value: number) => value * value;
const easeOut = (value: number) => 1 - (1 - value) * (1 - value);
const easeInOut = (value: number) => value < .5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
const tween = (time: number, start: number, end: number, from: number, to: number, easing = (value: number) => value) => from + (to - from) * easing(clamp((time - start) / Math.max(.0001, end - start)));
function squash(time: number, landing: number, depth: number) {
  if (time <= landing || time >= landing + .22) return 0;
  return time < landing + .07 ? tween(time, landing, landing + .07, 0, -depth, easeOut) : tween(time, landing + .07, landing + .22, -depth, 0, easeOut);
}
function glyphPose(time: number, glyph: (typeof GLYPHS)[number]) {
  const wave = CUES.Hold + .3 + glyph.finX / 1920 * .5 + glyph.finY / 1080 * .25;
  const waveY = time < wave ? 0 : time < wave + .14 ? tween(time, wave, wave + .14, 0, -12, easeOut) : time < wave + .3 ? tween(time, wave + .14, wave + .3, -12, 0, easeIn) : 0;
  if (glyph.comma) {
    const start = CUES.Commas + .1 + glyph.comD;
    if (time <= start) return null;
    const stops = [start, start + .5, start + .68, start + .86, start + .98, start + 1.1];
    const values = [-1150, 0, -110, 0, -40, 0];
    let y = values[values.length - 1];
    for (let index = 0; index < stops.length - 1; index++) if (time <= stops[index + 1]) { y = tween(time, stops[index], stops[index + 1], values[index], values[index + 1], index % 2 ? easeOut : easeIn); break; }
    const rotation = time > start + 1.1 ? Math.sin((time - start - 1.1) * 9) * 7 * Math.exp(-(time - start - 1.1) * 2.5) : 0;
    return { x: glyph.finX, y: glyph.finY + y + waveY, rotation, scaleY: 1 + squash(time, start + .5, .28) + squash(time, start + .86, .16) };
  }
  const fallStart = CUES.Rain + .1 + glyph.fallD;
  const landing = fallStart + .6;
  if (time <= fallStart) return null;
  const fallY = tween(time, fallStart, landing, glyph.pileY - 1250, glyph.pileY, easeIn);
  const sortStart = CUES.Sort + .15 + glyph.sortD;
  const progress = clamp((time - sortStart) / .85);
  const eased = easeInOut(progress);
  const x = glyph.pileX + (glyph.finX - glyph.pileX) * eased;
  const baseY = (progress > 0 ? glyph.pileY : fallY) + (glyph.finY - glyph.pileY) * eased;
  const y = baseY - (150 + Math.abs(glyph.finX - glyph.pileX) * .07) * Math.sin(progress * Math.PI) + waveY;
  const wobble = time < CUES.Mess ? 0 : time < CUES.Mess + .3 ? tween(time, CUES.Mess, CUES.Mess + .3, 0, 1) : time < CUES.Sort + .2 ? 1 : tween(time, CUES.Sort + .2, CUES.Sort + .6, 1, 0);
  const rotation = glyph.pileR * (1 - eased) + (progress <= 0 ? Math.sin(time * 7 + glyph.wobP) * 3 * wobble : 0);
  let scaleY = 1 + squash(time, landing, .2) + (progress >= 1 ? squash(time, sortStart + .85, .16) : 0);
  if (progress > 0 && progress < 1) scaleY = 1.06;
  return { x, y, rotation, scaleY };
}

function CoverGrid() {
  const frame = useRef<number | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const glyphNodes = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    let start: number | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = (time: number) => {
      for (let index = 0; index < GLYPHS.length; index++) {
        const node = glyphNodes.current[index];
        if (!node) continue;
        const pose = glyphPose(time, GLYPHS[index]);
        if (!pose) {
          node.style.visibility = "hidden";
          continue;
        }
        node.style.visibility = "visible";
        node.style.transform = `translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${pose.rotation}deg) scaleY(${pose.scaleY})`;
      }
    };
    const tick = (timestamp: number) => {
      start ??= timestamp;
      draw(((timestamp - start) / 1000) % LOOP);
      frame.current = window.requestAnimationFrame(tick);
    };
    if (reducedMotion) {
      draw(LOOP - .001);
      return;
    }
    frame.current = window.requestAnimationFrame(tick);
    return () => { if (frame.current) window.cancelAnimationFrame(frame.current); };
  }, []);

  useEffect(() => {
    const update = () => {
      const box = viewport.current?.getBoundingClientRect();
      if (!box || !stage.current) return;
      const coverScale = Math.max(box.width / 1920, box.height / 1080) * 1.08;
      stage.current.style.transform = `translate3d(-50%, -50%, 0) scale(${coverScale})`;
    };
    update(); const observer = new ResizeObserver(update); if (viewport.current) observer.observe(viewport.current); return () => observer.disconnect();
  }, []);

  return <div className="cover-grid-original" ref={viewport}><div className="cover-grid-stage" ref={stage}>{GLYPHS.map((glyph, index) => <span key={index} ref={(node) => { glyphNodes.current[index] = node; }} aria-hidden="true">{glyph.ch}</span>)}</div></div>;
}

export function ReferenceLoginScreen({ user, enter, credentialLogin }: { user: User; enter: (role?: PortalRole) => void; credentialLogin: (username: string, password: string, role: PortalRole) => Promise<void> }) {
  const [login, setLogin] = useState(false);
  const [loginMode, setLoginMode] = useState<PortalRole | null>(null);
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const submitCredentials = async (event: FormEvent) => {
    event.preventDefault(); setLoginError(""); setLoggingIn(true);
    if (!loginMode) return;
    try { await credentialLogin(credentials.username, credentials.password, loginMode); setCredentials({ username: "", password: "" }); setLoginMode(null); }
    catch (error) { setLoginError(error instanceof Error ? error.message : "That login could not be completed."); }
    finally { setLoggingIn(false); }
  };
  return <main className="reference-cover">
    {!login ? <button className="reference-cover-animation" onClick={() => setLogin(true)} title="Click to log in" aria-label="Click to log in"><CoverGrid /></button> : <section className="reference-login-panel">
      <img src="/bill-inc.png" alt="BILL, INC." />
      {!loginMode ? <div className="reference-login-options">
        <button onClick={() => setLoginMode("client")}>LOG IN — CLIENT <b>→</b></button>
        <button onClick={() => setLoginMode("production")}>LOG IN — PRODUCTION <b>→</b></button>
        {user && <button className="reference-existing-login" onClick={() => enter(user.role)}>CONTINUE AS {user.name.toUpperCase()} <b>→</b></button>}
      </div> : <>
        <div className="reference-login-mode"><span>LOG IN — {loginMode.toUpperCase()}</span><button onClick={() => { setLoginMode(null); setLoginError(""); }}>CHANGE</button></div>
        <form className="reference-credential-form" onSubmit={submitCredentials}>
          <label>USERNAME<input autoComplete="username" value={credentials.username} onChange={(event) => setCredentials({ ...credentials, username: event.target.value })} /></label>
          <label>PASSWORD<input type="password" autoComplete="current-password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} /></label>
          {loginError && <span>{loginError}</span>}
          <button type="submit" disabled={loggingIn || !credentials.username || !credentials.password}>{loggingIn ? "LOGGING IN…" : `ENTER ${loginMode.toUpperCase()}`}<b>→</b></button>
        </form>
      </>}
      <button className="reference-login-back" onClick={() => setLogin(false)}>← BACK</button>
    </section>}
  </main>;
}

type BudgetTotals = { estimate: number; committed: number; actual: number; remaining: number; percent: number };
function normalizedLine(line: BudgetLine, index: number) {
  const rate = line.rate == null ? cleanNumber(line.estimate) : cleanNumber(line.rate);
  const quantity = line.quantity == null ? 1 : cleanNumber(line.quantity, 1);
  const days = line.days == null ? 1 : cleanNumber(line.days, 1);
  const tax = line.tax_pct == null ? 0 : cleanNumber(line.tax_pct);
  const total = rate * quantity * days * (1 + tax / 100);
  const hasRateStructure = line.rate != null || line.quantity != null || line.days != null || line.tax_pct != null;
  return { ...line, section: line.section_code || String.fromCharCode(65 + index), itemCode: line.item_code || `${String.fromCharCode(65 + index)}1`, itemName: line.item_name || line.category, rate, quantity, days, tax, total: hasRateStructure ? total : cleanNumber(line.estimate) };
}
function BudgetEditableRow({ line, baseline, mutate }: { line: ReturnType<typeof normalizedLine>; baseline?: BudgetSnapshot; mutate: Mutate }) {
  const [draft, setDraft] = useState({ itemName: line.itemName, description: line.description, rate: String(line.rate), quantity: String(line.quantity), days: String(line.days), tax: String(line.tax) });
  useEffect(() => setDraft({ itemName: line.itemName, description: line.description, rate: String(line.rate), quantity: String(line.quantity), days: String(line.days), tax: String(line.tax) }), [line.id, line.itemName, line.description, line.rate, line.quantity, line.days, line.tax]);
  const total = cleanNumber(draft.rate) * cleanNumber(draft.quantity, 1) * cleanNumber(draft.days, 1) * (1 + cleanNumber(draft.tax) / 100);
  const changed = baseline ? Math.abs(total - cleanNumber(baseline.estimate)) > .005 || draft.description !== baseline.description : false;
  const save = () => mutate({ action: "update_budget_line", id: line.id, category: line.category, sectionCode: line.section, itemCode: line.itemCode, itemName: draft.itemName, description: draft.description, rate: cleanNumber(draft.rate), quantity: cleanNumber(draft.quantity, 1), days: cleanNumber(draft.days, 1), taxPct: cleanNumber(draft.tax), estimate: total }, `${line.itemCode} updated`);
  return <div className={changed ? "estimate-line estimate-line-changed" : "estimate-line"}>
    <span className="estimate-code">{line.itemCode}</span>
    <input value={draft.itemName} onChange={(event) => setDraft({ ...draft, itemName: event.target.value })} onBlur={save} aria-label={`${line.itemCode} item`} />
    <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} onBlur={save} aria-label={`${line.itemCode} description`} />
    <input inputMode="decimal" value={draft.rate} onChange={(event) => setDraft({ ...draft, rate: event.target.value })} onBlur={save} aria-label={`${line.itemCode} rate`} />
    <input inputMode="decimal" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} onBlur={save} aria-label={`${line.itemCode} quantity`} />
    <input inputMode="decimal" value={draft.days} onChange={(event) => setDraft({ ...draft, days: event.target.value })} onBlur={save} aria-label={`${line.itemCode} days`} />
    <label><input inputMode="decimal" value={draft.tax} onChange={(event) => setDraft({ ...draft, tax: event.target.value })} onBlur={save} aria-label={`${line.itemCode} VAT or payroll percentage`} /><b>%</b></label>
    <span className="estimate-amount">{money.format(total)}</span>
    <button className="estimate-delete" onClick={() => mutate({ action: "delete_budget_line", id: line.id }, `${line.itemCode} removed`)} aria-label={`Remove ${line.itemCode}`}>×</button>
  </div>;
}

export function ReferenceBudgetView({ data, lines, totals, openComposer, mutate }: { data: PortalData; lines: BudgetLine[]; totals: BudgetTotals; expenses: unknown[]; openComposer: () => void; mutate: Mutate }) {
  const [compareId, setCompareId] = useState(data.budgetVersions.find((version) => version.status !== "confirmed")?.id ?? data.budgetVersions[0]?.id ?? "");
  const baseline = data.budgetVersions.find((version) => version.id === compareId);
  const baselineMap = new Map((baseline?.snapshot ?? []).map((line) => [line.id, line]));
  const normalized = lines.map(normalizedLine);
  const sections = [...new Map(normalized.map((line) => [line.section, line.category])).entries()].map(([code, name]) => ({ code, name, rows: normalized.filter((line) => line.section === code) }));
  const subtotal = normalized.reduce((sum, line) => sum + line.total, 0);
  const markup = cleanNumber(data.project.markup_pct, 10);
  const insurance = cleanNumber(data.project.insurance_pct, 5);
  const markupAmount = subtotal * markup / 100;
  const insuranceAmount = subtotal * insurance / 100;
  const grand = subtotal + markupAmount + insuranceAmount;
  const exportPDF = () => { document.body.dataset.printSurface = "budget"; window.print(); window.setTimeout(() => { delete document.body.dataset.printSurface; }, 250); };
  const updateMeta = (field: string, value: string | number) => mutate({ action: "update_project_budget_meta", [field]: value }, "Estimate details updated");
  return <section className="reference-budget-page">
    <header className="reference-section-head"><div><p>FINANCE · VERSIONED ESTIMATE</p><h1>BUDGET</h1><span>The original BILL, INC. production-estimate format, live and exportable.</span></div><div><button onClick={() => mutate({ action: "save_budget_version", confirm: false }, "Draft budget version saved")}>SAVE VERSION</button><button onClick={() => mutate({ action: "save_budget_version", confirm: true }, "New budget version confirmed")}>CONFIRM VERSION</button><button className="solid" onClick={exportPDF}>EXPORT PDF ↓</button></div></header>
    <section className="budget-version-panel budget-noprint">
      <div><span>CONFIRMED BUDGET</span><strong>{data.budgetVersions.find((version) => version.status === "confirmed")?.name || "WORKING ESTIMATE"}</strong><b>{money.format(grand)}</b></div>
      <label>COMPARE TO<select value={compareId} onChange={(event) => setCompareId(event.target.value)}>{data.budgetVersions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}</select></label>
      <button onClick={openComposer}>＋ ADD LINE</button>
    </section>
    <article className="budget-document" data-budget-document>
      <header className="estimate-header"><div><img src="/bill-inc.png" alt="BILL, INC." /><h2>PRODUCTION ESTIMATE</h2><p>{data.budgetVersions.find((version) => version.status === "confirmed")?.name || "WORKING ESTIMATE"}</p></div></header>
      <section className="estimate-details">
        <div><h3>BILLING DETAILS</h3><label>Client<input defaultValue={data.project.client} onBlur={(event) => updateMeta("client", event.target.value)} /></label><label>Contact<input defaultValue={data.project.contact || ""} onBlur={(event) => updateMeta("contact", event.target.value)} /></label><label>Email<input defaultValue={data.project.contact_email || ""} onBlur={(event) => updateMeta("contactEmail", event.target.value)} /></label><label>Address<input defaultValue={data.project.billing_address || ""} onBlur={(event) => updateMeta("billingAddress", event.target.value)} /></label></div>
        <div><h3>JOB DETAILS</h3><label>Job Name<input defaultValue={data.project.name} onBlur={(event) => updateMeta("name", event.target.value)} /></label><label>Job Number<input defaultValue={data.project.code} onBlur={(event) => updateMeta("code", event.target.value)} /></label><label>PO Number<input defaultValue={data.project.po_no || "TBC"} onBlur={(event) => updateMeta("poNo", event.target.value)} /></label><label>Date<input defaultValue={new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} readOnly /></label></div>
      </section>
      <section className="estimate-copy"><h3>BID SUMMARY</h3><textarea defaultValue={data.project.budget_notes || "Budget, schedule, locations, markets, crew, camera and production approach."} onBlur={(event) => updateMeta("budgetNotes", event.target.value)} /></section>
      <section className="estimate-copy"><h3>CHANGES SINCE PREVIOUS VERSION</h3><textarea defaultValue={data.project.budget_changes || ""} placeholder="What changed from the last version…" onBlur={(event) => updateMeta("budgetChanges", event.target.value)} /></section>
      <section className="estimate-summary"><h3>SHOOT COST SUMMARY OVERVIEW</h3>{sections.map((section) => <div key={section.code}><b>{section.code}</b><a href={`#budget-${section.code}`}>{section.name}</a><span>{money.format(section.rows.reduce((sum, line) => sum + line.total, 0))}</span></div>)}<footer><div><span>SUBTOTAL</span><b>{money.format(subtotal)}</b></div><div><label>MARKUP <input defaultValue={markup} onBlur={(event) => updateMeta("markupPct", cleanNumber(event.target.value))} /> %</label><b>{money.format(markupAmount)}</b></div><div><label>INSURANCE <input defaultValue={insurance} onBlur={(event) => updateMeta("insurancePct", cleanNumber(event.target.value))} /> %</label><b>{money.format(insuranceAmount)}</b></div><div className="estimate-grand"><span>GRAND TOTAL</span><b>{money.format(grand)}</b></div></footer></section>
      {sections.map((section) => <section className="estimate-section" id={`budget-${section.code}`} key={section.code}><header><b>{section.code}</b><strong>{section.name}</strong><span>RATE × QTY × DAYS + VAT / PAYROLL %</span></header><div className="estimate-columns"><span /><span>ITEM</span><span>DESCRIPTION</span><span>RATE</span><span>QTY</span><span>DAYS</span><span>VAT / PAYROLL</span><span>TOTAL</span></div>{section.rows.map((line) => <BudgetEditableRow key={line.id} line={line} baseline={baselineMap.get(line.id)} mutate={mutate} />)}<footer><button className="budget-noprint" onClick={openComposer}>＋ ADD LINE</button><strong>SECTION {section.code} TOTAL</strong><span>{money.format(section.rows.reduce((sum, line) => sum + line.total, 0))}</span></footer></section>)}
      <button className="estimate-add-section budget-noprint" onClick={openComposer}>＋ ADD BUDGET LINE</button>
      <div className="estimate-thanks">Thank you!</div><footer className="estimate-footer"><span>BILL, INC.</span><span>PRODUCTION ESTIMATE</span><span>65 MOTT ST, #4, NEW YORK, NY 10013</span></footer>
    </article>
    <section className="budget-history budget-noprint"><h2>VERSION HISTORY</h2>{data.budgetVersions.map((version) => <div key={version.id}><span><strong>{version.name}</strong><small>{new Date(version.created_at).toLocaleDateString()}</small></span><b>{titleCase(version.status)}</b><span>{money.format(version.snapshot.reduce((sum, line) => sum + cleanNumber(line.estimate), 0))}</span><button onClick={() => mutate({ action: "set_budget_version_status", id: version.id, status: version.status === "archived" ? "confirmed" : "archived" }, "Budget version status updated")}>{version.status === "archived" ? "REACTIVATE" : "ARCHIVE"}</button></div>)}</section>
  </section>;
}

type ClientPage = "home" | "Budgets" | "Reconciliation" | "Locations" | "Call Sheets" | "Schedules" | "Files";
const CLIENT_PAGES: { page: ClientPage; copy: string }[] = [
  { page: "Budgets", copy: "View estimates, compare versions and download PDFs." },
  { page: "Reconciliation", copy: "Review approved spend and live production actuals." },
  { page: "Locations", copy: "Explore the shortlist and mark your location picks." },
  { page: "Call Sheets", copy: "Open the latest published crew and timing documents." },
  { page: "Schedules", copy: "See production dates and the current shooting schedule." },
  { page: "Files", copy: "Download shared production files and final deliverables." },
];

function snapshotTotal(snapshot: BudgetSnapshot[]) { return snapshot.reduce((sum, line) => sum + cleanNumber(line.estimate), 0); }

function ClientBudgetComparison({ versions }: { versions: PortalData["budgetVersions"] }) {
  const fallback = versions[0];
  const [currentId, setCurrentId] = useState(versions.find((version) => version.status === "confirmed")?.id || fallback?.id || "");
  const [previousId, setPreviousId] = useState(versions.find((version) => version.id !== currentId)?.id || fallback?.id || "");
  const [lineMode, setLineMode] = useState<"all" | "changes">("all");
  const current = versions.find((version) => version.id === currentId) || fallback;
  const previous = versions.find((version) => version.id === previousId) || fallback;
  const left = new Map((previous?.snapshot || []).map((line) => [line.id, line]));
  const right = new Map((current?.snapshot || []).map((line) => [line.id, line]));
  const ids = [...new Set([...left.keys(), ...right.keys()])];
  const rows = ids.map((id) => {
    const before = left.get(id); const after = right.get(id); const delta = cleanNumber(after?.estimate) - cleanNumber(before?.estimate);
    return { id, before, after, delta, changed: Math.abs(delta) > .005 || before?.description !== after?.description };
  }).filter((row) => lineMode === "all" || row.changed);
  const download = () => { document.body.dataset.printSurface = "client-budget"; window.print(); window.setTimeout(() => { delete document.body.dataset.printSurface; }, 250); };
  if (!current) return <div className="client-empty">No budget has been shared yet.</div>;
  return <article className="original-client-compare">
    <header><div><span>VERSION COMPARISON</span><h2>{current.name}</h2></div><div><label>COMPARE<select value={previousId} onChange={(event) => setPreviousId(event.target.value)}>{versions.map((version) => <option value={version.id} key={version.id}>{version.name}</option>)}</select></label><label>WITH<select value={currentId} onChange={(event) => setCurrentId(event.target.value)}>{versions.map((version) => <option value={version.id} key={version.id}>{version.name}</option>)}</select></label></div></header>
    <div className="original-client-compare-actions"><div className="client-line-mode" role="group" aria-label="Budget comparison lines"><button className={lineMode === "all" ? "active" : ""} onClick={() => setLineMode("all")}>ALL LINES</button><button className={lineMode === "changes" ? "active" : ""} onClick={() => setLineMode("changes")}>CHANGES ONLY</button></div><button onClick={download}>DOWNLOAD PDF ↓</button></div>
    <div className="client-compare-head"><span>ITEM</span><span>{previous?.name || "PREVIOUS"}</span><span>{current.name}</span><span>CHANGE</span></div>
    {rows.map((row) => <div className={row.changed ? "client-compare-line changed" : "client-compare-line"} key={row.id}><span><strong>{row.after?.item_name || row.before?.item_name || row.after?.category || row.before?.category}</strong><small>{row.after?.description || row.before?.description}</small></span><span>{money.format(cleanNumber(row.before?.estimate))}</span><span>{money.format(cleanNumber(row.after?.estimate))}</span><b>{row.changed ? signedMoney(row.delta) : "—"}</b></div>)}
    <footer><span>TOTAL</span><span>{money.format(snapshotTotal(previous?.snapshot || []))}</span><span>{money.format(snapshotTotal(current.snapshot))}</span><b>{signedMoney(snapshotTotal(current.snapshot) - snapshotTotal(previous?.snapshot || []))}</b></footer>
  </article>;
}

function ClientLocationBoard({ locations, publish }: { locations: Location[]; publish: Mutate }) {
  const visible = locations.filter((location) => !location.deleted_at && location.client_visible !== 0);
  return <div className="original-client-locations">{visible.map((location, index) => <article key={location.id}><div className="client-location-image" style={{ backgroundImage: galleryOf(location)[0] ? `url(${galleryOf(location)[0]})` : undefined }}><span>{pad(index + 1)}</span></div><div><p>{location.city} · {location.category || "Location"}</p><h2>{location.name}</h2><span>{location.blurb || location.client_note || location.note}</span><dl><div><dt>DAY RATE</dt><dd>{money.format(location.rate)}</dd></div><div><dt>SQUARE FEET</dt><dd>{location.square_feet || "—"}</dd></div><div><dt>AVAILABILITY</dt><dd>{location.availability || "Pending"}</dd></div></dl><footer><button className={location.status === "approved" ? "active" : ""} onClick={() => publish({ action: "update_location_status", id: location.id, status: "approved" }, `${location.name} marked as a top pick`)}>TOP PICK</button><button className={location.status === "shortlisted" ? "active" : ""} onClick={() => publish({ action: "update_location_status", id: location.id, status: "shortlisted" }, `${location.name} marked as a secondary pick`)}>SECONDARY</button><button className={location.status === "rejected" ? "active" : ""} onClick={() => publish({ action: "update_location_status", id: location.id, status: "rejected" }, `${location.name} marked not interested`)}>NOT INTERESTED</button></footer></div></article>)}</div>;
}

export function ReferenceClientPortal({ data, totals, preview, setPreview, publish, clientOnly = false }: { data: PortalData; totals: BudgetTotals; preview: boolean; setPreview: (value: boolean) => void; publish: Mutate; clientOnly?: boolean }) {
  const [page, setPage] = useState<ClientPage>("home");
  const [clientTheme, setClientTheme] = useState<"light" | "dark">("light");
  const shares = data.records.filter((record) => record.module === "client_share");
  const openPortal = () => { setPage("home"); setPreview(true); };
  if (!preview) return <section className="page original-client-admin"><header className="reference-section-head"><div><p>CLIENT · PUBLISHED WORKSPACE</p><h1>CLIENT PORTAL</h1><span>The original clean client view, with budget comparison and live project shares.</span></div><div><button onClick={() => publish({ action: "publish_client_item", kind: "Budget", label: data.budgetVersions[0]?.name || "Production Estimate" }, "Budget shared to client portal")}>SHARE BUDGET</button><button onClick={() => publish({ action: "publish_client_item", kind: "Locations", label: `${data.project.name} · Location Shortlist` }, "Locations shared to client portal")}>SHARE LOCATIONS</button><button className="solid" onClick={openPortal}>OPEN CLIENT VIEW ↗</button></div></header><div className="original-client-admin-grid"><section><p>SHARED WITH CLIENT</p>{shares.map((share) => <div key={share.id}><span>{share.data.kind}</span><strong>{share.data.label}</strong><small>{share.data.date}</small><b>{share.data.status}</b></div>)}</section><aside><span>PORTAL STATUS</span><strong>LIVE</strong><div><span>Budget versions</span><b>{data.budgetVersions.length}</b></div><div><span>Locations visible</span><b>{data.locations.filter((location) => !location.deleted_at && location.client_visible !== 0).length}</b></div><div><span>Committed</span><b>{shortMoney.format(totals.committed)}</b></div></aside></div></section>;
  return <section className={`original-client-portal client-theme-${clientTheme}`}>
    <header><button className="client-wordmark" onClick={() => setPage("home")}><img src="/bill-inc.png" alt="BILL, INC." /></button><div><span>{data.project.name}</span><i /><strong>CLIENT PORTAL</strong></div><div className="client-header-actions"><button onClick={() => setClientTheme((current) => current === "light" ? "dark" : "light")}>{clientTheme === "light" ? "DARK MODE" : "LIGHT MODE"}</button><button onClick={() => setPreview(false)}>{clientOnly ? "LOG OUT →" : "CLOSE ×"}</button></div></header>
    <main>
      <div className="client-date"><span>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>{page !== "home" && <button onClick={() => setPage("home")}>← PROJECT HOME</button>}</div>
      {page === "home" ? <><h1>{data.project.name}</h1><p className="client-welcome">Everything shared for {data.project.client}, together in one place.</p><div className="original-client-cards">{CLIENT_PAGES.map((card, index) => <button onClick={() => setPage(card.page)} key={card.page}><span>{pad(index + 1)}</span><h2>{card.page}</h2><p>{card.copy}</p><footer>OPEN <b>→</b></footer></button>)}</div></> : <><h1 className="client-page-title">{page}</h1>{page === "Budgets" && <ClientBudgetComparison versions={data.budgetVersions} />}{page === "Locations" && <ClientLocationBoard locations={data.locations} publish={publish} />}{page === "Reconciliation" && <div className="client-simple-list"><header><span>VENDOR</span><span>MEMO</span><span>STATUS</span><span>AMOUNT</span></header>{data.expenses.map((expense) => <div key={expense.id}><strong>{expense.vendor}</strong><span>{expense.memo}</span><small>{titleCase(expense.status)}</small><b>{money.format(expense.amount)}</b></div>)}</div>}{(["Call Sheets", "Schedules", "Files"] as ClientPage[]).includes(page) && <div className="client-simple-list">{shares.filter((share) => share.data.kind === page.replace(/s$/, "") || share.data.kind === page).map((share) => <div key={share.id}><strong>{share.data.label}</strong><span>{share.data.date}</span><small>{share.data.status}</small><b>OPEN →</b></div>)}{!shares.some((share) => share.data.kind === page.replace(/s$/, "") || share.data.kind === page) && <div><strong>Nothing published yet.</strong><span>Your production team can push the latest version here.</span></div>}</div>}</>}
      <footer className="original-client-footer"><span>BILL, INC.</span><span>{data.project.code}</span><span>PRIVATE CLIENT PORTAL</span></footer>
    </main>
  </section>;
}

type LocationDraft = { name: string; city: string; category: string; rate: string; squareFeet: string; availability: string; blurb: string; note: string; clientNote: string; imageUrl: string; tags: string };
const emptyLocationDraft: LocationDraft = { name: "", city: "", category: "Residential", rate: "", squareFeet: "", availability: "Availability Pending", blurb: "", note: "", clientNote: "", imageUrl: "", tags: "" };

function LocationEditor({ location, close, save }: { location?: Location; close: () => void; save: (draft: LocationDraft) => void }) {
  const [draft, setDraft] = useState<LocationDraft>(location ? { name: location.name, city: location.city, category: location.category || "Uncategorized", rate: String(location.rate), squareFeet: location.square_feet || "", availability: location.availability || "Availability Pending", blurb: location.blurb || "", note: location.note, clientNote: location.client_note, imageUrl: location.image_url, tags: location.tags } : emptyLocationDraft);
  const field = (key: keyof LocationDraft, label: string, placeholder = "") => <label>{label}<input value={draft[key]} placeholder={placeholder} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>;
  return <div className="modal-backdrop"><form className="location-editor" onSubmit={(event) => { event.preventDefault(); save(draft); }}><header><div><p>LOCATION LIBRARY</p><h2>{location ? "EDIT LOCATION" : "ADD LOCATION"}</h2></div><button type="button" onClick={close}>×</button></header><div className="location-editor-fields">{field("name", "Location name")}{field("city", "City / region")}{field("category", "Category")}{field("rate", "Day rate")}{field("squareFeet", "Square feet")}{field("availability", "Availability")}{field("imageUrl", "Lead image URL")}{field("tags", "Search tags", "Modern | Daylight | Rooftop")}</div><label>Short client blurb<textarea value={draft.blurb} onChange={(event) => setDraft({ ...draft, blurb: event.target.value })} /></label><label>Internal scouting notes<textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label><label>Client-facing notes<textarea value={draft.clientNote} onChange={(event) => setDraft({ ...draft, clientNote: event.target.value })} /></label><footer><button type="button" onClick={close}>CANCEL</button><button className="solid" type="submit">SAVE LOCATION</button></footer></form></div>;
}

function LocationPresentation({ project, locations, close, mutate }: { project: Project; locations: Location[]; close: () => void; mutate: Mutate }) {
  const [format, setFormat] = useState<"site" | "deck">("deck");
  const [clientTheme, setClientTheme] = useState<"light" | "dark">("light");
  const list = locations.filter((location) => !location.deleted_at && location.client_visible !== 0);
  const groups = [...new Set(list.map((location) => location.category || "Locations"))].map((name) => ({ name, items: list.filter((location) => (location.category || "Locations") === name) }));
  const selectionValue = (location: Location) => location.status === "approved" ? "top" : location.status === "shortlisted" ? "secondary" : location.status === "rejected" ? "not" : "";
  const updatePick = (location: Location, value: string) => mutate({ action: "update_location_status", id: location.id, status: value === "top" ? "approved" : value === "secondary" ? "shortlisted" : value === "not" ? "rejected" : "review" }, `${location.name} client selection updated`);
  const exportPdf = () => { document.body.dataset.printSurface = "locations"; window.print(); window.setTimeout(() => { delete document.body.dataset.printSurface; }, 250); };
  return <section className={`original-location-presentation location-theme-${clientTheme}`}>
    <header><img src="/bill-inc.png" alt="BILL, INC." /><div className="location-presentation-meta"><span>{project.client}</span><strong>{project.name}</strong></div><div className="location-presentation-actions"><div className="location-format-toggle"><button className={format === "deck" ? "active" : ""} onClick={() => setFormat("deck")}>PRESENTATION</button><button className={format === "site" ? "active" : ""} onClick={() => setFormat("site")}>SITE</button></div><button onClick={() => setClientTheme((current) => current === "light" ? "dark" : "light")}>{clientTheme === "light" ? "DARK MODE" : "LIGHT MODE"}</button><button onClick={exportPdf}>PDF ↓</button><button onClick={close}>CLOSE ×</button></div></header>
    {format === "site" ? <main className="location-client-site"><div><p>LOCATION PRESENTATION</p><h1>{project.name}</h1><span>{project.client} · {list.length} locations</span></div><ClientLocationBoard locations={list} publish={mutate} /></main> : list.length ? <main className="location-deck-stage" data-deck-stage>
      <article className="location-deck-page deck-cover" data-deck-frame><header><img src="/bill-inc.png" alt="BILL, INC." /><span>{project.client}<br />LOCATION PRESENTATION</span></header><h1>{project.name}</h1><footer><div><small>CLIENT</small><strong>{project.client}</strong></div><div><small>LOCATIONS</small><strong>{pad(list.length)}</strong></div><div><small>DATE</small><strong>{new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</strong></div></footer></article>
      <article className="location-deck-page deck-index" data-deck-frame><header><img src="/bill-inc.png" alt="BILL, INC." /><span>{project.client}</span></header><h2>INDEX</h2><div>{list.map((location, index) => <div key={location.id}><b>{pad(index + 1)}</b><strong>{location.name}</strong><span>{location.category || "Location"}<br />{location.city}</span></div>)}</div></article>
      {groups.flatMap((group, groupIndex) => [
        <article className="location-deck-page deck-divider" data-deck-frame key={`divider-${group.name}`}><header><img src="/bill-inc.png" alt="BILL, INC." /><span>{project.client}</span></header><div><b>{pad(groupIndex + 1)}</b><h2>{group.name}</h2></div><footer>{pad(group.items.length)} LOCATION{group.items.length === 1 ? "" : "S"}</footer></article>,
        ...group.items.map((location) => { const index = list.findIndex((item) => item.id === location.id); const gallery = galleryOf(location); return <article className="location-deck-page deck-location" data-deck-frame key={location.id}><header><img src="/bill-inc.png" alt="BILL, INC." /><span>{project.client}</span></header><div className="deck-location-body"><section><b>{pad(index + 1)}</b><p>{location.city}</p><h2>{location.name}</h2><span>{location.blurb || location.client_note || location.note}</span><dl><div><dt>SQUARE FEET</dt><dd>{location.square_feet || "—"}</dd></div><div><dt>DAY RATE</dt><dd>{money.format(location.rate)}</dd></div><div><dt>AVAILABILITY</dt><dd>{location.availability || "Pending"}</dd></div></dl><label>CLIENT PICK<select value={selectionValue(location)} onChange={(event) => updatePick(location, event.target.value)}><option value="">SELECT</option><option value="top">TOP PICK</option><option value="secondary">SECONDARY</option><option value="not">NOT INTERESTED</option></select></label></section><div className="deck-location-gallery"><div className="deck-location-lead" style={{ backgroundImage: gallery[0] ? `url(${gallery[0]})` : undefined }} /> <div>{[0, 1, 2].map((thumb) => <span style={{ backgroundImage: gallery[thumb + 1] ? `url(${gallery[thumb + 1]})` : gallery[0] ? `url(${gallery[0]})` : undefined }} key={thumb} />)}</div></div></div></article>; }),
      ])}
      <article className="location-deck-page deck-closing" data-deck-frame><img src="/bill-inc.png" alt="BILL, INC." /><h2>THANK YOU</h2><footer>{project.client} · {project.name}</footer></article>
    </main> : <div className="client-empty">Choose locations to create a client presentation.</div>}
  </section>;
}

export function ReferenceLocationsView({ project, locations, mutate }: { project: Project; locations: Location[]; open: () => void; mutate: Mutate }) {
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("active"); const [category, setCategory] = useState("all"); const [city, setCity] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [detail, setDetail] = useState<Location | null>(null); const [editing, setEditing] = useState<Location | "new" | null>(null); const [presenting, setPresenting] = useState(false); const [importing, setImporting] = useState(false);
  const importPicker = useRef<HTMLInputElement>(null); const galleryPicker = useRef<HTMLInputElement>(null);
  const active = locations.filter((location) => !location.deleted_at); const deleted = locations.filter((location) => Boolean(location.deleted_at));
  const categories = [...new Set(active.map((location) => location.category || "Uncategorized"))].sort(); const cities = [...new Set(active.map((location) => location.city))].sort();
  const filtered = active.filter((location) => status === "active" || location.status === status).filter((location) => category === "all" || (location.category || "Uncategorized") === category).filter((location) => city === "all" || location.city === city).filter((location) => `${location.name} ${location.city} ${location.category} ${location.tags} ${location.note}`.toLowerCase().includes(query.toLowerCase()));
  const presentationLocations = selected.size ? active.filter((location) => selected.has(location.id)) : active.filter((location) => location.client_visible !== 0);
  const saveLocation = (draft: LocationDraft) => { const base = { name: draft.name, city: draft.city, category: draft.category, rate: cleanNumber(draft.rate), squareFeet: draft.squareFeet, availability: draft.availability, blurb: draft.blurb, note: draft.note, clientNote: draft.clientNote, imageUrl: draft.imageUrl, tags: draft.tags }; if (editing && editing !== "new") mutate({ action: "update_location", id: editing.id, ...base }, `${draft.name} updated`); else mutate({ action: "add_location", ...base }, `${draft.name} added to the location library`); setEditing(null); };
  async function uploadFiles(files: FileList, folderImport: boolean) {
    setImporting(true);
    try {
      const grouped = new Map<string, string[]>();
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const form = new FormData(); form.set("file", file); form.set("projectId", project.id); form.set("category", "Location");
        const response = await fetch("/api/files", { method: "POST", body: form }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Image upload failed");
        const folder = file.webkitRelativePath?.split("/").slice(-2, -1)[0] || file.name.replace(/\.[^.]+$/, ""); grouped.set(folder, [...(grouped.get(folder) || []), payload.url]);
      }
      if (folderImport) await mutate({ action: "import_locations", folders: [...grouped.entries()].map(([name, gallery]) => ({ name, gallery })) }, `${grouped.size} location folders imported`);
      else if (detail) await mutate({ action: "update_location_gallery", id: detail.id, gallery: [...galleryOf(detail), ...[...grouped.values()].flat()] }, `${detail.name} gallery updated`);
    } catch (error) { window.alert(error instanceof Error ? error.message : "Those images could not be imported."); }
    finally { setImporting(false); }
  }
  if (presenting) return <LocationPresentation project={project} locations={presentationLocations} close={() => setPresenting(false)} mutate={mutate} />;
  if (detail) return <section className="reference-location-detail"><header><button onClick={() => setDetail(null)}>← ALL LOCATIONS</button><div><button onClick={() => setEditing(detail)}>EDIT DETAILS</button><button onClick={() => galleryPicker.current?.click()}>＋ ADD IMAGES</button><button onClick={() => setPresenting(true)}>CLIENT PREVIEW ↗</button></div></header><main><section><div className="location-hero" style={{ backgroundImage: galleryOf(detail)[0] ? `url(${galleryOf(detail)[0]})` : undefined }}><span>{titleCase(detail.status)}</span></div><div className="location-gallery">{galleryOf(detail).map((image, index) => <button style={{ backgroundImage: `url(${image})` }} onClick={() => mutate({ action: "update_location_gallery", id: detail.id, gallery: galleryOf(detail).filter((_, current) => current !== index) }, "Image removed")} title="Remove image" key={`${image}-${index}`} />)}</div></section><aside><p>{detail.city} · {detail.category || "Uncategorized"}</p><h1>{detail.name}</h1><span>{detail.blurb || detail.note}</span><dl><div><dt>DAY RATE</dt><dd>{money.format(detail.rate)}</dd></div><div><dt>SQUARE FEET</dt><dd>{detail.square_feet || "—"}</dd></div><div><dt>AVAILABILITY</dt><dd>{detail.availability || "Pending"}</dd></div><div><dt>SEARCH TAGS</dt><dd>{detail.tags || "—"}</dd></div><div><dt>INTERNAL NOTES</dt><dd>{detail.note || "—"}</dd></div><div><dt>CLIENT NOTES</dt><dd>{detail.client_note || "—"}</dd></div></dl><footer><button onClick={() => mutate({ action: "set_location_visibility", id: detail.id, visible: detail.client_visible === 0 }, detail.client_visible === 0 ? "Location added to client view" : "Location hidden from client view")}>{detail.client_visible === 0 ? "ADD TO CLIENT VIEW" : "HIDE FROM CLIENT VIEW"}</button><button className="danger" onClick={() => { mutate({ action: "delete_location", id: detail.id }, `${detail.name} moved to recently deleted`); setDetail(null); }}>DELETE LOCATION</button></footer></aside></main><input ref={galleryPicker} hidden type="file" accept="image/*" multiple onChange={(event) => event.target.files && uploadFiles(event.target.files, false)} />{editing && editing !== "new" && <LocationEditor location={editing} close={() => setEditing(null)} save={saveLocation} />}</section>;
  return <section className="reference-locations-page"><header className="reference-section-head"><div><p>CLIENT · LOCATION LIBRARY</p><h1>LOCATIONS</h1><span>The original searchable library, location detail pages and client presentation workflow.</span></div><div><button onClick={() => importPicker.current?.click()}>{importing ? "IMPORTING…" : "IMPORT FOLDERS"}</button><button onClick={() => setEditing("new")}>＋ ADD LOCATION</button><button className="solid" onClick={() => setPresenting(true)}>CLIENT PREVIEW ↗</button></div></header><div className="location-library-shell"><aside><label className="location-search">SEARCH<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, city, tag…" /></label><div className="location-filter"><p>STATUS</p>{[["active", "All locations"], ["approved", "Top picks"], ["shortlisted", "Secondary"], ["rejected", "Not interested"]].map(([value, label]) => <button className={status === value ? "active" : ""} onClick={() => setStatus(value)} key={value}><span>{label}</span><b>{value === "active" ? active.length : active.filter((location) => location.status === value).length}</b></button>)}</div><div className="location-filter"><p>CATEGORY</p><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}><span>All categories</span><b>{active.length}</b></button>{categories.map((value) => <button className={category === value ? "active" : ""} onClick={() => setCategory(value)} key={value}><span>{value}</span><b>{active.filter((location) => (location.category || "Uncategorized") === value).length}</b></button>)}</div><div className="location-filter"><p>CITY / REGION</p><button className={city === "all" ? "active" : ""} onClick={() => setCity("all")}><span>All cities</span><b>{active.length}</b></button>{cities.map((value) => <button className={city === value ? "active" : ""} onClick={() => setCity(value)} key={value}><span>{value}</span><b>{active.filter((location) => location.city === value).length}</b></button>)}</div><button className="clear-location-filters" onClick={() => { setQuery(""); setStatus("active"); setCategory("all"); setCity("all"); }}>CLEAR FILTERS</button></aside><main><div className="location-results-head"><div><span>ALL LOCATIONS</span><b>{filtered.length} RESULTS</b></div><div><button onClick={() => setSelected(new Set(filtered.map((location) => location.id)))}>SELECT ALL</button><button onClick={() => setSelected(new Set())}>DESELECT ALL</button><span>{selected.size} SELECTED</span></div></div><div className="reference-location-grid">{filtered.map((location, index) => <article key={location.id}><button className="reference-location-photo" onClick={() => setDetail(location)} style={{ backgroundImage: galleryOf(location)[0] ? `url(${galleryOf(location)[0]})` : undefined }}><span>{pad(index + 1)}</span><b>{titleCase(location.status)}</b></button><div><p>{location.city} · {location.category || "Uncategorized"}</p><h2><button onClick={() => setDetail(location)}>{location.name}</button><span>{money.format(location.rate)}</span></h2><small>{location.square_feet || "—"} SQ FT · {location.availability || "PENDING"}</small><footer><button className={selected.has(location.id) ? "active" : ""} onClick={() => setSelected((current) => { const next = new Set(current); if (next.has(location.id)) next.delete(location.id); else next.add(location.id); return next; })}>{selected.has(location.id) ? "✓ SELECTED" : "+ SELECT"}</button><button onClick={() => setDetail(location)}>VIEW DETAILS →</button></footer></div></article>)}</div>{deleted.length > 0 && <section className="recently-deleted"><header><span>RECENTLY DELETED</span><b>{deleted.length} · AUTO-PURGE AFTER 14 DAYS</b></header>{deleted.map((location) => <div key={location.id}><strong>{location.name}</strong><span>{location.city}</span><small>{location.deleted_at ? new Date(location.deleted_at).toLocaleDateString() : ""}</small><button onClick={() => mutate({ action: "restore_location", id: location.id }, `${location.name} restored`)}>RESTORE</button><button onClick={() => mutate({ action: "purge_location", id: location.id }, `${location.name} permanently deleted`)}>PURGE</button></div>)}</section>}</main></div><input ref={importPicker} hidden type="file" accept="image/*" multiple {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(event) => event.target.files && uploadFiles(event.target.files, true)} />{editing && <LocationEditor location={editing === "new" ? undefined : editing} close={() => setEditing(null)} save={saveLocation} />}</section>;
}
