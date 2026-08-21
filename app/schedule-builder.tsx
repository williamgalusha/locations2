"use client";

import { useMemo, useState } from "react";
import type { Location, ModuleRecord, Mutate, Project } from "./production-portal";

type BuilderAnswers = {
  dayNumber: string;
  totalDays: string;
  shootDate: string;
  shootLocation: string;
  productionCall: string;
  crewCall: string;
  clientCall: string;
  firstShot: string;
  mealTime: string;
  cameraWrap: string;
  hardOut: string;
  objectives: string;
  talent: string;
  sets: string;
  deliverables: string;
  constraints: string;
};

export type ScheduleDraftRow = {
  time: string;
  endTime: string;
  runMinutes: string;
  event: string;
  board: string;
  look: string;
  talent: string;
  location: string;
  notes: string;
  type: string;
};

type BuilderQuestion = { id: string; prompt: string; reason: string; required: boolean };
type EditEntry = { request: string; date: string; result: string };
type ScheduleResult = { ready: boolean; summary: string; assumptions: string[]; questions: BuilderQuestion[]; rows: ScheduleDraftRow[]; source?: string; warning?: string };

const blankRow = (): ScheduleDraftRow => ({ time: "", endTime: "", runMinutes: "", event: "", board: "", look: "", talent: "", location: "", notes: "", type: "shoot" });

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function defaultAnswers(project: Project, schedule: ModuleRecord[], locations: Location[]): BuilderAnswers {
  const approved = locations.find((location) => location.status.toLowerCase() === "approved") || locations[0];
  const lookup = (pattern: RegExp, fallback: string) => schedule.find((record) => pattern.test(record.data.event || ""))?.data.time || fallback;
  return {
    dayNumber: "1",
    totalDays: String(Math.max(1, Math.round((new Date(`${project.shoot_end}T12:00:00`).getTime() - new Date(`${project.shoot_start}T12:00:00`).getTime()) / 86400000) + 1)),
    shootDate: project.shoot_start,
    shootLocation: approved ? [approved.name, approved.address || approved.city].filter(Boolean).join(" · ") : "Location TBD",
    productionCall: lookup(/production.*call/i, "06:30"),
    crewCall: lookup(/crew.*call|breakfast/i, "07:30"),
    clientCall: lookup(/client.*call/i, "08:30"),
    firstShot: lookup(/first shot/i, "09:30"),
    mealTime: lookup(/lunch|meal/i, "13:00"),
    cameraWrap: lookup(/camera wrap/i, "17:00"),
    hardOut: lookup(/hard out|walkaway/i, "18:00"),
    objectives: "",
    talent: "",
    sets: approved?.name || "",
    deliverables: "",
    constraints: "",
  };
}

function rowDuration(row: ScheduleDraftRow) {
  if (row.runMinutes) return `${row.runMinutes} MIN`;
  if (!row.time || !row.endTime) return "—";
  const [startHour, startMinute] = row.time.split(":").map(Number);
  const [endHour, endMinute] = row.endTime.split(":").map(Number);
  const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return minutes > 0 ? `${minutes} MIN` : "—";
}

function inputTime(value: string) {
  return /^\d{2}:\d{2}$/.test(value) ? value : "";
}

