import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Tab Error Boundary Caught Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-8 text-center">
            <h3 className="text-lg font-bold text-destructive">
              Section Temporary Error
            </h3>
            <p className="mt-2 text-sm text-foreground/60">
              {this.state.error?.message || "An unexpected rendering error occurred."}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Try Again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
