import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import EvidencePanel from "./EvidencePanel";
import { Wordmark } from "./brand";
import { fmtDate, fmtNum } from "../lib/format";

export default function DoctorView({ preview = false }: { preview?: boolean }) {
  const { patientId, shareToken, go, openAuth, showEvidence } = useStore();
  const { isAuthenticated } = useConvexAuth();
  const share = useQuery(api.health.getShare, shareToken ? { token: shareToken } : "skip");
  const resolvedId = preview ? patientId : share?.patientId ?? null;
  const snap = useQuery(
    api.health.doctorSnapshot,
    resolvedId ? { patientId: resolvedId, shareToken: shareToken ?? undefined } : "skip",
  );

  if (shareToken && share === null) return <Centered>This share link is invalid.</Centered>;
  if (shareToken && share?.expired) return <Centered>This share link has expired.</Centered>;
  // Preview requires a signed-in patient. Don't hang on a hard-refresh when unauthenticated.
  if (preview && !patientId && !isAuthenticated) {
    return (
      <Centered>
        <div className="text-center">
          <p>Sign in to preview your clinical snapshot.</p>
          <button className="btn-primary mt-3" onClick={() => openAuth("signIn")}>Sign in</button>
        </div>
      </Centered>
    );
  }
  if (!snap) return <Centered>Loading clinical snapshot…</Centered>;

  return (
    <div className="min-h-full">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <Wordmark />
            <span className="hidden text-2xs text-ink-400 sm:inline">/ Clinical snapshot</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary no-print gap-1.5 px-2.5 py-1 text-xs" onClick={() => window.print()} title="Print or save as PDF">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6V2.5h8V6M4 12H2.5V6.5h11V12H12M4 9.5h8V14H4z" />
              </svg>
              Print / PDF
            </button>
            {preview ? (
              <button className="btn-ghost no-print text-xs" onClick={() => go("home")}>← Back to record</button>
            ) : (
              <span className="no-print text-2xs text-ink-400">Shared by patient · read-only</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-7">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink-900">{snap.patient.name}</h1>
            <div className="mono mt-0.5 text-xs text-ink-400">
              {snap.patient.age} yr · {snap.patient.recordsFrom} · {snap.orgs.length} organizations
            </div>
          </div>
        </div>

        {snap.conflicts.length > 0 && (
          <div className="mt-4 rounded-md border border-warn-line bg-warn-soft px-3.5 py-3">
            <div className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-warn">
              <span className="h-1.5 w-1.5 rounded-full bg-warn" /> Records requiring attention
            </div>
            {snap.conflicts.map((c: any) => (
              <div key={c._id} className="mt-1.5 text-sm text-ink-800">
                <span className="font-medium">{title(c.kind)}:</span> {c.label} — {c.options.map((o: any) => `${o.source} ${o.value}`).join(" vs ")}
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Panel title="Current medications">
            {snap.activeMeds.map((m: any, i: number) => (
              <Row key={i} onClick={() => showEvidence({ documentId: m.documentId, page: m.page })} left={m.name} right={m.dose ? `${m.dose} ${m.doseUnit}` : ""} />
            ))}
          </Panel>
          <Panel title="Active conditions">
            {snap.activeConds.map((c: any, i: number) => (
              <Row key={i} onClick={() => showEvidence({ documentId: c.documentId, page: c.page })} left={c.name} />
            ))}
          </Panel>
          <Panel title="Allergies">
            {snap.allergies.length ? snap.allergies.map((a: any, i: number) => (
              <Row key={i} onClick={() => showEvidence({ documentId: a.documentId, page: a.page })} left={a.substance} />
            )) : <div className="py-1.5 text-sm text-ink-400">None recorded</div>}
          </Panel>
          <Panel title="Care organizations">
            {snap.orgs.map((o: string, i: number) => <Row key={i} left={o} />)}
          </Panel>
        </div>

        <Panel title="Significant longitudinal changes" className="mt-3">
          <div className="grid gap-2.5 pt-1 sm:grid-cols-3">
            {snap.trends.map((t: any) => (
              <div key={t.code} className="rounded-md border border-line p-2.5">
                <div className="text-2xs font-medium text-ink-500">{t.label}</div>
                <div className="mt-1 flex items-baseline gap-1 mono text-sm">
                  <span className="text-ink-400">{fmtNum(t.first)}</span>
                  <span className="text-ink-300">→</span>
                  <span className="font-medium text-bad">{fmtNum(t.peak)}</span>
                </div>
                <div className="mono text-2xs text-ink-400">latest {fmtNum(t.last)} {t.unit}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Recent history" className="mt-3">
          <ol className="space-y-1.5 pt-1">
            {snap.recent.map((r: any, i: number) => (
              <li key={i} className="flex gap-3">
                <span className="mono w-[70px] shrink-0 text-2xs text-ink-400">{fmtDate(r.date)}</span>
                <button className="text-left text-sm text-ink-700 hover:text-ink-900" onClick={() => r.documentId && showEvidence({ documentId: r.documentId, page: r.page })}>
                  {r.label}
                </button>
              </li>
            ))}
          </ol>
        </Panel>

        <p className="mt-7 text-center text-2xs text-ink-400">Every item links to its source record.</p>
      </main>

      <EvidencePanel />
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`card p-3.5 ${className}`}>
      <div className="eyebrow">{title}</div>
      <div className="mt-1.5 divide-y divide-line-soft">{children}</div>
    </div>
  );
}

function Row({ left, right, onClick }: { left: string; right?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick} className="flex w-full items-center justify-between py-1.5 text-left disabled:cursor-default">
      <span className="text-sm text-ink-800">{left}</span>
      {right !== undefined && <span className="mono text-xs text-ink-500">{right}</span>}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-screen place-items-center text-sm text-ink-400">{children}</div>;
}

function title(kind: string) {
  return kind === "medication_dose" ? "Medication discrepancy" : kind === "allergy" ? "Allergy conflict" : "Duplicate condition";
}
