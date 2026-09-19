import { defineApp } from "convex/server";
import staticHosting from "@convex-dev/static-hosting/convex.config";

// Host the built Vite frontend directly on Convex, served at
// https://<deployment>.convex.site alongside the backend + auth routes.
const app = defineApp();
app.use(staticHosting);

export default app;
