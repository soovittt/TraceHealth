const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function fmtMonthYear(ts: number): string {
  const d = new Date(ts);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function year(ts: number): number {
  return new Date(ts).getUTCFullYear();
}

export function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function provenanceLabel(p: string): { label: string; dot: string } {
  switch (p) {
    case "imported":
      return { label: "Imported", dot: "bg-ink-300" };
    case "ai_extracted":
      return { label: "AI extracted", dot: "bg-accent" };
    case "patient_verified":
      return { label: "Patient verified", dot: "bg-good" };
    case "clinician_verified":
      return { label: "Clinician verified", dot: "bg-accent" };
    default:
      return { label: p, dot: "bg-ink-300" };
  }
}
