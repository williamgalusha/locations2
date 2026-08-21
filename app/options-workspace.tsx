"use client";

import type { DragEvent } from "react";
import { useMemo, useRef, useState } from "react";
import type { ModuleRecord, Mutate, Project } from "./production-portal";

export type OptionsModule = "casting" | "art_buying";
type OptionCandidate = { id: string; name: string; role: string; agency: string; availability: string; status: string; rate: string; notes: string; link: string; imageUrl: string };
type OptionSection = { id: string; name: string; candidates: OptionCandidate[] };

const ART_BUYING_SECTIONS = ["Photographer", "Director", "DP", "Set Design", "Hair Stylist", "Makeup Artist", "Manicurist", "BTS"];
const CASTING_SECTIONS = ["Principal", "Featured", "Supporting", "Background"];
const emptyCandidate = (): OptionCandidate => ({ id: crypto.randomUUID(), name: "", role: "", agency: "", availability: "", status: "Review", rate: "", notes: "", link: "", imageUrl: "" });
const defaultSections = (module: OptionsModule): OptionSection[] => (module === "art_buying" ? ART_BUYING_SECTIONS : CASTING_SECTIONS).map((name) => ({ id: crypto.randomUUID(), name, candidates: [] }));

function parseSections(value?: string, module: OptionsModule = "art_buying") {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    if (Array.isArray(parsed) && parsed.length) return parsed as OptionSection[];
  } catch { /* fall through to the editable template */ }
  return defaultSections(module);
}

function printDeck() {
  document.body.dataset.printSurface = "options-deck";
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    window.print();
    window.setTimeout(() => { delete document.body.dataset.printSurface; }, 250);
  }));
}

