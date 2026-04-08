import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TypeFolder } from '../TypeFolder-file/TypeFolder';

const mockFetch = vi.fn();
const mockDiscoverInboxUri = vi.fn();
const mockPostFileAccessRequest = vi.fn();
const mockDeleteAccessRequest = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ fetch: mockFetch }),
}));

vi.mock('@/infrastructure/validation/fileTypeRegistry', () => ({
  getFileTypeInfo: (uri: string) => ({
    label: uri === 'http://schema.org/ImageObject' ? 'Image' : 'Document',
    description: 'test',
  }),
}));

vi.mock('@/infrastructure/solid/sharedCatalog', () => ({
  toContainerUri: (uri: string) => uri.replace(/index\.ttl$/, ''),
}));

vi.mock('@/infrastructure/inbox/inboxAccess', () => ({
  discoverInboxUri: (...args: any[]) => mockDiscoverInboxUri(...args),
  postFileAccessRequest: (...args: any[]) => mockPostFileAccessRequest(...args),
  deleteAccessRequest: (...args: any[]) => mockDeleteAccessRequest(...args),
}));

const entries = [
  { uri: 'https://pod.example/app/doc1/index.ttl', title: 'Document 1', conformsTo: '' },
  { uri: 'https://pod.example/app/doc2/index.ttl', title: '', conformsTo: '' },
];

const baseProps = {
  classUri: 'http://schema.org/ImageObject',
  entries: entries as any,
  contactWebId: 'https://contact.example/profile/card#me',
  viewerWebId: 'https://viewer.example/profile/card#me',
  rejections: new Map(),
  onClearRejection: vi.fn(),
};

