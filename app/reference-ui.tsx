"use client";

import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BudgetLine, BudgetSnapshot, Location, Mutate, PortalData, Project, User } from "./production-portal";
import type { PortalRole } from "./credential-auth";
import { ClientOptionsLibrary } from "./options-workspace";

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
const locationQuery = (location: Pick<Location, "name" | "city" | "address">) => location.address?.trim() || [location.name, location.city].filter(Boolean).join(", ");
const googleMapsUrl = (location: Pick<Location, "name" | "city" | "address" | "maps_url">) => location.maps_url?.trim() || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery(location))}`;
const googleStreetViewUrl = (location: Pick<Location, "latitude" | "longitude" | "street_view_url">) => {
  if (location.street_view_url?.trim()) return location.street_view_url.trim();
  if (location.latitude == null || location.longitude == null) return "";
  const latitude = Number(location.latitude); const longitude = Number(location.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}` : "";
};
const parseGoogleCoordinates = (value: string) => {
  const match = value.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) || value.match(/[?&](?:query|viewpoint)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  return match ? { latitude: match[1], longitude: match[2] } : null;
};

function LocationMapLinks({ location, compact = false }: { location: Location; compact?: boolean }) {
  const streetView = googleStreetViewUrl(location);
  return <div className={`location-map-links${compact ? " compact" : ""}`}><a href={googleMapsUrl(location)} target="_blank" rel="noreferrer">GOOGLE MAPS ↗</a>{streetView && <a href={streetView} target="_blank" rel="noreferrer">STREET VIEW ↗</a>}</div>;
}

function mapPositions(locations: Location[]) {
  const coordinateLocations = locations.filter((location) => location.latitude != null && location.longitude != null && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)));
  const latitudes = coordinateLocations.map((location) => Number(location.latitude)); const longitudes = coordinateLocations.map((location) => Number(location.longitude));
  const minLat = Math.min(...latitudes); const maxLat = Math.max(...latitudes); const minLon = Math.min(...longitudes); const maxLon = Math.max(...longitudes);
  const presets = [{ x: 31, y: 38 }, { x: 57, y: 58 }, { x: 72, y: 35 }, { x: 47, y: 72 }, { x: 81, y: 68 }, { x: 24, y: 62 }, { x: 66, y: 78 }, { x: 85, y: 48 }];
  return locations.map((location, index) => {
    if (Number(location.map_x) >= 0 && Number(location.map_y) >= 0) return { x: clamp(Number(location.map_x), 5, 95), y: clamp(Number(location.map_y), 8, 92) };
    const latitude = Number(location.latitude); const longitude = Number(location.longitude);
    if (location.latitude != null && location.longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude) && coordinateLocations.length) {
      const x = maxLon === minLon ? 55 : 16 + ((longitude - minLon) / (maxLon - minLon)) * 70;
      const y = maxLat === minLat ? 54 : 22 + ((maxLat - latitude) / (maxLat - minLat)) * 60;
      return { x, y };
    }
    const preset = presets[index % presets.length]; const cycle = Math.floor(index / presets.length);
    return { x: clamp(preset.x + cycle * 2, 6, 90), y: clamp(preset.y + cycle * 3, 15, 88) };
  });
}

function LocationOverviewMap({ project, locations, deck = false }: { project: Project; locations: Location[]; deck?: boolean }) {
  const positions = mapPositions(locations);
  return <section className={`location-overview-map${deck ? " deck-map-surface" : ""}`}>
    <div className="location-map-roads" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <span key={index} />)}</div>
    <div className="location-map-title"><small>{project.client}</small><h2>LOCATIONS<br />OVERVIEW</h2></div>
    <div className="location-map-markers">{locations.map((location, index) => <a href={googleMapsUrl(location)} target="_blank" rel="noreferrer" style={{ left: `${positions[index].x}%`, top: `${positions[index].y}%` }} title={`Open ${location.name} in Google Maps`} key={location.id}><i>{index + 1}</i><b>{location.name}</b></a>)}</div>
    <footer><strong>BILL, INC.</strong><span>{project.name} · {pad(locations.length)} LOCATIONS</span></footer>
  </section>;
}

