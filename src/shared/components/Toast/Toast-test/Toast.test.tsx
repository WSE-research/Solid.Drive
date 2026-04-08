import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast } from '../Toast-file/Toast';

describe('Toast', () => {
  it('is defined', () => {
    expect(Toast).toBeDefined();
  });

  it('renders the message text', () => {
    render(<Toast message="Hello world" />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('has role="alert"', () => {
    render(<Toast message="Alert msg" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('applies info type class by default', () => {
    render(<Toast message="Info" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('toast', 'toast--info');
  });

  it('applies error type class', () => {
    render(<Toast message="Error" type="error" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('toast', 'toast--error');
  });

  it('applies success type class', () => {
    render(<Toast message="Success" type="success" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('toast', 'toast--success');
  });

  it('renders dismiss button when onDismiss is provided', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Dismissable" onDismiss={onDismiss} />);
    const btn = screen.getByLabelText('Dismiss');
    expect(btn).toBeInTheDocument();
  });

  it('does not render dismiss button when onDismiss is not provided', () => {
    render(<Toast message="No dismiss" />);
    expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(<Toast message="Click dismiss" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders message inside a span with toast__message class', () => {
    const { container } = render(<Toast message="Styled msg" />);
    const span = container.querySelector('.toast__message');
    expect(span).toBeInTheDocument();
    expect(span?.textContent).toBe('Styled msg');
  });
});
