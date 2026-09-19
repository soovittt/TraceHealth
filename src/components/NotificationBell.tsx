import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";

// Top-bar notification bell. The unread badge + list update reactively via
// Convex, so a background job (e.g. a finished summary) lights it up live.
export default function NotificationBell() {
  const { patientId, go, setFocusReport } = useStore();
  const [open, setOpen] = useState(false);
  const unread = useQuery(api.notifications.unreadCount, patientId ? { patientId } : "skip") ?? 0;
  const list = useQuery(api.notifications.list, patientId && open ? { patientId } : "skip");
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  if (!patientId) return null;

  function onItem(n: any) {
    if (!n.read) markRead({ id: n._id });
    if (n.refType === "report" && n.refId) {
      setFocusReport(n.refId);
      go("reports");
    }
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        className={`relative grid h-8 w-8 place-items-center rounded-md text-ink-500 hover:bg-line-soft hover:text-ink-800 ${open ? "bg-line-soft text-ink-800" : ""}`}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2a3.5 3.5 0 0 0-3.5 3.5c0 3-1.2 4-1.5 4.5h10c-.3-.5-1.5-1.5-1.5-4.5A3.5 3.5 0 0 0 8 2zM6.5 12.5a1.5 1.5 0 0 0 3 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-pop animate-fade-in">
            <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
              <span className="text-sm font-semibold text-ink-900">Notifications</span>
              {unread > 0 && (
                <button className="text-2xs text-accent hover:underline" onClick={() => markAllRead({ patientId })}>
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {list === undefined ? (
                <div className="px-3.5 py-8 text-center text-2xs text-ink-400">Loading…</div>
              ) : list.length === 0 ? (
                <div className="px-3.5 py-10 text-center text-sm text-ink-400">No notifications yet.</div>
              ) : (
                list.map((n: any, i: number) => {
                  const failed = n.kind === "report_failed";
                  const clickable = n.refType === "report" && n.refId;
                  return (
                    <button
                      key={n._id}
                      onClick={() => onItem(n)}
                      className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors ${i > 0 ? "border-t border-line-soft" : ""} hover:bg-line-soft ${clickable ? "" : "cursor-default"}`}
                    >
                      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md ${failed ? "bg-bad-soft text-bad" : "bg-accent-soft text-accent"}`}>
                        {failed ? (
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M8 4.5v4M8 11h.01" /></svg>
                        ) : (
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-ink-900">{n.title}</span>
                          {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                        </span>
                        {n.body && <span className="mt-0.5 block text-xs leading-snug text-ink-500">{n.body}</span>}
                        <span className="mt-0.5 block text-2xs text-ink-400">{relTime(n.createdAt)}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function relTime(t: number): string {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
