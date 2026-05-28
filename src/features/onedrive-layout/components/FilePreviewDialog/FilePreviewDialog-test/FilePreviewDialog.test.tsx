import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (_key: string, fallback?: string) => fallback ?? _key,
  ],
}));

vi.mock('@/features/onedrive-layout/icons', () => {
  const Stub = () => <span />;
  return { CloseIcon: Stub, DownloadIcon: Stub };
});

vi.mock(
  '@/features/file-explorer/components/FileCard/FileCard-file/FileMediaPreview',
  () => ({
    FileMediaPreview: (props: {
      previewUrl: string;
      mimeType: string;
      name?: string;
    }) => (
      <file-preview-body
        data-testid="file-media-preview"
        data-preview-url={props.previewUrl}
        data-mime={props.mimeType}
        data-name={props.name ?? ''}
      />
    ),
  }),
);

import { FilePreviewDialog } from '../FilePreviewDialog-file/FilePreviewDialog';

URL.createObjectURL = vi.fn(() => 'blob:mock');
URL.revokeObjectURL = vi.fn();

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  binaryUri: 'https://pod.example/file/binary',
  title: 'Baggage_description.pdf',
  mediaType: 'application/pdf',
  onDownload: vi.fn(),
};

const makeResponse = (overrides: Partial<Response> = {}): Response =>
  ({
    ok: true,
    status: 200,
    statusText: 'OK',
    blob: () => Promise.resolve(new Blob(['x'])),
    ...overrides,
  }) as unknown as Response;

describe('FilePreviewDialog', () => {
  beforeEach(() => {
    vi.mocked(URL.createObjectURL).mockReset().mockReturnValue('blob:mock');
    vi.mocked(URL.revokeObjectURL).mockReset();
    defaultProps.onOpenChange = vi.fn();
    defaultProps.onDownload = vi.fn();
  });

  it('renders nothing when open is false', () => {
    render(
      <FilePreviewDialog
        {...defaultProps}
        open={false}
        solidFetch={vi.fn() as unknown as typeof fetch}
      />,
    );
    expect(screen.queryByText('Baggage_description.pdf')).not.toBeInTheDocument();
  });

  it('shows the loading state while the binary is being fetched', () => {
    const fetchMock = vi.fn(() => new Promise(() => {}));
    render(
      <FilePreviewDialog
        {...defaultProps}
        solidFetch={fetchMock as unknown as typeof fetch}
      />,
    );
    expect(screen.getByText('Loading preview…')).toBeInTheDocument();
    expect(screen.getByText('Baggage_description.pdf')).toBeInTheDocument();
  });

  it('renders the FileMediaPreview with the object URL once the fetch resolves', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse());
    render(
      <FilePreviewDialog
        {...defaultProps}
        solidFetch={fetchMock as unknown as typeof fetch}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('file-media-preview')).toBeInTheDocument();
    });
    const preview = screen.getByTestId('file-media-preview');
    expect(preview.getAttribute('data-preview-url')).toBe('blob:mock');
    expect(preview.getAttribute('data-mime')).toBe('application/pdf');
    expect(preview.getAttribute('data-name')).toBe('Baggage_description.pdf');
  });

  it('surfaces the status + statusText when the fetch returns non-2xx', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeResponse({ ok: false, status: 404, statusText: 'Not Found' }));
    render(
      <FilePreviewDialog
        {...defaultProps}
        solidFetch={fetchMock as unknown as typeof fetch}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Could not load preview/)).toBeInTheDocument();
    });
    expect(screen.getByText(/404 Not Found/)).toBeInTheDocument();
  });

  it('surfaces the error message when the fetch throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    render(
      <FilePreviewDialog
        {...defaultProps}
        solidFetch={fetchMock as unknown as typeof fetch}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/offline/)).toBeInTheDocument();
    });
  });

  it('falls back to a generic reason when the fetch rejects with a non-Error value', async () => {
    const fetchMock = vi.fn().mockRejectedValue('boom');
    render(
      <FilePreviewDialog
        {...defaultProps}
        solidFetch={fetchMock as unknown as typeof fetch}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Unknown error/)).toBeInTheDocument();
    });
  });

  it('fires onDownload when the download button is clicked', async () => {
    const onDownload = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(makeResponse());
    render(
      <FilePreviewDialog
        {...defaultProps}
        onDownload={onDownload}
        solidFetch={fetchMock as unknown as typeof fetch}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('file-media-preview')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('revokes the object URL when the dialog closes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse());
    const { rerender } = render(
      <FilePreviewDialog
        {...defaultProps}
        solidFetch={fetchMock as unknown as typeof fetch}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('file-media-preview')).toBeInTheDocument();
    });
    await act(async () => {
      rerender(
        <FilePreviewDialog
          {...defaultProps}
          open={false}
          solidFetch={fetchMock as unknown as typeof fetch}
        />,
      );
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('drops the result when the dialog closes after the fetch resolves but before the blob is read', async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const { rerender } = render(
      <FilePreviewDialog
        {...defaultProps}
        solidFetch={fetchMock as unknown as typeof fetch}
      />,
    );
    rerender(
      <FilePreviewDialog
        {...defaultProps}
        open={false}
        solidFetch={fetchMock as unknown as typeof fetch}
      />,
    );
    await act(async () => {
      resolveFetch(makeResponse());
    });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('drops the result when the dialog closes after the blob is read but before setLoad fires', async () => {
    let resolveBlob!: (blob: Blob) => void;
    const response = {
      ok: true,
      status: 200,
      statusText: 'OK',
      blob: () =>
        new Promise<Blob>((resolve) => {
          resolveBlob = resolve;
        }),
    } as unknown as Response;
    const fetchMock = vi.fn().mockResolvedValue(response);
    const { rerender } = render(
      <FilePreviewDialog
        {...defaultProps}
        solidFetch={fetchMock as unknown as typeof fetch}
      />,
    );
    await act(async () => {});
    rerender(
      <FilePreviewDialog
        {...defaultProps}
        open={false}
        solidFetch={fetchMock as unknown as typeof fetch}
      />,
    );
    await act(async () => {
      resolveBlob(new Blob(['x']));
    });
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('suppresses the error setLoad when the dialog closes before the rejection propagates', async () => {
    let rejectFetch!: (error: Error) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((_, reject) => {
          rejectFetch = reject;
        }),
    );
    const { rerender } = render(
      <FilePreviewDialog
        {...defaultProps}
        solidFetch={fetchMock as unknown as typeof fetch}
      />,
    );
    rerender(
      <FilePreviewDialog
        {...defaultProps}
        open={false}
        solidFetch={fetchMock as unknown as typeof fetch}
      />,
    );
    await act(async () => {
      rejectFetch(new Error('aborted'));
    });
    expect(screen.queryByText(/aborted/)).not.toBeInTheDocument();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
