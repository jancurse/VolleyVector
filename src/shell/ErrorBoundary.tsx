import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

import { Button } from "../ui/Button";
import { cx, EYEBROW, MUTED, TITLE } from "../ui/styles";

// The top-level crash net: if a render throws anywhere below it, the app shows a recover/reload screen
// instead of a blank page. React offers no hook equivalent for catching render errors, so this is the
// one sanctioned class component in the codebase. Recover clears the error and retries the same tree;
// Reload reloads the document, the harder reset for a state the retry cannot escape.

const BG =
  "flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6 text-center [background:radial-gradient(135%_90%_at_50%_-10%,var(--bg-glow),transparent_55%),var(--bg)]";

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { error: Error | null };

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("App crashed:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error === null) return this.props.children;

    return (
      <div className={cx(BG)}>
        <div>
          <p className={EYEBROW}>Something went wrong</p>
          <h1 className={TITLE}>The app hit an unexpected error</h1>
        </div>
        <p className={MUTED}>Try again, or reload the page if it keeps happening.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
          <Button variant="ghost" paired onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    );
  }
}
