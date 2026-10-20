import Ajv from "ajv";
import schema from "./data/encpt-note.schema.json";

const ajv = new Ajv({ allErrors: true, strict: false });
const check = ajv.compile(schema);

export const pesStatement = (p) =>
  `${p.problem} related to ${p.etiology || "…"} as evidenced by ${
    p.signsSymptoms.filter(Boolean).join("; ") || "…"
  }.`;

// Chart (UI state) -> schema-shaped note
export function buildNote(c) {
  return {
    schemaVersion: "1.0",
    date: c.date,
    clinician: c.clinician,
    patient: c.patient,
    assessment: c.assessment.map(({ domain, code, term, value, unit }) => ({ domain, code, term, value, unit })),
    diagnosis: c.diagnosis.map((d) => ({
      code: d.code, problem: d.problem, etiology: d.etiology,
      signsSymptoms: d.signsSymptoms, statement: pesStatement(d),
    })),
    intervention: c.intervention.map(({ category, code, term, detail }) => ({ category, code, term, detail })),
    monitoringEvaluation: c.monitoring.map(({ domain, code, indicator, target, current }) => ({ domain, code, indicator, target, current })),
  };
}

export function validateNote(note) {
  const ok = check(note);
  const errors = ok ? [] : check.errors.map((e) => `${e.instancePath || "note"} ${e.message}`);
  return { ok, errors };
}

// Schema-shaped note -> readable ADIME text
export function noteToText(n) {
  const L = [];
  L.push("NUTRITION CARE NOTE (ADIME / eNCPT)");
  L.push(`Date: ${n.date}   Clinician: ${n.clinician || "—"}`);
  L.push(`Patient: ${n.patient.name || "—"}   MRN: ${n.patient.mrn || "—"}   Age/Sex: ${n.patient.age || "—"}/${n.patient.sex || "—"}`);
  L.push("", "A — ASSESSMENT");
  n.assessment.forEach((a) => L.push(`  • [${a.code}] ${a.term}: ${a.value}${a.unit ? " " + a.unit : ""}`));
  L.push("", "D — NUTRITION DIAGNOSIS (PES)");
  n.diagnosis.forEach((d) => L.push(`  • [${d.code}] ${d.statement}`));
  L.push("", "I — INTERVENTION");
  n.intervention.forEach((i) => L.push(`  • [${i.code}] ${i.term}: ${i.detail}`));
  L.push("", "ME — MONITORING & EVALUATION");
  n.monitoringEvaluation.forEach((m) =>
    L.push(`  • [${m.code}] ${m.indicator}: target ${m.target}${m.current ? `; current ${m.current}` : ""}`));
  return L.join("\n");
}
