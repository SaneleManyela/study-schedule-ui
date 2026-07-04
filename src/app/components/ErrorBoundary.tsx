import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Top-level error boundary.
 *
 * Catches unhandled render errors that would otherwise leave the user on a
 * blank white page with no way to recover. Shows a minimal recovery UI and
 * logs the error so it appears in Cloud Logging / the browser console.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Logged here so the error appears in Cloud Logging when deployed.
    console.error("[ErrorBoundary] Unhandled render error:", error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false, message: "" });
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ color: "#6b7280", maxWidth: "36rem" }}>
          An unexpected error occurred. Your data is safe — this is a display issue only.
        </p>
        {this.state.message && (
          <code
            style={{
              display: "block",
              background: "#f3f4f6",
              borderRadius: "0.5rem",
              padding: "0.75rem 1rem",
              fontSize: "0.8rem",
              color: "#374151",
              maxWidth: "36rem",
              wordBreak: "break-all",
            }}
          >
            {this.state.message}
          </code>
        )}
        <button
          onClick={this.handleReload}
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 1.5rem",
            background: "#111827",
            color: "#fff",
            borderRadius: "0.5rem",
            border: "none",
            cursor: "pointer",
            fontSize: "0.9rem",
          }}
        >
          Reload app
        </button>
      </div>
    );
  }
}
