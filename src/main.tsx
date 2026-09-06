import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;

// Apply saved theme before first paint (default: light).
if (localStorage.getItem("th_theme") === "dark") {
  document.documentElement.classList.add("dark");
}

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (!url) {
  root.render(
    <div style={{ maxWidth: 640, margin: "80px auto", fontFamily: "Inter, sans-serif", padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>TraceHealth needs its backend</h1>
      <p style={{ color: "#475569", lineHeight: 1.6 }}>
        <code>VITE_CONVEX_URL</code> is not set. Start the Convex dev backend once — it
        writes the URL into <code>.env.local</code> and generates the API types:
      </p>
      <pre style={{ background: "#0f1115", color: "#e2e8f0", padding: 16, borderRadius: 12 }}>
npx convex dev
      </pre>
      <p style={{ color: "#475569" }}>Then reload this page (or run <code>npm run dev:all</code>).</p>
    </div>,
  );
} else {
  const convex = new ConvexReactClient(url);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <ConvexAuthProvider client={convex}>
          <App />
        </ConvexAuthProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
