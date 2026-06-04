import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { CatalogEntry } from '@/types';
import type { AccessApproval, AccessRejection } from '@/infrastructure/inbox/inboxAccess';
import { TypeFolder } from '../TypeFolder-file/TypeFolder';

const mockFetch = vi.fn();
const mockDiscoverInboxUri = vi.fn();
const mockPostFileAccessRequest = vi.fn();
const mockPostTypeAccessRequest = vi.fn();
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
  toContainerUri: (uri: string) =>
    uri.endsWith('/') ? uri : uri.slice(0, uri.lastIndexOf('/') + 1),
}));

vi.mock('@/infrastructure/inbox/inboxAccess', () => ({
  discoverInboxUri: (...args: unknown[]) => mockDiscoverInboxUri(...args),
  postFileAccessRequest: (...args: unknown[]) => mockPostFileAccessRequest(...args),
  postTypeAccessRequest: (...args: unknown[]) => mockPostTypeAccessRequest(...args),
  deleteAccessRequest: (...args: unknown[]) => mockDeleteAccessRequest(...args),
}));

const entries = [
  { uri: 'https://pod.example/app/doc1/index.ttl', title: 'Document 1', conformsTo: '' },
  { uri: 'https://pod.example/app/doc2/index.ttl', title: '', conformsTo: '' },
];

const baseProps = {
  classUri: 'http://schema.org/ImageObject',
  entries: entries as CatalogEntry[],
  contactWebId: 'https://contact.example/profile/card#me',
  viewerWebId: 'https://viewer.example/profile/card#me',
  rejections: new Map(),
  approvals: new Map(),
  onClearOutcome: vi.fn(),
};

