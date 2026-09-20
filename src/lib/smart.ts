// SMART on FHIR OAuth 2.0 (Authorization Code + PKCE) — the consumer rail for
// connecting a provider ("log into your portal, authorize read access").

export type Provider = {
  id: string;
  name: string;
  blurb: string;
  fhirBaseUrl: string;
  clientId: string | undefined;
  scopes: string;
  testable: boolean; // works today without registration
  sandbox?: boolean; // true = synthetic test patients, not real people
  domain?: string; // for brand logo
  open?: boolean; // open FHIR server: no OAuth/login — fetched server-side directly
  openToken?: string; // a static bearer some "open" servers require (e.g. ONC Inferno)
  openPatientId?: string; // pin a known patient (some open servers reject list queries)
  loginHint?: string; // sandbox test credentials to show on the card
};

// The public SMART sandbox works with any client id + PKCE — testable now.
// Epic/Cerner need a (free) registered client id, supplied via env.
export const PROVIDERS: Provider[] = [
  {
    id: "smart-sandbox",
    name: "SMART Health IT Sandbox",
    blurb: "Official developer test server. Log in, pick any synthetic patient, and authorize — connect a few to compare records.",
    // Unpinned base: standalone launch shows the sandbox patient picker; the
    // chosen patient comes back in the token response (`patient`).
    fhirBaseUrl: "https://launch.smarthealthit.org/v/r4/fhir",
    clientId: "tracehealth-app",
    // read for import + write so a report can be written back as a DocumentReference.
    scopes: "launch/patient patient/*.read patient/*.write openid fhirUser offline_access",
    testable: true,
    sandbox: true,
    domain: "smarthealthit.org",
  },
  {
    id: "epic",
    name: "Epic MyChart",
    blurb: "Real Epic hospitals over SMART on FHIR — sandbox test patients.",
    fhirBaseUrl: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
    clientId: import.meta.env.VITE_EPIC_CLIENT_ID as string | undefined,
    scopes: "launch/patient patient/*.read openid fhirUser offline_access",
    testable: false,
    sandbox: true,
    domain: "epic.com",
    loginHint: "Sandbox login: fhircamila / epicepic1",
  },
  {
    id: "cerner",
    name: "Oracle Health (Cerner)",
    blurb: "Oracle Health / Cerner SMART login. The flow is wired — connecting needs a free Cerner developer client id.",
    // Cerner's public R4 sandbox tenant; SMART discovery lives at its .well-known.
    fhirBaseUrl: "https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d",
    clientId: import.meta.env.VITE_CERNER_CLIENT_ID as string | undefined,
    scopes: "launch/patient patient/*.read openid fhirUser offline_access",
    testable: false,
    sandbox: true,
    domain: "oracle.com",
  },
  {
    id: "va",
    name: "VA Health (Lighthouse)",
    blurb: "U.S. Dept. of Veterans Affairs FHIR sandbox with synthetic Veteran records. Needs a free VA developer client id.",
    fhirBaseUrl: "https://sandbox-api.va.gov/services/fhir/v0/r4",
    clientId: import.meta.env.VITE_VA_CLIENT_ID as string | undefined,
    // VA Lighthouse requires explicit per-resource scopes (no patient/*.read wildcard).
    scopes: "launch/patient patient/Patient.read patient/Observation.read patient/Condition.read patient/MedicationRequest.read patient/AllergyIntolerance.read patient/Encounter.read openid fhirUser offline_access",
    testable: false,
    sandbox: true,
    domain: "va.gov",
  },

  // ---- open FHIR servers: no login, fetched server-side, real R4 data ----
  {
    id: "hapi",
    name: "HAPI FHIR (public server)",
    blurb: "A public FHIR R4 test server — no login. We pull a sample synthetic patient's record. Great for a quick look.",
    fhirBaseUrl: "https://hapi.fhir.org/baseR4",
    clientId: undefined,
    scopes: "",
    testable: true,
    sandbox: true,
    open: true,
    domain: "hapifhir.io",
  },
  {
    id: "oracle-open",
    name: "Oracle Health (open sample)",
    blurb: "Oracle Health / Cerner's open sandbox — no login. Pulls a synthetic patient in Cerner's FHIR format.",
    fhirBaseUrl: "https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d",
    clientId: undefined,
    scopes: "",
    testable: true,
    sandbox: true,
    open: true,
    // Cerner rejects open Patient/Observation list queries, so pin a data-rich patient.
    openPatientId: "12724066",
    domain: "oracle.com",
  },
  {
    id: "inferno",
    name: "ONC Inferno (US Core)",
    blurb: "The U.S. ONC reference server — no login. Curated US Core R4 sample patients (clean, standards-conformant data).",
    fhirBaseUrl: "https://inferno.healthit.gov/reference-server/r4",
    clientId: undefined,
    scopes: "",
    testable: true,
    sandbox: true,
    open: true,
    openToken: "SAMPLE_TOKEN",
    // Pin a data-rich US Core patient (discovery lands on a near-empty test patient).
    openPatientId: "355",
    domain: "healthit.gov",
  },
];

