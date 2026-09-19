import { useEffect, useState } from "react";
import { useConvexAuth, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { StoreProvider, useStore } from "./lib/store";
import Landing from "./components/Landing";
import Auth from "./components/Auth";
import AppShell from "./components/AppShell";
import DoctorView from "./components/DoctorView";
import OAuthCallback from "./components/OAuthCallback";

// Whenever a user is signed in without a loaded record, resolve (or create)
// their own patient. Runs reactively, so it never races sign-in token setup.
function useResolveMyPatient() {
  const { isAuthenticated } = useConvexAuth();
  const { patientId, setPatientId, shareToken } = useStore();
  const myPatient = useQuery(api.patients.getMyPatient, isAuthenticated && !shareToken ? {} : "skip");
  const ensure = useMutation(api.patients.ensureMyPatient);

  useEffect(() => {
    if (!isAuthenticated || shareToken || patientId) return;
    if (myPatient === undefined) return; // still loading
    if (myPatient) {
      setPatientId(myPatient);
    } else {
      ensure({}).then((id) => setPatientId(id)).catch(() => {});
    }
  }, [isAuthenticated, shareToken, patientId, myPatient]);
}

function Router() {
  const { view, shareToken, go } = useStore();
  useResolveMyPatient();

  // OAuth redirect target — handle the SMART callback, then transition
  // client-side (NO full reload) so the just-established session is preserved
  // and the user lands straight on their populated record.
  const [inCallback, setInCallback] = useState(
    () => typeof window !== "undefined" && window.location.pathname === "/callback",
  );
  if (inCallback) {
    return (
      <OAuthCallback
        onDone={(target) => {
          setInCallback(false);
          go(target); // updates the URL via the store's router; clears ?code=…
        }}
      />
    );
  }

  // Public doctor-share link stands alone (no app chrome).
  if (shareToken) return <DoctorView />;

  if (view === "landing") return <Landing />;
  if (view === "auth") return <Auth />;
  return <AppShell />;
}

export default function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  );
}