const SCENES = [
  { name: "Rain", duration: 2.8 }, { name: "Mess", duration: 1 }, { name: "Sort", duration: 5.6 },
  { name: "Commas", duration: 2.6 }, { name: "Hold", duration: 2 },
] as const;
const CUES = SCENES.reduce<Record<string, number>>((result, scene) => { result[scene.name] = Object.values(result).length ? Object.entries(result).reduce((sum, [name]) => sum + SCENES.find((entry) => entry.name === name)!.duration, 0) : 0; return result; }, {});
const LOOP = SCENES.reduce((sum, scene) => sum + scene.duration, 0);
const COVER_PLAYBACK_RATE = 1.3 * 0.85;
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
  const glyphVisibility = useRef(new Uint8Array(GLYPHS.length));
  const glyphTransforms = useRef<string[]>(Array(GLYPHS.length).fill(""));

  useEffect(() => {
    let previous: number | null = null;
    let elapsed = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const draw = (time: number) => {
      for (let index = 0; index < GLYPHS.length; index++) {
        const node = glyphNodes.current[index];
        if (!node) continue;
        const pose = glyphPose(time, GLYPHS[index]);
        if (!pose) {
          if (glyphVisibility.current[index]) {
            glyphVisibility.current[index] = 0;
            glyphTransforms.current[index] = "";
            node.style.visibility = "hidden";
          }
          continue;
        }
        if (!glyphVisibility.current[index]) {
          glyphVisibility.current[index] = 1;
          node.style.visibility = "visible";
        }
        const transform = `translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${pose.rotation}deg) scaleY(${pose.scaleY})`;
        if (glyphTransforms.current[index] !== transform) {
          glyphTransforms.current[index] = transform;
          node.style.transform = transform;
        }
      }
    };
    const tick = (timestamp: number) => {
      previous ??= timestamp;
      const delta = Math.min(timestamp - previous, 50);
      previous = timestamp;
      elapsed = (elapsed + delta / 1000 * COVER_PLAYBACK_RATE) % LOOP;
      draw(elapsed);
      frame.current = window.requestAnimationFrame(tick);
    };
    const resume = () => { if (!document.hidden) previous = null; };
    if (reducedMotion) {
      draw(LOOP - .001);
      return;
    }
    document.addEventListener("visibilitychange", resume);
    frame.current = window.requestAnimationFrame(tick);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      if (frame.current) window.cancelAnimationFrame(frame.current);
    };
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

export function ReferenceLoginScreen({ user, enter, credentialLogin }: { user: User; enter: (role?: PortalRole) => void | Promise<void>; credentialLogin: (username: string, password: string, role: PortalRole) => Promise<void> }) {
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
        {user && <button className="reference-existing-login" onClick={() => void enter(user.role)}>CONTINUE AS {user.name.toUpperCase()} <b>→</b></button>}
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
const budgetSnapshot = (lines: BudgetLine[]): BudgetSnapshot[] => lines.map((line) => ({ id: line.id, category: line.category, description: line.description, estimate: cleanNumber(line.estimate), section_code: line.section_code, item_code: line.item_code, item_name: line.item_name, rate: line.rate, quantity: line.quantity, days: line.days, tax_pct: line.tax_pct, is_na: line.is_na, na_note: line.na_note }));

function BudgetEditableRow({ line, displayCode, readOnly, mutate, dragStart, drop }: { line: ReturnType<typeof normalizedLine>; displayCode: string; readOnly: boolean; mutate: Mutate; dragStart: (event: DragEvent<HTMLDivElement>, id: string) => void; drop: (event: DragEvent<HTMLDivElement>, id: string) => void }) {
  const [draft, setDraft] = useState({ itemName: line.itemName, description: line.description, rate: String(line.rate), quantity: String(line.quantity), days: String(line.days), tax: String(line.tax) });
  useEffect(() => setDraft({ itemName: line.itemName, description: line.description, rate: String(line.rate), quantity: String(line.quantity), days: String(line.days), tax: String(line.tax) }), [line.id, line.itemName, line.description, line.rate, line.quantity, line.days, line.tax]);
  const total = cleanNumber(draft.rate) * cleanNumber(draft.quantity, 1) * cleanNumber(draft.days, 1) * (1 + cleanNumber(draft.tax) / 100);
  const save = () => {
    const changed = draft.itemName !== line.itemName || draft.description !== line.description || cleanNumber(draft.rate) !== line.rate || cleanNumber(draft.quantity, 1) !== line.quantity || cleanNumber(draft.days, 1) !== line.days || cleanNumber(draft.tax) !== line.tax;
    if (!readOnly && changed) mutate({ action: "update_budget_line", id: line.id, category: line.category, sectionCode: line.section, itemCode: line.itemCode, itemName: draft.itemName, description: draft.description, rate: cleanNumber(draft.rate), quantity: cleanNumber(draft.quantity, 1), days: cleanNumber(draft.days, 1), taxPct: cleanNumber(draft.tax), estimate: total, isNa: Boolean(line.is_na), naNote: line.na_note || "" }, `${displayCode} updated`);
  };
  return <div className="estimate-line" draggable={!readOnly} onDragStart={(event) => dragStart(event, line.id)} onDragOver={(event) => { if (!readOnly) event.preventDefault(); }} onDrop={(event) => drop(event, line.id)}>
    <span className="estimate-code">{displayCode}</span>
    <input readOnly={readOnly} value={draft.itemName} onChange={(event) => setDraft({ ...draft, itemName: event.target.value })} onBlur={save} aria-label={`${displayCode} item`} />
    <input readOnly={readOnly} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} onBlur={save} aria-label={`${displayCode} description`} />
    <input readOnly={readOnly} inputMode="decimal" value={draft.rate} onChange={(event) => setDraft({ ...draft, rate: event.target.value })} onBlur={save} aria-label={`${displayCode} rate`} />
    <input readOnly={readOnly} inputMode="decimal" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} onBlur={save} aria-label={`${displayCode} quantity`} />
    <input readOnly={readOnly} inputMode="decimal" value={draft.days} onChange={(event) => setDraft({ ...draft, days: event.target.value })} onBlur={save} aria-label={`${displayCode} days`} />
    <label><input readOnly={readOnly} inputMode="decimal" value={draft.tax} onChange={(event) => setDraft({ ...draft, tax: event.target.value })} onBlur={save} aria-label={`${displayCode} VAT or payroll percentage`} /><b>%</b></label>
    <span className="estimate-amount">$ {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    {!readOnly && <span className="estimate-drag budget-noprint" title="Drag to move this line">⠿</span>}
  </div>;
}

export function ReferenceBudgetView({ data, lines, totals, openComposer, mutate, auditBudget, auditing }: { data: PortalData; lines: BudgetLine[]; totals: BudgetTotals; expenses: unknown[]; openComposer: () => void; mutate: Mutate; auditBudget: () => void; auditing: boolean }) {
  void totals; void openComposer;
  const [undoStack, setUndoStack] = useState<BudgetSnapshot[][]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [overageOpen, setOverageOpen] = useState(false);
  const [viewingVersionId, setViewingVersionId] = useState<string | null>(null);
  const draggedLine = useRef<string | null>(null);
  const viewingVersion = data.budgetVersions.find((version) => version.id === viewingVersionId);
  const readOnly = Boolean(viewingVersion);
  const sourceLines: BudgetLine[] = viewingVersion ? viewingVersion.snapshot.map((line) => ({ ...line, actual: 0 })) : lines;
  const normalized = sourceLines.map(normalizedLine);
  const sections = [...new Map(normalized.map((line) => [line.section, line.category])).entries()].sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true })).map(([code, name]) => { const rows = normalized.filter((line) => line.section === code); return { code, name, rows, na: rows.some((line) => Boolean(line.is_na)), note: rows.find((line) => line.na_note)?.na_note || "" }; });
  const subtotal = normalized.reduce((sum, line) => sum + line.total, 0);
  const markup = cleanNumber(data.project.markup_pct, 10);
  const insurance = cleanNumber(data.project.insurance_pct, 5);
  const markupAmount = subtotal * markup / 100;
  const insuranceAmount = subtotal * insurance / 100;
  const grand = subtotal + markupAmount + insuranceAmount;
  const exportPDF = () => { document.body.dataset.printSurface = "budget"; window.print(); window.setTimeout(() => { delete document.body.dataset.printSurface; }, 250); };
  const updateMeta = (field: string, value: string | number) => mutate({ action: "update_project_budget_meta", [field]: value }, "Estimate details updated");
  const confirmed = data.budgetVersions.find((version) => version.status === "confirmed") || data.budgetVersions.find((version) => !version.status.startsWith("overage"));
  const clientShareVersion = viewingVersion || confirmed;
  const budgetVersions = data.budgetVersions.filter((version) => !version.status.startsWith("overage"));
  const archivedBudgets = budgetVersions.filter((version) => version.status !== "confirmed");
  const confirmedOverages = data.budgetVersions.filter((version) => version.status === "overage_confirmed");
  const archivedOverages = data.budgetVersions.filter((version) => version.status === "overage_archived");
  const mutateBudget: Mutate = async (payload, success) => { setUndoStack((stack) => [...stack, budgetSnapshot(lines)].slice(-50)); return await mutate(payload, success); };
  const undo = async () => { const snapshot = undoStack.at(-1); if (!snapshot) return; setUndoStack((stack) => stack.slice(0, -1)); await mutate({ action: "replace_budget_snapshot", snapshot }, "Last budget change undone"); };
  const latestAudit = data.audits[0];
  const budgetComments = data.records.filter((record) => record.module === "budget_comment").sort((a, b) => b.created_at.localeCompare(a.created_at));
  const openBudgetComments = budgetComments.filter((record) => record.data.status !== "resolved");
  let latestAuditNotes: { severity: string; title: string; detail: string; line_code?: string }[] = [];
  try { latestAuditNotes = latestAudit ? (Array.isArray(latestAudit.notes) ? latestAudit.notes : JSON.parse(latestAudit.notes)) : []; } catch { latestAuditNotes = []; }
  const nextSectionCode = () => { const used = new Set(sections.map((section) => section.code)); for (let code = 65; code <= 90; code++) { const candidate = String.fromCharCode(code); if (!used.has(candidate)) return candidate; } return `S${Date.now().toString(36).slice(-3).toUpperCase()}`; };
  const addSection = () => { const code = nextSectionCode(); mutateBudget({ action: "add_budget_line", sectionCode: code, itemCode: `${code}1`, category: "New Category", itemName: "", description: "", rate: 0, quantity: 1, days: 1, taxPct: 0 }, `Section ${code} added`); };
  const addLine = (code: string, name: string, count: number) => mutateBudget({ action: "add_budget_line", sectionCode: code, itemCode: `${code}${count + 1}`, category: name, itemName: "", description: "", rate: 0, quantity: 1, days: 1, taxPct: 0 }, `Line added to section ${code}`);
  const dragStart = (event: DragEvent<HTMLDivElement>, id: string) => { draggedLine.current = id; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", id); };
  const drop = (event: DragEvent<HTMLDivElement>, targetId: string) => { event.preventDefault(); const id = draggedLine.current || event.dataTransfer.getData("text/plain"); draggedLine.current = null; if (id && id !== targetId) mutateBudget({ action: "reorder_budget_line", id, targetId }, "Budget line moved"); };
  const reactivate = async (id: string, overage = false) => { await mutate({ action: "restore_budget_version", id, status: overage ? "overage_confirmed" : "confirmed" }, overage ? "Overage reactivated" : "Budget version reactivated"); setViewingVersionId(null); };
  return <section className="reference-budget-page">
    <header className="budget-original-toolbar budget-noprint"><strong>BUDGET · PRODUCTION ESTIMATE</strong><div><button onClick={undo} disabled={!undoStack.length}>↶ UNDO</button><button onClick={() => mutateBudget({ action: "clear_budget" }, "Budget cleared — use Undo to restore it")}>CLEAR BUDGET</button><button className="budget-audit-trigger" onClick={auditBudget} disabled={auditing}>{auditing ? "AUDITING…" : "AUDIT BUDGET ↗"}</button><button onClick={() => mutate({ action: "publish_client_item", kind: "Budget", label: clientShareVersion?.name || "Production Estimate", versionId: clientShareVersion?.id || "" }, `${clientShareVersion?.name || "Budget"} pushed to client portal`)}>PUSH TO CLIENT PORTAL →</button><button className="solid" onClick={exportPDF}>EXPORT PDF ↓</button></div></header>
    {latestAudit && <details className="budget-audit-result budget-noprint"><summary><span>{latestAudit.source === "openai" ? "DOCUMENT REVIEW" : "AUTOMATED CROSS-CHECK"}</span><strong>{latestAudit.summary}</strong><b>{latestAuditNotes.length} NOTES ▾</b></summary><div>{latestAuditNotes.slice(0, 8).map((note, index) => <article className={note.severity} key={`${note.title}-${index}`}><b>{note.severity}</b><span><strong>{note.title}</strong><small>{note.detail}</small></span><i>{note.line_code || "—"}</i></article>)}</div></details>}
    {budgetComments.length > 0 && <details className="budget-comment-inbox budget-noprint" open={openBudgetComments.length > 0}><summary><span>CLIENT COMMENTS</span><strong>{openBudgetComments.length} OPEN NOTE{openBudgetComments.length === 1 ? "" : "S"}</strong><b>{budgetComments.length} TOTAL ▾</b></summary><div>{budgetComments.map((comment) => <article className={comment.data.status === "resolved" ? "resolved" : ""} key={comment.id}><span><b>{comment.data.anchorLabel || "Entire budget"}</b><small>{comment.data.versionName || "Budget"} · {comment.data.date}</small></span><p>{comment.data.comment}</p><span><strong>{comment.data.author || "Client"}</strong>{comment.data.status === "resolved" ? <i>RESOLVED</i> : <button onClick={() => mutate({ action: "resolve_budget_comment", id: comment.id }, "Client budget comment resolved")}>MARK RESOLVED</button>}</span></article>)}</div></details>}
    <section className="budget-version-manager budget-noprint">
      {readOnly && <div className="budget-view-banner"><strong>VIEWING “{viewingVersion?.name}” — VIEW ONLY</strong><button onClick={() => reactivate(viewingVersion!.id, viewingVersion!.status.startsWith("overage"))}>REACTIVATE TO EDIT</button></div>}
      <div className="budget-version-block"><div className="budget-version-current"><span>CONFIRMED BUDGET</span><strong>{confirmed?.name || "WORKING ESTIMATE"}</strong>{!readOnly && <i>EDITING</i>}<b>{money.format(grand)}</b><button onClick={() => mutate({ action: "save_budget_version", confirm: true }, "Budget saved as a new confirmed version")}>＋ SAVE AS NEW VERSION</button></div>
        <button className="budget-history-toggle" onClick={() => setArchiveOpen((value) => !value)}>▾ <strong>VERSION HISTORY</strong> <span>{archivedBudgets.length} archived · view only</span></button>
        {archiveOpen && <div className="budget-version-list">{archivedBudgets.length ? archivedBudgets.map((version) => <div key={version.id}><strong>{version.name}</strong><span>{money.format(snapshotTotal(version.snapshot))}</span><footer><button onClick={() => setViewingVersionId(version.id)}>VIEW</button><button onClick={() => mutate({ action: "publish_client_item", kind: "Budget", label: version.name, versionId: version.id }, `${version.name} pushed to client portal`)}>PUSH TO CLIENT</button><button className="solid" onClick={() => reactivate(version.id)}>REACTIVATE</button><button aria-label={`Delete ${version.name}`} onClick={() => { if (window.confirm(`Delete ${version.name}?`)) mutate({ action: "delete_budget_version", id: version.id }, "Budget version deleted"); }}>×</button></footer></div>) : <p>No archived versions yet — “Save as new version” files the current budget here when you confirm a newer one.</p>}</div>}
      </div>
      <div className="budget-overage-block"><div><strong>CONFIRMED OVERAGES</strong><button onClick={() => mutate({ action: "save_budget_version", kind: "overage", confirm: true }, "New overage saved")}>＋ SAVE AS NEW OVERAGE</button></div>{confirmedOverages.map((version) => <div className="budget-overage-row" key={version.id}><i>CONFIRMED ✓</i><strong>OVERAGE — {version.name}</strong><span>{money.format(snapshotTotal(version.snapshot))}</span><footer><button onClick={() => setViewingVersionId(version.id)}>VIEW</button><button onClick={() => mutate({ action: "set_budget_version_status", id: version.id, status: "overage_archived" }, "Overage archived")}>ARCHIVE</button><button onClick={() => mutate({ action: "delete_budget_version", id: version.id }, "Overage deleted")}>×</button></footer></div>)}{!confirmedOverages.length && <p>No confirmed overages yet. Build an overage scenario below, then save it here.</p>}<button className="budget-history-toggle" onClick={() => setOverageOpen((value) => !value)}>▾ <strong>OVERAGE HISTORY</strong> <span>{archivedOverages.length} archived · view only</span></button>{overageOpen && <div className="budget-version-list">{archivedOverages.map((version) => <div key={version.id}><strong>OVERAGE — {version.name}</strong><span>{money.format(snapshotTotal(version.snapshot))}</span><footer><button onClick={() => setViewingVersionId(version.id)}>VIEW</button><button className="solid" onClick={() => reactivate(version.id, true)}>REACTIVATE</button><button onClick={() => mutate({ action: "delete_budget_version", id: version.id }, "Overage deleted")}>×</button></footer></div>)}</div>}</div>
    </section>
    <article className="budget-document" data-budget-document>
      <header className="estimate-header"><div><img src="/bill-inc.png" alt="BILL, INC." /><h2>PRODUCTION ESTIMATE</h2><p>{viewingVersion?.name || confirmed?.name || "WORKING ESTIMATE"}</p></div></header>
      <section className="estimate-details">
        <div><h3>BILLING DETAILS</h3><label>Client<input defaultValue={data.project.client} onBlur={(event) => updateMeta("client", event.target.value)} /></label><label>Contact<input defaultValue={data.project.contact || ""} onBlur={(event) => updateMeta("contact", event.target.value)} /></label><label>Email<input defaultValue={data.project.contact_email || ""} onBlur={(event) => updateMeta("contactEmail", event.target.value)} /></label><label>Address<input defaultValue={data.project.billing_address || ""} onBlur={(event) => updateMeta("billingAddress", event.target.value)} /></label></div>
        <div><h3>JOB DETAILS</h3><label>Job Name<input defaultValue={data.project.name} onBlur={(event) => updateMeta("name", event.target.value)} /></label><label>Job Number<input defaultValue={data.project.code} onBlur={(event) => updateMeta("code", event.target.value)} /></label><label>PO Number<input defaultValue={data.project.po_no || "TBC"} onBlur={(event) => updateMeta("poNo", event.target.value)} /></label><label>Date<input defaultValue={new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} readOnly /></label></div>
      </section>
      <section className="estimate-copy"><h3>BID SUMMARY</h3><textarea defaultValue={data.project.budget_notes || "Budget, schedule, locations, markets, crew, camera and production approach."} onBlur={(event) => updateMeta("budgetNotes", event.target.value)} /></section>
      <section className="estimate-copy"><h3>CHANGES SINCE PREVIOUS VERSION</h3><textarea defaultValue={data.project.budget_changes || ""} placeholder="What changed from the last version…" onBlur={(event) => updateMeta("budgetChanges", event.target.value)} /></section>
      <section className="estimate-summary"><h3>SHOOT COST SUMMARY OVERVIEW</h3>{sections.map((section) => <div key={section.code}><b>{section.code}</b><a href={`#budget-${section.code}`}>{section.name}</a><span>{money.format(section.rows.reduce((sum, line) => sum + line.total, 0))}</span></div>)}<footer><div><span>SUBTOTAL</span><b>{money.format(subtotal)}</b></div><div><label>MARKUP <input defaultValue={markup} onBlur={(event) => updateMeta("markupPct", cleanNumber(event.target.value))} /> %</label><b>{money.format(markupAmount)}</b></div><div><label>INSURANCE <input defaultValue={insurance} onBlur={(event) => updateMeta("insurancePct", cleanNumber(event.target.value))} /> %</label><b>{money.format(insuranceAmount)}</b></div><div className="estimate-grand"><span>GRAND TOTAL</span><b>{money.format(grand)}</b></div></footer></section>
      {sections.map((section) => <section className="estimate-section" id={`budget-${section.code}`} key={section.code}><header><b>{section.code}</b><input readOnly={readOnly} defaultValue={section.name} key={section.name} onBlur={(event) => { if (!readOnly && event.target.value !== section.name) mutateBudget({ action: "rename_budget_section", sectionCode: section.code, category: event.target.value }, `Section ${section.code} renamed`); }} aria-label={`Section ${section.code} name`} /><span>RATE × QTY × DAYS + VAT / PAYROLL %</span></header>{!section.na && <><div className="estimate-columns"><span /><span>ITEM</span><span>DESCRIPTION</span><span>RATE</span><span>QTY</span><span>DAYS</span><span>VAT / PAYROLL</span><span>TOTAL</span></div>{section.rows.map((line, index) => <BudgetEditableRow key={line.id} line={line} displayCode={`${section.code}${index + 1}`} readOnly={readOnly} mutate={mutateBudget} dragStart={dragStart} drop={drop} />)}</>}{section.na && <div className="estimate-na"><span /><input readOnly={readOnly} defaultValue={section.note} key={section.note} placeholder="N/A — Not Applicable to This Estimate" onBlur={(event) => mutateBudget({ action: "set_budget_section_na", sectionCode: section.code, isNa: true, naNote: event.target.value }, `Section ${section.code} note updated`)} /><b>—</b></div>}<footer><span className="estimate-section-actions budget-noprint">{!readOnly && <><button onClick={addSection}>＋ ADD SECTION BELOW</button><button onClick={() => mutateBudget({ action: "remove_budget_section", sectionCode: section.code }, `Section ${section.code} removed`)}>− REMOVE SECTION</button><button onClick={() => mutateBudget({ action: "set_budget_section_na", sectionCode: section.code, isNa: !section.na, naNote: section.note }, `Section ${section.code} ${section.na ? "restored" : "marked N/A"}`)}>{section.na ? "RESTORE SECTION" : "MARK N/A"}</button>{!section.na && <><button onClick={() => { const last = section.rows.at(-1); if (last) mutateBudget({ action: "delete_budget_line", id: last.id }, `Last line removed from section ${section.code}`); }}>− REMOVE LINE</button><button onClick={() => addLine(section.code, section.name, section.rows.length)}>＋ ADD LINE</button></>}</>}</span><strong>SECTION {section.code} TOTAL</strong><span>{money.format(section.na ? 0 : section.rows.reduce((sum, line) => sum + line.total, 0))}</span></footer></section>)}
      {!sections.length && <button className="estimate-add-section budget-noprint" onClick={addSection}>＋ ADD SECTION</button>}
      <div className="estimate-autosave budget-noprint"><span>All entries auto-save. Totals roll up to the summary overview, the reconciliation and the exported PDF.</span><button onClick={() => mutateBudget({ action: "clear_budget" }, "Budget cleared — use Undo to restore it")}>CLEAR ALL</button></div>
      <div className="estimate-thanks">Thank you!</div><footer className="estimate-footer"><span>BILL, INC.</span><span>PRODUCTION ESTIMATE</span><span>65 MOTT ST, #4, NEW YORK, NY 10013</span></footer>
    </article>
  </section>;
}

