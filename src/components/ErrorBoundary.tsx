import { Component, ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

// Catches render/query errors so a single failure never blanks the whole app.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[TraceHealth] render error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "Inter, sans-serif" }}>
          <div style={{ maxWidth: 460, width: "100%", border: "1px solid #e7e7ea", borderRadius: 12, background: "#fff", padding: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#a1a1aa" }}>
              Something broke
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: "6px 0 4px", color: "#18181b" }}>
              We hit an error rendering this page
            </h1>
            <p style={{ fontSize: 13, color: "#71717a", margin: 0 }}>
              This is a prototype — the detail below helps us fix it.
            </p>
            <pre style={{ marginTop: 12, padding: 12, background: "#faf6f6", border: "1px solid #f0d9d9", borderRadius: 8, fontSize: 12, color: "#c0343a", whiteSpace: "pre-wrap", overflow: "auto", maxHeight: 180 }}>
              {String(this.state.error?.message ?? this.state.error)}
            </pre>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => {
                  window.location.hash = "";
                  window.location.reload();
                }}
                style={{ flex: 1, padding: "9px 12px", borderRadius: 8, background: "#18181b", color: "#fff", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer" }}
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
