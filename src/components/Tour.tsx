import { useEffect, useLayoutEffect, useState } from "react";
import { useStore } from "../lib/store";

// A lightweight product tour: spotlights a real UI element (by data-tour id) and
// shows a "Step X of N" tooltip with Back / Next / Skip. Steps with target=null
// render a centered card (intro/outro). Robust to layout — recomputes on resize.

type Step = { target: string | null; title: string; body: string };

const STEPS: Step[] = [
  { target: null, title: "Welcome to TraceHealth 👋", body: "Your whole health history in one record — pulled from every provider, understood by an AI. Here's the 30-second tour." },
  { target: "connect-btn", title: "Start here — connect a provider", body: "Click Connect on the SMART sandbox to pull a full record over FHIR (labs, meds, conditions). This is how your data comes in." },
  { target: "nav-import", title: "Or add data yourself", body: "Drop a PDF, snap a photo of a lab report, or paste text — the AI extracts it into your record." },
  { target: "nav-home", title: "Your Overview", body: "Once you've connected, this shows what needs attention, your key metrics, and recent activity." },
  { target: "nav-metric", title: "Trends", body: "Every lab as a real trend line over the years, flagged when it's out of range." },
  { target: "nav-ask", title: "Ask the AI", body: "Ask anything about your health — grounded in your record, cited to sources, even live drug prices." },
  { target: "share", title: "Share with a clinician", body: "Hand any doctor a clean, read-only snapshot with one link — no account needed on their end." },
  { target: null, title: "That's it — you're set.", body: "Hit Connect to bring in a record, then try Ask AI. Enjoy." },
];

export default function Tour() {
  const { tourOpen, endTour } = useStore();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  // Reset to first step whenever the tour (re)opens.
  useEffect(() => { if (tourOpen) setI(0); }, [tourOpen]);

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
