import { useState, useRef, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { Markdown } from "./markdown";

function hostOf(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; }
}

const SUGGESTIONS = ["Summarize this patient in 3 lines.", "What's currently out of range?", "Any medication or allergy concerns?"];

// A read-only clinician chat, scoped ENTIRELY to one shared record via the share
// token. It never writes to the patient's history and can't reach any other
// record — the server resolves the token to exactly one patient.
export default function DoctorAssistant({ token }: { token: string | null }) {
  const { showEvidence } = useStore();
  const ask = useAction(api.assistant.askShared);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  async function send(q?: string) {
    const text = (q ?? input).trim();
    if (!text || !token || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const r: any = await ask({ shareToken: token, question: text });
      setMsgs((m) => [...m, { role: "assistant", ...r }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", content: `Sorry — ${String(e?.message ?? "something went wrong")}.`, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-accent" fill="currentColor"><path d="M8 1.5l1.2 3.3 3.3 1.2-3.3 1.2L8 10.5 6.8 7.2 3.5 6l3.3-1.2z" /></svg>
          <span className="text-sm font-semibold text-ink-900">Ask about this patient</span>
        </div>
        <p className="mt-0.5 text-2xs text-ink-400">Read-only · answers cite the record · not medical advice</p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto px-3 py-3">
        {msgs.length === 0 && (
          <div className="space-y-1.5">
            <div className="eyebrow mb-1">Try asking</div>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="block w-full rounded-md border border-line px-2.5 py-1.5 text-left text-xs text-ink-700 transition-colors hover:border-accent-line hover:bg-line-soft">{s}</button>
            ))}
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[88%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-brand px-3 py-2 text-sm text-brand-fg">{m.content}</div>
            </div>
          ) : (
            <div key={i} className={`rounded-lg rounded-bl-sm border px-3 py-2.5 text-sm ${m.error ? "border-bad/30 bg-bad-soft text-bad-ink" : "border-line bg-surface text-ink-800"}`}>
              <Markdown text={m.content} />
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-line-soft pt-2">
                  {m.citations.map((c: any, j: number) => (
                    <button key={j} onClick={() => showEvidence({ documentId: c.documentId })} className="rounded border border-line bg-canvas px-1.5 py-0.5 text-2xs text-ink-500 hover:text-ink-800">{c.label ?? `Source ${j + 1}`}</button>
                  ))}
                </div>
              )}
              {m.webSources && m.webSources.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-2xs text-ink-400">Sources:</span>
                  {m.webSources.map((w: any, j: number) => (
                    <a key={j} href={w.url} target="_blank" rel="noopener noreferrer" className="rounded border border-line bg-canvas px-1.5 py-0.5 text-2xs text-accent hover:underline">{hostOf(w.url)}</a>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <span className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-accent" style={{ animation: `pulse 1s ${i * 0.15}s infinite ease-in-out` }} />)}</span>
            Reading the record…
          </div>
        )}
      </div>

      <div className="border-t border-line p-2.5">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder={token ? "Ask about this patient…" : "Chat unavailable"}
            disabled={!token}
            className="input max-h-24 flex-1 resize-none py-2 text-sm"
          />
          <button className="btn-primary px-3 py-2" onClick={() => send()} disabled={busy || !input.trim() || !token}>{busy ? "…" : "Send"}</button>
        </div>
      </div>
    </div>
  );
}
