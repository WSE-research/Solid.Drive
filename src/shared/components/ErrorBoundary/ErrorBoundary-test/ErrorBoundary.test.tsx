import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary-file/ErrorBoundary';

// Component that throws on render
function ThrowingChild({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Child content</div>;
}

describe('ErrorBoundary', () => {
  // Suppress React error boundary console.error noise
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('is defined', () => {
    expect(ErrorBoundary).toBeDefined();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Safe content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('renders default fallback when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
  });

  it('renders default fallback inside error-boundary div', () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(container.querySelector('.error-boundary')).toBeInTheDocument();
    expect(container.querySelector('.error-boundary__message')).toBeInTheDocument();
  });

  it('renders custom fallback when provided and child throws', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong.')).not.toBeInTheDocument();
  });

  it('does not render children after error', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );
    expect(screen.queryByText('Child content')).not.toBeInTheDocument();
  });

  it('calls console.error via componentDidCatch', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>
    );
    // React calls console.error + our componentDidCatch calls it
    expect(consoleErrorSpy).toHaveBeenCalled();
    const errorBoundaryCall = consoleErrorSpy.mock.calls.find(
      (call) => call[0] === '[ErrorBoundary]'
    );
    expect(errorBoundaryCall).toBeDefined();
    expect(errorBoundaryCall![1]).toBeInstanceOf(Error);
    expect(errorBoundaryCall![1].message).toBe('Test error');
  });

  it('getDerivedStateFromError sets hasError and error', () => {
    const error = new Error('Test derived');
    const result = ErrorBoundary.getDerivedStateFromError(error);
    expect(result).toEqual({ hasError: true, error });
  });
});