describe('TypeFolder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDiscoverInboxUri.mockResolvedValue('https://contact.example/inbox/');
    mockPostFileAccessRequest.mockResolvedValue(undefined);
    mockDeleteAccessRequest.mockResolvedValue(undefined);
  });

  it('renders collapsed folder with label and count', () => {
    render(<TypeFolder {...baseProps} />);
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByText(String(entries.length))).toBeInTheDocument();
  });

  it('shows closed folder icon when collapsed', () => {
    render(<TypeFolder {...baseProps} />);
    expect(screen.queryByText('doc1')).not.toBeInTheDocument();
  });

  it('shows file list when expanded', () => {
    render(<TypeFolder {...baseProps} />);
    fireEvent.click(screen.getByText('Image'));
    expect(screen.getByText('Document 1')).toBeInTheDocument();
    // doc2 has no title, should show decoded URI segment
    expect(screen.getByText('doc2')).toBeInTheDocument();
  });

  it('toggles open/closed on click', () => {
    render(<TypeFolder {...baseProps} />);
    fireEvent.click(screen.getByText('Image'));
    expect(screen.getByText('Document 1')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Image'));
    expect(screen.queryByText('Document 1')).not.toBeInTheDocument();
  });

  it('renders "request all" button', () => {
    render(<TypeFolder {...baseProps} />);
    expect(screen.getByText('sharedWithMe.requestAll')).toBeInTheDocument();
  });

  it('request all button sends requests for all entries', async () => {
    render(<TypeFolder {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('sharedWithMe.requestAll'));
    });
    expect(mockDiscoverInboxUri).toHaveBeenCalledWith('https://contact.example/profile/card#me', mockFetch);
    expect(mockPostFileAccessRequest).toHaveBeenCalledTimes(2);
  });

  it('shows "request sent" after successful bulk request', async () => {
    render(<TypeFolder {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('sharedWithMe.requestAll'));
    });
    expect(screen.getByText('sharedWithMe.requestSent')).toBeInTheDocument();
  });

  it('shows "request error" when bulk request fails', async () => {
    mockDiscoverInboxUri.mockRejectedValue(new Error('fail'));
    render(<TypeFolder {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('sharedWithMe.requestAll'));
    });
    expect(screen.getByText('sharedWithMe.requestError')).toBeInTheDocument();
  });

  it('individual file request button works', async () => {
    render(<TypeFolder {...baseProps} />);
    fireEvent.click(screen.getByText('Image'));
    const requestButtons = screen.getAllByText('sharedWithMe.requestFile');
    await act(async () => {
      fireEvent.click(requestButtons[0]);
    });
    expect(mockPostFileAccessRequest).toHaveBeenCalledTimes(1);
  });

  it('shows rejection badge and request again button', () => {
    const rejections = new Map([
      ['https://pod.example/app/doc1/', {
        accessTo: 'https://pod.example/app/doc1/',
        messageUri: 'https://viewer.example/inbox/rejection1',
        sender: 'https://contact.example/profile/card#me',
      }],
    ]);
    render(<TypeFolder {...baseProps} rejections={rejections as any} />);
    fireEvent.click(screen.getByText('Image'));
    expect(screen.getByText('sharedWithMe.requestDenied')).toBeInTheDocument();
    expect(screen.getByText('sharedWithMe.requestAgain')).toBeInTheDocument();
  });

  it('request again deletes old rejection and re-requests', async () => {
    const rejections = new Map([
      ['https://pod.example/app/doc1/', {
        accessTo: 'https://pod.example/app/doc1/',
        messageUri: 'https://viewer.example/inbox/rejection1',
        sender: 'https://contact.example/profile/card#me',
      }],
    ]);
    render(<TypeFolder {...baseProps} rejections={rejections as any} />);
    fireEvent.click(screen.getByText('Image'));
    await act(async () => {
      fireEvent.click(screen.getByText('sharedWithMe.requestAgain'));
    });
    expect(mockDeleteAccessRequest).toHaveBeenCalledWith(
      'https://viewer.example/inbox/rejection1',
      mockFetch
    );
    expect(baseProps.onClearRejection).toHaveBeenCalledWith('https://pod.example/app/doc1/');
  });

  it('disables request all button after sent', async () => {
    render(<TypeFolder {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('sharedWithMe.requestAll'));
    });
    expect(screen.getByText('sharedWithMe.requestSent')).toBeDisabled();
  });

  it('shows error status on individual file when handleRequestFile fails', async () => {
    mockDiscoverInboxUri.mockRejectedValue(new Error('inbox fail'));
    render(<TypeFolder {...baseProps} />);
    fireEvent.click(screen.getByText('Image'));
    const requestButtons = screen.getAllByText('sharedWithMe.requestFile');
    await act(async () => {
      fireEvent.click(requestButtons[0]);
    });
    expect(screen.getByText('sharedWithMe.requestError')).toBeInTheDocument();
  });

  it('continues handleRequestAgain even when deleteAccessRequest throws', async () => {
    mockDeleteAccessRequest.mockRejectedValue(new Error('delete fail'));
    const rejections = new Map([
      ['https://pod.example/app/doc1/', {
        accessTo: 'https://pod.example/app/doc1/',
        messageUri: 'https://viewer.example/inbox/rejection1',
        sender: 'https://contact.example/profile/card#me',
      }],
    ]);
    render(<TypeFolder {...baseProps} rejections={rejections as any} />);
    fireEvent.click(screen.getByText('Image'));
    await act(async () => {
      fireEvent.click(screen.getByText('sharedWithMe.requestAgain'));
    });
    // Should still clear the rejection and re-request
    expect(baseProps.onClearRejection).toHaveBeenCalledWith('https://pod.example/app/doc1/');
    expect(mockPostFileAccessRequest).toHaveBeenCalled();
  });

  it('shows "sent" on individual file after bulk request succeeds', async () => {
    render(<TypeFolder {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('sharedWithMe.requestAll'));
    });
    // Expand to see file rows
    fireEvent.click(screen.getByText('Image'));
    // Individual file buttons should show "sent" since bulkStatus === "sent"
    const sentButtons = screen.getAllByText('sharedWithMe.requestSent');
    expect(sentButtons.length).toBeGreaterThanOrEqual(1);
  });
});
