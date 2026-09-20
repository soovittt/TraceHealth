import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useStore } from "../lib/store";
import { fmtDate } from "../lib/format";
import { useEffect } from "react";
import { PROVIDERS, startConnect, providerFromDirectory, type Provider } from "../lib/smart";

// Real brand logo (DuckDuckGo icon service) with a clean monogram fallback.
function ProviderLogo({ domain, label }: { domain?: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md border border-line bg-white">
      {domain && !failed ? (
        <img
          src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
          alt=""
          className="h-5 w-5 object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-2xs font-semibold text-ink-600">{label.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}

const DOMAIN_BY_ID: Record<string, string | undefined> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p.domain]),
);

export default function Integrations() {
  const { patientId, go } = useStore();
  const connections = useQuery(api.connections.listMyConnections, patientId ? { patientId } : "skip");
  const docs = useQuery(api.health.listDocuments, patientId ? { patientId } : "skip");
  const syncConn = useAction(api.fhir.syncConnection);
  const connectOpen = useAction(api.fhir.connectOpenServer);
  const removeConn = useMutation(api.connections.removeConnection);
  const disconnectSource = useMutation(api.mutations.disconnectSource);
  const searchProviders = useAction(api.directory.searchProviders);

  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dirQuery, setDirQuery] = useState("");
  const [dirResults, setDirResults] = useState<any[]>([]);
  const [dirBusy, setDirBusy] = useState(false);

  // Debounced search over the real provider directory.
  useEffect(() => {
    const q = dirQuery.trim();
    if (q.length < 2) {
      setDirResults([]);
      return;
    }
    setDirBusy(true);
    const t = setTimeout(async () => {
      try {
        setDirResults(await searchProviders({ query: q }));
      } catch {
        setDirResults([]);
      } finally {
        setDirBusy(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirQuery]);

  async function connectDirectory(org: any) {
    setMsg(null);
    try {
      await startConnect(providerFromDirectory(org));
    } catch (e: any) {
      setMsg(
        e?.message ??
          "Connecting to a real health system requires an approved Epic app (set VITE_EPIC_CLIENT_ID).",
      );
    }
  }

  async function connect(p: Provider) {
    setBusy(`c:${p.id}`);
    setMsg(null);
    try {
      if (p.open) {
        // Open FHIR server: no login — the backend pulls a sample patient directly.
        if (!patientId) throw new Error("No record loaded.");
        const r = await connectOpen({ patientId, providerId: p.id, provider: p.name, fhirBaseUrl: p.fhirBaseUrl, token: p.openToken, patientFhirId: p.openPatientId });
        setMsg(`Connected ${p.name} — imported ${r.counts} records.`);
        setBusy(null);
        return;
      }
      // Real SMART on FHIR: redirect to the provider's login + consent, then the
      // /callback handler exchanges the code and syncs the record.
      await startConnect(p);
    } catch (e: any) {
      setMsg(e?.message ?? "Could not start the connection.");
      setBusy(null);
    }
  }

  async function sync(id: any, name: string) {
    setBusy(`s:${id}`);
    setMsg(null);
    try {
      const r = await syncConn({ connectionId: id });
      setMsg(`Re-synced ${name} — ${r.counts} records.`);
    } catch (e: any) {
      setMsg(e?.message ?? "Sync failed.");
    } finally {
      setBusy(null);
    }
  }

  const sources = groupSources(docs ?? []);

  return (
    <div className="mx-auto max-w-4xl animate-fade-in">
      <h1 className="text-2xl font-semibold text-ink-900">Connections</h1>
      <p className="mt-1 text-sm text-ink-500">
        Connect your providers over SMART on FHIR — you log into their portal and authorize read
        access. Records normalize into one source-traceable model.
      </p>

      {msg && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink-700">
          <span className="h-1.5 w-1.5 rounded-full bg-good" />
          {msg}
        </div>
      )}

      {/* connected providers (OAuth) */}
      {(connections ?? []).length > 0 && (
        <>
          <div className="mt-7 mb-2 flex items-center justify-between">
            <div className="eyebrow">Connected providers</div>
            <span className="flex items-center gap-1.5 text-2xs text-ink-400">
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M13 8a5 5 0 1 1-1.5-3.5M13 3v2h-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Auto-syncs every 2 hours
            </span>
          </div>
          <div className="card divide-y divide-line-soft">
            {connections!.map((c: any) => (
              <div key={c._id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <ProviderLogo domain={DOMAIN_BY_ID[c.providerId]} label={c.provider} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink-900">{c.provider}</span>
                      {c.status === "error" && (
                        <span className="tag border-warn-line text-warn">Reconnect needed</span>
                      )}
                    </div>
                    <div className="mono text-2xs text-ink-400">
                      {c.lastCounts ?? 0} records · synced {c.lastSyncedAt ? fmtDate(c.lastSyncedAt) : "—"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button className="btn-secondary text-xs" onClick={() => sync(c._id, c.provider)} disabled={busy === `s:${c._id}`}>
                    {busy === `s:${c._id}` ? "Syncing…" : "Re-sync"}
                  </button>
                  <button className="rounded-md px-2 py-1 text-xs text-ink-400 hover:bg-line-soft hover:text-bad" onClick={() => removeConn({ connectionId: c._id })}>
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* connect a provider */}
      <div className="mt-7 flex items-center justify-between">
        <div className="eyebrow">Connect a provider</div>
        <span className="text-2xs text-ink-400">
          Sandboxes use synthetic test patients · real data needs provider production access
        </span>
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {PROVIDERS.map((p) => {
          const connectable = p.open || !!p.clientId;
          const isConnected = (connections ?? []).some((c: any) => c.providerId === p.id);
          return (
            <div key={p.id} className="card flex h-full flex-col p-4">
              {/* header: logo + name + status badges */}
              <div className="flex items-start gap-3">
                <ProviderLogo domain={p.domain} label={p.name} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-snug text-ink-900">{p.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {p.open ? (
                      <span className="tag whitespace-nowrap">Open · no login</span>
                    ) : p.sandbox ? (
                      <span className="tag whitespace-nowrap border-warn-line text-warn">Sandbox</span>
                    ) : null}
                    {isConnected && (
                      <span className="tag whitespace-nowrap border-good/30 text-good-ink">
                        <span className="mr-1 h-1.5 w-1.5 rounded-full bg-good" /> Connected
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* blurb fills the middle so all cards' buttons align at the bottom */}
              <p className="mt-2 flex-1 text-xs leading-relaxed text-ink-500">{p.blurb}</p>

              {p.loginHint && (
                <div className="mt-2 rounded border border-line-soft bg-canvas px-2 py-1 text-2xs text-ink-500">
                  <span className="mono">{p.loginHint}</span>
                </div>
              )}

              {/* action — full width, pinned to the bottom (uniform across cards) */}
              <div className="mt-3">
                {connectable ? (
                  <button
                    data-tour={p.id === "smart-sandbox" ? "connect-btn" : undefined}
                    className="btn-primary w-full text-xs"
                    onClick={() => connect(p)}
                    disabled={busy === `c:${p.id}`}
                  >
                    {busy === `c:${p.id}` ? "Connecting…" : isConnected ? "Reconnect" : "Connect"}
                  </button>
                ) : (
                  <button className="btn-secondary w-full text-xs opacity-60" disabled title="Needs a developer client id">
                    Needs setup
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* find your provider — real directory search */}
      <div className="mt-7 flex items-center justify-between">
        <div className="eyebrow">Find your provider</div>
        <span className="text-2xs text-ink-400">479 US health systems on Epic · Kaiser, UCSF, Cleveland Clinic…</span>
      </div>
      <div className="mt-2 card p-3">
        <div className="flex items-center gap-2 rounded-md border border-line-strong bg-canvas px-2.5 py-1.5 focus-within:border-accent-line">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ink-400" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M11 11l3 3" strokeLinecap="round" />
          </svg>
          <input
            value={dirQuery}
            onChange={(e) => setDirQuery(e.target.value)}
            placeholder="Search your hospital or clinic — e.g. Kaiser, UCSF, Stanford…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink-400"
          />
          {dirBusy && <span className="mono text-2xs text-ink-400">…</span>}
        </div>

        {dirResults.length > 0 && (
          <div className="mt-2 max-h-72 divide-y divide-line-soft overflow-auto">
            {dirResults.map((org, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <ProviderLogo domain="epic.com" label={org.name} />
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink-800">{org.name}</div>
                    <div className="mono truncate text-2xs text-ink-400">via Epic · {hostOf(org.fhirBaseUrl)}</div>
                  </div>
                </div>
                <button className="btn-secondary shrink-0 text-xs" onClick={() => connectDirectory(org)}>
                  Connect
                </button>
              </div>
            ))}
          </div>
        )}
        {dirQuery.trim().length >= 2 && !dirBusy && dirResults.length === 0 && (
          <div className="px-1 pt-2 text-xs text-ink-400">No match. Try your health system's name.</div>
        )}
        <div className="mt-2 px-1 text-2xs text-ink-400">
          Real health systems use production Epic access (an approved app). The flow is wired — connecting
          live data requires Epic app approval; use the sandbox above to demo end-to-end today.
        </div>
      </div>

      {/* data sources (all imported documents by org) */}
      {sources.length > 0 && (
        <>
          <div className="eyebrow mt-7 mb-2">Data sources</div>
          <div className="card divide-y divide-line-soft">
            {sources.map((s) => (
              <div key={s.org} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-ink-900">{s.org}</div>
                  <div className="mono text-2xs text-ink-400">
                    {s.count} {s.count === 1 ? "document" : "documents"} · via {s.via.join(", ")} · last {fmtDate(s.last)}
                  </div>
                </div>
                <button
                  className="rounded-md px-2 py-1 text-xs text-ink-400 hover:bg-line-soft hover:text-bad"
                  onClick={() => patientId && disconnectSource({ patientId, org: s.org })}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* upload path */}
      <div className="eyebrow mt-7 mb-2">Other ways to add records</div>
      <div className="card flex items-center justify-between p-4">
        <div>
          <div className="text-sm font-medium text-ink-900">Upload or paste a document</div>
          <div className="text-xs text-ink-500">PDF, CSV, JSON, FHIR bundle — extracted with AI.</div>
        </div>
        <button className="btn-secondary text-xs" onClick={() => go("import")}>
          Open
        </button>
      </div>

      <p className="mt-6 text-2xs text-ink-400">
        OAuth tokens are stored server-side and never sent to the browser. Every connected record
        writes into the same normalized model with source links.
      </p>
    </div>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function groupSources(docs: any[]) {
  const map = new Map<string, { org: string; count: number; via: Set<string>; last: number }>();
  for (const d of docs) {
    const cur = map.get(d.org) ?? { org: d.org, count: 0, via: new Set<string>(), last: 0 };
    cur.count += 1;
    cur.via.add(d.receivedVia);
    cur.last = Math.max(cur.last, d.receivedAt);
    map.set(d.org, cur);
  }
  return [...map.values()].map((s) => ({ ...s, via: [...s.via] })).sort((a, b) => b.last - a.last);
}