type ClientPage = "home" | "Budgets" | "Travel" | "Casting" | "Art Buying" | "Locations" | "Call Sheets" | "Schedules" | "Files";
const CLIENT_PAGES: { page: ClientPage; copy: string }[] = [
  { page: "Budgets", copy: "View estimates, reconciliation, comparisons and PDFs." },
  { page: "Travel", copy: "Open published travel memos, bookings and movements." },
  { page: "Casting", copy: "Review casting options, links, rates and presentation decks." },
  { page: "Art Buying", copy: "Review creative talent options and published decks." },
  { page: "Locations", copy: "Explore the shortlist and mark your location picks." },
  { page: "Call Sheets", copy: "Open the latest published crew and timing documents." },
  { page: "Schedules", copy: "See production dates and the current shooting schedule." },
  { page: "Files", copy: "Download shared production files and final deliverables." },
];

function snapshotTotal(snapshot: BudgetSnapshot[]) { return snapshot.reduce((sum, line) => sum + cleanNumber(line.estimate), 0); }

function printClientBudget() {
  document.body.dataset.printSurface = "client-budget";
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    window.print();
    window.setTimeout(() => { delete document.body.dataset.printSurface; }, 250);
  }));
}

function getPublishedBudgetVersions(versions: PortalData["budgetVersions"], shares: PortalData["records"]) {
  const publishedIds = new Set<string>();
  shares.filter((share) => share.data.kind?.toLowerCase() === "budget").forEach((share) => {
    const direct = versions.find((version) => version.id === share.data.versionId);
    const versionMark = share.data.label?.match(/\bV\d+\b/i)?.[0]?.toUpperCase();
    const byLabel = versions.find((version) => version.name.toLowerCase() === share.data.label?.toLowerCase() || (versionMark && version.name.toUpperCase().includes(versionMark)));
    const match = direct || byLabel;
    if (match) publishedIds.add(match.id);
  });
  return versions.filter((version) => publishedIds.has(version.id));
}

