import { fmtNum } from "../lib/format";

type Pt = { value: number; date: number };

// Responsive sparkline — fills its container width, fixed height, never overflows.
export function Sparkline({ points, height = 26 }: { points: Pt[]; height?: number; color?: string }) {
  if (points.length < 2) return <div style={{ height }} />;
  const W = 100;
  const H = height;
  const xs = points.map((p) => p.date);
  const ys = points.map((p) => p.value);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const px = (x: number) => ((x - minX) / (maxX - minX || 1)) * (W - 3) + 1.5;
  const py = (y: number) => H - 3 - ((y - minY) / (maxY - minY || 1)) * (H - 6);
  const dPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${px(p.date).toFixed(1)} ${py(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full text-ink-400" style={{ height }}>
      <path
        d={dPath}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={px(last.date)} cy={py(last.value)} r={1.6} fill="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export type Marker = { date: number; label: string; kind: string };

export function TrendChart({
  points,
  unit,
  refHigh,
  markers = [],
  onPoint,
  height = 240,
}: {
  points: (Pt & { id?: string })[];
  unit: string;
  refHigh?: number;
  color?: string;
  markers?: Marker[];
  onPoint?: (index: number) => void;
  height?: number;
}) {
  const W = 780;
  const H = height;
  const padL = 40;
  const padR = 16;
  const padT = 22;
  const padB = 40;
  if (points.length === 0) return null;

  const xs = points.map((p) => p.date);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const ysAll = [...points.map((p) => p.value), ...(refHigh ? [refHigh] : [])];
  const minY = Math.min(...ysAll) * 0.94;
  const maxY = Math.max(...ysAll) * 1.05;

  const px = (x: number) => padL + ((x - minX) / (maxX - minX || 1)) * (W - padL - padR);
  const py = (y: number) => padT + (1 - (y - minY) / (maxY - minY || 1)) * (H - padT - padB);

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${px(p.date)} ${py(p.value)}`).join(" ");

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => minY + ((maxY - minY) / yTicks) * i);
  const MONO = "'IBM Plex Mono', monospace";

  // Only label the x-axis once per year, and never closer than ~28px, so
  // clustered readings don't collide into unreadable overlaps ("20219").
  const yearLabelIdx = (() => {
    const show = new Set<number>();
    let lastYear: number | null = null;
    let lastX = -Infinity;
    points.forEach((p, i) => {
      const y = new Date(p.date).getUTCFullYear();
      const x = px(p.date);
      if (y !== lastYear && x - lastX >= 28) { show.add(i); lastYear = y; lastX = x; }
    });
    return show;
  })();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-ink-900" style={{ maxHeight: H }}>
      {/* y grid + labels */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={py(t)} y2={py(t)} className="stroke-line-soft" strokeWidth={1} />
          <text x={padL - 8} y={py(t) + 3.5} textAnchor="end" fontSize="10" className="fill-ink-400" fontFamily={MONO}>
            {fmtNum(t)}
          </text>
        </g>
      ))}

      {/* reference line */}
      {refHigh && (
        <g>
          <line x1={padL} x2={W - padR} y1={py(refHigh)} y2={py(refHigh)} className="stroke-warn" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
          <text x={W - padR} y={py(refHigh) - 5} textAnchor="end" fontSize="9" className="fill-warn" fontFamily={MONO}>
            ref {fmtNum(refHigh)}
          </text>
        </g>
      )}

      {/* event markers */}
      {markers.map((m, i) => (
        <g key={i}>
          <line x1={px(m.date)} x2={px(m.date)} y1={padT} y2={H - padB} className="stroke-ink-300" strokeWidth={1} strokeDasharray="2 3" />
          <text x={px(m.date)} y={padT - 7} textAnchor="middle" fontSize="9.5" className="fill-ink-500" fontWeight={500}>
            {m.label}
          </text>
        </g>
      ))}

      <path d={linePath} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />

      {points.map((p, i) => (
        <g key={i} className={onPoint ? "cursor-pointer" : ""} onClick={() => onPoint?.(i)}>
          <circle cx={px(p.date)} cy={py(p.value)} r={10} fill="transparent" />
          <circle cx={px(p.date)} cy={py(p.value)} r={3} className="fill-surface" stroke="currentColor" strokeWidth={1.6} />
          <text x={px(p.date)} y={py(p.value) - 10} textAnchor="middle" fontSize="10" fontWeight={500} className="fill-ink-900" fontFamily={MONO}>
            {fmtNum(p.value)}
          </text>
          {yearLabelIdx.has(i) && (
            <text x={px(p.date)} y={H - padB + 15} textAnchor="middle" fontSize="9.5" className="fill-ink-400" fontFamily={MONO}>
              {new Date(p.date).getUTCFullYear()}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
