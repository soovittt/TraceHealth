import { useEffect, useRef, useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { loadPending, clearPending } from "../lib/smart";
import type { View } from "../lib/store";
import { Wordmark } from "./brand";

// Completes the SMART OAuth redirect: verifies state, exchanges the code
// (server-side, PKCE), and imports the record — then hands control back to the
// Router via onDone() so it can transition client-side (no reload, session kept).
export default function OAuthCallback({ onDone }: { onDone: (target: View) => void }) {
  const ensure = useMutation(api.patients.ensureMyPatient);
  const exchange = useAction(api.fhir.exchangeAndConnect);
  const [status, setStatus] = useState<"working" | "error">("working");
  const [message, setMessage] = useState("Finishing the secure connection…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      const code = params.get("code");
      const state = params.get("state");
      const pending = loadPending();

      if (err) {
        fail(params.get("error_description") || `Authorization was cancelled (${err}).`);
        return;
      }
      if (!code || !pending) {
        fail("The connection response was incomplete. Please try again.");
        return;
      }
      if (state !== pending.state) {
        fail("Security check failed (state mismatch). Please try again.");
        return;
      }

      try {
        const patientId = await ensure({});
        setMessage(`Importing your records from ${pending.provider}…`);
        const r = await exchange({
          patientId,
          providerId: pending.providerId,
          provider: pending.provider,
          fhirBaseUrl: pending.fhirBaseUrl,
          tokenEndpoint: pending.tokenEndpoint,
          clientId: pending.clientId,
          code,
          codeVerifier: pending.codeVerifier,
          redirectUri: pending.redirectUri,
        });
        clearPending();
        setMessage(`Connected ${pending.provider} — imported ${r.counts} records.`);
        // Land on the dashboard so the freshly synced record is right there.
        setTimeout(() => onDone("home"), 800);
      } catch (e: any) {
        fail(e?.message ?? "Could not complete the connection.");
      }
    })();

    function fail(m: string) {
      clearPending();
      setStatus("error");
      setMessage(m);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-full place-items-center px-6">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 text-center shadow-pop">
        <div className="mb-4 flex justify-center">
          <Wordmark />
        </div>
        {status === "working" ? (
          <>
            <div className="mx-auto mb-3 h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
            <p className="text-sm text-ink-600">{message}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-bad-ink">{message}</p>
            <button className="btn-secondary mt-4 w-full" onClick={() => onDone("integrations")}>
              Back to Connections
            </button>
          </>
        )}
      </div>
    </div>
  );
}
