import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { AccessRequest } from '@/infrastructure/inbox/inboxAccess';

const mockShowInfo = vi.fn();

vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    showInfo: mockShowInfo,
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showToast: vi.fn(),
    confirm: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, options?: Record<string, unknown>) => {
      if (key === 'requestNotifications.toast' && options) {
        const opts = options as { name?: string; description?: string };
        return `${opts.name ?? ''} ${opts.description ?? ''}`.trim();
      }
      if (key === 'requestsPanel.requestsFileAccess' && options) {
        return `wants access to ${(options as { resource?: string }).resource ?? ''}`.trim();
      }
      if (key === 'requestsPanel.requestsTypeAccess' && options) {
        return `wants access to all ${(options as { type?: string }).type ?? ''} files`.trim();
      }
      if (key === 'requestsPanel.requestsAccess') return 'wants access to your catalog';
      return key;
    },
  ],
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: {},
}));

vi.mock('@/infrastructure/validation/fileTypeRegistry', () => ({
  getFileTypeInfo: (uri: string) => ({ label: uri, description: '' }),
}));

let mockLoading = false;
let mockProfile: { name?: string } | undefined = undefined;

vi.mock('@ldo/solid-react', () => ({
  useResource: () => ({ isLoading: () => mockLoading }),
  useSubject: () => mockProfile,
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isLoadable: () => true,
}));

import { RequestToastFirer } from '../RequestNotificationsContext-file/RequestToastFirer';

const makeRequest = (overrides: Partial<AccessRequest> = {}): AccessRequest => ({
  messageUri: 'urn:msg:1',
  requesterWebId: 'https://alice.solidcommunity.net/profile/card#me',
  accessTo: '',
  requestType: 'catalog',
  timestamp: '2026-05-20T10:00:00Z',
  ...overrides,
});

describe('RequestToastFirer', () => {
  beforeEach(() => {
    mockShowInfo.mockClear();
    mockLoading = false;
    mockProfile = undefined;
  });

  it('fires the toast with the resolved profile name when the profile loads', () => {
    mockProfile = { name: 'Alice Doe' };
    const onFired = vi.fn();
    render(<RequestToastFirer request={makeRequest()} onFired={onFired} />);
    expect(mockShowInfo).toHaveBeenCalledTimes(1);
    expect(mockShowInfo).toHaveBeenCalledWith(expect.stringContaining('Alice Doe'));
    expect(onFired).toHaveBeenCalledWith('urn:msg:1');
  });

  it('falls back to the WebID-derived name when the profile has no name', () => {
    mockProfile = undefined;
    const onFired = vi.fn();
    render(<RequestToastFirer request={makeRequest()} onFired={onFired} />);
    expect(mockShowInfo).toHaveBeenCalledWith(expect.stringContaining('alice'));
    expect(onFired).toHaveBeenCalledWith('urn:msg:1');
  });

  it('fires only once even on multiple renders', () => {
    mockProfile = { name: 'Alice Doe' };
    const onFired = vi.fn();
    const { rerender } = render(
      <RequestToastFirer request={makeRequest()} onFired={onFired} />,
    );
    rerender(<RequestToastFirer request={makeRequest()} onFired={onFired} />);
    expect(mockShowInfo).toHaveBeenCalledTimes(1);
  });

  it('falls back via the timeout when the profile stays loading', () => {
    vi.useFakeTimers();
    mockLoading = true;
    mockProfile = undefined;
    const onFired = vi.fn();
    render(<RequestToastFirer request={makeRequest()} onFired={onFired} />);
    expect(mockShowInfo).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(mockShowInfo).toHaveBeenCalledTimes(1);
    expect(mockShowInfo).toHaveBeenCalledWith(expect.stringContaining('alice'));
    vi.useRealTimers();
  });

  it('uses the file-access description for file requests', () => {
    mockProfile = { name: 'Alice Doe' };
    render(
      <RequestToastFirer
        request={makeRequest({
          requestType: 'file',
          accessTo: 'https://owner.example/files/photo.jpg/',
        })}
        onFired={vi.fn()}
      />,
    );
    expect(mockShowInfo).toHaveBeenCalledWith(expect.stringContaining('photo.jpg'));
  });

  it('uses the type-access description for type requests', () => {
    mockProfile = { name: 'Alice Doe' };
    render(
      <RequestToastFirer
        request={makeRequest({
          requestType: 'type',
          forClass: 'https://schema.org/Photograph',
        })}
        onFired={vi.fn()}
      />,
    );
    expect(mockShowInfo).toHaveBeenCalledWith(
      expect.stringContaining('https://schema.org/Photograph'),
    );
  });

  it('uses the catalog description when a type request has no forClass', () => {
    mockProfile = { name: 'Alice Doe' };
    render(
      <RequestToastFirer
        request={makeRequest({ requestType: 'type' })}
        onFired={vi.fn()}
      />,
    );
    expect(mockShowInfo).toHaveBeenCalledWith(
      expect.stringContaining('wants access to your catalog'),
    );
  });
});