function ClientBudgetDocument({ project, version, comments, publish, back }: { project: Project; version: PortalData["budgetVersions"][number]; comments: PortalData["records"]; publish: Mutate; back: () => void }) {
  const normalized = version.snapshot.map((line, index) => normalizedLine({ ...line, actual: 0 }, index));
  const sections = [...new Map(normalized.map((line) => [line.section, line.category])).entries()].sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true })).map(([code, name]) => { const rows = normalized.filter((line) => line.section === code); return { code, name, rows, na: rows.some((line) => Boolean(line.is_na)), note: rows.find((line) => line.na_note)?.na_note || "" }; });
  const subtotal = normalized.reduce((sum, line) => sum + line.total, 0);
  const markup = cleanNumber(project.markup_pct, 10);
  const insurance = cleanNumber(project.insurance_pct, 5);
  const markupAmount = subtotal * markup / 100;
  const insuranceAmount = subtotal * insurance / 100;
  const grand = subtotal + markupAmount + insuranceAmount;
  const noMutation: Mutate = async () => false;
  const noDrag = (_event: DragEvent<HTMLDivElement>, _id: string) => {};
  const versionDate = new Date(version.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const [commentAnchor, setCommentAnchor] = useState<{ type: string; id: string; label: string } | null>(null);
  const [commentText, setCommentText] = useState("");
  const versionComments = comments.filter((comment) => comment.data.versionId === version.id && comment.data.status !== "resolved");
  const submitComment = async () => {
    if (!commentAnchor || !commentText.trim()) return;
    const ok = await publish({ action: "add_budget_comment", versionId: version.id, versionName: version.name, anchorType: commentAnchor.type, anchorId: commentAnchor.id, anchorLabel: commentAnchor.label, comment: commentText.trim() }, "Budget comment sent to production");
    if (ok) { setCommentAnchor(null); setCommentText(""); }
  };
  return <section className="client-budget-view">
    <div className="client-budget-view-actions"><button onClick={back}>← ALL PUBLISHED BUDGETS</button><span>{versionComments.length} OPEN COMMENT{versionComments.length === 1 ? "" : "S"}</span><button onClick={() => setCommentAnchor({ type: "document", id: version.id, label: "Entire budget" })}>＋ COMMENT ON BUDGET</button><button onClick={printClientBudget}>DOWNLOAD BUDGET PDF ↓</button></div>
    <article className="budget-document" data-budget-document>
      <header className="estimate-header"><div><img src="/bill-inc.png" alt="BILL, INC." /><h2>PRODUCTION ESTIMATE</h2><p>{version.name}</p></div></header>
      <section className="estimate-details">
        <div><h3>BILLING DETAILS</h3><label>Client<input value={project.client} readOnly /></label><label>Contact<input value={project.contact || ""} readOnly /></label><label>Email<input value={project.contact_email || ""} readOnly /></label><label>Address<input value={project.billing_address || ""} readOnly /></label></div>
        <div><h3>JOB DETAILS</h3><label>Job Name<input value={project.name} readOnly /></label><label>Job Number<input value={project.code} readOnly /></label><label>PO Number<input value={project.po_no || "TBC"} readOnly /></label><label>Date<input value={versionDate} readOnly /></label></div>
      </section>
      <section className="estimate-copy"><h3>BID SUMMARY</h3><textarea value={project.budget_notes || "Budget, schedule, locations, markets, crew, camera and production approach."} readOnly /></section>
      <section className="estimate-copy"><h3>CHANGES SINCE PREVIOUS VERSION</h3><textarea value={project.budget_changes || ""} readOnly /></section>
      <section className="estimate-summary"><h3>SHOOT COST SUMMARY OVERVIEW</h3>{sections.map((section) => <div key={section.code}><b>{section.code}</b><a href={`#client-budget-${section.code}`}>{section.name}</a><span>{money.format(section.na ? 0 : section.rows.reduce((sum, line) => sum + line.total, 0))}</span></div>)}<footer><div><span>SUBTOTAL</span><b>{money.format(subtotal)}</b></div><div><label>MARKUP <input value={markup} readOnly /> %</label><b>{money.format(markupAmount)}</b></div><div><label>INSURANCE <input value={insurance} readOnly /> %</label><b>{money.format(insuranceAmount)}</b></div><div className="estimate-grand"><span>GRAND TOTAL</span><b>{money.format(grand)}</b></div></footer></section>
      {sections.map((section) => <section className="estimate-section" id={`client-budget-${section.code}`} key={section.code}><header><b>{section.code}</b><input value={section.name} readOnly aria-label={`Section ${section.code} name`} /><span>RATE × QTY × DAYS + VAT / PAYROLL %</span></header>{!section.na && <><div className="estimate-columns"><span /><span>ITEM</span><span>DESCRIPTION</span><span>RATE</span><span>QTY</span><span>DAYS</span><span>VAT / PAYROLL</span><span>TOTAL</span></div>{section.rows.map((line, index) => <div className="client-budget-comment-line" key={line.id}><BudgetEditableRow line={line} displayCode={`${section.code}${index + 1}`} readOnly mutate={noMutation} dragStart={noDrag} drop={noDrag} /><button className={versionComments.some((comment) => comment.data.anchorId === line.id) ? "has-comments" : ""} onClick={() => setCommentAnchor({ type: "line", id: line.id, label: `${section.code}${index + 1} · ${line.itemName || line.category}` })}>COMMENT{versionComments.filter((comment) => comment.data.anchorId === line.id).length ? ` (${versionComments.filter((comment) => comment.data.anchorId === line.id).length})` : ""}</button></div>)}</>}{section.na && <div className="estimate-na"><span /><input value={section.note || "N/A — Not Applicable to This Estimate"} readOnly /><b>—</b></div>}<footer><button className={versionComments.some((comment) => comment.data.anchorId === section.code) ? "has-comments" : ""} onClick={() => setCommentAnchor({ type: "section", id: section.code, label: `Section ${section.code} · ${section.name}` })}>＋ COMMENT{versionComments.filter((comment) => comment.data.anchorId === section.code).length ? ` (${versionComments.filter((comment) => comment.data.anchorId === section.code).length})` : ""}</button><strong>SECTION {section.code} TOTAL</strong><span>{money.format(section.na ? 0 : section.rows.reduce((sum, line) => sum + line.total, 0))}</span></footer></section>)}
      <div className="estimate-thanks">Thank you!</div><footer className="estimate-footer"><span>BILL, INC.</span><span>PRODUCTION ESTIMATE</span><span>65 MOTT ST, #4, NEW YORK, NY 10013</span></footer>
    </article>
    {commentAnchor && <div className="budget-comment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommentAnchor(null); }}><section className="budget-comment-composer" role="dialog" aria-modal="true" aria-label="Add budget comment"><header><div><span>CLIENT NOTE</span><h2>COMMENT ON {commentAnchor.label.toUpperCase()}</h2></div><button onClick={() => setCommentAnchor(null)}>×</button></header><textarea autoFocus value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Write a clear note or question for production…" /><footer><button onClick={() => setCommentAnchor(null)}>CANCEL</button><button className="solid" disabled={!commentText.trim()} onClick={() => void submitComment()}>SEND TO PRODUCTION →</button></footer></section></div>}
  </section>;
}

function ClientBudgetComparison({ versions, back }: { versions: PortalData["budgetVersions"]; back: () => void }) {
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
  if (!current) return <div className="client-empty">No budget has been shared yet.</div>;
  return <article className="original-client-compare">
    <header><div><span>VERSION COMPARISON</span><h2>{current.name}</h2></div><div><label>COMPARE<select value={previousId} onChange={(event) => setPreviousId(event.target.value)}>{versions.map((version) => <option value={version.id} key={version.id}>{version.name}</option>)}</select></label><label>WITH<select value={currentId} onChange={(event) => setCurrentId(event.target.value)}>{versions.map((version) => <option value={version.id} key={version.id}>{version.name}</option>)}</select></label></div></header>
    <div className="original-client-compare-actions"><div className="client-compare-toolbar"><button onClick={back}>← ALL PUBLISHED BUDGETS</button><div className="client-line-mode" role="group" aria-label="Budget comparison lines"><button className={lineMode === "all" ? "active" : ""} onClick={() => setLineMode("all")}>ALL LINES</button><button className={lineMode === "changes" ? "active" : ""} onClick={() => setLineMode("changes")}>CHANGES ONLY</button></div></div><button onClick={printClientBudget}>DOWNLOAD COMPARISON PDF ↓</button></div>
    <div className="client-compare-head"><span>ITEM</span><span>{previous?.name || "PREVIOUS"}</span><span>{current.name}</span><span>CHANGE</span></div>
    {rows.map((row) => <div className={row.changed ? "client-compare-line changed" : "client-compare-line"} key={row.id}><span><strong>{row.after?.item_name || row.before?.item_name || row.after?.category || row.before?.category}</strong><small>{row.after?.description || row.before?.description}</small></span><span>{money.format(cleanNumber(row.before?.estimate))}</span><span>{money.format(cleanNumber(row.after?.estimate))}</span><b>{row.changed ? signedMoney(row.delta) : "—"}</b></div>)}
    <footer><span>TOTAL</span><span>{money.format(snapshotTotal(previous?.snapshot || []))}</span><span>{money.format(snapshotTotal(current.snapshot))}</span><b>{signedMoney(snapshotTotal(current.snapshot) - snapshotTotal(previous?.snapshot || []))}</b></footer>
  </article>;
}

function ClientBudgets({ project, versions, shares, comments, publish }: { project: Project; versions: PortalData["budgetVersions"]; shares: PortalData["records"]; comments: PortalData["records"]; publish: Mutate }) {
  const published = useMemo(() => getPublishedBudgetVersions(versions, shares), [versions, shares]);
  const [mode, setMode] = useState<"library" | "view" | "compare">("library");
  const [selectedId, setSelectedId] = useState("");
  const selected = published.find((version) => version.id === selectedId) || published[0];
  const openDownload = (versionId: string) => { setSelectedId(versionId); setMode("view"); window.setTimeout(printClientBudget, 40); };
  if (mode === "view" && selected) return <ClientBudgetDocument project={project} version={selected} comments={comments} publish={publish} back={() => setMode("library")} />;
  if (mode === "compare" && published.length > 1) return <ClientBudgetComparison versions={published} back={() => setMode("library")} />;
  return <section className="client-budget-library">
    <header><div><span>PUBLISHED BUDGETS</span><h2>VERSION HISTORY</h2><p>Open or download any shared estimate, or compare two published versions.</p></div><button disabled={published.length < 2} onClick={() => setMode("compare")}>COMPARE TWO VERSIONS →</button></header>
    {published.length ? <div>{published.map((version, index) => <article key={version.id}><span>{pad(index + 1)}</span><div><strong>{version.name}</strong><small>Published estimate · {new Date(version.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</small></div><b>{money.format(snapshotTotal(version.snapshot))}</b><footer><button onClick={() => { setSelectedId(version.id); setMode("view"); }}>VIEW BUDGET →</button><button onClick={() => openDownload(version.id)}>DOWNLOAD PDF ↓</button></footer></article>)}</div> : <div className="client-empty"><strong>NO BUDGET HAS BEEN SHARED YET</strong><span>Your production team can publish a specific budget version from the budget workspace.</span></div>}
  </section>;
}

function ClientReconciliation({ share }: { share: PortalData["records"][number] }) {
  const estimate = cleanNumber(share.data.estimate);
  const working = cleanNumber(share.data.working);
  const actual = cleanNumber(share.data.actual);
  const remaining = cleanNumber(share.data.remaining);
  const openCommitment = cleanNumber(share.data.openCommitment);
  const percent = cleanNumber(share.data.percent);
  return <section className="client-reconciliation">
    <header><div><span>PUBLISHED COST REPORT</span><h2>RECONCILIATION</h2><p>Top-line snapshot published by production on {share.data.date}.</p></div><div><span>BUDGET COMMITTED</span><strong>{percent}%</strong></div></header>
    <div className="client-reconciliation-metrics"><article><span>CONFIRMED ESTIMATE</span><strong>{money.format(estimate)}</strong></article><article><span>WORKING</span><strong>{money.format(working)}</strong></article><article><span>ACTUAL</span><strong>{money.format(actual)}</strong></article><article><span>REMAINING</span><strong>{money.format(remaining)}</strong></article><article><span>OPEN COMMITMENT</span><strong>{money.format(openCommitment)}</strong></article></div>
    <footer><span>PUBLISHED SNAPSHOT</span><strong>{share.data.label}</strong><small>This report remains unchanged until production publishes a new reconciliation.</small></footer>
  </section>;
}

function ClientBudgetWorkspace({ project, versions, shares, comments, publish }: { project: Project; versions: PortalData["budgetVersions"]; shares: PortalData["records"]; comments: PortalData["records"]; publish: Mutate }) {
  const [section, setSection] = useState<"budgets" | "reconciliation">("budgets");
  const reconciliation = shares.filter((share) => share.data.kind?.toLowerCase() === "reconciliation").reduce<PortalData["records"][number] | null>((latest, share) => !latest || new Date(share.created_at) > new Date(latest.created_at) ? share : latest, null);
  return <><nav className="client-budget-subnav" aria-label="Budget sections"><button className={section === "budgets" ? "active" : ""} onClick={() => setSection("budgets")}>BUDGETS</button>{reconciliation && <button className={section === "reconciliation" ? "active" : ""} onClick={() => setSection("reconciliation")}>RECONCILIATION</button>}</nav>{section === "budgets" || !reconciliation ? <ClientBudgets project={project} versions={versions} shares={shares} comments={comments} publish={publish} /> : <ClientReconciliation share={reconciliation} />}</>;
}

function printClientTravel() {
  document.body.dataset.printSurface = "client-travel";
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    window.print();
    window.setTimeout(() => { delete document.body.dataset.printSurface; }, 250);
  }));
}