// Build a Provider from a directory search result (real hospital on Epic/Cerner).
export function providerFromDirectory(org: { name: string; fhirBaseUrl: string; portal: string }): Provider {
  const clientId =
    org.portal === "epic"
      ? (import.meta.env.VITE_EPIC_CLIENT_ID as string | undefined)
      : (import.meta.env.VITE_CERNER_CLIENT_ID as string | undefined);
  return {
    id: `${org.portal}:${org.fhirBaseUrl}`,
    name: org.name,
    blurb: "",
    fhirBaseUrl: org.fhirBaseUrl,
    clientId,
    scopes: "launch/patient patient/*.read openid fhirUser offline_access",
    testable: !!clientId,
    sandbox: false,
    domain: undefined,
  };
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function randomString(len = 40): string {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return base64url(a);
}
async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return base64url(new Uint8Array(digest));
}

type PendingOAuth = {
  providerId: string;
  provider: string;
  fhirBaseUrl: string;
  tokenEndpoint: string;
  clientId: string;
  codeVerifier: string;
  redirectUri: string;
  state: string;
};

const KEY = "smart_oauth_pending";

export function loadPending(): PendingOAuth | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
export function clearPending() {
  sessionStorage.removeItem(KEY);
}

// Discover endpoints, build a PKCE authorize URL, and redirect the browser.
export async function startConnect(p: Provider) {
  if (!p.clientId) throw new Error(`${p.name} needs a client id (set VITE_${p.id.toUpperCase()}_CLIENT_ID).`);

  const conf = await fetch(`${p.fhirBaseUrl}/.well-known/smart-configuration`, {
    headers: { Accept: "application/json" },
  }).then((r) => {
    if (!r.ok) throw new Error(`Could not read ${p.name}'s SMART configuration.`);
    return r.json();
  });
  const authorizeEndpoint: string = conf.authorization_endpoint;
  const tokenEndpoint: string = conf.token_endpoint;

  const codeVerifier = randomString(48);
  const codeChallenge = await sha256(codeVerifier);
  const state = randomString(16);
  const redirectUri = `${window.location.origin}/callback`;

  const pending: PendingOAuth = {
    providerId: p.id,
    provider: p.name,
    fhirBaseUrl: p.fhirBaseUrl,
    tokenEndpoint,
    clientId: p.clientId,
    codeVerifier,
    redirectUri,
    state,
  };
  sessionStorage.setItem(KEY, JSON.stringify(pending));

  const url = new URL(authorizeEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", p.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", p.scopes);
  url.searchParams.set("state", state);
  url.searchParams.set("aud", p.fhirBaseUrl);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  window.location.assign(url.toString());
}
