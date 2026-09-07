import { useState, useEffect } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { Mark } from "./brand";
import SearchBar from "./SearchBar";
import EvidencePanel from "./EvidencePanel";
import AssistantDock from "./AssistantDock";
import ExportMenu from "./ExportMenu";
import HealthHome from "./HealthHome";
import Timeline from "./Timeline";
import MetricGraph from "./MetricGraph";
import Compare from "./Compare";
import Conflicts from "./Conflicts";
import Integrations from "./Integrations";
import Reports from "./Reports";
import ImportScreen from "./ImportScreen";
import NeedsAttention from "./NeedsAttention";
import AssistantChat from "./AssistantChat";
import DoctorView from "./DoctorView";

const NAV: { key: any; label: string; hint: string; icon: string }[] = [
  { key: "home", label: "Overview", hint: "1", icon: "M2.5 7.5 8 3l5.5 4.5V13a.5.5 0 0 1-.5.5h-3V9.5H6v4H3a.5.5 0 0 1-.5-.5z" },
  { key: "timeline", label: "Timeline", hint: "2", icon: "M3 2.5v11M3 5h8M3 8.5h5.5M3 12h7" },
  { key: "metric", label: "Trends", hint: "3", icon: "M2.5 11 6 7.5l2.5 2.5L13 5M2.5 13.5h11" },
  { key: "compare", label: "Compare", hint: "4", icon: "M6 2.5v11M3 5.5 6 3l3 2.5M10 13.5v-11M13 10.5 10 13 7 10.5" },
  { key: "conflicts", label: "Review", hint: "5", icon: "M8 2.5 14 13H2zM8 6.5v3.5M8 11.5h.01" },
  { key: "integrations", label: "Connections", hint: "6", icon: "M6.5 9.5 4.8 11.2a2.4 2.4 0 0 1-3.4-3.4l1.7-1.7M9.5 6.5l1.7-1.7a2.4 2.4 0 0 1 3.4 3.4l-1.7 1.7M6 10l4-4" },
  { key: "import", label: "Add data", hint: "7", icon: "M8 3v7m0 0L5 7m3 3 3-3M3 12.5h10" },
  { key: "reports", label: "Reports", hint: "8", icon: "M4 2h6l3 3v9H4zM10 2v3h3M6 8h5M6 11h5" },
  { key: "ask", label: "Ask AI", hint: "9", icon: "M8 2l1.1 3.1L12.2 6.2 9.1 7.3 8 10.4 6.9 7.3 3.8 6.2 6.9 5.1zM12.5 10l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4L11 11.9l1.4-.5z" },
];

