import { useStore } from "../lib/store";
import AssistantChat from "./AssistantChat";

// A dockable, collapsible AI panel that lives alongside the main content on
// every in-app page. Persists open/side across navigation and reloads.
export default function AssistantDock() {
  const { dockOpen, dockSide, dockExpanded, toggleDock, setDockSide, toggleDockExpanded } = useStore();
  if (!dockOpen) return null;

  const borderSide = dockSide === "right" ? "border-l" : "border-r";
  const width = dockExpanded ? "w-[680px] max-w-[52vw]" : "w-[380px]";

  return (
    <aside className={`flex h-full shrink-0 flex-col ${width} ${borderSide} border-line bg-surface transition-[width] duration-200`}>
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
            onClick={() => toggleDockExpanded()}
            title={dockExpanded ? "Collapse" : "Expand"}
            className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-line-soft hover:text-ink-700"
          >
            {dockExpanded ? (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 6h3M13 6V3M6 10H3M3 10v3M10 6l3-3M6 10l-3 3" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3h4v4M13 3l-4 4M7 13H3V9M3 13l4-4" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setDockSide(dockSide === "right" ? "left" : "right")}
            title={dockSide === "right" ? "Dock left" : "Dock right"}
            className="grid h-6 w-6 place-items-center rounded text-ink-400 hover:bg-line-soft hover:text-ink-700"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3">
              <rect x="2" y="3" width="12" height="10" rx="1.5" />
              <line x1={dockSide === "right" ? "6" : "10"} y1="3" x2={dockSide === "right" ? "6" : "10"} y2="13" />
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