function DeckPages({ project, title, sections }: { project: Project; title: string; sections: OptionSection[] }) {
  const count = sections.reduce((sum, section) => sum + section.candidates.length, 0);
  return <main className="options-deck-stage">
    <article className="options-deck-page options-deck-cover"><header><strong>BILL, INC.</strong><span>{project.client}</span></header><div><p>CREATIVE OPTIONS</p><h1>{title.toUpperCase()}</h1><h2>{project.name}</h2></div><footer><span>{project.code}</span><span>{sections.length} SECTIONS</span><span>{count} OPTIONS</span></footer></article>
    <article className="options-deck-page options-deck-index"><header><strong>BILL, INC.</strong><span>{project.client}</span></header><div><p>OPTIONS INDEX</p><h2>{title.toUpperCase()}</h2>{sections.map((section, index) => <div key={section.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{section.name}</strong><b>{section.candidates.length}</b></div>)}</div></article>
    {sections.map((section, sectionIndex) => <section className="options-deck-group" key={section.id}>
      <article className="options-deck-page options-deck-divider"><header><strong>BILL, INC.</strong><span>{project.client}</span></header><div><span>{String(sectionIndex + 1).padStart(2, "0")}</span><h2>{section.name.toUpperCase()}</h2></div><footer>{section.candidates.length} OPTION{section.candidates.length === 1 ? "" : "S"}</footer></article>
      {section.candidates.map((candidate, candidateIndex) => <article className="options-deck-page options-deck-candidate" key={candidate.id}>
        <header><strong>BILL, INC.</strong><span>{project.client} · {project.name}</span></header>
        <div className="options-deck-candidate-grid"><div className="options-deck-image" style={{ backgroundImage: candidate.imageUrl ? `url(${candidate.imageUrl})` : undefined }}><span>{candidate.imageUrl ? "" : `${String(sectionIndex + 1).padStart(2, "0")}.${String(candidateIndex + 1).padStart(2, "0")}`}</span></div><section><p>{section.name}</p><h2>{candidate.name || "OPTION NAME"}</h2><h3>{candidate.role || section.name}</h3><dl><div><dt>AGENCY / REPRESENTATION</dt><dd>{candidate.agency || "—"}</dd></div><div><dt>AVAILABILITY / HOLD</dt><dd>{candidate.availability || "Pending"}</dd></div><div><dt>RATE</dt><dd>{candidate.rate || "Pending"}</dd></div><div><dt>STATUS</dt><dd>{candidate.status || "Review"}</dd></div></dl>{candidate.notes && <div className="options-deck-notes"><span>NOTES</span><p>{candidate.notes}</p></div>}{candidate.link && <a href={candidate.link} target="_blank" rel="noreferrer">VIEW PORTFOLIO / REEL ↗</a>}</section></div>
        <footer><span>{project.code}</span><span>{section.name}</span><span>{String(candidateIndex + 1).padStart(2, "0")}</span></footer>
      </article>)}
    </section>)}
  </main>;
}

export function OptionsWorkspace({ module, title, project, record, mutate }: { module: OptionsModule; title: string; project: Project; record?: ModuleRecord; mutate: Mutate }) {
  const [sections, setSections] = useState<OptionSection[]>(() => parseSections(record?.data.sections, module));
  const [deck, setDeck] = useState(false);
  const [dirty, setDirty] = useState(false);
  const draggedSection = useRef<string | null>(null);
  const change = (next: OptionSection[]) => { setSections(next); setDirty(true); };
  const save = () => mutate(record ? { action: "update_module_record", module, id: record.id, data: { type: "options_sheet", title, sections: JSON.stringify(sections) } } : { action: "add_module_record", module, data: { type: "options_sheet", title, sections: JSON.stringify(sections) } }, `${title} options saved`).then((ok) => { if (ok) setDirty(false); });
  const publish = (selected: OptionSection[]) => mutate({ action: "publish_client_item", kind: title, moduleKey: module, label: selected.length === sections.length ? `${project.name} · ${title}` : `${selected[0]?.name || title} · Options`, sectionId: selected.length === 1 ? selected[0].id : "", snapshot: JSON.stringify(selected) }, `${selected.length === sections.length ? title : selected[0]?.name} pushed to the client portal`);
  const updateSection = (sectionId: string, patch: Partial<OptionSection>) => change(sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section));
  const updateCandidate = (sectionId: string, candidateId: string, field: keyof OptionCandidate, value: string) => change(sections.map((section) => section.id === sectionId ? { ...section, candidates: section.candidates.map((candidate) => candidate.id === candidateId ? { ...candidate, [field]: value } : candidate) } : section));
  const moveSection = (id: string, delta: number) => { const index = sections.findIndex((section) => section.id === id); const target = index + delta; if (index < 0 || target < 0 || target >= sections.length) return; const next = [...sections]; const [item] = next.splice(index, 1); next.splice(target, 0, item); change(next); };
  const dropSection = (event: DragEvent<HTMLElement>, targetId: string) => { event.preventDefault(); const id = draggedSection.current || event.dataTransfer.getData("text/plain"); const from = sections.findIndex((section) => section.id === id); const target = sections.findIndex((section) => section.id === targetId); if (from < 0 || target < 0 || from === target) return; const next = [...sections]; const [item] = next.splice(from, 1); next.splice(target, 0, item); change(next); draggedSection.current = null; };
  if (deck) return <section className="options-deck-workspace"><nav className="options-deck-toolbar"><button onClick={() => setDeck(false)}>← OPTIONS SHEET</button><strong>{project.name} · {title}</strong><div><button onClick={() => publish(sections)}>PUSH FULL DECK →</button><button className="solid" onClick={printDeck}>EXPORT PDF ↓</button></div></nav><DeckPages project={project} title={title} sections={sections} /></section>;
  return <section className="options-workspace">
    <header className="reference-section-head"><div><p>CLIENT · CREATIVE OPTIONS</p><h1>{title.toUpperCase()}</h1><span>Build the working options sheet, then automatically generate the client deck.</span></div><div><button onClick={() => change([...sections, { id: crypto.randomUUID(), name: "New Section", candidates: [] }])}>＋ SECTION</button><button onClick={() => setDeck(true)}>VIEW DECK ↗</button><button onClick={() => publish(sections)}>PUSH FULL DECK →</button><button className="solid" disabled={!dirty} onClick={save}>{dirty ? "SAVE CHANGES" : "SAVED"}</button></div></header>
    <div className="options-sheet-meta"><span>PROJECT</span><strong>{project.name}</strong><span>JOB</span><strong>{project.code}</strong><span>OPTIONS</span><strong>{sections.reduce((sum, section) => sum + section.candidates.length, 0)}</strong></div>
    {sections.map((section, sectionIndex) => <article className="options-section" draggable onDragStart={(event) => { draggedSection.current = section.id; event.dataTransfer.setData("text/plain", section.id); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropSection(event, section.id)} key={section.id}>
      <header><b>{String(sectionIndex + 1).padStart(2, "0")}</b><input aria-label={`Section ${sectionIndex + 1} name`} value={section.name} onChange={(event) => updateSection(section.id, { name: event.target.value })} /><span>ARTIST / TALENT OPTIONS</span><div><button onClick={() => moveSection(section.id, -1)} aria-label={`Move ${section.name} up`}>↑</button><button onClick={() => moveSection(section.id, 1)} aria-label={`Move ${section.name} down`}>↓</button><button onClick={() => publish([section])}>PUSH SECTION →</button><button onClick={() => change(sections.filter((item) => item.id !== section.id))} aria-label={`Remove ${section.name}`}>×</button></div></header>
      <div className="options-columns"><span>NAME</span><span>ROLE</span><span>AGENCY</span><span>AVAILABILITY / HOLD</span><span>RATE</span><span>STATUS</span><span>LINK</span><span>NOTES</span><span /></div>
      {section.candidates.map((candidate) => <div className="options-row" key={candidate.id}>{(["name", "role", "agency", "availability", "rate", "status", "link", "notes"] as (keyof OptionCandidate)[]).map((field) => <input key={field} value={candidate[field]} placeholder={field === "imageUrl" ? "Image URL" : field.replace(/([A-Z])/g, " $1")} onChange={(event) => updateCandidate(section.id, candidate.id, field, event.target.value)} />)}<button onClick={() => updateSection(section.id, { candidates: section.candidates.filter((item) => item.id !== candidate.id) })} aria-label={`Remove ${candidate.name || "option"}`}>×</button><label>IMAGE URL<input value={candidate.imageUrl} placeholder="https://…" onChange={(event) => updateCandidate(section.id, candidate.id, "imageUrl", event.target.value)} /></label></div>)}
      <footer><button onClick={() => updateSection(section.id, { candidates: [...section.candidates, emptyCandidate()] })}>＋ ADD OPTION</button><span>{section.candidates.length} OPTION{section.candidates.length === 1 ? "" : "S"}</span></footer>
    </article>)}
  </section>;
}

export function ClientOptionsLibrary({ title, project, shares }: { title: string; project: Project; shares: ModuleRecord[] }) {
  const published = useMemo(() => shares.filter((share) => share.data.kind?.toLowerCase() === title.toLowerCase() && share.data.snapshot).sort((a, b) => b.created_at.localeCompare(a.created_at)), [shares, title]);
  const [selectedId, setSelectedId] = useState("");
  const selected = published.find((share) => share.id === selectedId);
  const sections = selected ? parseSections(selected.data.snapshot, title === "Casting" ? "casting" : "art_buying") : [];
  if (selected) return <section className="client-options-view"><div className="client-options-actions"><button onClick={() => setSelectedId("")}>← ALL PUBLISHED DECKS</button><button onClick={printDeck}>DOWNLOAD DECK PDF ↓</button></div><DeckPages project={project} title={title} sections={sections} /></section>;
  return <section className="client-options-library"><header><div><span>PUBLISHED {title.toUpperCase()}</span><h2>OPTIONS & DECKS</h2><p>Open a full deck or a section shared by production.</p></div></header>{published.length ? <div>{published.map((share, index) => <article key={share.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{share.data.label}</strong><small>Published {share.data.date}</small></div><button onClick={() => setSelectedId(share.id)}>VIEW DECK →</button></article>)}</div> : <div className="client-empty"><strong>NO {title.toUpperCase()} OPTIONS HAVE BEEN SHARED YET</strong></div>}</section>;
}
