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
};

// The public SMART sandbox works with any client id + PKCE — testable now.
// Epic/Cerner need a (free) registered client id, supplied via env.
export const PROVIDERS: Provider[] = [
  {
    id: "smart-sandbox",
    name: "SMART Health IT Sandbox",
    blurb: "Official developer test server. Real patient login + consent, but synthetic test patients — not real people.",
    // Patient-standalone launch pinned to a data-rich patient (314 obs) + skip the
    // picker, so it ALWAYS lands on a full record → consent only.
    // {"k":"1","b":"ede897d1-...","i":"1"} (base64url).
    fhirBaseUrl:
      "https://launch.smarthealthit.org/v/r4/sim/eyJrIjoiMSIsImIiOiJlZGU4OTdkMS1iMGQ0LTQ0MDEtOWM4Yi00NWNjZjYzN2NiYmQiLCJpIjoiMSJ9/fhir",
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
    blurb: "Connect your hospital account via Epic's patient API.",
    fhirBaseUrl: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
    clientId: import.meta.env.VITE_EPIC_CLIENT_ID as string | undefined,
    scopes: "launch/patient patient/*.read openid fhirUser offline_access",
    testable: false,
    domain: "epic.com",
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
