import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { fmtDate } from "../lib/format";

export default function Conflicts() {
  const { patientId, showEvidence } = useStore();
  const conflicts = useQuery(api.health.listConflicts, patientId ? { patientId } : "skip");
  const meds = useQuery(api.health.listMedications, patientId ? { patientId } : "skip");
  const missing = useQuery(api.health.listMissing, patientId ? { patientId } : "skip");
  const resolve = useMutation(api.mutations.resolveConflict);
  const verify = useMutation(api.mutations.verifyMedication);

  if (!conflicts) return <div className="mx-auto h-64 max-w-3xl animate-pulse rounded-lg bg-line-soft" />;
  const unverified = (meds ?? []).filter((m: any) => m.provenance !== "patient_verified");

  return (
    <div className="mx-auto max-w-3xl animate-fade-in space-y-9">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Review</h1>
        <p className="mt-1 text-sm text-ink-500">Combining records across providers surfaces what a single portal can’t.</p>

        <div className="eyebrow mt-6 mb-2">Record conflicts</div>
        <div className="space-y-3">
          {conflicts.map((c: any) => (
            <div key={c._id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-warn" />
                    <span className="text-2xs font-semibold uppercase tracking-wide text-warn">{label(c.kind)}</span>
                  </div>
                  <div className="mt-1.5 text-md font-medium text-ink-900">{c.label}</div>
                  {c.detail && <div className="text-sm text-ink-500">{c.detail}</div>}
                </div>
                {c.status === "resolved" && (
                  <span className="flex items-center gap-1.5 rounded-md border border-line bg-good-soft px-2 py-1 text-2xs font-medium text-good-ink">
                    Resolved · {c.resolvedValue}
                  </span>
                )}
              </div>

              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {c.options.map((o: any, i: number) => (
                  <div key={i} className="rounded-md border border-line p-3">
                    <div className="eyebrow">{o.source}</div>
                    <div className="mt-1 mono text-sm font-medium text-ink-900">{o.value}</div>
                    <div className="mt-2.5 flex gap-2">
                      {c.status !== "resolved" && (
                        <button className="btn-primary px-2.5 py-1 text-xs" onClick={() => resolve({ conflictId: c._id, value: o.value })}>Mark correct</button>
                      )}
                      {o.documentId && (
                        <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => showEvidence({ documentId: o.documentId })}>Source</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="eyebrow mb-2">Verify medications</div>
        <div className="card divide-y divide-line-soft">
          {unverified.map((m: any) => (
            <div key={m._id} className="flex items-center justify-between px-3.5 py-2.5">
              <div>
                <div className="text-sm text-ink-800">{m.name} {m.dose ? <span className="mono text-ink-500">{m.dose} {m.doseUnit}</span> : ""} still active?</div>
                <div className="mono text-2xs text-ink-400">last recorded {m.startDate ? fmtDate(m.startDate) : "—"}</div>
              </div>
              <div className="flex gap-1.5">
                <button className="btn-primary px-2.5 py-1 text-xs" onClick={() => verify({ medicationId: m._id, active: true })}>Yes</button>
                <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => verify({ medicationId: m._id, active: false })}>No</button>
              </div>
            </div>
          ))}
          {unverified.length === 0 && <div className="px-3.5 py-3 text-sm text-ink-400">All medications verified.</div>}
        </div>
      </div>

      {(missing ?? []).length > 0 && (
        <div>
          <div className="eyebrow mb-2">Missing from history</div>
          <div className="space-y-3">
            {missing!.map((mr: any) => (
              <div key={mr._id} className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-md font-medium text-ink-900">{mr.label}</div>
                    <div className="text-sm text-ink-500">{mr.org}{mr.date ? ` · ${fmtDate(mr.date)}` : ""}</div>
                  </div>
                  <button className="btn-ghost text-xs" onClick={() => showEvidence({ documentId: mr.referencedInDocumentId })}>Reference</button>
                </div>
                <div className="mt-3 rounded-md border border-line bg-canvas px-3 py-2.5 text-sm text-ink-500 opacity-70">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-medium text-ink-700">How to obtain this record</span>
                    <span className="tag">Coming soon</span>
                  </div>
                  Firecrawl will look up {mr.org}’s records-request process and TraceHealth will prepare
                  the request for you.
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function label(kind: string) {
  return kind === "medication_dose" ? "Medication discrepancy" : kind === "allergy" ? "Allergy conflict" : "Duplicate condition";
}