function ClientTravel({ project, records, shares }: { project: Project; records: PortalData["records"]; shares: PortalData["records"] }) {
  const published = shares.filter((share) => share.data.kind?.toLowerCase() === "travel memo");
  const [selectedId, setSelectedId] = useState("");
  const selected = published.find((share) => share.id === selectedId);
  const traveler = selected?.data.traveler || selected?.data.label?.replace(/\s*·\s*Travel Memo$/i, "") || "";
  const itinerary = records.filter((record) => record.module === "travel" && (record.data.traveler || "").toLowerCase().split(/\s*,\s*/).includes(traveler.toLowerCase()));
  const groups = [
    { title: "FLIGHTS", items: itinerary.filter((record) => record.data.type === "Flight") },
    { title: "HOTELS", items: itinerary.filter((record) => record.data.type === "Hotel") },
    { title: "CARS / TRANSFERS", items: itinerary.filter((record) => ["Car", "Transfer"].includes(record.data.type)) },
  ];
  if (selected) return <section className="client-travel-memo"><div className="client-travel-actions"><button onClick={() => setSelectedId("")}>← ALL TRAVEL MEMOS</button><button onClick={printClientTravel}>DOWNLOAD MEMO PDF ↓</button></div><article><header><div><span>TRAVEL MEMO</span><h2>{traveler}</h2><p>{project.name} · {project.code}</p></div><strong>{selected.data.date || "SHARED"}</strong></header>{groups.map((group) => <section key={group.title}><h3>{group.title}</h3>{group.items.length ? group.items.map((record) => <div key={record.id}><span><strong>{record.data.detail || `${record.data.from || "—"} → ${record.data.to || "—"}`}</strong><small>{record.data.provider || record.data.type}</small></span><span><strong>{record.data.timing || record.data.departDate || "Date pending"}</strong><small>{record.data.departTime || record.data.arriveTime || "Time pending"}</small></span><span><small>CONFIRMATION</small><b>{record.data.confirmation || "—"}</b></span></div>) : <p>No {group.title.toLowerCase()} on this memo.</p>}</section>)}<footer><span>BILL, INC.</span><span>PLEASE VERIFY ALL TIMES BEFORE TRAVEL</span><span>{project.client}</span></footer></article></section>;
  return <section className="client-travel-library">{published.length ? <div>{published.map((share, index) => <article key={share.id}><span>{pad(index + 1)}</span><div><strong>{share.data.label}</strong><small>Published travel memo · {share.data.date}</small></div><button onClick={() => setSelectedId(share.id)}>OPEN MEMO →</button></article>)}</div> : <div className="client-empty"><strong>NO TRAVEL MEMOS HAVE BEEN SHARED YET</strong></div>}</section>;
}

function ClientLocationBoard({ locations, publish }: { locations: Location[]; publish: Mutate }) {
  const visible = locations.filter((location) => !location.deleted_at && location.client_visible !== 0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const selectedIndex = visible.findIndex((location) => location.id === selectedId);
  const selected = selectedIndex >= 0 ? visible[selectedIndex] : null;
  const selectedGallery = selected ? [...new Set(galleryOf(selected))] : [];
  const openLocation = (location: Location) => { setSelectedId(location.id); setPhotoIndex(0); };
  const closeLocation = () => setSelectedId(null);
  const movePhoto = (direction: number) => setPhotoIndex((current) => selectedGallery.length ? (current + direction + selectedGallery.length) % selectedGallery.length : 0);
  const moveLocation = (direction: number) => {
    if (!visible.length || selectedIndex < 0) return;
    const next = visible[(selectedIndex + direction + visible.length) % visible.length];
    setSelectedId(next.id);
    setPhotoIndex(0);
  };

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeLocation();
      if (event.key === "ArrowLeft") movePhoto(-1);
      if (event.key === "ArrowRight") movePhoto(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, selectedGallery.length]);

  return <>
    <div className="original-client-locations">{visible.map((location, index) => { const gallery = [...new Set(galleryOf(location))]; return <article key={location.id}>
      <button className="client-location-image" style={{ backgroundImage: gallery[0] ? `url(${gallery[0]})` : undefined }} onClick={() => openLocation(location)} aria-label={`View all photos and details for ${location.name}`}><span>{pad(index + 1)}</span><b>VIEW {gallery.length || 0} PHOTO{gallery.length === 1 ? "" : "S"} →</b></button>
      <div><p>{location.city} · {location.category || "Location"}</p><h2><button onClick={() => openLocation(location)}>{location.name}</button></h2><span>{location.blurb || location.client_note || location.note}</span><dl><div><dt>DAY RATE</dt><dd>{money.format(location.rate)}</dd></div><div><dt>SQUARE FEET</dt><dd>{location.square_feet || "—"}</dd></div><div><dt>AVAILABILITY</dt><dd>{location.availability || "Pending"}</dd></div></dl><LocationMapLinks location={location} compact /><button className="client-location-open" onClick={() => openLocation(location)}>VIEW ALL PHOTOS + DETAILS →</button><footer><button className={location.status === "approved" ? "active" : ""} onClick={() => publish({ action: "update_location_status", id: location.id, status: "approved" }, `${location.name} marked as a top pick`)}>TOP PICK</button><button className={location.status === "shortlisted" ? "active" : ""} onClick={() => publish({ action: "update_location_status", id: location.id, status: "shortlisted" }, `${location.name} marked as a secondary pick`)}>SECONDARY</button><button className={location.status === "rejected" ? "active" : ""} onClick={() => publish({ action: "update_location_status", id: location.id, status: "rejected" }, `${location.name} marked not interested`)}>NOT INTERESTED</button></footer></div>
    </article>; })}</div>
    {selected && <div className="client-location-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeLocation(); }}><section className="client-location-detail" role="dialog" aria-modal="true" aria-label={`${selected.name} location details`}>
      <header><div><span>{pad(selectedIndex + 1)} / {pad(visible.length)}</span><strong>{selected.name}</strong></div><nav><button onClick={() => moveLocation(-1)}>← PREVIOUS</button><button onClick={() => moveLocation(1)}>NEXT →</button><button onClick={closeLocation}>CLOSE ×</button></nav></header>
      <main><section className="client-location-gallery"><div className="client-location-hero" style={{ backgroundImage: selectedGallery[photoIndex] ? `url(${selectedGallery[photoIndex]})` : undefined }}><span>{pad(photoIndex + 1)} / {pad(Math.max(selectedGallery.length, 1))}</span>{selectedGallery.length > 1 && <><button className="previous" onClick={() => movePhoto(-1)} aria-label="Previous photo">←</button><button className="next" onClick={() => movePhoto(1)} aria-label="Next photo">→</button></>}</div>{selectedGallery.length > 1 && <div className="client-location-thumbnails">{selectedGallery.map((image, index) => <button className={index === photoIndex ? "active" : ""} style={{ backgroundImage: `url(${image})` }} onClick={() => setPhotoIndex(index)} aria-label={`View photo ${index + 1}`} key={`${selected.id}-${image}`} />)}</div>}</section>
      <aside><p>{selected.city} · {selected.category || "Location"}</p><h2>{selected.name}</h2><span>{selected.blurb || selected.client_note || selected.note}</span>{selected.address && <section><small>ADDRESS</small><p>{selected.address}</p></section>}{selected.client_note && <section><small>CLIENT NOTES</small><p>{selected.client_note}</p></section>}{selected.note && selected.note !== selected.client_note && <section><small>PRODUCTION NOTES</small><p>{selected.note}</p></section>}<dl><div><dt>DAY RATE</dt><dd>{money.format(selected.rate)}</dd></div><div><dt>SQUARE FEET</dt><dd>{selected.square_feet || "—"}</dd></div><div><dt>AVAILABILITY</dt><dd>{selected.availability || "Pending"}</dd></div><div><dt>STATUS</dt><dd>{titleCase(selected.status || "review")}</dd></div></dl><LocationMapLinks location={selected} />{selected.tags && <div className="client-location-tags">{selected.tags.split("|").filter(Boolean).map((tag) => <span key={tag}>{tag}</span>)}</div>}<footer><button className={selected.status === "approved" ? "active" : ""} onClick={() => publish({ action: "update_location_status", id: selected.id, status: "approved" }, `${selected.name} marked as a top pick`)}>TOP PICK</button><button className={selected.status === "shortlisted" ? "active" : ""} onClick={() => publish({ action: "update_location_status", id: selected.id, status: "shortlisted" }, `${selected.name} marked as a secondary pick`)}>SECONDARY</button><button className={selected.status === "rejected" ? "active" : ""} onClick={() => publish({ action: "update_location_status", id: selected.id, status: "rejected" }, `${selected.name} marked not interested`)}>NOT INTERESTED</button></footer></aside></main>
    </section></div>}
  </>;
}

