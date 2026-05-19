import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SelectedResource } from '@/features/onedrive-layout/hooks/useSelectedResource';
import { SelectionActions } from '../SelectionActions-file/SelectionActions';

/**
 * Drives the ResizeObserver-based overflow logic from tests by
 * stubbing the global with a controllable `triggerResize` helper.
 */
type ResizeCallback = (entries: Array<{ contentRect: { width: number } }>) => void;
let triggerResize: ((width: number) => void) | null = null;
const installResizeObserverStub = () => {
  const originalRO = (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver;
  class StubResizeObserver {
    private cb: ResizeCallback;
    constructor(cb: ResizeCallback) {
      this.cb = cb;
    }
    observe() {
      triggerResize = (width: number) => {
        this.cb([{ contentRect: { width } }]);
      };
    }
    unobserve() {}
    disconnect() {
      triggerResize = null;
    }
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = StubResizeObserver;
  return () => {
    triggerResize = null;
    (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = originalRO;
  };
};

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, fallback?: string) => fallback ?? key],
}));

const fileSelection: NonNullable<SelectedResource> = {
  kind: 'file',
  uri: 'https://pod/app/doc/',
  name: 'doc.pdf',
};

const baseHandlers = {
  onShare: vi.fn(),
  onCopyLink: vi.fn(),
  onDelete: vi.fn(),
  onDownload: vi.fn(),
  onMoveTo: vi.fn(),
  onRename: vi.fn(),
};

const ALL_ACTION_LABELS = [
  'share',
  'copy link',
  'delete',
  'download',
  'move to',
  'rename',
] as const;

describe('SelectionActions', () => {
  it('renders no action buttons when nothing is selected', () => {
    render(<SelectionActions selection={null} {...baseHandlers} />);
    for (const label of ALL_ACTION_LABELS) {
      expect(
        screen.queryByRole('button', { name: new RegExp(label, 'i') }),
      ).not.toBeInTheDocument();
    }
  });

  it('renders all six action buttons when a file is selected', () => {
    render(<SelectionActions selection={fileSelection} {...baseHandlers} />);
    for (const label of ALL_ACTION_LABELS) {
      expect(
        screen.getByRole('button', { name: new RegExp(label, 'i') }),
      ).toBeInTheDocument();
    }
  });

  it('clicking Share fires onShare', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();
    render(
      <SelectionActions
        {...baseHandlers}
        selection={fileSelection}
        onShare={onShare}
      />,
    );
    await user.click(screen.getByRole('button', { name: /share/i }));
    expect(onShare).toHaveBeenCalledOnce();
  });

  it('clicking Copy link fires onCopyLink', async () => {
    const user = userEvent.setup();
    const onCopyLink = vi.fn();
    render(
      <SelectionActions
        {...baseHandlers}
        selection={fileSelection}
        onCopyLink={onCopyLink}
      />,
    );
    await user.click(screen.getByRole('button', { name: /copy link/i }));
    expect(onCopyLink).toHaveBeenCalledOnce();
  });

  it('clicking Download fires onDownload', async () => {
    const user = userEvent.setup();
    const onDownload = vi.fn();
    render(
      <SelectionActions
        {...baseHandlers}
        selection={fileSelection}
        onDownload={onDownload}
      />,
    );
    await user.click(screen.getByRole('button', { name: /download/i }));
    expect(onDownload).toHaveBeenCalledOnce();
  });

  it('clicking Delete fires onDelete (not stubbed — wired in OneDriveLayout)', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <SelectionActions
        {...baseHandlers}
        selection={fileSelection}
        onDelete={onDelete}
      />,
    );
    const deleteBtn = screen.getByRole('button', { name: /delete/i });
    expect(deleteBtn).not.toHaveAttribute('data-stub');
    await user.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('Move To and Rename are stubbed (data-stub) but still forward clicks', async () => {
    const user = userEvent.setup();
    const onMoveTo = vi.fn();
    const onRename = vi.fn();
    render(
      <SelectionActions
        {...baseHandlers}
        selection={fileSelection}
        onMoveTo={onMoveTo}
        onRename={onRename}
      />,
    );
    const moveBtn = screen.getByRole('button', { name: /move to/i });
    const renameBtn = screen.getByRole('button', { name: /rename/i });
    expect(moveBtn).toHaveAttribute('data-stub', 'true');
    expect(renameBtn).toHaveAttribute('data-stub', 'true');
    await user.click(moveBtn);
    await user.click(renameBtn);
    expect(onMoveTo).toHaveBeenCalledOnce();
    expect(onRename).toHaveBeenCalledOnce();
  });

  describe('ResizeObserver-driven overflow', () => {
    let restore: (() => void) | null = null;

    afterEach(() => {
      restore?.();
      restore = null;
    });

    it('keeps all six actions inline when the container is wide enough', () => {
      restore = installResizeObserverStub();
      render(<SelectionActions selection={fileSelection} {...baseHandlers} />);
      // 6 buttons * 110px = 660px; anything ≥ 660 fits the lot.
      act(() => triggerResize?.(800));
      // All inline → no "More actions" trigger appears.
      expect(
        screen.queryByRole('button', { name: /more actions/i }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument();
    });

    it('shows the kebab and pushes overflow into it when the container shrinks', () => {
      restore = installResizeObserverStub();
      render(<SelectionActions selection={fileSelection} {...baseHandlers} />);
      // Width 300 - 44 (kebab) = 256 ÷ 110 ≈ 2 inline → 4 in kebab.
      act(() => triggerResize?.(300));
      expect(
        screen.getByRole('button', { name: /more actions/i }),
      ).toBeInTheDocument();
      // Share + Copy link survive inline; the rest are not visible
      // until the kebab opens.
      expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /rename/i }),
      ).not.toBeInTheDocument();
    });

    it('puts every action in the kebab at very narrow widths', () => {
      restore = installResizeObserverStub();
      render(<SelectionActions selection={fileSelection} {...baseHandlers} />);
      act(() => triggerResize?.(80));
      // 80 - 44 = 36, no room for any inline button.
      expect(
        screen.getByRole('button', { name: /more actions/i }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
    });

    it('forwards a click on a kebab menu item back to the matching handler', async () => {
      restore = installResizeObserverStub();
      const user = userEvent.setup();
      const onRename = vi.fn();
      render(
        <SelectionActions
          {...baseHandlers}
          selection={fileSelection}
          onRename={onRename}
        />,
      );
      // Force every action into the kebab so Rename lives in the menu.
      act(() => triggerResize?.(80));
      await user.click(screen.getByRole('button', { name: /more actions/i }));
      const renameItem = await screen.findByRole('menuitem', { name: /rename/i });
      await user.click(renameItem);
      expect(onRename).toHaveBeenCalledOnce();
    });

    it('ignores ResizeObserver entries with no first entry', () => {
      // Drives the `if (!entry) return;` guard inside the observer
      // callback when ResizeObserver fires with an empty entry list.
      const noopRO: ResizeCallback[] = [];
      const originalRO = (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver;
      class EmptyObserver {
        constructor(cb: ResizeCallback) { noopRO.push(cb); }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
      (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = EmptyObserver;
      try {
        render(<SelectionActions selection={fileSelection} {...baseHandlers} />);
        act(() => noopRO[0]?.([]));
        // All six actions stay inline because containerWidth never updates.
        expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument();
        expect(
          screen.queryByRole('button', { name: /more actions/i }),
        ).not.toBeInTheDocument();
      } finally {
        (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = originalRO;
      }
    });
  });
});