describe('TypeFolder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockDiscoverInboxUri.mockResolvedValue('https://contact.example/inbox/');
    mockPostFileAccessRequest.mockResolvedValue(undefined);
    mockPostTypeAccessRequest.mockResolvedValue(undefined);
    mockDeleteAccessRequest.mockResolvedValue(undefined);
  });

  it('renders collapsed folder with label and item count', () => {
    render(<TypeFolder {...baseProps} />);
    expect(screen.getByText('Image')).toBeInTheDocument();
    expect(screen.getByText(`${entries.length} sharedWithMe.items`)).toBeInTheDocument();
  });

  it('does not show file list when collapsed', () => {
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

  it('renders a "request all" button for bulk access requests', () => {
    render(<TypeFolder {...baseProps} />);
    expect(screen.getByText('sharedWithMe.requestAll')).toBeInTheDocument();
  });

  it('request all button sends a single category-level request', async () => {
    render(<TypeFolder {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('sharedWithMe.requestAll'));
    });
    expect(mockDiscoverInboxUri).toHaveBeenCalledWith('https://contact.example/profile/card#me', mockFetch);
    expect(mockPostTypeAccessRequest).toHaveBeenCalledTimes(1);
    expect(mockPostTypeAccessRequest).toHaveBeenCalledWith(
      'https://contact.example/inbox/',
      'https://viewer.example/profile/card#me',
      'http://schema.org/ImageObject',
      mockFetch
    );
    expect(mockPostFileAccessRequest).not.toHaveBeenCalled();
  });

  it('shows the bulk "pending" label after a successful bulk request', async () => {
    render(<TypeFolder {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('sharedWithMe.requestAll'));
    });
    expect(screen.getByText('sharedWithMe.requestPending')).toBeInTheDocument();
  });

  it('flags files for retry when the bulk request fails', async () => {
    mockDiscoverInboxUri.mockRejectedValue(new Error('fail'));
    render(<TypeFolder {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('sharedWithMe.requestAll'));
    });
    fireEvent.click(screen.getByText('Image'));
    expect(screen.getAllByText('sharedWithMe.requestError').length).toBeGreaterThanOrEqual(1);
  });

  it('individual file request button sends access request on click', async () => {
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
      }],
    ]);
    render(<TypeFolder {...baseProps} rejections={rejections as Map<string, AccessRejection>} />);
    fireEvent.click(screen.getByText('Image'));
    expect(screen.getByText('sharedWithMe.requestDenied')).toBeInTheDocument();
    expect(screen.getByText('sharedWithMe.requestAgain')).toBeInTheDocument();
  });

  it('request again deletes old rejection and re-requests', async () => {
    const rejections = new Map([
      ['https://pod.example/app/doc1/', {
        accessTo: 'https://pod.example/app/doc1/',
        messageUri: 'https://viewer.example/inbox/rejection1',
      }],
    ]);
    render(<TypeFolder {...baseProps} rejections={rejections as Map<string, AccessRejection>} />);
    fireEvent.click(screen.getByText('Image'));
    await act(async () => {
      fireEvent.click(screen.getByText('sharedWithMe.requestAgain'));
    });
    expect(mockDeleteAccessRequest).toHaveBeenCalledWith(
      'https://viewer.example/inbox/rejection1',
      mockFetch
    );
    expect(baseProps.onClearOutcome).toHaveBeenCalledWith('https://pod.example/app/doc1/');
  });

  it('shows the approved badge and a request again button', () => {
    const approvals = new Map([
      ['https://pod.example/app/doc1/', {
        accessTo: 'https://pod.example/app/doc1/',
        messageUri: 'https://viewer.example/inbox/approval1',
      }],
    ]);
    render(<TypeFolder {...baseProps} approvals={approvals as Map<string, AccessApproval>} />);
    fireEvent.click(screen.getByText('Image'));
    expect(screen.getByText('sharedWithMe.requestApproved')).toBeInTheDocument();
    expect(screen.getByText('sharedWithMe.requestAgain')).toBeInTheDocument();
  });

  it('request again from an approval deletes the approval notice and re-requests', async () => {
    const approvals = new Map([
      ['https://pod.example/app/doc1/', {
        accessTo: 'https://pod.example/app/doc1/',
        messageUri: 'https://viewer.example/inbox/approval1',
      }],
    ]);
    render(<TypeFolder {...baseProps} approvals={approvals as Map<string, AccessApproval>} />);
    fireEvent.click(screen.getByText('Image'));
    await act(async () => {
      fireEvent.click(screen.getByText('sharedWithMe.requestAgain'));
    });
    expect(mockDeleteAccessRequest).toHaveBeenCalledWith('https://viewer.example/inbox/approval1', mockFetch);
    expect(baseProps.onClearOutcome).toHaveBeenCalledWith('https://pod.example/app/doc1/');
    expect(mockPostFileAccessRequest).toHaveBeenCalled();
  });

  it('renders a singular item label when the folder holds one entry', () => {
    render(<TypeFolder {...baseProps} entries={[entries[0]] as CatalogEntry[]} />);
    expect(screen.getByText('1 sharedWithMe.item')).toBeInTheDocument();
  });

  it('disables the request all button once every file is pending', async () => {
    render(<TypeFolder {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('sharedWithMe.requestAll'));
    });
    expect(screen.getByText('sharedWithMe.requestPending')).toBeDisabled();
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
      }],
    ]);
    render(<TypeFolder {...baseProps} rejections={rejections as Map<string, AccessRejection>} />);
    fireEvent.click(screen.getByText('Image'));
    await act(async () => {
      fireEvent.click(screen.getByText('sharedWithMe.requestAgain'));
    });
    // Should still clear the rejection and re-request
    expect(baseProps.onClearOutcome).toHaveBeenCalledWith('https://pod.example/app/doc1/');
    expect(mockPostFileAccessRequest).toHaveBeenCalled();
  });

  it('shows the "pending" pill on each file after a bulk request succeeds', async () => {
    render(<TypeFolder {...baseProps} />);
    await act(async () => {
      fireEvent.click(screen.getByText('sharedWithMe.requestAll'));
    });
    fireEvent.click(screen.getByText('Image'));
    expect(screen.getAllByText('sharedWithMe.requestPending').length).toBeGreaterThanOrEqual(1);
  });
});
