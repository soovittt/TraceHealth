import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import AssistantChat from "./AssistantChat";

// The AI panel docks on the right. Drag its LEFT edge to make it wider/narrower;
// the chosen width persists across navigation and reloads.
const MIN_W = 340;
const MAX_FRAC = 0.6;

export default function AssistantDock() {
  const { dockOpen, toggleDock } = useStore();
  const [width, setWidth] = useState<number>(() => {
    const s = Number(localStorage.getItem("th_dockWidth"));
    return s && s >= MIN_W ? s : 400;
  });
  const resizing = useRef(false);

  const clampW = useCallback(
    (w: number) => Math.min(Math.max(MIN_W, w), Math.round(window.innerWidth * MAX_FRAC)),
    [],
  );

  useEffect(() => {
    try { localStorage.setItem("th_dockWidth", String(width)); } catch { /* ignore */ }
  }, [width]);

  useEffect(() => {
    const onResize = () => setWidth((w) => clampW(w));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampW]);

  // Drag-to-resize from the left edge (width = distance from pointer to the viewport's right edge).
  useEffect(() => {
    function move(e: PointerEvent) {
      if (!resizing.current) return;
      setWidth(clampW(window.innerWidth - e.clientX));
    }
    function up() {
      if (!resizing.current) return;
      resizing.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [clampW]);

  if (!dockOpen) return null;

  return (
    <aside className="relative flex h-full shrink-0 flex-col border-l border-line bg-surface" style={{ width }}>
      {/* left-edge resize handle */}
      <div
        onPointerDown={(e) => {
          resizing.current = true;
          document.body.style.userSelect = "none";
          document.body.style.cursor = "ew-resize";
          e.preventDefault();
        }}
        title="Drag to resize"
        className="group absolute left-0 top-0 z-10 h-full w-2 -translate-x-1/2 cursor-ew-resize"
      >
        <div className="mx-auto h-full w-0.5 bg-transparent transition-colors group-hover:bg-accent" />
      </div>

      <header className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded bg-brand text-brand-fg">
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
              <path d="M8 2l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" />
            </svg>
          </span>
          <span className="text-sm font-semibold text-ink-900">Assistant</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => window.open("/chat", "_blank", "noopener")}
            title="Open in new tab"
            className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-line-soft hover:text-ink-700"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3H3.5v9.5h9.5V10M9.5 3H13v3.5M13 3l-5.5 5.5" />
            </svg>
          </button>
          <button
            onClick={() => toggleDock(false)}
            title="Close (⌘J)"
            className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-line-soft hover:text-ink-700"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <AssistantChat compact />
      </div>
    </aside>
  );
}
