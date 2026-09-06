import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { METRIC_META } from "../../convex/metrics";
import { useStore } from "../lib/store";
import { fmtDate } from "../lib/format";
import { Markdown } from "./markdown";
import ChatChart from "./ChatChart";

// A short description of what the user is viewing, so the AI can resolve "this".
function describeView(view: string, metricCode: string | null): string {
  switch (view) {
    case "home":
      return "the Overview dashboard (key metric cards, recent activity, active meds & conditions)";
    case "timeline":
      return "the Timeline (all records — labs, visits, meds, diagnoses — newest first)";
    case "metric":
      return `the Trends chart for ${metricCode ? METRIC_META[metricCode]?.label ?? metricCode : "a metric"}`;
    case "chat":
      return "the full-page assistant (no specific chart in view — the whole record is available)";
    case "compare":
      return "the Compare page (two time periods side by side)";
    case "conflicts":
      return "the Review page (record conflicts and things needing attention)";
    case "integrations":
      return "the Connections page (data sources / provider integrations)";
    default:
      return "TraceHealth";
  }
}

const SUGGESTIONS = [
  "Summarize my health in 5 bullet points.",
  "What's my biggest cardiovascular risk right now?",
  "Chart my cholesterol and blood pressure trends.",
  "Which records conflict, and what should I resolve?",
  "Draft a 30-second summary for my doctor.",
];