export function ScheduleWorkspace({ project, schedule, builderRecord, crew, locations, production, mutate, publish, openRow }: {
  project: Project;
  schedule: ModuleRecord[];
  builderRecord?: ModuleRecord;
  crew: ModuleRecord[];
  locations: Location[];
  production: ModuleRecord[];
  mutate: Mutate;
  publish: () => void;
  openRow: () => void;
}) {
  const [answers, setAnswers] = useState<BuilderAnswers>(() =>
    parseJson(builderRecord?.data.answers, defaultAnswers(project, schedule, locations)),
  );
  const [notes, setNotes] = useState(builderRecord?.data.notes || "");
  const [editRequest, setEditRequest] = useState("");
  const [questions, setQuestions] = useState<BuilderQuestion[]>(() => parseJson(builderRecord?.data.questions, []));
  const [clarifications, setClarifications] = useState<Record<string, string>>(() => parseJson(builderRecord?.data.clarifications, {}));
  const [draft, setDraft] = useState<ScheduleDraftRow[]>(() => parseJson(builderRecord?.data.draft, []));
  const [assumptions, setAssumptions] = useState<string[]>(() => parseJson(builderRecord?.data.assumptions, []));
  const [history, setHistory] = useState<EditEntry[]>(() => parseJson(builderRecord?.data.editHistory, []));
  const [summary, setSummary] = useState(builderRecord?.data.summary || "");
  const [working, setWorking] = useState<"build" | "edit" | "save" | "apply" | "">("");
  const [message, setMessage] = useState("");

  const ordered = useMemo(() => [...schedule].sort((a, b) => (a.data.time || "").localeCompare(b.data.time || "")), [schedule]);
  const approvedLocations = locations.filter((location) => location.status.toLowerCase() === "approved");
  const filledQuestions = questions.every((question) => !question.required || clarifications[question.id]?.trim());

  function serializedState(overrides: Partial<{ draft: ScheduleDraftRow[]; questions: BuilderQuestion[]; assumptions: string[]; summary: string; history: EditEntry[] }> = {}) {
    return {
      answers: JSON.stringify(answers),
      notes,
      questions: JSON.stringify(overrides.questions ?? questions),
      clarifications: JSON.stringify(clarifications),
      draft: JSON.stringify(overrides.draft ?? draft),
      assumptions: JSON.stringify(overrides.assumptions ?? assumptions),
      summary: overrides.summary ?? summary,
      editHistory: JSON.stringify(overrides.history ?? history),
    };
  }

  async function saveBuilder(success = "Schedule builder saved", overrides: Parameters<typeof serializedState>[0] = {}) {
    const data = serializedState(overrides);
    return builderRecord
      ? mutate({ action: "update_module_record", module: "schedule_builder", id: builderRecord.id, data }, success)
      : mutate({ action: "add_module_record", module: "schedule_builder", data }, success);
  }

  async function runBuilder(mode: "build" | "edit") {
    if (mode === "edit" && !editRequest.trim()) { setMessage("Write the change you want before requesting an edit."); return; }
    setWorking(mode); setMessage("");
    try {
      const response = await fetch("/api/schedule-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, mode, answers, clarifications, notes, editRequest, currentSchedule: mode === "edit" ? (draft.length ? draft : schedule.map((record) => ({ ...blankRow(), ...record.data }))) : [] }),
      });
      const result = await response.json() as ScheduleResult & { error?: string };
      if (!response.ok) throw new Error(result.error || "The schedule could not be built.");
      const nextHistory = mode === "edit" ? [{ request: editRequest.trim(), date: new Date().toISOString(), result: result.summary || "Draft revised" }, ...history].slice(0, 30) : history;
      setDraft(result.rows || []); setQuestions(result.questions || []); setAssumptions(result.assumptions || []); setSummary(result.summary || ""); setHistory(nextHistory); setEditRequest("");
      setMessage(result.questions?.length && !result.ready ? "Answer the follow-up questions, then build again." : result.warning || `${result.rows.length} schedule items proposed. Review before applying.`);
      await saveBuilder("Schedule draft saved", { draft: result.rows || [], questions: result.questions || [], assumptions: result.assumptions || [], summary: result.summary || "", history: nextHistory });
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "The schedule could not be built."); }
    finally { setWorking(""); }
  }

  async function applyDraft() {
    if (!draft.length) return;
    setWorking("apply");
    const applied = await mutate({ action: "replace_schedule", rows: draft }, `${draft.length} schedule items applied; call sheet updated`);
    if (applied) setMessage("The active schedule and call sheet now use this draft.");
    setWorking("");
  }

  function updateDraft(index: number, field: keyof ScheduleDraftRow, value: string) {
    setDraft((current) => current.map((row, position) => position === index ? { ...row, [field]: value } : row));
  }

  return <section className="page schedule-builder-page">
    <header className="page-head"><div><p>OPERATIONS · GUIDED TIMELINE</p><h1>SCHEDULE</h1><span>Build a detailed shooting day from project facts, then keep the live call sheet in sync.</span></div><div><button className="outline-button" onClick={publish}>PUSH TO CLIENT →</button><button className="outline-button" onClick={() => window.print()}>EXPORT PDF ↓</button><button className="black-button" onClick={openRow}>＋ ROW</button></div></header>

    <div className="schedule-builder-banner"><div><span>SCHEDULE BUILDER</span><strong>DAY {answers.dayNumber || "1"} OF {answers.totalDays || "1"}</strong></div><p>Project details, approved locations, crew, and existing production records are included automatically.</p><button disabled={working === "build" || (questions.length > 0 && !filledQuestions)} onClick={() => void runBuilder("build")}>{working === "build" ? "BUILDING…" : questions.length ? "REBUILD WITH ANSWERS →" : "BUILD SCHEDULE →"}</button></div>

    <div className="schedule-builder-layout">
      <section className="schedule-questionnaire"><header><span>01</span><div><p>BASIC QUESTIONS</p><h2>DAY PARAMETERS</h2></div></header><div className="schedule-answer-grid">
        <Field label="DAY" value={answers.dayNumber} onChange={(value) => setAnswers({ ...answers, dayNumber: value })} type="number" />
        <Field label="OF DAYS" value={answers.totalDays} onChange={(value) => setAnswers({ ...answers, totalDays: value })} type="number" />
        <Field label="SHOOT DATE" value={answers.shootDate} onChange={(value) => setAnswers({ ...answers, shootDate: value })} type="date" wide />
        <Field label="PRIMARY LOCATION" value={answers.shootLocation} onChange={(value) => setAnswers({ ...answers, shootLocation: value })} wide />
        <Field label="PRODUCTION CALL" value={answers.productionCall} onChange={(value) => setAnswers({ ...answers, productionCall: value })} type="time" />
        <Field label="CREW CALL" value={answers.crewCall} onChange={(value) => setAnswers({ ...answers, crewCall: value })} type="time" />
        <Field label="CLIENT CALL" value={answers.clientCall} onChange={(value) => setAnswers({ ...answers, clientCall: value })} type="time" />
        <Field label="FIRST SHOT" value={answers.firstShot} onChange={(value) => setAnswers({ ...answers, firstShot: value })} type="time" />
        <Field label="MEAL" value={answers.mealTime} onChange={(value) => setAnswers({ ...answers, mealTime: value })} type="time" />
        <Field label="CAMERA WRAP" value={answers.cameraWrap} onChange={(value) => setAnswers({ ...answers, cameraWrap: value })} type="time" />
        <Field label="HARD OUT" value={answers.hardOut} onChange={(value) => setAnswers({ ...answers, hardOut: value })} type="time" wide />
        <Field label="SHOTS / OBJECTIVES" value={answers.objectives} onChange={(value) => setAnswers({ ...answers, objectives: value })} area wide placeholder="One shot or setup per line; include sequence, duration, and priorities when known." />
        <Field label="TALENT" value={answers.talent} onChange={(value) => setAnswers({ ...answers, talent: value })} area wide placeholder="Names, fittings, HMU timing, restrictions, or release windows." />
        <Field label="SETS / MOVES" value={answers.sets} onChange={(value) => setAnswers({ ...answers, sets: value })} area wide placeholder="Sets, stages, company moves, resets, or lighting changes." />
        <Field label="DELIVERABLES" value={answers.deliverables} onChange={(value) => setAnswers({ ...answers, deliverables: value })} area wide placeholder="Stills, motion, social, BTS, boards, looks, or asset counts." />
        <Field label="CONSTRAINTS" value={answers.constraints} onChange={(value) => setAnswers({ ...answers, constraints: value })} area wide placeholder="Location windows, daylight, overtime, talent hard outs, special access, weather." />
      </div>{questions.length > 0 && <section className="schedule-followups"><header><span>FOLLOW-UP QUESTIONS</span><b>{questions.filter((question) => question.required).length} REQUIRED</b></header>{questions.map((question) => <label key={question.id}><span><strong>{question.prompt}</strong><small>{question.reason}</small></span><input value={clarifications[question.id] || ""} onChange={(event) => setClarifications({ ...clarifications, [question.id]: event.target.value })} placeholder={question.required ? "Required before rebuilding" : "Optional"} /></label>)}</section>}<footer><button className="outline-button" disabled={working === "save"} onClick={() => { setWorking("save"); void saveBuilder().finally(() => setWorking("")); }}>{working === "save" ? "SAVING…" : "SAVE BUILDER"}</button><button className="black-button" disabled={working === "build" || (questions.length > 0 && !filledQuestions)} onClick={() => void runBuilder("build")}>{working === "build" ? "BUILDING…" : "BUILD SCHEDULE →"}</button></footer></section>

      <aside className="schedule-builder-sidebar"><section><header><span>PROJECT DATA</span><b>AUTO-PULLED</b></header><dl><Fact label="JOB" value={`${project.name} · ${project.code}`} /><Fact label="CLIENT" value={project.client} /><Fact label="DATES" value={`${project.shoot_start} — ${project.shoot_end}`} /><Fact label="LOCATIONS" value={`${approvedLocations.length || locations.length} available`} /><Fact label="HEADCOUNT" value={`${crew.length} people`} /><Fact label="PRODUCTION ITEMS" value={`${production.length} records`} /></dl></section><section className="schedule-notes"><header><span>NOTES</span><b>INTERNAL</b></header><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add context, priorities, unresolved decisions, or notes for the next schedule pass." /><button onClick={() => void saveBuilder("Schedule notes saved")}>SAVE NOTES</button></section><section className="schedule-edits"><header><span>EDITS</span><b>REQUEST A REVISION</b></header><textarea value={editRequest} onChange={(event) => setEditRequest(event.target.value)} placeholder="Example: Move lunch to 12:30, give the hero setup 20 more minutes, and keep the hard out unchanged." /><button disabled={working === "edit" || (!draft.length && !schedule.length)} onClick={() => void runBuilder("edit")}>{working === "edit" ? "REVISING…" : "REQUEST EDIT →"}</button>{history.length > 0 && <div className="schedule-edit-history">{history.map((entry, index) => <article key={`${entry.date}-${index}`}><time>{new Date(entry.date).toLocaleString()}</time><strong>{entry.request}</strong><span>{entry.result}</span></article>)}</div>}</section></aside>
    </div>

    {message && <div className="schedule-builder-message">{message}</div>}
    {draft.length > 0 && <section className="schedule-draft"><header><div><span>02 · PROPOSED SCHEDULE</span><h2>{summary || `${draft.length} ITEMS READY TO REVIEW`}</h2></div><div><button className="outline-button" onClick={() => setDraft([...draft, blankRow()])}>＋ DRAFT ROW</button><button className="outline-button" onClick={() => void saveBuilder("Schedule draft saved")}>SAVE DRAFT</button><button className="black-button" disabled={working === "apply"} onClick={() => void applyDraft()}>{working === "apply" ? "APPLYING…" : "APPLY TO LIVE SCHEDULE →"}</button></div></header>{assumptions.length > 0 && <details><summary>ASSUMPTIONS · {assumptions.length}</summary><ul>{assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></details>}<ScheduleGrid rows={draft} update={updateDraft} remove={(index) => setDraft((current) => current.filter((_row, position) => position !== index))} /></section>}

    <section className="schedule-live"><header><div><span>03 · LIVE SOURCE</span><h2>{ordered.length} SCHEDULED ITEMS</h2></div><p>These rows drive general call, calculated crew calls, and the generated call sheet.</p></header><div className="schedule-sheet detailed"><div className="schedule-head"><span>TIME</span><span>RUN</span><span>DESCRIPTION</span><span>BOARD</span><span>LOOK</span><span>TALENT</span><span>SET / LOCATION</span><span>NOTES</span><span /></div>{ordered.map((record) => <LiveScheduleRow record={record} mutate={mutate} key={record.id} />)}</div></section>
  </section>;
}