function ClientCredentialManager({ data, publish }: { data: PortalData; publish: Mutate }) {
  const [username, setUsername] = useState(data.clientCredential?.username || "");
  const [password, setPassword] = useState("");
  useEffect(() => { setUsername(data.clientCredential?.username || ""); setPassword(""); }, [data.project.id, data.clientCredential?.username]);
  const active = Boolean(data.clientCredential?.active);
  return <section className="client-credential-manager"><header><div><p>PROJECT ACCESS</p><h2>CLIENT LOGIN</h2></div><span className={active ? "active" : ""}>{data.clientCredential ? active ? "ACTIVE" : "DISABLED" : "NOT CREATED"}</span></header><form onSubmit={(event) => { event.preventDefault(); void publish({ action: "set_client_credential", username, password }, data.clientCredential ? "Client login updated" : "Client login created"); }}><label>CLIENT USERNAME<input required minLength={3} autoCapitalize="none" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="client-project" /></label><label>{data.clientCredential ? "NEW PASSWORD · LEAVE BLANK TO KEEP" : "CLIENT PASSWORD"}<input required={!data.clientCredential} minLength={8} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={data.clientCredential ? "••••••••" : "At least 8 characters"} /></label><div><p>This login opens only <strong>{data.project.name}</strong> and its client-facing materials.</p><button className="solid" type="submit">{data.clientCredential ? "SAVE CLIENT LOGIN" : "CREATE CLIENT LOGIN"}</button></div></form>{data.clientCredential && active && <button className="disable-client-login" onClick={() => void publish({ action: "disable_client_credential" }, "Client login disabled")}>DISABLE CLIENT LOGIN</button>}</section>;
}

