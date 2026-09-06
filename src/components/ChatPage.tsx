import { useQuery, useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { Wordmark } from "./brand";
import AssistantChat from "./AssistantChat";
import EvidencePanel from "./EvidencePanel";

// Full-page chat — its own route (/chat), openable in a new tab.
export default function ChatPage() {
  const { patientId, go } = useStore();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const patient = useQuery(api.health.getPatient, patientId ? { patientId } : "skip");

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <header className="flex items-center justify-between border-b border-line bg-surface px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Wordmark />
          <span className="text-2xs text-ink-400">/ Assistant</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {patient?.name && <span className="text-ink-500">{patient.name}</span>}
          <button className="btn-secondary text-xs" onClick={() => go("home")}>
            Open dashboard →
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {!patientId ? (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-ink-400">
            {isLoading ? (
              "Loading…"
            ) : isAuthenticated ? (
              "Setting up your record…"
            ) : (
              <span>
                Please{" "}
                <button className="font-medium text-accent" onClick={() => go("auth")}>
                  sign in
                </button>{" "}
                to use the assistant.
              </span>
            )}
          </div>
        ) : (
          <div className="mx-auto flex h-full max-w-3xl flex-col">
            <AssistantChat />
          </div>
        )}
      </div>

      <EvidencePanel />
    </div>
  );
}