export default function AssistantChat({ compact = false }: { compact?: boolean }) {
  const { patientId, showEvidence, consumePendingPrompt, pendingPrompt, view, metricCode, conversationId, setConversation } =
    useStore();

  const conversations = useQuery(api.assistant.listConversations, patientId ? { patientId } : "skip");
  const messages = useQuery(api.assistant.listMessages, conversationId ? { conversationId } : "skip");
  const ask = useMutation(api.assistant.ask);
  const deleteConversation = useMutation(api.assistant.deleteConversation);

  const [input, setInput] = useState("");
  const [attached, setAttached] = useState<{ filename: string; text: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const handledRef = useRef<string | null>(null);
  const initedRef = useRef(false);

  // On first load, continue the most recent conversation (if any).
  useEffect(() => {
    if (initedRef.current || !conversations) return;
    initedRef.current = true;
    if (!conversationId && conversations.length) setConversation(conversations[0]._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  const busy = (messages ?? []).some((m: any) => m.role === "assistant" && m.pending);
  const shownMessages = conversationId ? messages ?? [] : [];
  const empty = shownMessages.length === 0;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text().catch(() => "");
    setAttached({ filename: f.name, text: text.slice(0, 20000) });
    e.target.value = "";
  }

  async function send(q?: string) {
    const text = (q ?? input).trim();
    if ((!text && !attached) || !patientId || busy) return;
    setInput("");
    const att = attached;
    setAttached(null);
    const convId = await ask({
      patientId,
      question: text || "Please analyze the attached file and summarize the key findings.",
      conversationId: conversationId ?? undefined,
      context: describeView(view, metricCode),
      attachment: att ?? undefined,
    });
    if (!conversationId) setConversation(convId);
  }

  function newChat() {
    setConversation(null);
    setInput("");
    setAttached(null);
    setHistoryOpen(false);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Auto-send a prompt queued from an "ask" bar elsewhere in the app.
  useEffect(() => {
    if (pendingPrompt && patientId && handledRef.current !== pendingPrompt) {
      handledRef.current = pendingPrompt;
      const p = consumePendingPrompt();
      if (p) send(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt, patientId]);

  return (
    <div className="flex h-full flex-col">
      {/* toolbar: new chat + history */}
      <div className="relative flex items-center justify-between border-b border-line px-3 py-1.5">
        <button className="btn-ghost px-2 py-1 text-xs" onClick={newChat}>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M8 3.5v9M3.5 8h9" />
          </svg>
          New chat
        </button>
        <button
          className={`btn-ghost px-2 py-1 text-xs ${historyOpen ? "bg-line-soft text-ink-900" : ""}`}
          onClick={() => setHistoryOpen((v) => !v)}
          title="Chat history"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 4.5V8l2.5 1.5" />
          </svg>
          History
        </button>

        {historyOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setHistoryOpen(false)} />
            <div className="absolute right-2 top-9 z-30 max-h-80 w-72 overflow-auto rounded-lg border border-line bg-surface p-1 shadow-pop animate-fade-in">
              {(conversations ?? []).length === 0 && (
                <div className="px-2 py-3 text-xs text-ink-400">No past chats yet.</div>
              )}
              {(conversations ?? []).map((c: any) => (
                <div
                  key={c._id}
                  className={`group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-canvas ${c._id === conversationId ? "bg-line-soft" : ""}`}
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setConversation(c._id);
                      setHistoryOpen(false);
                    }}
                  >
                    <div className="truncate text-sm text-ink-800">{c.title}</div>
                    <div className="mono text-2xs text-ink-400">{fmtDate(c.updatedAt)}</div>
                  </button>
                  <button
                    className="shrink-0 rounded p-1 text-ink-400 opacity-0 hover:text-bad group-hover:opacity-100"
                    title="Delete chat"
                    onClick={async () => {
                      await deleteConversation({ conversationId: c._id });
                      if (c._id === conversationId) setConversation(null);
                    }}
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.3">
                      <path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.5 8h5l.5-8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-auto px-4 py-4">
        {empty && (
          <div className="animate-fade-in">
            <div className="eyebrow mb-2">Ask about your record</div>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-md border border-line px-3 py-2 text-left text-sm text-ink-700 transition-colors hover:border-accent-line hover:bg-canvas"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-3 text-2xs text-ink-400">
              Answers are grounded in your records and cite their source. Not medical advice.
            </p>
          </div>
        )}

        {shownMessages.map((m: any) =>
          m.role === "user" ? (
            <div key={m._id} className="flex justify-end">
              <div className="max-w-[88%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-brand px-3 py-2 text-sm text-brand-fg">{m.content}</div>
            </div>
          ) : (
            <div key={m._id} className="flex justify-start">
              <div className={compact ? "w-full" : "max-w-[92%]"}>
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="grid h-4 w-4 place-items-center rounded bg-accent-soft">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  </span>
                  <span className="eyebrow">TraceHealth AI</span>
                </div>
                {m.pending ? (
                  <ReasoningTrace steps={m.steps} stage={m.stage} live />
                ) : (
                  <div className={`rounded-lg rounded-bl-sm border px-3 py-2.5 text-sm ${m.error ? "border-bad/30 bg-bad-soft text-bad-ink" : "border-line bg-surface text-ink-800"}`}>
                    {m.steps && m.steps.length > 0 && <ReasoningTrace steps={m.steps} />}
                    <Markdown text={m.content} />
                    {m.charts?.map((code: string) => <ChatChart key={code} code={code} />)}
                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line-soft pt-2.5">
                        {m.citations.map((c: any, i: number) => (
                          <button
                            key={i}
                            onClick={() => showEvidence({ documentId: c.documentId })}
                            className="flex items-center gap-1 rounded border border-line bg-canvas px-1.5 py-0.5 text-2xs text-ink-500 hover:border-accent-line hover:text-ink-800"
                          >
                            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.2">
                              <path d="M3 2h4l2 2v6H3zM7 2v2h2" />
                            </svg>
                            {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      {/* composer */}
      <div className="border-t border-line px-3 py-2.5">
        {attached && (
          <div className="mb-1.5 flex items-center gap-2 rounded-md border border-line bg-canvas px-2 py-1 text-xs text-ink-700">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path d="M9 3H4v10h8V6M9 3l3 3M9 3v3h3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="truncate">{attached.filename}</span>
            <button className="ml-auto text-ink-400 hover:text-bad" onClick={() => setAttached(null)}>✕</button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" className="hidden" accept=".txt,.csv,.json,.md,.xml,.fhir,.html" onChange={onFile} />
          <button
            onClick={() => fileRef.current?.click()}
            title="Attach a file"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line-strong text-ink-500 hover:bg-canvas hover:text-ink-800"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5.5 6 10.5a1.8 1.8 0 0 0 2.5 2.5l5-5a3 3 0 0 0-4.2-4.2l-5.3 5.3a4.2 4.2 0 0 0 6 6L14 8" />
            </svg>
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={attached ? "Ask about this file…" : "Ask about your health…"}
            className="input max-h-28 flex-1 resize-none py-2 text-sm"
          />
          <button className="btn-primary px-3 py-2" onClick={() => send()} disabled={busy || (!input.trim() && !attached)}>
            {busy ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

type Step = { title: string; detail?: string; status: string };

// A live, step-by-step reasoning trace over the health data. While the answer is
// streaming (`live`) it's always open and the active step spins; once the answer
// lands it collapses into a "Reasoned in N steps" summary the user can expand.
function ReasoningTrace({ steps, stage, live = false }: { steps?: Step[]; stage?: string; live?: boolean }) {
  const [open, setOpen] = useState(live);
  const list: Step[] = steps && steps.length ? steps : stage ? [{ title: stage, status: "running" }] : [{ title: "Thinking…", status: "running" }];

  // Once finished, treat every step as complete (no lingering spinners).
  const rows = live ? list : list.map((s) => ({ ...s, status: "done" }));

  if (live) {
    return (
      <div className="rounded-lg rounded-bl-sm border border-line bg-surface px-3 py-2.5">
        <StepList rows={rows} live />
      </div>
    );
  }

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-2xs font-medium text-ink-400 hover:text-ink-600"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3 text-good" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
        Reasoned in {rows.length} step{rows.length === 1 ? "" : "s"}
        <svg viewBox="0 0 16 16" className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 4l4 4-4 4" />
        </svg>
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-line-soft bg-canvas px-3 py-2">
          <StepList rows={rows} />
        </div>
      )}
    </div>
  );
}

function StepList({ rows, live = false }: { rows: Step[]; live?: boolean }) {
  return (
    <ol className="space-y-1.5">
      {rows.map((s, i) => {
        const running = live && s.status === "running";
        return (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center">
              {running ? (
                <span className="h-1.5 w-1.5 rounded-full bg-accent" style={{ animation: "pulse 1s infinite ease-in-out" }} />
              ) : (
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-good" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
              )}
            </span>
            <span className="min-w-0">
              <span className={`text-xs ${running ? "text-ink-800" : "text-ink-600"}`}>{s.title}</span>
              {s.detail && <span className="mono ml-1.5 text-2xs text-ink-400">{s.detail}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
