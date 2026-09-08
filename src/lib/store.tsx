import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export type View =
  | "landing"
  | "auth"
  | "import"
  | "home"
  | "timeline"
  | "metric"
  | "compare"
  | "conflicts"
  | "integrations"
  | "reports"
  | "signals"
  | "ask"
  | "chat"
  | "doctor";

export type AuthMode = "signIn" | "signUp";

export type Evidence = {
  documentId: Id<"documents">;
  page?: number;
  highlight?: string;
  // Optional record-specific detail (so the panel shows WHAT this record is,
  // not just the shared import document).
  detail?: { badge: string; title: string; rows: { label: string; value: string }[]; note?: string; visitDate?: number };
} | null;

type Store = {
  patientId: Id<"patients"> | null;
  setPatientId: (id: Id<"patients"> | null) => void;
  view: View;
  go: (v: View) => void;
  metricCode: string | null;
  openMetric: (code: string) => void;
  evidence: Evidence;
  showEvidence: (e: Evidence) => void;
  shareToken: string | null;
  authMode: AuthMode;
  openAuth: (mode: AuthMode) => void;
  // Global AI assistant dock.
  dockOpen: boolean;
  dockSide: "left" | "right";
  dockExpanded: boolean;
  toggleDock: (open?: boolean) => void;
  setDockSide: (s: "left" | "right") => void;
  toggleDockExpanded: (v?: boolean) => void;
  // A queued prompt to auto-send when the dock opens (from an ask bar).
  pendingPrompt: string | null;
  askAI: (prompt: string) => void;
  consumePendingPrompt: () => string | null;
  // Active AI conversation (null = a fresh, unsaved "new chat").
  conversationId: Id<"conversations"> | null;
  setConversation: (id: Id<"conversations"> | null) => void;
  // A running background export job (drives the global toast).
  exportJob: { id: Id<"exports">; format: string } | null;
  setExportJob: (j: { id: Id<"exports">; format: string } | null) => void;
};

const Ctx = createContext<Store | null>(null);

// ---- URL <-> view routing -----------------------------------------------
const VIEW_TO_PATH: Record<View, string> = {
  landing: "/",
  auth: "/signin",
  import: "/import",
  home: "/dashboard",
  timeline: "/timeline",
  metric: "/trends",
  compare: "/compare",
  conflicts: "/review",
  integrations: "/integrations",
  reports: "/reports",
  signals: "/attention",
  ask: "/dashboard",
  chat: "/chat",
  doctor: "/doctor",
};

function pathFor(view: View, authMode: AuthMode, shareToken: string | null, metricCode?: string | null): string {
  if (shareToken) return `/share/${shareToken}`;
  if (view === "auth") return authMode === "signUp" ? "/signup" : "/signin";
  if (view === "metric" && metricCode) return `/trends/${encodeURIComponent(metricCode)}`;
  return VIEW_TO_PATH[view] ?? "/";
}

function parsePath(pathname: string): { view: View; authMode?: AuthMode; shareToken?: string; metricCode?: string } {
  if (pathname.startsWith("/share/")) {
    return { view: "doctor", shareToken: decodeURIComponent(pathname.slice("/share/".length)) };
  }
  if (pathname.startsWith("/trends/")) {
    return { view: "metric", metricCode: decodeURIComponent(pathname.slice("/trends/".length)) };
  }
  switch (pathname) {
    case "/": return { view: "landing" };
    case "/signin": return { view: "auth", authMode: "signIn" };
    case "/signup": return { view: "auth", authMode: "signUp" };
    case "/import": return { view: "import" };
    case "/dashboard": return { view: "home" };
    case "/timeline": return { view: "timeline" };
    case "/trends": return { view: "metric" };
    case "/compare": return { view: "compare" };
    case "/review": return { view: "conflicts" };
    case "/integrations": return { view: "integrations" };
    case "/reports": return { view: "reports" };
    case "/attention": return { view: "signals" };
    case "/chat": return { view: "chat" };
    case "/doctor": return { view: "doctor" };
    default: return { view: "landing" };
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = parsePath(typeof window !== "undefined" ? window.location.pathname : "/");
  const [patientId, setPatientId] = useState<Id<"patients"> | null>(null);
  const [view, setView] = useState<View>(initial.view);
  const [metricCode, setMetricCode] = useState<string | null>(initial.metricCode ?? null);
  const [evidence, setEvidence] = useState<Evidence>(null);
  const [shareToken, setShareToken] = useState<string | null>(initial.shareToken ?? null);
  const [authMode, setAuthMode] = useState<AuthMode>(initial.authMode ?? "signUp");
  const [dockOpen, setDockOpen] = useState<boolean>(
    () => (typeof localStorage !== "undefined" && localStorage.getItem("th_dockOpen") === "1"),
  );
  const [dockSide, setDockSideState] = useState<"left" | "right">(
    () => ((typeof localStorage !== "undefined" && localStorage.getItem("th_dockSide")) as any) || "right",
  );
  const [dockExpanded, setDockExpanded] = useState<boolean>(
    () => typeof localStorage !== "undefined" && localStorage.getItem("th_dockExpanded") === "1",
  );
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<Id<"conversations"> | null>(null);
  const [exportJob, setExportJob] = useState<{ id: Id<"exports">; format: string } | null>(null);

  useEffect(() => {
    localStorage.setItem("th_dockOpen", dockOpen ? "1" : "0");
  }, [dockOpen]);
  useEffect(() => {
    localStorage.setItem("th_dockSide", dockSide);
  }, [dockSide]);
  useEffect(() => {
    localStorage.setItem("th_dockExpanded", dockExpanded ? "1" : "0");
  }, [dockExpanded]);

  // Keep the URL in sync with the current view (so /dashboard, /trends/LDL, … are real).
  useEffect(() => {
    const path = pathFor(view, authMode, shareToken, metricCode);
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
  }, [view, authMode, shareToken, metricCode]);

  // Browser back/forward re-drives the view from the URL.
  useEffect(() => {
    function onPop() {
      const p = parsePath(window.location.pathname);
      setView(p.view);
      setAuthMode(p.authMode ?? "signUp");
      setShareToken(p.shareToken ?? null);
      if (p.metricCode) setMetricCode(p.metricCode);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const value: Store = {
    patientId,
    setPatientId,
    view,
    go: (v) => {
      setEvidence(null);
      setView(v);
    },
    metricCode,
    openMetric: (code) => {
      setMetricCode(code);
      setView("metric");
    },
    evidence,
    showEvidence: setEvidence,
    shareToken,
    authMode,
    openAuth: (mode) => {
      setAuthMode(mode);
      setView("auth");
    },
    dockOpen,
    dockSide,
    dockExpanded,
    toggleDock: (open) => setDockOpen((prev) => (open === undefined ? !prev : open)),
    setDockSide: setDockSideState,
    toggleDockExpanded: (v) => setDockExpanded((prev) => (v === undefined ? !prev : v)),
    pendingPrompt,
    askAI: (prompt) => {
      setPendingPrompt(prompt);
      setDockOpen(true);
    },
    consumePendingPrompt: () => {
      const p = pendingPrompt;
      setPendingPrompt(null);
      return p;
    },
    conversationId,
    setConversation: setConversationId,
    exportJob,
    setExportJob,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside provider");
  return s;
}