export default function AppShell() {
  const { view, go, patientId, setPatientId, openMetric, dockOpen, dockSide, toggleDock } = useStore();

  // ⌘/Ctrl-J toggles the assistant dock from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        toggleDock();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggleDock]);
  const patient = useQuery(api.health.getPatient, patientId ? { patientId } : "skip");
  const conflicts = useQuery(api.health.listConflicts, patientId ? { patientId } : "skip");
  const me = useQuery(api.patients.getMe, {});
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const createShare = useMutation(api.mutations.createShare);
  const [shareLink, setShareLink] = useState<string | null>(null);

  if (view === "doctor") return <DoctorView preview />;

  const isDemo = !!patient?.isDemo;

  async function exit() {
    if (me) await signOut();
    setPatientId(null);
    go("landing");
  }

  const openCount = (conflicts ?? []).filter((c: any) => c.status === "open").length;

  async function share() {
    if (!patientId) return;
    const token = await createShare({ patientId });
    setShareLink(`${window.location.origin}/share/${token}`);
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* sidebar */}
      <nav className="flex h-full w-[216px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface">
        <button
          className="flex items-center gap-2.5 border-b border-line px-3.5 py-3 text-left hover:bg-line-soft"
          onClick={() => go("landing")}
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand text-brand-fg">
            <Mark className="h-4 w-4" color="currentColor" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {patient?.name ?? "TraceHealth"}
            </span>
            <span className="block truncate text-2xs text-ink-400">
              {patient?.recordsFrom ? `Records ${patient.recordsFrom}` : "Health record"}
            </span>
          </span>
          <Chevron />
        </button>

        <div className="px-2.5 py-3">
          <div className="eyebrow px-1.5 pb-1.5">Workspace</div>
          <div className="space-y-0.5">
            {NAV.map((n) => {
              const active = n.key === "ask" ? dockOpen : view === n.key;
              return (
                <button
                  key={n.key}
                  onClick={() =>
                    n.key === "ask" ? toggleDock(true) : n.key === "metric" ? openMetric("LDL") : go(n.key)
                  }
                  className={`group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    active ? "bg-line-soft font-medium text-ink-900" : "text-ink-600 hover:bg-line-soft"
                  }`}
                >
                  <svg viewBox="0 0 16 16" className={`h-4 w-4 ${active ? "text-ink-900" : "text-ink-400"}`} fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d={n.icon} />
                  </svg>
                  <span className="flex-1 text-left">{n.label}</span>
                  {n.key === "conflicts" && openCount > 0 && (
                    <span className="mono flex h-4 min-w-4 items-center justify-center rounded bg-warn-soft px-1 text-2xs font-semibold text-warn">
                      {openCount}
                    </span>
                  )}
                  <span className="kbd opacity-0 group-hover:opacity-100">{n.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-auto space-y-2.5 border-t border-line p-2.5">
          <button className="btn-secondary w-full justify-start gap-2" onClick={share}>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path d="M11 5.5 6 8m5 2.5L6 8m0 0a2 2 0 1 0-2 0m8-4.5a1.5 1.5 0 1 0 0 .01M12 12.5a1.5 1.5 0 1 0 0 .01" />
            </svg>
            Share with clinician
          </button>

          <ExportMenu />

          {/* account row */}
          <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-2xs font-semibold text-brand-fg">
              {(me?.name ?? me?.email ?? (isDemo ? "D" : "?")).slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-ink-800">
                {me?.name ?? (isDemo ? "Demo patient" : "Guest")}
              </div>
              <div className="truncate text-2xs text-ink-400">{me?.email ?? (isDemo ? "read-only demo" : "")}</div>
            </div>
            <button
              onClick={exit}
              title={me ? "Sign out" : "Exit demo"}
              className="grid h-6 w-6 shrink-0 place-items-center rounded text-ink-400 hover:bg-line-soft hover:text-ink-700"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3">
                <path d="M6 3H3.5v10H6M10 5l3 3-3 3M13 8H6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* AI dock — left (hidden on the full-page chat, which is itself the assistant) */}
      {dockSide === "left" && view !== "chat" && <AssistantDock />}

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-20 flex shrink-0 items-center gap-3 border-b border-line bg-surface/85 px-5 py-2.5 backdrop-blur">
          <SearchBar />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <button
              className={`btn-ghost gap-1.5 ${dockOpen ? "bg-line-soft text-ink-900" : ""}`}
              onClick={() => toggleDock()}
              title="Toggle AI assistant (⌘J)"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-accent" fill="currentColor">
                <path d="M8 1.5l1.2 3.3 3.3 1.2-3.3 1.2L8 10.5 6.8 7.2 3.5 6l3.3-1.2z" />
              </svg>
              Ask AI
              <span className="kbd ml-0.5 hidden sm:inline">⌘J</span>
            </button>
            <span className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-2xs text-ink-500">
              <span className="h-1.5 w-1.5 rounded-full bg-good" />
              Live
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-6">
          {!patientId ? (
            isAuthenticated ? (
              <div className="mx-auto max-w-md pt-24 text-center text-sm text-ink-400">
                Setting up your record…
              </div>
            ) : (
              <div className="mx-auto max-w-md pt-24 text-center text-sm text-ink-400">
                No record loaded.{" "}
                <button className="font-medium text-accent" onClick={() => go("landing")}>
                  Go to start
                </button>
              </div>
            )
          ) : (
            <>
              {view === "home" && <HealthHome />}
              {view === "timeline" && <Timeline />}
              {view === "metric" && <MetricGraph />}
              {view === "compare" && <Compare />}
              {view === "conflicts" && <Conflicts />}
              {view === "integrations" && <Integrations />}
              {view === "import" && <ImportScreen />}
              {view === "signals" && <NeedsAttention />}
              {view === "chat" && (
                <div className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-lg border border-line bg-surface">
                  <AssistantChat />
                </div>
              )}
              {view === "reports" && <Reports />}
            </>
          )}
        </main>
      </div>

      {/* AI dock — right (hidden on the full-page chat, which is itself the assistant) */}
      {dockSide === "right" && view !== "chat" && <AssistantDock />}

      <EvidencePanel />

      {shareLink && (
        <ShareModal link={shareLink} onClose={() => setShareLink(null)} onOpen={() => { setShareLink(null); go("doctor"); }} />
      )}
    </div>
  );
}

// Light/dark theme switch — persists to localStorage, toggles .dark on <html>.
function ThemeToggle() {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("th_theme", next ? "dark" : "light");
  }
  return (
    <button className="btn-ghost gap-1.5 px-2" onClick={toggle} title="Toggle theme">
      {dark ? (
        <svg viewBox="0 0 16 16" className="h-4 w-4 text-ink-500" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="8" cy="8" r="3.2" />
          <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M13 3l-1 1M4 12l-1 1" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="h-4 w-4 text-ink-500" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-ink-300" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="m6 4 3 4-3 4" />
    </svg>
  );
}

function ShareModal({ link, onClose, onOpen }: { link: string; onClose: () => void; onOpen: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-6 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-line bg-surface p-5 shadow-pop animate-rise" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Share with a clinician</h3>
        <p className="mt-1 text-sm text-ink-500">
          A read-only clinical snapshot. The link expires in 7 days and needs no login.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-md border border-line-strong bg-canvas px-2.5 py-2">
          <input readOnly value={link} className="w-full bg-transparent mono text-xs text-ink-600 outline-none" />
          <button
            className="btn-secondary shrink-0 px-2 py-1 text-xs"
            onClick={() => {
              navigator.clipboard?.writeText(link);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={onOpen}>Preview snapshot</button>
        </div>
      </div>
    </div>
  );
}
