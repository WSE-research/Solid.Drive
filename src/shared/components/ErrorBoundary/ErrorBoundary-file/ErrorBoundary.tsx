/**
 * Error boundary component for catching React errors.
 *
 * @packageDocumentation
 */

import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

/**
 * Props for the ErrorBoundary component.
 */
type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * State for the ErrorBoundary component.
 */
type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Error boundary class component that catches JavaScript errors
 * in child components and displays a fallback UI.
 *
 * @public
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Production apps would log to an error service here
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="error-boundary">
          <p className="error-boundary__message">Something went wrong.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
