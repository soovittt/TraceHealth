import { useEffect, useLayoutEffect, useState } from "react";
import { useStore } from "../lib/store";

// A lightweight product tour: spotlights a real UI element (by data-tour id) and
// shows a "Step X of N" tooltip with Back / Next / Skip. Steps with target=null
// render a centered card (intro/outro). Robust to layout — recomputes on resize.

// `nav` navigates the app to that view when the step opens — so the tour walks
// through the REAL screens a person uses, not just static coachmarks.
type Step = { target: string | null; title: string; body: string; nav?: "home" | "import" | "integrations" };

const STEPS: Step[] = [
  { target: null, title: "Welcome to TraceHealth 👋", body: "Your whole health history in one record. Quick 30-second tour — then you'll bring in your first record.", nav: "home" },
  { target: "nav-home", title: "Your Overview", body: "Your dashboard — what needs attention, key metrics, recent activity. It fills in once you add data." },
  { target: "nav-metric", title: "Trends", body: "Every lab becomes a real trend line over the years, flagged when it's out of range." },
  { target: "nav-ask", title: "Ask the AI", body: "Ask anything about your health — grounded in your record, cited to sources, even live drug prices." },
  { target: "dropzone", title: "Add your own data", body: "Drop a PDF, snap a photo of a lab report, or paste text — the AI reads it and adds it to your record.", nav: "import" },
  { target: "connect-btn", title: "Or connect a provider", body: "Click Connect, log into the provider over SMART on FHIR and authorize — your full record syncs in (labs, meds, conditions).", nav: "integrations" },
  { target: "share", title: "Share with a clinician", body: "Hand any doctor a clean, read-only snapshot with one link — no account on their end." },
  { target: "connect-btn", title: "You're all set 🎉", body: "Bring in a record now — click Connect and authorize, or add your own data. Then try Ask AI.", nav: "integrations" },
];

export default function Tour() {
  const { tourOpen, endTour, go } = useStore();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  // Reset to first step whenever the tour (re)opens.
  useEffect(() => { if (tourOpen) setI(0); }, [tourOpen]);

  // Drive the app to this step's screen so the tour walks the real flow.
  useEffect(() => {
    if (!tourOpen) return;
    if (step.nav) go(step.nav);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourOpen, i]);

  useLayoutEffect(() => {
    if (!tourOpen) return;
    const measure = () => {
      if (!step.target) { setRect(null); return; }
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    };
    measure();
    window.addEventListener("resize", measure);
    const t = setInterval(measure, 400); // follow layout shifts (e.g. sidebar)
    return () => { window.removeEventListener("resize", measure); clearInterval(t); };
  }, [tourOpen, i, step.target]);

  if (!tourOpen) return null;

  // Tooltip position: near the target (below if room, else above), clamped;
  // centered when there's no target.
  const W = 300;
  let ttStyle: React.CSSProperties;
  if (rect) {
    const below = rect.bottom + 12;
    const wantAbove = below + 190 > window.innerHeight;
    const top = wantAbove ? Math.max(12, rect.top - 190) : below;
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - W - 12);
    ttStyle = { position: "fixed", top, left, width: W };
  } else {
    ttStyle = { position: "fixed", top: "50%", left: "50%", width: W, transform: "translate(-50%,-50%)" };
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {/* dim + spotlight hole (box-shadow trick) */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-lg border-2 border-accent transition-all duration-200"
          style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/55" />
      )}

      {/* tooltip */}
      <div style={ttStyle} className="rounded-xl border border-line bg-surface p-4 shadow-pop animate-fade-in">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-medium uppercase tracking-wide text-ink-400">Step {i + 1} of {STEPS.length}</span>
          <button className="text-2xs text-ink-400 hover:text-ink-700" onClick={endTour}>Skip tutorial</button>
        </div>
        <div className="mt-1.5 text-sm font-semibold text-ink-900">{step.title}</div>
        <div className="mt-1 text-xs leading-relaxed text-ink-500">{step.body}</div>
        <div className="mt-3.5 flex items-center justify-between">
          {/* progress dots */}
          <div className="flex gap-1">
            {STEPS.map((_, k) => <span key={k} className={`h-1.5 w-1.5 rounded-full ${k === i ? "bg-accent" : "bg-line-strong"}`} />)}
          </div>
          <div className="flex gap-2">
            {i > 0 && <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setI((v) => v - 1)}>Back</button>}
            <button className="btn-primary px-3 py-1 text-xs" onClick={() => (last ? endTour() : setI((v) => v + 1))}>{last ? "Done" : "Next"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
