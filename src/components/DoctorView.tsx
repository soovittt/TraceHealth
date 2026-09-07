import { useState, useEffect } from "react";
import { useQuery, useAction, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import EvidencePanel from "./EvidencePanel";
import DoctorAssistant from "./DoctorAssistant";
import { Markdown } from "./markdown";
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
  const signals = useQuery(
    api.signals.getSignals,
    resolvedId ? { patientId: resolvedId, shareToken: shareToken ?? undefined } : "skip",
  );
  const genBrief = useAction(api.insights.clinicalBrief);
  const [brief, setBrief] = useState<{ markdown: string; citations: any[] } | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  // A share token scopes the doctor chat to ONLY this record. In the real shared
  // link it's the URL token; in owner-preview we mint one so the chat works too.
  const createShare = useMutation(api.mutations.createShare);
  const [chatToken, setChatToken] = useState<string | null>(shareToken ?? null);
  const [chatOpen, setChatOpen] = useState(true);
  useEffect(() => {
    if (shareToken) { setChatToken(shareToken); return; }
    if (preview && resolvedId && !chatToken) createShare({ patientId: resolvedId }).then((t) => setChatToken(t)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareToken, preview, resolvedId]);

  async function makeBrief() {
    if (!resolvedId) return;
    setBriefLoading(true);
    try {
      const r = await genBrief({ patientId: resolvedId, shareToken: shareToken ?? undefined });
      if (r) setBrief(r);
    } finally {
      setBriefLoading(false);
    }
  }

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

  const highFlags = (signals ?? []).filter((s: any) => s.severity === "high");

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <header className="shrink-0 border-b border-line bg-surface">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-2.5">
            <Wordmark />
            <span className="hidden text-2xs text-ink-400 sm:inline">/ Clinical snapshot</span>
          </div>
          <div className="flex items-center gap-2">
            {chatToken && (
              <button className={`btn-ghost no-print gap-1.5 px-2.5 py-1 text-xs ${chatOpen ? "bg-line-soft text-ink-900" : ""}`} onClick={() => setChatOpen((v) => !v)}>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-accent" fill="currentColor"><path d="M8 1.5l1.2 3.3 3.3 1.2-3.3 1.2L8 10.5 6.8 7.2 3.5 6l3.3-1.2z" /></svg>
                {chatOpen ? "Hide AI" : "Ask AI"}
              </button>
            )}
            <button className="btn-secondary no-print gap-1.5 px-2.5 py-1 text-xs" onClick={() => window.print()} title="Print or save as PDF">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6V2.5h8V6M4 12H2.5V6.5h11V12H12M4 9.5h8V14H4z" />
              </svg>
              Print / PDF
            </button>
            {preview ? (
              <button className="btn-ghost no-print text-xs" onClick={() => go("home")}>← Back</button>
            ) : (
              <span className="no-print text-2xs text-ink-400">Shared · read-only</span>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* clinical snapshot */}
        <main className="min-w-0 flex-1 overflow-auto px-6 py-5">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-baseline justify-between">
              <h1 className="text-lg font-semibold text-ink-900">{snap.patient.name}</h1>
              <div className="mono text-2xs text-ink-400">{snap.patient.age} yr · {snap.patient.recordsFrom} · {snap.orgs.length} orgs</div>
            </div>

            {/* #47 safety banner */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-bad/30 bg-bad-soft px-3 py-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-bad-ink">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2.5 14 13H2zM8 6.5v3.5M8 11.5h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {snap.allergies.length ? `Allergies: ${snap.allergies.map((a: any) => a.substance).join(", ")}` : "No known allergies"}
              </span>
              {highFlags.map((s: any) => <span key={s.id} className="text-xs text-bad-ink">· {s.title}</span>)}
            </div>

            {/* #48 SBAR brief */}
            <div className="mt-2.5 card p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-accent" fill="currentColor"><path d="M8 1.5l1.2 3.3 3.3 1.2-3.3 1.2L8 10.5 6.8 7.2 3.5 6l3.3-1.2z" /></svg>
                  <span className="eyebrow">AI clinical brief · SBAR</span>
                </div>
                {!brief && (
                  <button className="btn-secondary no-print px-2.5 py-1 text-xs" onClick={makeBrief} disabled={briefLoading}>{briefLoading ? "Generating…" : "Generate brief"}</button>
                )}
              </div>
              {brief ? (
                <div className="mt-2 text-sm text-ink-800">
                  <Markdown text={brief.markdown} />
                  {brief.citations?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line-soft pt-2">
                      {brief.citations.map((c: any, i: number) => (
                        <button key={i} onClick={() => showEvidence({ documentId: c.documentId })} className="rounded border border-line bg-canvas px-1.5 py-0.5 text-2xs text-ink-500 hover:text-ink-800">Source {i + 1}</button>
                      ))}
                    </div>
                  )}
                  <div className="mt-1.5 text-2xs text-ink-400">AI-generated · for triage · not a diagnosis</div>
                </div>
              ) : (
                <p className="mt-1 text-xs text-ink-400">A situation → background → assessment → review summary, generated from this record.</p>
              )}
            </div>

            {snap.conflicts.length > 0 && (
              <div className="mt-2.5 rounded-md border border-warn-line bg-warn-soft px-3 py-2.5">
                <div className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wide text-warn">
                  <span className="h-1.5 w-1.5 rounded-full bg-warn" /> Records requiring attention
                </div>
                {snap.conflicts.map((c: any) => (
                  <div key={c._id} className="mt-1 text-sm text-ink-800"><span className="font-medium">{title(c.kind)}:</span> {c.label} — {c.options.map((o: any) => `${o.source} ${o.value}`).join(" vs ")}</div>
                ))}
              </div>
            )}

            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
              <Panel title="Current medications">
                {snap.activeMeds.map((m: any, i: number) => <Row key={i} onClick={() => showEvidence({ documentId: m.documentId, page: m.page })} left={m.name} right={m.dose ? `${m.dose} ${m.doseUnit}` : ""} />)}
              </Panel>
              <Panel title="Active conditions">
                {snap.activeConds.map((c: any, i: number) => <Row key={i} onClick={() => showEvidence({ documentId: c.documentId, page: c.page })} left={c.name} />)}
              </Panel>
              <Panel title="Allergies">
                {snap.allergies.length ? snap.allergies.map((a: any, i: number) => <Row key={i} onClick={() => showEvidence({ documentId: a.documentId, page: a.page })} left={a.substance} />) : <div className="py-1.5 text-sm text-ink-400">None recorded</div>}
              </Panel>
              <Panel title="Care organizations">
                {snap.orgs.map((o: string, i: number) => <Row key={i} left={o} />)}
              </Panel>
            </div>

            <Panel title="Significant longitudinal changes" className="mt-2.5">
              <div className="grid gap-2 pt-1 sm:grid-cols-3">
                {snap.trends.map((t: any) => (
                  <div key={t.code} className="rounded-md border border-line p-2">
                    <div className="text-2xs font-medium text-ink-500">{t.label}</div>
                    <div className="mt-0.5 flex items-baseline gap-1 mono text-sm">
                      <span className="text-ink-400">{fmtNum(t.first)}</span><span className="text-ink-300">→</span><span className="font-medium text-bad">{fmtNum(t.peak)}</span>
                    </div>
                    <div className="mono text-2xs text-ink-400">latest {fmtNum(t.last)} {t.unit}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Recent history" className="mt-2.5">
              <ol className="space-y-1 pt-1">
                {snap.recent.map((r: any, i: number) => (
                  <li key={i} className="flex gap-3">
                    <span className="mono w-[64px] shrink-0 text-2xs text-ink-400">{fmtDate(r.date)}</span>
                    <button className="text-left text-sm text-ink-700 hover:text-ink-900" onClick={() => r.documentId && showEvidence({ documentId: r.documentId, page: r.page })}>{r.label}</button>
                  </li>
                ))}
              </ol>
            </Panel>

            <p className="mt-5 text-center text-2xs text-ink-400">Every item links to its source record.</p>
          </div>
        </main>

        {/* read-only, share-scoped clinician chat */}
        {chatToken && chatOpen && (
          <aside className="no-print flex w-[360px] shrink-0 flex-col border-l border-line bg-surface">
            <DoctorAssistant token={chatToken} />
          </aside>
        )}
      </div>

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
