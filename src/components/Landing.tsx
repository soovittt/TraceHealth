import { useState } from "react";
import { useMutation, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { Wordmark } from "./brand";

export default function Landing() {
  const { setPatientId, go, openAuth } = useStore();
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const ensure = useMutation(api.patients.ensureMyPatient);
  const [entering, setEntering] = useState(false);
  const [guesting, setGuesting] = useState(false);

  async function openMyDashboard() {
    setEntering(true);
    const pid = await ensure({});
    setPatientId(pid);
    go("home");
  }

  // Zero-typing entry: create a throwaway guest account and drop straight into
  // the app, where one click loads a full sample record.
  async function tryAsGuest() {
    setGuesting(true);
    try {
      await signIn("anonymous");
      go("home"); // the app resolver auto-creates this guest's patient
    } catch {
      setGuesting(false);
    }
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Wordmark />
          <div className="flex items-center gap-4 text-sm">
            <a href="#how" className="hidden text-ink-600 hover:text-ink-900 sm:inline">How it works</a>
            <a href="#features" className="hidden text-ink-600 hover:text-ink-900 sm:inline">Features</a>
            <a href="#trust" className="hidden text-ink-600 hover:text-ink-900 sm:inline">Security</a>
            {isAuthenticated ? (
              <button className="btn-secondary" onClick={openMyDashboard} disabled={entering}>
                {entering ? "Opening…" : "Open dashboard"}
              </button>
            ) : (
              <>
                <button className="font-medium text-ink-700 hover:text-ink-900" onClick={() => openAuth("signIn")}>Sign in</button>
                <button className="btn-primary" onClick={tryAsGuest} disabled={guesting}>{guesting ? "Setting up…" : "Try it"}</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 py-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-24">
        <div className="animate-rise">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas px-2.5 py-1 text-2xs font-medium text-ink-500">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Longitudinal health record · built on Convex
          </div>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
            Your doctors have records. You deserve a history.
          </h1>
          <p className="mt-4 max-w-md text-md text-ink-500">
            TraceHealth pulls years of scattered records from every provider and reconstructs one
            source-traceable timeline — with an AI that reasons over your data and cites every claim.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-2.5">
            <button className="btn-primary px-4 py-2" onClick={tryAsGuest} disabled={guesting}>
              {guesting ? "Setting up…" : "Try it — no signup"}
            </button>
            <button className="btn-secondary px-4 py-2" onClick={() => openAuth("signUp")}>Create an account</button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-400">
            <span>One click, no email — loads a full sample record you can explore.</span>
          </div>
          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6">
            <Feature k="One timeline" v="Every lab, visit & med across providers" />
            <Feature k="Trace to source" v="Each value links to its document" />
            <Feature k="Cross-record" v="Surfaces conflicts a portal can't" />
          </dl>
        </div>
        <div className="animate-rise" style={{ animationDelay: "60ms" }}>
          <PreviewWindow />
        </div>
      </section>

      {/* problem framing */}
      <section className="border-y border-line bg-canvas">
        <div className="mx-auto max-w-4xl px-6 py-14 text-center">
          <p className="text-lg font-medium leading-relaxed text-ink-800 sm:text-xl">
            The average patient sees <span className="text-ink-900">multiple providers across different systems</span> —
            and each one keeps only <span className="text-ink-900">its own slice</span>. No one holds the whole picture.
            <span className="text-ink-500"> Not your PCP. Not your specialist. Not you.</span>
          </p>
        </div>
      </section>

      {/* how it works */}
      <Section id="how" eyebrow="How it works" title="From scattered records to one clear history">
        <div className="grid gap-5 sm:grid-cols-3">
          <Step n="1" title="Connect" body="Link a provider over real SMART on FHIR, upload a document, or add records by hand. Sync stays fresh automatically." />
          <Step n="2" title="Normalize" body="Labs, meds, conditions & visits from every source collapse into one model — different codes for the same test become one metric." />
          <Step n="3" title="Understand" body="Read the timeline, chart any trend, resolve conflicts, and ask an AI that answers from your data and cites the source." />
        </div>
      </Section>

      {/* features */}
      <Section id="features" eyebrow="Features" title="Everything your patient portal won't give you" muted>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card icon="timeline" title="Longitudinal timeline" body="Every record, newest-first, on one thread — labs, visits, medications and diagnoses across all your providers." />
          <Card icon="trend" title="Trends with reference lines" body="Chart LDL, HbA1c, blood pressure, weight and more against clinical thresholds. Every point is clickable." />
          <Card icon="doc" title="Evidence for every number" body="Click any value to trace it back to the exact source document. Nothing is unsourced." />
          <Card icon="ai" title="Grounded AI assistant" body="Ask in plain English. Get cited answers with inline charts and a live, health-framed reasoning trace — never invented data." />
          <Card icon="warn" title="Conflict detection" body="When providers disagree — a med dose recorded two ways — TraceHealth flags it so you can reconcile." />
          <Card icon="share" title="Export & clinician share" body="Download your record as FHIR / JSON / CSV, or share a read-only, printable snapshot with any doctor." />
        </div>
      </Section>

      {/* both directions */}
      <Section eyebrow="Your data, both directions" title="It's your record — take it anywhere">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <div className="text-sm font-semibold text-ink-900">Bring data in</div>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li className="flex gap-2"><Tick /> Live FHIR sync from real providers (OAuth), refreshed every 2 hours</li>
              <li className="flex gap-2"><Tick /> AI extraction from pasted notes or text records</li>
              <li className="flex gap-2"><Tick /> Import a FHIR Bundle or JSON export — lossless round-trip</li>
              <li className="flex gap-2"><Tick /> Add a lab, med, condition or allergy by hand</li>
            </ul>
          </div>
          <div className="card p-5">
            <div className="text-sm font-semibold text-ink-900">Take data out</div>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li className="flex gap-2"><Tick /> Export the whole record as a FHIR R4 Bundle</li>
              <li className="flex gap-2"><Tick /> Download JSON or a spreadsheet-ready CSV</li>
              <li className="flex gap-2"><Tick /> Per-metric CSV for any trend</li>
              <li className="flex gap-2"><Tick /> Print or PDF a clinical snapshot, or write a summary back to your provider</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* trust */}
      <Section id="trust" eyebrow="Built for trust" title="Your health data, handled with care" muted>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card icon="lock" title="Row-level security" body="Your record is yours. Reads and writes are gated per user — no one sees your data but you and whoever you explicitly share with." />
          <Card icon="doc" title="Provenance on everything" body="Every fact carries where it came from (imported, AI-extracted, or patient-verified) and links to its source." />
          <Card icon="clock" title="Time-boxed sharing" body="Clinician links are read-only and expire in 7 days. Revoke access by letting them lapse." />
        </div>
        <p className="mt-5 text-center text-2xs text-ink-400">A hackathon prototype — not a medical device. No diagnosis, prescription, or treatment advice.</p>
      </Section>

      {/* FAQ */}
      <Section eyebrow="FAQ" title="Questions, answered">
        <div className="mx-auto max-w-2xl divide-y divide-line">
          <Faq q="Where does the data come from?" a="Real providers over SMART on FHIR (the SMART Health IT sandbox is pre-populated for demos), plus anything you upload, import, or enter yourself." />
          <Faq q="Does the AI make up numbers?" a="No. It only answers from your stored records, cites the source document for each claim, and renders charts from the actual data — never model-invented values." />
          <Faq q="Can my doctor actually use it?" a="Yes — share a read-only snapshot link (no login), let them print it to PDF, or write an AI summary back into their FHIR system." />
          <Faq q="Can I get my data out?" a="Any time — export the full record as a FHIR Bundle, JSON, or CSV. It's your history to keep." />
        </div>
      </Section>

      {/* CTA */}
      <section className="border-t border-line bg-canvas">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold text-ink-900 sm:text-3xl">Start building your health history</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-500">Create a free account, connect a provider, and see years of records reconstruct into one timeline.</p>
          <div className="mt-6 flex justify-center gap-2.5">
            <button className="btn-primary px-4 py-2" onClick={tryAsGuest} disabled={guesting}>{guesting ? "Setting up…" : "Try it — no signup"}</button>
            <button className="btn-secondary px-4 py-2" onClick={() => openAuth("signIn")}>Sign in</button>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-2xs text-ink-400 sm:flex-row">
          <Wordmark />
          <span>Built for the Convex All Gas Hackathon · Convex · OpenAI · Firecrawl · AgentMail</span>
          <span>Not a medical device</span>
        </div>
      </footer>
    </div>
  );
}

function Section({ id, eyebrow, title, children, muted = false }: { id?: string; eyebrow: string; title: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <section id={id} className={muted ? "bg-canvas" : ""}>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="eyebrow">{eyebrow}</div>
        <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">{title}</h2>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="card p-5">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-fg">{n}</span>
      <div className="mt-3 text-sm font-semibold text-ink-900">{title}</div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{body}</p>
    </div>
  );
}

function Card({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="card p-5">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-accent-soft text-accent">
        <Icon name={icon} />
      </span>
      <div className="mt-3 text-sm font-semibold text-ink-900">{title}</div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{body}</p>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="py-4">
      <div className="text-sm font-medium text-ink-900">{q}</div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{a}</p>
    </div>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
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

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    timeline: "M3 2.5v11M3 5h8M3 8.5h5.5M3 12h7",
    trend: "M2.5 11 6 7.5l2.5 2.5L13 5M2.5 13.5h11",
    doc: "M4 2h6l3 3v9H4zM10 2v3h3M6 8h5M6 11h5",
    ai: "M8 2l1.1 3.1L12.2 6.2 9.1 7.3 8 10.4 6.9 7.3 3.8 6.2 6.9 5.1z",
    warn: "M8 2.5 14 13H2zM8 6.5v3.5M8 11.5h.01",
    share: "M11 5.5 6 8m5 2.5L6 8m0 0a2 2 0 1 0-2 0m8-4.5a1.5 1.5 0 1 0 0 .01M12 12.5a1.5 1.5 0 1 0 0 .01",
    lock: "M4.5 7V5a3.5 3.5 0 0 1 7 0v2M3.5 7h9v6.5h-9z",
    clock: "M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM8 4.5V8l2.5 1.5",
  };
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] ?? paths.doc} />
    </svg>
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
        <span className="ml-2 mono text-2xs text-ink-400">tracehealth.app / your-record</span>
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between">
          <div className="text-sm font-semibold">Your health record</div>
          <div className="mono text-2xs text-ink-400">2018–2026</div>
        </div>
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
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r={2.5} fill="currentColor" />
    </svg>
  );
}
