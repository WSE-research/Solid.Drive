import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NotificationProvider } from '../NotificationContext-file/NotificationContext';
import { useNotifications } from '../NotificationContext-file/notificationContextValue';

type TestWindow = Window & { __confirmResult?: boolean };

// Helper component to access and use notification functions
function TestConsumer({ action }: { action?: (ctx: ReturnType<typeof useNotifications>) => void }) {
  const ctx = useNotifications();
  return (
    <div>
      <button onClick={() => ctx.showToast('toast msg')}>showToast</button>
      <button onClick={() => ctx.showError('error msg')}>showError</button>
      <button onClick={() => ctx.showSuccess('success msg')}>showSuccess</button>
      <button onClick={() => ctx.showInfo('info msg')}>showInfo</button>
      <button onClick={() => { ctx.confirm('Are you sure?').then((v) => { (window as TestWindow).__confirmResult = v; }); }}>confirm</button>
      {action && <button onClick={() => action(ctx)}>custom</button>}
    </div>
  );
}

function renderWithProvider(action?: (ctx: ReturnType<typeof useNotifications>) => void) {
  return render(
    <NotificationProvider>
      <TestConsumer action={action} />
    </NotificationProvider>
  );
}

describe('NotificationContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as TestWindow).__confirmResult;
  });

  it('throws a descriptive error when useNotifications is called outside NotificationProvider', () => {
    // Suppress React error boundary console noise
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      'useNotifications must be used within NotificationProvider'
    );
    spy.mockRestore();
  });

  it('renders children inside provider', () => {
    renderWithProvider();
    expect(screen.getByText('showToast')).toBeInTheDocument();
  });

  it('showToast displays a toast message', () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByText('showToast'));
    });
    expect(screen.getByText('toast msg')).toBeInTheDocument();
  });

  it('showError displays an error toast', () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByText('showError'));
    });
    expect(screen.getByText('error msg')).toBeInTheDocument();
  });

  it('showSuccess displays a success toast', () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByText('showSuccess'));
    });
    expect(screen.getByText('success msg')).toBeInTheDocument();
  });

  it('showInfo displays an info toast', () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByText('showInfo'));
    });
    expect(screen.getByText('info msg')).toBeInTheDocument();
  });

  it('toast auto-dismisses after 5 seconds', () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByText('showToast'));
    });
    expect(screen.getByText('toast msg')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('toast msg')).not.toBeInTheDocument();
  });

  it('toast can be manually dismissed', () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByText('showToast'));
    });
    expect(screen.getByText('toast msg')).toBeInTheDocument();

    const dismissBtn = screen.getByLabelText('Dismiss');
    act(() => {
      fireEvent.click(dismissBtn);
    });
    expect(screen.queryByText('toast msg')).not.toBeInTheDocument();
  });

  it('confirm shows confirmation dialog', () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByText('confirm'));
    });
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('confirm resolves true when Confirm is clicked', async () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByText('confirm'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Confirm'));
    });
    expect((window as TestWindow).__confirmResult).toBe(true);
    // Dialog should be dismissed
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
  });

  it('confirm resolves false when Cancel is clicked', async () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByText('confirm'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'));
    });
    expect((window as TestWindow).__confirmResult).toBe(false);
  });

  it('confirm resolves false when overlay is clicked', async () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByText('confirm'));
    });
    const overlay = document.querySelector('confirm-overlay')!;
    await act(async () => {
      fireEvent.click(overlay);
    });
    expect((window as TestWindow).__confirmResult).toBe(false);
  });

  it('clicking dialog itself does not dismiss (stopPropagation)', async () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByText('confirm'));
    });
    const dialog = document.querySelector('confirm-dialog')!;
    await act(async () => {
      fireEvent.click(dialog);
    });
    // Dialog should still be visible
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('multiple toasts can be shown simultaneously', () => {
    renderWithProvider();
    act(() => {
      fireEvent.click(screen.getByText('showError'));
      fireEvent.click(screen.getByText('showSuccess'));
    });
    expect(screen.getByText('error msg')).toBeInTheDocument();
    expect(screen.getByText('success msg')).toBeInTheDocument();
  });
});
