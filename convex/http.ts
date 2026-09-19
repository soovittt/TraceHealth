import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { auth } from "./auth";
import { components } from "./_generated/api";

const http = httpRouter();

// Exact routes (auth endpoints) are matched before the static catch-all, so
// login keeps working; unknown paths fall back to the SPA's index.html.
auth.addHttpRoutes(http);
registerStaticRoutes(http, components.staticHosting);

export default http;
