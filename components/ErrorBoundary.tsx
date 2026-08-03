"use client";
import { Component, ErrorInfo, ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

const ACCENT = "#C8853A";

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[error-boundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "#000",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: "45%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 340,
              height: 340,
              borderRadius: "9999px",
              background: `radial-gradient(circle, rgba(200,133,58,0.5) 0%, rgba(200,133,58,0.2) 40%, rgba(200,133,58,0) 72%)`,
              filter: "blur(60px)",
              pointerEvents: "none",
            }}
          />
          <p
            className="font-serif italic"
            style={{
              color: "#F5F0E8",
              fontSize: 27,
              textAlign: "center",
              marginBottom: 14,
            }}
          >
            the cube is confused
          </p>
          <p
            className="font-mono"
            style={{
              color: "#F5F0E8",
              opacity: 0.45,
              fontSize: 10,
              letterSpacing: "0.12em",
              textAlign: "center",
              marginBottom: 34,
            }}
          >
            something unexpected happened · your solves are safe
          </p>
          <button
            onClick={() => window.location.reload()}
            className="font-mono"
            style={{
              color: "#F5F0E8",
              fontSize: 11,
              letterSpacing: "0.24em",
              background: "transparent",
              border: "1px solid rgba(245,240,232,0.18)",
              borderRadius: 10,
              cursor: "pointer",
              padding: "13px 30px",
              transition: "border-color 0.2s ease, color 0.2s ease",
            }}
            onPointerEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = ACCENT;
              (e.currentTarget as HTMLElement).style.color = ACCENT;
            }}
            onPointerLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,240,232,0.18)";
              (e.currentTarget as HTMLElement).style.color = "#F5F0E8";
            }}
          >
            reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
