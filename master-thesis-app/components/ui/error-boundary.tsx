"use client";

import React, { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorIcon } from "@/components/ui/error-icon";
import { SegmentErrorLayout } from "@/components/errors/segment-error-layout";
import { logger } from "@/lib/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Ved endring av key (f.eks. tab) prøves reset. */
  resetKeys?: Array<string | number>;
  /** Vertikal sentrering i hovedfeltet (under header / ved siden av sidebar). */
  centerInMainColumn?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Feilgrense som viser fallback UI ved render-feil (f.eks. i en fane)
 * uten å ta ned hele siden. Bruk resetKeys={[tab]} for å resette ved fane-bytt.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    logger.error("ErrorBoundary caught", { message: error.message, errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys } = this.props;
    if (
      this.state.hasError &&
      resetKeys &&
      prevProps.resetKeys &&
      resetKeys.some((k, i) => prevProps.resetKeys![i] !== k)
    ) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const err = this.state.error;
      const isDev = process.env.NODE_ENV === "development";

      const card = (
        <div
          className="mx-auto w-full max-w-lg rounded-lg border border-border bg-card p-5 text-center shadow-sm sm:p-6"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            <ErrorIcon size="xs" className="shrink-0" />
            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-foreground sm:text-lg">
                Kunne ikke vise innholdet
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground px-0.5">
                En uventet feil oppstod i denne delen av siden. Prøv igjen,
                eller last hele vinduet på nytt hvis problemet vedvarer.
              </p>
            </div>
            {isDev && err?.message ? (
              <details className="w-full rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-left">
                <summary className="cursor-pointer text-xs font-medium text-foreground">
                  Tekniske detaljer (kun utvikling)
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto wrap-break-word whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">
                  {err.message}
                </pre>
              </details>
            ) : null}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button variant="default" size="sm" onClick={this.reset}>
                <RefreshCw className="mr-2 size-3.5" />
                Prøv igjen
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (typeof window !== "undefined") window.location.reload();
                }}
              >
                Last siden på nytt
              </Button>
            </div>
          </div>
        </div>
      );

      return this.props.centerInMainColumn ? (
        <SegmentErrorLayout>{card}</SegmentErrorLayout>
      ) : (
        card
      );
    }
    return this.props.children;
  }
}