function Field({ label, value, onChange, type = "text", wide = false, area = false, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; type?: string; wide?: boolean; area?: boolean; placeholder?: string }) {
  return <label className={wide ? "wide" : ""}><span>{label}</span>{area ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /> : <input type={type} min={type === "number" ? "1" : undefined} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}</label>;
}

function Fact({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }

function ScheduleGrid({ rows, update, remove }: { rows: ScheduleDraftRow[]; update: (index: number, field: keyof ScheduleDraftRow, value: string) => void; remove: (index: number) => void }) {
  return <div className="schedule-sheet detailed draft-grid"><div className="schedule-head"><span>TIME</span><span>RUN</span><span>DESCRIPTION</span><span>BOARD</span><span>LOOK</span><span>TALENT</span><span>SET / LOCATION</span><span>NOTES</span><span /></div>{rows.map((row, index) => <div className={`schedule-row type-${row.type || "shoot"}`} key={index}><input type="time" value={inputTime(row.time)} onChange={(event) => update(index, "time", event.target.value)} /><span>{rowDuration(row)}</span><input value={row.event} onChange={(event) => update(index, "event", event.target.value)} /><input value={row.board} onChange={(event) => update(index, "board", event.target.value)} /><input value={row.look} onChange={(event) => update(index, "look", event.target.value)} /><input value={row.talent} onChange={(event) => update(index, "talent", event.target.value)} /><input value={row.location} onChange={(event) => update(index, "location", event.target.value)} /><input value={row.notes} onChange={(event) => update(index, "notes", event.target.value)} /><button onClick={() => remove(index)}>×</button></div>)}</div>;
}

function LiveScheduleRow({ record, mutate }: { record: ModuleRecord; mutate: Mutate }) {
  const [data, setData] = useState(record.data);
  const save = () => { if (JSON.stringify(data) !== JSON.stringify(record.data)) void mutate({ action: "update_module_record", module: "schedule", id: record.id, data }, "Schedule and call sheet updated"); };
  return <div className={`schedule-row type-${data.type || "shoot"}`}><input type="time" value={inputTime(data.time || "")} onChange={(event) => setData({ ...data, time: event.target.value })} onBlur={save} /><span>{rowDuration({ ...blankRow(), ...data })}</span><input value={data.event || ""} onChange={(event) => setData({ ...data, event: event.target.value })} onBlur={save} /><input value={data.board || ""} onChange={(event) => setData({ ...data, board: event.target.value })} onBlur={save} /><input value={data.look || ""} onChange={(event) => setData({ ...data, look: event.target.value })} onBlur={save} /><input value={data.talent || ""} onChange={(event) => setData({ ...data, talent: event.target.value })} onBlur={save} /><input value={data.location || ""} onChange={(event) => setData({ ...data, location: event.target.value })} onBlur={save} /><input value={data.notes || ""} onChange={(event) => setData({ ...data, notes: event.target.value })} onBlur={save} /><button onClick={() => void mutate({ action: "delete_module_record", id: record.id }, "Schedule row removed")}>×</button></div>;
}
