// A quiet, monochrome mark: a single thread with nodes — a timeline distilled.
export function Mark({ className = "h-4 w-4", color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden>
      <path
        d="M2 8c2.2 0 2.2-4 4-4s1.8 8 4 8 2.2-4 4-4"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="2" cy="8" r="1.5" fill={color} />
      <circle cx="14" cy="8" r="1.5" fill={color} />
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
