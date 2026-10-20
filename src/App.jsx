import { useMemo, useState } from "react";
import terms from "./data/encpt-terms.json";
import { buildNote, noteToText, pesStatement, validateNote } from "./note";
import "./styles.css";

const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().slice(0, 10);
const STEPS = [
  { key: "assessment", label: "Assessment" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "intervention", label: "Intervention" },
  { key: "monitoring", label: "Monitoring & evaluation" },
];

/* Two linked selects: domain -> term */
function TermPicker({ domains, domainCode, termCode, onChange }) {
  const domain = domains.find((d) => d.code === domainCode);
  return (
    <div className="row">
      <label>Domain
        <select value={domainCode} onChange={(e) => onChange(e.target.value, "")}>
          <option value="">Select…</option>
          {domains.map((d) => <option key={d.code} value={d.code}>{d.code} · {d.name}</option>)}
        </select>
      </label>
      <label>Term
        <select value={termCode} disabled={!domain} onChange={(e) => onChange(domainCode, e.target.value)}>
          <option value="">Select…</option>
          {domain?.terms.map((t) => <option key={t.code} value={t.code}>{t.code} · {t.name}</option>)}
        </select>
      </label>
    </div>
  );
}

const getTerm = (domains, dc, tc) => domains.find((d) => d.code === dc)?.terms.find((t) => t.code === tc);

function Entries({ items, render, onRemove, empty }) {
  if (!items.length) return <p className="empty">{empty}</p>;
  return (
    <ul className="entries">
      {items.map((it) => (
        <li key={it.id}>
          <div>{render(it)}</div>
          <button className="link" onClick={() => onRemove(it.id)}>Remove</button>
        </li>
      ))}
    </ul>
  );
}

function AssessmentStep({ items, add, remove }) {
  const [d, setD] = useState({ domain: "", term: "", value: "" });
  const t = getTerm(terms.assessment, d.domain, d.term);
  const submit = () => {
    add({ id: uid(), domain: d.domain, code: t.code, term: t.name, value: d.value.trim(), unit: t.unit });
    setD({ ...d, term: "", value: "" });
  };
  return (
    <>
      <TermPicker domains={terms.assessment} domainCode={d.domain} termCode={d.term}
        onChange={(domain, term) => setD({ ...d, domain, term })} />
      <div className="row">
        <label>Finding{t?.unit && ` (${t.unit})`}
          <input value={d.value} onChange={(e) => setD({ ...d, value: e.target.value })} placeholder="e.g. 82" />
        </label>
        <button className="primary" disabled={!t || !d.value.trim()} onClick={submit}>Add finding</button>
      </div>
      <Entries items={items} onRemove={remove} empty="No findings yet. Pick a domain and term to record one."
        render={(a) => <><b>{a.term}</b> <span className="code">{a.code}</span><br />{a.value} {a.unit}</>} />
    </>
  );
}

