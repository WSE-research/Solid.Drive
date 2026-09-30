import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGuardedSoftDelete } from '../useGuardedSoftDelete-file/useGuardedSoftDelete';

const mockConfirm = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();
vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({ confirm: mockConfirm, showSuccess: mockShowSuccess, showError: mockShowError }),
}));

const resourceUri = 'https://pod.example/my-solid-app/photo-2024/';
const otherResourceUri = 'https://pod.example/my-solid-app/sunset-2024/';

describe('useGuardedSoftDelete', () => {
  beforeEach(() => {
    mockConfirm.mockReset().mockResolvedValue(true);
    mockShowSuccess.mockClear();
    mockShowError.mockClear();
  });

  it('does nothing when the confirm prompt is declined', async () => {
    mockConfirm.mockResolvedValue(false);
    const run = vi.fn();
    const { result } = renderHook(() => useGuardedSoftDelete());

    await result.current.runGuardedDelete({
      resourceUri,
      confirmMessage: 'Delete it?',
      failedMessage: 'Delete failed',
      run,
    });

    expect(run).not.toHaveBeenCalled();
    expect(mockShowSuccess).not.toHaveBeenCalled();
  });

  it('shows the success message and calls onSuccess when the delete succeeds', async () => {
    const onSuccess = vi.fn();
    const run = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useGuardedSoftDelete());

    await result.current.runGuardedDelete({
      resourceUri,
      confirmMessage: 'Delete it?',
      failedMessage: 'Delete failed',
      successMessage: 'Deleted',
      onSuccess,
      run,
    });

    expect(mockShowSuccess).toHaveBeenCalledWith('Deleted');
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('skips the success toast when no successMessage is given, but still calls onSuccess', async () => {
    const onSuccess = vi.fn();
    const run = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useGuardedSoftDelete());

    await result.current.runGuardedDelete({
      resourceUri,
      confirmMessage: 'Delete it?',
      failedMessage: 'Delete failed',
      onSuccess,
      run,
    });

    expect(mockShowSuccess).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('shows the failure reason and skips onSuccess when the delete reports { ok: false }', async () => {
    const onSuccess = vi.fn();
    const run = vi.fn().mockResolvedValue({ ok: false, reason: '403 Forbidden' });
    const { result } = renderHook(() => useGuardedSoftDelete());

    await result.current.runGuardedDelete({
      resourceUri,
      confirmMessage: 'Delete it?',
      failedMessage: 'Delete failed',
      onSuccess,
      run,
    });

    expect(mockShowError).toHaveBeenCalledWith('Delete failed: 403 Forbidden');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('reports a thrown Error the same way as an { ok: false } result', async () => {
    const run = vi.fn().mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useGuardedSoftDelete());

    await result.current.runGuardedDelete({
      resourceUri,
      confirmMessage: 'Delete it?',
      failedMessage: 'Delete failed',
      run,
    });

    expect(mockShowError).toHaveBeenCalledWith('Delete failed: network down');
  });

  it('falls back to "Unknown error" when a non-Error value is thrown', async () => {
    const run = vi.fn().mockRejectedValue('plain string failure');
    const { result } = renderHook(() => useGuardedSoftDelete());

    await result.current.runGuardedDelete({
      resourceUri,
      confirmMessage: 'Delete it?',
      failedMessage: 'Delete failed',
      run,
    });

    expect(mockShowError).toHaveBeenCalledWith('Delete failed: Unknown error');
  });

  it('ignores a second call for the same resource fired while the first is still in flight', async () => {
    let resolveRun: ((value: { ok: true }) => void) | undefined;
    const run = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveRun = resolve;
      }),
    );
    const { result } = renderHook(() => useGuardedSoftDelete());

    const call1 = result.current.runGuardedDelete({ resourceUri, confirmMessage: 'Delete it?', failedMessage: 'Delete failed', run });
    const call2 = result.current.runGuardedDelete({ resourceUri, confirmMessage: 'Delete it?', failedMessage: 'Delete failed', run });
    resolveRun!({ ok: true });
    await Promise.all([call1, call2]);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not block a delete of a different resource while the first is still in flight', async () => {
    let resolveFirstRun: ((value: { ok: true }) => void) | undefined;
    const run = vi.fn().mockImplementation((uri: string) =>
      uri === resourceUri
        ? new Promise((resolve) => {
            resolveFirstRun = resolve;
          })
        : Promise.resolve({ ok: true }),
    );
    const { result } = renderHook(() => useGuardedSoftDelete());

    const call1 = result.current.runGuardedDelete({
      resourceUri,
      confirmMessage: 'Delete it?',
      failedMessage: 'Delete failed',
      run: () => run(resourceUri),
    });
    const call2 = result.current.runGuardedDelete({
      resourceUri: otherResourceUri,
      confirmMessage: 'Delete it?',
      failedMessage: 'Delete failed',
      run: () => run(otherResourceUri),
    });
    await call2;
    resolveFirstRun!({ ok: true });
    await call1;

    expect(run).toHaveBeenCalledWith(resourceUri);
    expect(run).toHaveBeenCalledWith(otherResourceUri);
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('allows a new delete once the previous one has settled', async () => {
    const run = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useGuardedSoftDelete());

    await result.current.runGuardedDelete({ resourceUri, confirmMessage: 'Delete it?', failedMessage: 'Delete failed', run });
    await result.current.runGuardedDelete({ resourceUri, confirmMessage: 'Delete it?', failedMessage: 'Delete failed', run });

    expect(run).toHaveBeenCalledTimes(2);
  });
});
