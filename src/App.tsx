import { useEffect } from "react";
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
  const { view, shareToken } = useStore();
  useResolveMyPatient();

  // OAuth redirect target — handles the SMART callback then routes onward.
  if (window.location.pathname === "/callback") return <OAuthCallback />;

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
