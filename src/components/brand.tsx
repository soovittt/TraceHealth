// The mark: a health "trace" — a pulse line that resolves into a highlighted
// node (your latest data point). Trace + health + your record, distilled.
export function Mark({ className = "h-4 w-4", color = "currentColor", accent = "#2383e2" }: { className?: string; color?: string; accent?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path
        d="M2 9h2.6l1.1-3.8 1.5 7.2 1.3-4.6h1.7l2-2.4"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12.2" cy="5.4" r="1.7" fill={accent} />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="grid h-6 w-6 place-items-center rounded-md bg-brand text-brand-fg">
        <Mark className="h-3.5 w-3.5" color="currentColor" />
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink-900">TraceHealth</span>
    </div>
  );
}
