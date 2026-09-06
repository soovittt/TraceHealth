import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useStore } from "../lib/store";
import { Mark, Wordmark } from "./brand";

export default function Auth() {
  const { signIn } = useAuthActions();
  const { authMode, go } = useStore();

  const [mode, setMode] = useState(authMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signUp" && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("email", email.trim());
      fd.set("password", password);
      fd.set("flow", mode);
      if (mode === "signUp") fd.set("name", name.trim());
      await signIn("password", fd);
      // Signed in. The app-level resolver creates/loads this user's record and
      // routes to the dashboard — no fragile mutation call right after sign-in.
      go("home");
    } catch (err: any) {
      setError(prettyError(String(err?.message ?? err), mode));
      setBusy(false);
    }
  }

  const signUp = mode === "signUp";

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-900 p-10 text-white lg:flex">
        <button onClick={() => go("landing")} className="flex items-center gap-2 text-white/90">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-white/10">
            <Mark className="h-3.5 w-3.5" color="#fff" />
          </span>
          <span className="text-[15px] font-semibold">TraceHealth</span>
        </button>

        <div className="max-w-sm">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Your whole health history, in one private record.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Connect providers over FHIR, import documents, and ask an AI that reasons over your
            records — every answer traced to its source.
          </p>
          <div className="mt-7 space-y-2.5">
            {[
              "End-to-end longitudinal timeline",
              "Source-cited AI assistant",
              "Cross-record conflict detection",
              "Share a clinician snapshot in one click",
            ].map((t) => (
              <div key={t} className="flex items-center gap-2.5 text-sm text-white/80">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-white/10">
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="#fff" strokeWidth="1.6">
                    <path d="M2.5 6.5 5 9l4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>

        <div className="text-2xs text-white/40">
          Your records are private to your account. HIPAA-minded by design.
        </div>

        {/* faint grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
      </div>

      {/* form panel */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b border-line px-6 py-3.5 lg:hidden">
          <button onClick={() => go("landing")}><Wordmark /></button>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm animate-rise">
            <h1 className="text-2xl font-semibold text-ink-900">
              {signUp ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              {signUp ? "Start your private health record — takes 20 seconds." : "Sign in to your health record."}
            </p>

            <form onSubmit={submit} className="mt-6 space-y-3">
              {signUp && (
                <Field label="Full name">
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sarah Williams" autoComplete="name" />
                </Field>
              )}
              <Field label="Email">
                <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
              </Field>
              <Field label="Password">
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  minLength={signUp ? 8 : undefined}
                  placeholder={signUp ? "At least 8 characters" : "Your password"}
                  autoComplete={signUp ? "new-password" : "current-password"}
                />
              </Field>
              {signUp && (
                <Field label="Confirm password">
                  <PasswordInput
                    value={confirm}
                    onChange={setConfirm}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    invalid={!!confirm && confirm !== password}
                  />
                  {confirm && confirm !== password && (
                    <span className="mt-1 block text-2xs text-bad">Passwords don't match</span>
                  )}
                </Field>
              )}

              {error && (
                <div className="rounded-md border border-bad/30 bg-bad-soft px-3 py-2 text-xs text-bad-ink">{error}</div>
              )}

              <button
                className="btn-primary w-full py-2.5"
                disabled={busy || (signUp && (password.length < 8 || password !== confirm))}
              >
                {busy ? "One moment…" : signUp ? "Create account" : "Sign in"}
              </button>
            </form>

            <div className="mt-4 text-center text-sm text-ink-500">
              {signUp ? "Already have an account?" : "New to TraceHealth?"}{" "}
              <button className="font-medium text-accent" onClick={() => { setError(null); setMode(signUp ? "signIn" : "signUp"); }}>
                {signUp ? "Sign in" : "Create one"}
              </button>
            </div>

            <p className="mt-6 text-center text-2xs text-ink-400">
              By continuing you agree this is a hackathon prototype, not a medical device.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  invalid,
  minLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  invalid?: boolean;
  minLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className={`input pr-9 ${invalid ? "border-bad/50 focus:border-bad/50 focus:ring-bad-soft" : ""}`}
        type={show ? "text" : "password"}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-ink-400 hover:bg-line-soft hover:text-ink-700"
      >
        {show ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.5 6.5a2 2 0 0 0 2.8 2.8" />
            <path d="M2 8s2.2-4 6-4c1 0 1.9.3 2.7.700M13.4 5.6C13.8 6.2 14 8 14 8s-2.2 4-6 4c-1 0-1.9-.3-2.7-.7" />
            <path d="M2.5 2.5l11 11" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" />
            <circle cx="8" cy="8" r="1.8" />
          </svg>
        )}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-600">{label}</span>
      {children}
    </label>
  );
}

function prettyError(raw: string, mode: string): string {
  const s = raw.toLowerCase();
  // Convex hides server-error details from the client, so match what we can and
  // fall back to the most likely cause for each flow.
  if (s.includes("already") || s.includes("exists"))
    return "An account with this email already exists — try signing in.";
  if (s.includes("invalidsecret") || s.includes("invalid password") || s.includes("invalidaccountid"))
    return "Incorrect email or password.";
  if (s.includes("password") && s.includes("8")) return "Password must be at least 8 characters.";
  return mode === "signIn"
    ? "Incorrect email or password."
    : "We couldn't create this account — it may already exist. Try signing in instead.";
}