function DiagnosisStep({ items, add, remove }) {
  const blank = { domain: "", term: "", etiology: "", sign: "", signs: [] };
  const [d, setD] = useState(blank);
  const t = getTerm(terms.diagnosis, d.domain, d.term);
  const addSign = () => d.sign.trim() && setD({ ...d, sign: "", signs: [...d.signs, d.sign.trim()] });
  const ready = t && d.etiology.trim() && d.signs.length;
  const submit = () => {
    add({ id: uid(), code: t.code, problem: t.name, etiology: d.etiology.trim(), signsSymptoms: d.signs });
    setD(blank);
  };
  return (
    <>
      <TermPicker domains={terms.diagnosis} domainCode={d.domain} termCode={d.term}
        onChange={(domain, term) => setD({ ...d, domain, term })} />
      <label>Etiology (related to)
        <input value={d.etiology} onChange={(e) => setD({ ...d, etiology: e.target.value })}
          placeholder="e.g. limited access to healthy foods" />
      </label>
      <div className="row">
        <label>Sign or symptom (as evidenced by)
          <input value={d.sign} onChange={(e) => setD({ ...d, sign: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && addSign()} placeholder="e.g. BMI 32 kg/m²" />
        </label>
        <button onClick={addSign} disabled={!d.sign.trim()}>Add sign</button>
      </div>
      {d.signs.length > 0 && <p className="chips">{d.signs.map((s, i) => <span key={i}>{s}</span>)}</p>}
      {t && <p className="pes"><b>PES preview:</b> {pesStatement({ problem: t.name, etiology: d.etiology, signsSymptoms: d.signs })}</p>}
      <button className="primary" disabled={!ready} onClick={submit}>Add PES statement</button>
      <Entries items={items} onRemove={remove} empty="No diagnoses yet. A PES statement needs a problem, an etiology and at least one sign."
        render={(x) => <><span className="code">{x.code}</span><br />{pesStatement(x)}</>} />
    </>
  );
}

function InterventionStep({ items, add, remove }) {
  const [d, setD] = useState({ domain: "", term: "", detail: "" });
  const t = getTerm(terms.intervention, d.domain, d.term);
  return (
    <>
      <TermPicker domains={terms.intervention} domainCode={d.domain} termCode={d.term}
        onChange={(domain, term) => setD({ ...d, domain, term })} />
      <label>Details and goals
        <textarea rows={3} value={d.detail} onChange={(e) => setD({ ...d, detail: e.target.value })}
          placeholder="e.g. 1,800 kcal plan, 3 meals + 2 snacks" />
      </label>
      <button className="primary" disabled={!t || !d.detail.trim()}
        onClick={() => { add({ id: uid(), category: d.domain, code: t.code, term: t.name, detail: d.detail.trim() }); setD({ ...d, term: "", detail: "" }); }}>
        Add intervention
      </button>
      <Entries items={items} onRemove={remove} empty="No interventions yet."
        render={(i) => <><b>{i.term}</b> <span className="code">{i.code}</span><br />{i.detail}</>} />
    </>
  );
}

function MonitoringStep({ items, add, remove }) {
  const [d, setD] = useState({ domain: "", term: "", target: "", current: "" });
  const outcomes = terms.assessment.filter((x) => x.code !== "CH"); // outcome indicators come from FH/AD/BD/PD
  const t = getTerm(outcomes, d.domain, d.term);
  return (
    <>
      <TermPicker domains={outcomes} domainCode={d.domain} termCode={d.term}
        onChange={(domain, term) => setD({ ...d, domain, term })} />
      <div className="row">
        <label>Target{t?.unit && ` (${t.unit})`}
          <input value={d.target} onChange={(e) => setD({ ...d, target: e.target.value })} placeholder="e.g. < 7" />
        </label>
        <label>Current (optional)
          <input value={d.current} onChange={(e) => setD({ ...d, current: e.target.value })} placeholder="e.g. 8.1" />
        </label>
      </div>
      <button className="primary" disabled={!t || !d.target.trim()}
        onClick={() => { add({ id: uid(), domain: d.domain, code: t.code, indicator: t.name, target: d.target.trim(), current: d.current.trim() }); setD({ ...d, term: "", target: "", current: "" }); }}>
        Add indicator
      </button>
      <Entries items={items} onRemove={remove} empty="No indicators yet."
        render={(m) => <><b>{m.indicator}</b> <span className="code">{m.code}</span><br />Target {m.target}{m.current && ` · current ${m.current}`}</>} />
    </>
  );
}

export default function App() {
  const [step, setStep] = useState("assessment");
  const [chart, setChart] = useState({
    date: today(), clinician: "", patient: { name: "", mrn: "", age: "", sex: "" },
    assessment: [], diagnosis: [], intervention: [], monitoring: [],
  });
  const [copied, setCopied] = useState(false);

  const add = (k) => (item) => setChart((c) => ({ ...c, [k]: [...c[k], item] }));
  const remove = (k) => (id) => setChart((c) => ({ ...c, [k]: c[k].filter((x) => x.id !== id) }));
  const setPatient = (f, v) => setChart((c) => ({ ...c, patient: { ...c.patient, [f]: v } }));

  const note = useMemo(() => buildNote(chart), [chart]);
  const { ok, errors } = useMemo(() => validateNote(note), [note]);
  const text = useMemo(() => noteToText(note), [note]);

  const copy = async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(note, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `encpt-note-${note.patient.mrn || "draft"}.json` });
    a.click(); URL.revokeObjectURL(url);
  };

  const props = { assessment: AssessmentStep, diagnosis: DiagnosisStep, intervention: InterventionStep, monitoring: MonitoringStep };
  const Step = props[step];

  return (
    <div className="app">
      <header>
        <h1>Nutrition care note</h1>
        <p>Chart with standardized eNCPT terms. Every entry is picked from a term list, so notes stay consistent and machine-readable.</p>
      </header>

      <section className="panel patient">
        <label>Patient name<input value={chart.patient.name} onChange={(e) => setPatient("name", e.target.value)} /></label>
        <label>MRN<input value={chart.patient.mrn} onChange={(e) => setPatient("mrn", e.target.value)} /></label>
        <label>Age<input value={chart.patient.age} onChange={(e) => setPatient("age", e.target.value)} /></label>
        <label>Sex
          <select value={chart.patient.sex} onChange={(e) => setPatient("sex", e.target.value)}>
            <option value="">—</option><option>Female</option><option>Male</option><option>Other</option>
          </select>
        </label>
        <label>Clinician<input value={chart.clinician} onChange={(e) => setChart({ ...chart, clinician: e.target.value })} /></label>
        <label>Date<input type="date" value={chart.date} onChange={(e) => setChart({ ...chart, date: e.target.value })} /></label>
      </section>

      <main>
        <nav className="steps" aria-label="ADIME steps">
          {STEPS.map((s) => (
            <button key={s.key} className={step === s.key ? "on" : ""} onClick={() => setStep(s.key)}>
              {s.label} <span className="count">{chart[s.key].length}</span>
            </button>
          ))}
        </nav>

        <section className="panel editor"><Step items={chart[step]} add={add(step)} remove={remove(step)} /></section>

        <aside className="panel note">
          <div className="note-head">
            <h2>Generated note</h2>
            <span className={ok ? "badge ok" : "badge warn"}>{ok ? "Schema valid" : `${errors.length} to fix`}</span>
          </div>
          <pre>{text}</pre>
          {!ok && <details><summary>What is missing</summary><ul>{errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}</ul></details>}
          <div className="row">
            <button onClick={copy}>{copied ? "Copied" : "Copy note"}</button>
            <button className="primary" onClick={download} disabled={!ok}>Download JSON</button>
          </div>
        </aside>
      </main>
    </div>
  );
}
