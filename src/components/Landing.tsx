import { useState } from "react";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { Wordmark } from "./brand";

export default function Landing() {
  const { setPatientId, go, openAuth } = useStore();
  const { isAuthenticated } = useConvexAuth();
  const ensure = useMutation(api.patients.ensureMyPatient);
  const [entering, setEntering] = useState(false);

  // Returning, signed-in user → open their own record.
  async function openMyDashboard() {
    setEntering(true);
    const pid = await ensure({});
    setPatientId(pid);
    go("home");
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Wordmark />
          <div className="flex items-center gap-3 text-sm text-ink-500">
            {isAuthenticated ? (
              <button className="btn-secondary" onClick={openMyDashboard} disabled={entering}>
                {entering ? "Opening…" : "Open dashboard"}
              </button>
            ) : (
              <>
                <button className="font-medium text-ink-700 hover:text-ink-900" onClick={() => openAuth("signIn")}>
                  Sign in
                </button>
                <button className="btn-primary" onClick={() => openAuth("signUp")}>
                  Get started
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-24">
        {/* copy */}
        <div className="animate-rise">
          <div className="eyebrow">Longitudinal health record</div>
          <h1 className="mt-3 max-w-xl text-4xl font-semibold text-ink-900 sm:text-5xl">
            Your records, unified into one health history.
          </h1>
          <p className="mt-4 max-w-md text-md text-ink-500">
            TraceHealth ingests years of scattered documents from every provider and reconstructs a
            single, source-traceable timeline — the view your patient portal never gives you.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <button className="btn-primary px-4 py-2" onClick={() => openAuth("signUp")}>
              Get started — it's free
            </button>
            <button className="btn-secondary px-4 py-2" onClick={() => openAuth("signIn")}>
              Sign in
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-400">
            <span className="mono">8 years</span>
            <Dot />
            <span className="mono">4 organizations</span>
            <Dot />
            <span className="mono">10 documents</span>
            <span className="ml-1">· demo needs no account</span>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6">
            <Feature k="One timeline" v="Every lab, visit & med across providers" />
            <Feature k="Trace to source" v="Each value links to its document + page" />
            <Feature k="Cross-record" v="Surfaces conflicts a single portal can't" />
          </dl>
        </div>

        {/* preview specimen */}
        <div className="animate-rise" style={{ animationDelay: "60ms" }}>
          <PreviewWindow />
        </div>
      </main>
    </div>
  );
}

function Dot() {
  return <span className="h-1 w-1 rounded-full bg-ink-300" />;
}

function Feature({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-ink-900">{k}</dt>
      <dd className="mt-1 text-xs leading-relaxed text-ink-500">{v}</dd>
    </div>
  );
}

// A static, real-looking product specimen — reads as "this is a serious tool".
function PreviewWindow() {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
      <div className="flex items-center gap-2 border-b border-line bg-canvas px-3.5 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="ml-2 mono text-2xs text-ink-400">tracehealth.app / sarah-williams</span>
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between">
          <div className="text-sm font-semibold">Sarah Williams</div>
          <div className="mono text-2xs text-ink-400">2018–2026</div>
        </div>

        {/* LDL feature row */}
        <div className="mt-3 rounded-lg border border-line p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-600">LDL Cholesterol</span>
            <span className="mono text-2xs text-bad">+58% since 2018</span>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <div className="mono text-2xl font-semibold text-ink-900">
              139<span className="ml-1 text-xs font-normal text-ink-400">mg/dL</span>
            </div>
            <PreviewSpark />
          </div>
          <div className="mt-1 mono text-2xs text-ink-400">104 → 171 → 139</div>
        </div>

        {/* mini rows */}
        <div className="mt-2 divide-y divide-line-soft">
          {[
            ["HbA1c", "5.7 %", "+0.6"],
            ["Weight", "184 lb", "+16"],
            ["Atorvastatin", "10 mg", "Mar 2026"],
          ].map(([a, b, c]) => (
            <div key={a} className="flex items-center justify-between py-2">
              <span className="text-xs text-ink-700">{a}</span>
              <div className="flex items-center gap-3">
                <span className="mono text-xs text-ink-900">{b}</span>
                <span className="mono text-2xs text-ink-400">{c}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-2xs text-ink-400">
          <span className="h-1.5 w-1.5 rounded-full bg-warn" />
          1 record conflict · Metformin dose
        </div>
      </div>
    </div>
  );
}

function PreviewSpark() {
  const vals = [104, 104, 117, 123, 128, 142, 158, 164, 171, 139];
  const w = 128;
  const h = 40;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * (w - 4) + 2;
    const y = h - 3 - ((v - min) / (max - min)) * (h - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={w} height={h} className="text-ink-900">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r={2.5} fill="currentColor" />
    </svg>
  );
}