function PublishedClientItems({ shares, publish }: { shares: PortalData["records"]; publish: Mutate }) {
  const ordered = [...shares].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return <section className="client-published-manager"><header><div><p>SHARED WITH CLIENT</p><h2>ALL PUBLISHED ITEMS</h2></div><b>{shares.length} LIVE</b></header><p className="client-published-note">Everything currently available in this project’s client portal. Removing an item only hides the client-facing copy; its production source stays intact.</p>{ordered.length ? <><div className="client-published-head"><span>TYPE</span><span>ITEM</span><span>PUBLISHED</span><span>STATUS</span><span>ACTION</span></div><div className="client-published-list">{ordered.map((share) => <div key={share.id}><span>{share.data.kind || "Document"}</span><strong>{share.data.label || "Production update"}</strong><small>{share.data.date || new Date(share.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</small><b>VISIBLE</b><button aria-label={`Remove ${share.data.label || "item"} from client portal`} onClick={() => void publish({ action: "unpublish_client_item", id: share.id }, `${share.data.label || "Item"} removed from the client portal`)}>REMOVE</button></div>)}</div></> : <div className="client-published-empty"><strong>NOTHING IS PUBLISHED</strong><span>Use the share controls above to add the first client-facing item.</span></div>}</section>;
}

export function ReferenceClientPortal({ data, totals, preview, setPreview, publish, theme, toggleTheme, clientOnly = false, onAccountHome }: { data: PortalData; totals: BudgetTotals; preview: boolean; setPreview: (value: boolean) => void; publish: Mutate; theme: "light" | "dark"; toggleTheme: () => void; clientOnly?: boolean; onAccountHome?: () => void }) {
  const [page, setPage] = useState<ClientPage>("home");
  const [locationPdfView, setLocationPdfView] = useState(false);
  const shares = data.records.filter((record) => record.module === "client_share");
  const budgetComments = data.records.filter((record) => record.module === "budget_comment");
  const defaultBudget = data.budgetVersions.find((version) => version.status === "confirmed") || data.budgetVersions[0];
  const openPortal = () => { setPage("home"); setPreview(true); };
  if (!preview) return <section className="page original-client-admin"><header className="reference-section-head"><div><p>CLIENT · PUBLISHED WORKSPACE</p><h1>CLIENT PORTAL</h1><span>The original clean client view, with budget comparison and live project shares.</span></div><div><button onClick={() => publish({ action: "publish_client_item", kind: "Budget", label: defaultBudget?.name || "Production Estimate", versionId: defaultBudget?.id || "" }, `${defaultBudget?.name || "Budget"} shared to client portal`)}>SHARE BUDGET</button><button onClick={() => publish({ action: "publish_client_item", kind: "Locations", label: `${data.project.name} · Location Shortlist` }, "Locations shared to client portal")}>SHARE LOCATIONS</button><button className="solid" onClick={openPortal}>OPEN CLIENT VIEW ↗</button></div></header><div className="original-client-admin-grid"><PublishedClientItems shares={shares} publish={publish} /><aside><span>PORTAL STATUS</span><strong>LIVE</strong><div><span>Published items</span><b>{shares.length}</b></div><div><span>Budget versions</span><b>{getPublishedBudgetVersions(data.budgetVersions, shares).length} published</b></div><div><span>Locations visible</span><b>{data.locations.filter((location) => !location.deleted_at && location.client_visible !== 0).length}</b></div><div><span>Committed</span><b>{shortMoney.format(totals.committed)}</b></div></aside></div><ClientCredentialManager data={data} publish={publish} /></section>;
  if (locationPdfView) return <LocationPresentation project={data.project} locations={data.locations} close={() => setLocationPdfView(false)} mutate={publish} theme={theme} toggleTheme={toggleTheme} />;
  return <section className={`original-client-portal client-theme-${theme}`}>
    <header><button className="client-wordmark" onClick={() => onAccountHome ? onAccountHome() : setPage("home")}><img src="/bill-inc.png" alt="BILL, INC." /></button><div><span>{data.project.name}</span><i /><strong>CLIENT PORTAL</strong></div><div className="client-header-actions"><button className="theme-button" onClick={toggleTheme} aria-label={`Use ${theme === "light" ? "dark" : "light"} mode`} title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>{theme === "light" ? "◐" : "◑"}</button>{clientOnly && onAccountHome && <button onClick={onAccountHome}>ALL JOBS</button>}<button className="present-button" onClick={() => setPreview(false)}>{clientOnly ? "LOG OUT →" : "PRODUCTION VIEW ↙"}</button></div></header>
    <main>
      <div className="client-date"><span>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>{page !== "home" && <button onClick={() => setPage("home")}>← PROJECT HOME</button>}</div>
      {page === "home" ? <><h1>{data.project.name}</h1><p className="client-welcome">Everything shared for {data.project.client}, together in one place.</p><div className="original-client-cards">{CLIENT_PAGES.map((card, index) => <button onClick={() => setPage(card.page)} key={card.page}><span>{pad(index + 1)}</span><h2>{card.page}</h2><p>{card.copy}</p><footer>OPEN <b>→</b></footer></button>)}</div></> : <><h1 className="client-page-title">{page}</h1>{page === "Budgets" && <ClientBudgetWorkspace project={data.project} versions={data.budgetVersions} shares={shares} comments={budgetComments} publish={publish} />}{page === "Travel" && <ClientTravel project={data.project} records={data.records} shares={shares} />}{page === "Casting" && <ClientOptionsLibrary title="Casting" project={data.project} shares={shares} />}{page === "Art Buying" && <ClientOptionsLibrary title="Art Buying" project={data.project} shares={shares} />}{page === "Locations" && <><div className="client-location-pdf-actions"><div><span>LOCATION PRESENTATION</span><strong>View the complete, print-ready location deck.</strong></div><button onClick={() => setLocationPdfView(true)}>OPEN PDF VIEW ↗</button></div><LocationOverviewMap project={data.project} locations={data.locations.filter((location) => !location.deleted_at && location.client_visible !== 0)} /><ClientLocationBoard locations={data.locations} publish={publish} /></>}{(["Call Sheets", "Schedules", "Files"] as ClientPage[]).includes(page) && <div className="client-simple-list">{shares.filter((share) => share.data.kind === page.replace(/s$/, "") || share.data.kind === page).map((share) => <div key={share.id}><strong>{share.data.label}</strong><span>{share.data.date}</span><small>{share.data.status}</small><b>OPEN →</b></div>)}{!shares.some((share) => share.data.kind === page.replace(/s$/, "") || share.data.kind === page) && <div><strong>Nothing published yet.</strong><span>Your production team can push the latest version here.</span></div>}</div>}</>}
      <footer className="original-client-footer"><span>BILL, INC.</span><span>{data.project.code}</span><span>PRIVATE CLIENT PORTAL</span></footer>
    </main>
  </section>;
}

type LocationDraft = { name: string; city: string; category: string; rate: string; squareFeet: string; availability: string; blurb: string; note: string; clientNote: string; imageUrl: string; tags: string; address: string; latitude: string; longitude: string; mapsUrl: string; streetViewUrl: string; mapX: string; mapY: string };
const emptyLocationDraft: LocationDraft = { name: "", city: "", category: "Residential", rate: "", squareFeet: "", availability: "Availability Pending", blurb: "", note: "", clientNote: "", imageUrl: "", tags: "", address: "", latitude: "", longitude: "", mapsUrl: "", streetViewUrl: "", mapX: "", mapY: "" };

function LocationEditor({ location, close, save }: { location?: Location; close: () => void; save: (draft: LocationDraft) => void }) {
  const [draft, setDraft] = useState<LocationDraft>(location ? { name: location.name, city: location.city, category: location.category || "Uncategorized", rate: String(location.rate), squareFeet: location.square_feet || "", availability: location.availability || "Availability Pending", blurb: location.blurb || "", note: location.note, clientNote: location.client_note, imageUrl: location.image_url, tags: location.tags, address: location.address || "", latitude: location.latitude == null ? "" : String(location.latitude), longitude: location.longitude == null ? "" : String(location.longitude), mapsUrl: location.maps_url || "", streetViewUrl: location.street_view_url || "", mapX: Number(location.map_x) >= 0 ? String(location.map_x) : "", mapY: Number(location.map_y) >= 0 ? String(location.map_y) : "" } : emptyLocationDraft);
  const field = (key: keyof LocationDraft, label: string, placeholder = "") => <label>{label}<input value={draft[key]} placeholder={placeholder} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>;
  const buildLinks = () => {
    const query = draft.address.trim() || [draft.name, draft.city].filter(Boolean).join(", ");
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    const latitude = Number(draft.latitude); const longitude = Number(draft.longitude);
    const streetViewUrl = draft.latitude && draft.longitude && Number.isFinite(latitude) && Number.isFinite(longitude) ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}` : draft.streetViewUrl;
    setDraft({ ...draft, mapsUrl, streetViewUrl });
  };
  return <div className="modal-backdrop"><form className="location-editor" onSubmit={(event) => { event.preventDefault(); save(draft); }}><header><div><p>LOCATION LIBRARY</p><h2>{location ? "EDIT LOCATION" : "ADD LOCATION"}</h2></div><button type="button" onClick={close}>×</button></header><div className="location-editor-fields">{field("name", "Location name")}{field("city", "City / region")}{field("category", "Category")}{field("rate", "Day rate")}{field("squareFeet", "Square feet")}{field("availability", "Availability")}{field("imageUrl", "Lead image URL")}{field("tags", "Search tags", "Modern | Daylight | Rooftop")}<label className="location-editor-wide">Full street address<input value={draft.address} placeholder="120 Franklin St, Brooklyn, NY 11222" onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></label><label>Latitude<input value={draft.latitude} inputMode="decimal" placeholder="40.7128" onChange={(event) => setDraft({ ...draft, latitude: event.target.value })} /></label><label>Longitude<input value={draft.longitude} inputMode="decimal" placeholder="-74.0060" onChange={(event) => setDraft({ ...draft, longitude: event.target.value })} /></label><label className="location-editor-wide">Google Maps link<input value={draft.mapsUrl} placeholder="Paste a Google Maps URL" onChange={(event) => { const coordinates = parseGoogleCoordinates(event.target.value); setDraft({ ...draft, mapsUrl: event.target.value, ...(coordinates || {}) }); }} /></label><label className="location-editor-wide">Google Street View link<input value={draft.streetViewUrl} placeholder="Paste a Street View URL, or add coordinates" onChange={(event) => { const coordinates = parseGoogleCoordinates(event.target.value); setDraft({ ...draft, streetViewUrl: event.target.value, ...(coordinates || {}) }); }} /></label><label>Map label X · 0–100<input value={draft.mapX} inputMode="decimal" placeholder="Auto" onChange={(event) => setDraft({ ...draft, mapX: event.target.value })} /></label><label>Map label Y · 0–100<input value={draft.mapY} inputMode="decimal" placeholder="Auto" onChange={(event) => setDraft({ ...draft, mapY: event.target.value })} /></label></div><div className="location-link-builder"><p>Coordinates place this location geographically on the overview. X/Y can override the label position to prevent overlaps.</p><button type="button" onClick={buildLinks}>BUILD GOOGLE LINKS</button></div><label>Short client blurb<textarea value={draft.blurb} onChange={(event) => setDraft({ ...draft, blurb: event.target.value })} /></label><label>Internal scouting notes<textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label><label>Client-facing notes<textarea value={draft.clientNote} onChange={(event) => setDraft({ ...draft, clientNote: event.target.value })} /></label><footer><button type="button" onClick={close}>CANCEL</button><button className="solid" type="submit">SAVE LOCATION</button></footer></form></div>;
}

function LocationMapWorkspace({ project, locations, close, edit, generate, busy }: { project: Project; locations: Location[]; close: () => void; edit: (location: Location) => void; generate: () => void; busy: boolean }) {
  const mapped = locations.filter((location) => location.latitude != null && location.longitude != null && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude))).length;
  return <section className="location-map-workspace"><header className="reference-section-head"><div><p>CLIENT · LOCATION MAP</p><h1>MAP BUILDER</h1><span>Build the numbered overview automatically, then fine-tune any label from its location record.</span></div><div><button onClick={close}>← LOCATION LIBRARY</button><button className="solid" disabled={busy} onClick={generate}>{busy ? "BUILDING MAP…" : "AUTO-BUILD MAP"}</button></div></header><div className="location-map-workspace-grid"><main><LocationOverviewMap project={project} locations={locations} /></main><aside><header><span>MAP STATUS</span><strong>{mapped} / {locations.length} RESOLVED</strong></header><p>Automatic build verifies the saved locations, fills coordinates, creates Google Maps and Street View links, and redraws this overview.</p><div>{locations.map((location, index) => <article key={location.id}><i>{index + 1}</i><div><strong>{location.name}</strong><span>{location.address || `${location.city} · address needed`}</span><LocationMapLinks location={location} compact /></div><button onClick={() => edit(location)}>EDIT</button></article>)}</div></aside></div></section>;
}

function LocationPresentation({ project, locations, close, mutate, theme, toggleTheme }: { project: Project; locations: Location[]; close: () => void; mutate: Mutate; theme?: "light" | "dark"; toggleTheme?: () => void }) {
  const [format, setFormat] = useState<"site" | "deck">("deck");
  const [localTheme, setLocalTheme] = useState<"light" | "dark">("light");
  const clientTheme = theme || localTheme;
  const changeTheme = () => toggleTheme ? toggleTheme() : setLocalTheme((current) => current === "light" ? "dark" : "light");
  const list = locations.filter((location) => !location.deleted_at && location.client_visible !== 0);
  const groups = [...new Set(list.map((location) => location.category || "Locations"))].map((name) => ({ name, items: list.filter((location) => (location.category || "Locations") === name) }));
  const selectionValue = (location: Location) => location.status === "approved" ? "top" : location.status === "shortlisted" ? "secondary" : location.status === "rejected" ? "not" : "";
  const updatePick = (location: Location, value: string) => mutate({ action: "update_location_status", id: location.id, status: value === "top" ? "approved" : value === "secondary" ? "shortlisted" : value === "not" ? "rejected" : "review" }, `${location.name} client selection updated`);
  const exportPdf = () => { document.body.dataset.printSurface = "locations"; window.print(); window.setTimeout(() => { delete document.body.dataset.printSurface; }, 250); };
  return <section className={`original-location-presentation location-theme-${clientTheme}`}>
    <header><img src="/bill-inc.png" alt="BILL, INC." /><div className="location-presentation-meta"><span>{project.client}</span><strong>{project.name}</strong></div><div className="location-presentation-actions"><div className="location-format-toggle"><button className={format === "deck" ? "active" : ""} onClick={() => setFormat("deck")}>PRESENTATION</button><button className={format === "site" ? "active" : ""} onClick={() => setFormat("site")}>SITE</button></div><button className="theme-button" onClick={changeTheme} aria-label={`Use ${clientTheme === "light" ? "dark" : "light"} mode`} title={`Switch to ${clientTheme === "light" ? "dark" : "light"} mode`}>{clientTheme === "light" ? "◐" : "◑"}</button><button onClick={exportPdf}>PDF ↓</button><button onClick={close}>CLOSE ×</button></div></header>
    {format === "site" ? <main className="location-client-site"><div><p>LOCATION PRESENTATION</p><h1>{project.name}</h1><span>{project.client} · {list.length} locations</span></div><LocationOverviewMap project={project} locations={list} /><ClientLocationBoard locations={list} publish={mutate} /></main> : list.length ? <main className="location-deck-stage" data-deck-stage>
      <article className="location-deck-page deck-cover" data-deck-frame><header><img src="/bill-inc.png" alt="BILL, INC." /><span>{project.client}<br />LOCATION PRESENTATION</span></header><h1>{project.name.split("/").map((part) => <span key={part}>{part.trim().replaceAll("’", "'")}</span>)}</h1><footer><div><small>CLIENT</small><strong>{project.client}</strong></div><div><small>LOCATIONS</small><strong>{pad(list.length)}</strong></div><div><small>DATE</small><strong>{new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}</strong></div></footer></article>
      <article className="location-deck-page deck-index" data-deck-frame><header><img src="/bill-inc.png" alt="BILL, INC." /><span>{project.client}</span></header><h2>INDEX</h2><div>{list.map((location, index) => <div key={location.id}><b>{pad(index + 1)}</b><strong>{location.name}</strong><span>{location.category || "Location"}<br />{location.city}</span></div>)}</div></article>
      <article className="location-deck-page deck-map" data-deck-frame><LocationOverviewMap project={project} locations={list} deck /></article>
      {groups.flatMap((group, groupIndex) => [
        <article className="location-deck-page deck-divider" data-deck-frame key={`divider-${group.name}`}><header><img src="/bill-inc.png" alt="BILL, INC." /><span>{project.client}</span></header><div><b>{pad(groupIndex + 1)}</b><h2>{group.name}</h2></div><footer>{pad(group.items.length)} LOCATION{group.items.length === 1 ? "" : "S"}</footer></article>,
        ...group.items.map((location) => { const index = list.findIndex((item) => item.id === location.id); const gallery = galleryOf(location); return <article className="location-deck-page deck-location" data-deck-frame key={location.id}><header><img src="/bill-inc.png" alt="BILL, INC." /><span>{project.client}</span></header><div className="deck-location-body"><section><b>{pad(index + 1)}</b><p>{location.city}</p><h2>{location.name}</h2><span>{location.blurb || location.client_note || location.note}</span>{location.address && <small className="deck-location-address">{location.address}</small>}<dl><div><dt>SQUARE FEET</dt><dd>{location.square_feet || "—"}</dd></div><div><dt>DAY RATE</dt><dd>{money.format(location.rate)}</dd></div><div><dt>AVAILABILITY</dt><dd>{location.availability || "Pending"}</dd></div></dl><LocationMapLinks location={location} compact /><label>CLIENT PICK<select value={selectionValue(location)} onChange={(event) => updatePick(location, event.target.value)}><option value="">SELECT</option><option value="top">TOP PICK</option><option value="secondary">SECONDARY</option><option value="not">NOT INTERESTED</option></select></label></section><div className="deck-location-gallery"><div className="deck-location-lead" style={{ backgroundImage: gallery[0] ? `url(${gallery[0]})` : undefined }} /> <div>{[0, 1, 2].map((thumb) => <span style={{ backgroundImage: gallery[thumb + 1] ? `url(${gallery[thumb + 1]})` : gallery[0] ? `url(${gallery[0]})` : undefined }} key={thumb} />)}</div></div></div></article>; }),
      ])}
      <article className="location-deck-page deck-closing" data-deck-frame><img src="/bill-inc.png" alt="BILL, INC." /><h2>THANK YOU</h2><footer>{project.client} · {project.name}</footer></article>
    </main> : <div className="client-empty">Choose locations to create a client presentation.</div>}
  </section>;
}

export function ReferenceLocationsView({ project, projects, locations, switchProject, openGlobalLibrary, mutate }: { project: Project; projects: Project[]; locations: Location[]; switchProject: (projectId: string) => Promise<void>; openGlobalLibrary: () => void; mutate: Mutate }) {
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("active"); const [category, setCategory] = useState("all"); const [city, setCity] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [detail, setDetail] = useState<Location | null>(null); const [editing, setEditing] = useState<Location | "new" | null>(null); const [presenting, setPresenting] = useState(false); const [mapping, setMapping] = useState(false); const [buildingMap, setBuildingMap] = useState(false); const [importing, setImporting] = useState(false);
  const [jobMenu, setJobMenu] = useState(false);
  const importPicker = useRef<HTMLInputElement>(null); const galleryPicker = useRef<HTMLInputElement>(null);
  const active = locations.filter((location) => !location.deleted_at); const deleted = locations.filter((location) => Boolean(location.deleted_at));
  const categories = [...new Set(active.map((location) => location.category || "Uncategorized"))].sort(); const cities = [...new Set(active.map((location) => location.city))].sort();
  const filtered = active.filter((location) => status === "active" || location.status === status).filter((location) => category === "all" || (location.category || "Uncategorized") === category).filter((location) => city === "all" || location.city === city).filter((location) => `${location.name} ${location.city} ${location.address || ""} ${location.category} ${location.tags} ${location.note}`.toLowerCase().includes(query.toLowerCase()));
  const presentationLocations = selected.size ? active.filter((location) => selected.has(location.id)) : active.filter((location) => location.client_visible !== 0);
  const saveLocation = (draft: LocationDraft) => { const queryValue = draft.address.trim() || [draft.name, draft.city].filter(Boolean).join(", "); const latitude = draft.latitude.trim(); const longitude = draft.longitude.trim(); const base = { name: draft.name, city: draft.city, category: draft.category, rate: cleanNumber(draft.rate), squareFeet: draft.squareFeet, availability: draft.availability, blurb: draft.blurb, note: draft.note, clientNote: draft.clientNote, imageUrl: draft.imageUrl, tags: draft.tags, address: draft.address, latitude, longitude, mapsUrl: draft.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryValue)}`, streetViewUrl: draft.streetViewUrl || (latitude && longitude ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}` : ""), mapX: draft.mapX, mapY: draft.mapY }; if (editing && editing !== "new") mutate({ action: "update_location", id: editing.id, ...base }, `${draft.name} updated`); else mutate({ action: "add_location", ...base }, `${draft.name} added to the location library`); setEditing(null); };
  const generateMap = async () => { setBuildingMap(true); try { await mutate({ action: "generate_location_map" }, "Location overview map generated"); } finally { setBuildingMap(false); } };
  async function uploadFiles(files: FileList, folderImport: boolean) {
    setImporting(true);
    try {
      const grouped = new Map<string, string[]>();
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const form = new FormData(); form.set("file", file); form.set("projectId", project.id); form.set("category", "Location");
        const response = await fetch("/api/files", { method: "POST", body: form }); const payload = await response.json() as { error?: string; url: string }; if (!response.ok) throw new Error(payload.error || "Image upload failed");
        const folder = file.webkitRelativePath?.split("/").slice(-2, -1)[0] || file.name.replace(/\.[^.]+$/, ""); grouped.set(folder, [...(grouped.get(folder) || []), payload.url]);
      }
      if (folderImport) await mutate({ action: "import_locations", folders: [...grouped.entries()].map(([name, gallery]) => ({ name, gallery })) }, `${grouped.size} location folders imported`);
      else if (detail) await mutate({ action: "update_location_gallery", id: detail.id, gallery: [...galleryOf(detail), ...[...grouped.values()].flat()] }, `${detail.name} gallery updated`);
    } catch (error) { window.alert(error instanceof Error ? error.message : "Those images could not be imported."); }
    finally { setImporting(false); }
  }
  if (presenting) return <LocationPresentation project={project} locations={presentationLocations} close={() => setPresenting(false)} mutate={mutate} />;
  if (mapping) return <><LocationMapWorkspace project={project} locations={active} close={() => setMapping(false)} edit={(location) => setEditing(location)} generate={() => void generateMap()} busy={buildingMap} />{editing && editing !== "new" && <LocationEditor location={editing} close={() => setEditing(null)} save={saveLocation} />}</>;
  if (detail) return <section className="reference-location-detail"><header><button onClick={() => setDetail(null)}>← ALL LOCATIONS</button><div><button onClick={() => setEditing(detail)}>EDIT DETAILS</button><button onClick={() => galleryPicker.current?.click()}>＋ ADD IMAGES</button><button onClick={() => setPresenting(true)}>CLIENT PREVIEW ↗</button></div></header><main><section><div className="location-hero" style={{ backgroundImage: galleryOf(detail)[0] ? `url(${galleryOf(detail)[0]})` : undefined }}><span>{titleCase(detail.status)}</span></div><div className="location-gallery">{galleryOf(detail).map((image, index) => <button style={{ backgroundImage: `url(${image})` }} onClick={() => mutate({ action: "update_location_gallery", id: detail.id, gallery: galleryOf(detail).filter((_, current) => current !== index) }, "Image removed")} title="Remove image" key={`${image}-${index}`} />)}</div></section><aside><p>{detail.city} · {detail.category || "Uncategorized"}</p><h1>{detail.name}</h1><span>{detail.blurb || detail.note}</span><dl><div><dt>DAY RATE</dt><dd>{money.format(detail.rate)}</dd></div><div><dt>SQUARE FEET</dt><dd>{detail.square_feet || "—"}</dd></div><div><dt>AVAILABILITY</dt><dd>{detail.availability || "Pending"}</dd></div><div><dt>ADDRESS</dt><dd>{detail.address || "Add address for map"}</dd></div><div><dt>SEARCH TAGS</dt><dd>{detail.tags || "—"}</dd></div><div><dt>INTERNAL NOTES</dt><dd>{detail.note || "—"}</dd></div><div><dt>CLIENT NOTES</dt><dd>{detail.client_note || "—"}</dd></div></dl><LocationMapLinks location={detail} /><footer><button onClick={() => mutate({ action: "set_location_visibility", id: detail.id, visible: detail.client_visible === 0 }, detail.client_visible === 0 ? "Location added to client view" : "Location hidden from client view")}>{detail.client_visible === 0 ? "ADD TO CLIENT VIEW" : "HIDE FROM CLIENT VIEW"}</button><button className="danger" onClick={() => { mutate({ action: "delete_location", id: detail.id }, `${detail.name} moved to recently deleted`); setDetail(null); }}>DELETE LOCATION</button></footer></aside></main><input ref={galleryPicker} hidden type="file" accept="image/*" multiple onChange={(event) => event.target.files && uploadFiles(event.target.files, false)} />{editing && editing !== "new" && <LocationEditor location={editing} close={() => setEditing(null)} save={saveLocation} />}</section>;
  return <section className="reference-locations-page unified-project-location-page"><header className="reference-section-head"><div><p>LOCATION LIBRARY · PROJECT PAGE</p><h1>{project.name}</h1><span>{project.client} · {project.code} · Search, edit, map and publish this production&apos;s location options.</span></div><div className="location-head-actions"><button onClick={openGlobalLibrary}>← ALL LOCATIONS</button><div className="location-job-switch"><button onClick={() => setJobMenu((value) => !value)}><span>PROJECT</span><strong>{project.code} · {project.name}</strong><b>⌄</b></button>{jobMenu && <div><p>SWITCH PROJECT</p>{projects.map((option) => <button className={option.id === project.id ? "current" : ""} onClick={() => { setJobMenu(false); setDetail(null); void switchProject(option.id); }} key={option.id}><span><strong>{option.name}</strong><small>{option.client} · {option.code}</small></span>{option.id !== project.id && <b>→</b>}</button>)}<button className="global" onClick={openGlobalLibrary}>FULL LOCATION LIBRARY ↗</button></div>}</div><button onClick={() => importPicker.current?.click()}>{importing ? "IMPORTING…" : "IMPORT FOLDERS"}</button><button onClick={() => setMapping(true)}>MAP BUILDER</button><button onClick={() => setEditing("new")}>＋ ADD LOCATION</button><button className="solid" onClick={() => setPresenting(true)}>CLIENT PREVIEW ↗</button></div></header><div className="location-library-shell"><aside><label className="location-search">SEARCH<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, city, address, tag…" /></label><div className="location-filter"><p>STATUS</p>{[["active", "All locations"], ["approved", "Top picks"], ["shortlisted", "Secondary"], ["rejected", "Not interested"]].map(([value, label]) => <button className={status === value ? "active" : ""} onClick={() => setStatus(value)} key={value}><span>{label}</span><b>{value === "active" ? active.length : active.filter((location) => location.status === value).length}</b></button>)}</div><div className="location-filter"><p>CATEGORY</p><button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}><span>All categories</span><b>{active.length}</b></button>{categories.map((value) => <button className={category === value ? "active" : ""} onClick={() => setCategory(value)} key={value}><span>{value}</span><b>{active.filter((location) => (location.category || "Uncategorized") === value).length}</b></button>)}</div><div className="location-filter"><p>CITY / REGION</p><button className={city === "all" ? "active" : ""} onClick={() => setCity("all")}><span>All cities</span><b>{active.length}</b></button>{cities.map((value) => <button className={city === value ? "active" : ""} onClick={() => setCity(value)} key={value}><span>{value}</span><b>{active.filter((location) => location.city === value).length}</b></button>)}</div><button className="clear-location-filters" onClick={() => { setQuery(""); setStatus("active"); setCategory("all"); setCity("all"); }}>CLEAR FILTERS</button></aside><main><div className="location-results-head"><div><span>PROJECT LOCATIONS</span><b>{filtered.length} RESULTS</b></div><div><button onClick={() => setSelected(new Set(filtered.map((location) => location.id)))}>SELECT ALL</button><button onClick={() => setSelected(new Set())}>DESELECT ALL</button><span>{selected.size} SELECTED</span></div></div><div className="reference-location-grid">{filtered.map((location, index) => <article key={location.id}><button className="reference-location-photo" onClick={() => setDetail(location)} style={{ backgroundImage: galleryOf(location)[0] ? `url(${galleryOf(location)[0]})` : undefined }}><span>{pad(index + 1)}</span><b>{titleCase(location.status)}</b></button><div><p>{location.city} · {location.category || "Uncategorized"}</p><h2><button onClick={() => setDetail(location)}>{location.name}</button><span>{money.format(location.rate)}</span></h2><small>{location.square_feet || "—"} SQ FT · {location.availability || "PENDING"}</small><LocationMapLinks location={location} compact /><footer><button className={selected.has(location.id) ? "active" : ""} onClick={() => setSelected((current) => { const next = new Set(current); if (next.has(location.id)) next.delete(location.id); else next.add(location.id); return next; })}>{selected.has(location.id) ? "✓ SELECTED" : "+ SELECT"}</button><button onClick={() => setDetail(location)}>VIEW DETAILS →</button></footer></div></article>)}</div>{deleted.length > 0 && <section className="recently-deleted"><header><span>RECENTLY DELETED</span><b>{deleted.length} · AUTO-PURGE AFTER 14 DAYS</b></header>{deleted.map((location) => <div key={location.id}><strong>{location.name}</strong><span>{location.city}</span><small>{location.deleted_at ? new Date(location.deleted_at).toLocaleDateString() : ""}</small><button onClick={() => mutate({ action: "restore_location", id: location.id }, `${location.name} restored`)}>RESTORE</button><button onClick={() => mutate({ action: "purge_location", id: location.id }, `${location.name} permanently deleted`)}>PURGE</button></div>)}</section>}</main></div><input ref={importPicker} hidden type="file" accept="image/*" multiple {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} onChange={(event) => event.target.files && uploadFiles(event.target.files, true)} />{editing && <LocationEditor location={editing === "new" ? undefined : editing} close={() => setEditing(null)} save={saveLocation} />}</section>;
}
