import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AccessRequest } from '@/infrastructure/inbox/inboxAccess';

vi.mock('react-i18next', () => ({
  useTranslation: () => [
    (key: string, vars?: Record<string, unknown> | string) => {
      // The fallback can be the second arg (string) OR the second arg
      // can be the variables map for keys that pass them directly.
      if (typeof vars === 'string') return vars;
      if (vars?.resource) return `requests file ${String(vars.resource)}`;
      if (vars?.type) return `requests type ${String(vars.type)}`;
      return key;
    },
  ],
}));

vi.mock('@ldo/solid-react', () => ({
  useResource: () => ({ isLoading: () => false }),
  useSubject: () => null,
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({ SolidProfileShapeType: {} }));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isLoadable: (value: unknown) =>
    typeof value === 'object' && value !== null && 'isLoading' in value,
}));

vi.mock('@/shared/components/Avatar', () => ({
  Avatar: ({ alt, initial }: { alt: string; initial: string }) => (
    <span data-testid="avatar" data-alt={alt} data-initial={initial} />
  ),
}));

vi.mock('@/shared/utils', () => ({
  getInitial: (name: string) => name.slice(0, 1).toUpperCase(),
  getProfileDisplayName: (_profile: unknown, webId: string) =>
    webId === 'https://alice.example/profile/card#me' ? 'Alice' : 'Unknown',
  getWebIdFallbackName: (webId: string) => webId,
  truncateDisplayName: (name: string) => name,
}));

vi.mock('@/infrastructure/validation/fileTypeRegistry', () => ({
  getFileTypeInfo: (uri: string) => ({
    label: uri.split('/').pop() ?? uri,
    description: '',
  }),
}));

import { RequestCard } from '../RequestsView-file/RequestCard';

const baseRequest: AccessRequest = {
  messageUri: 'urn:msg:1',
  requesterWebId: 'https://alice.example/profile/card#me',
  accessTo: 'https://owner.example/files/photo/',
  requestType: 'catalog',
  timestamp: '2026-04-22T10:00:00Z',
};

describe('RequestCard', () => {
  let onApprove: ReturnType<typeof vi.fn>;
  let onDeny: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onApprove = vi.fn();
    onDeny = vi.fn();
  });

  it('renders the requester name + Approve / Deny buttons', () => {
    render(
      <RequestCard
        request={baseRequest}
        busy={false}
        onApprove={onApprove}
        onDeny={onDeny}
      />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deny' })).toBeInTheDocument();
  });

  it('formats a file-level request with the resource label', () => {
    render(
      <RequestCard
        request={{
          ...baseRequest,
          requestType: 'file',
          accessTo: 'https://owner.example/files/photo/',
        }}
        busy={false}
        onApprove={onApprove}
        onDeny={onDeny}
      />,
    );
    expect(
      screen.getByText('requests file photo'),
    ).toBeInTheDocument();
  });

  it('formats a type-level request with the type label', () => {
    render(
      <RequestCard
        request={{
          ...baseRequest,
          requestType: 'type',
          forClass: 'http://schema.org/ImageObject',
        }}
        busy={false}
        onApprove={onApprove}
        onDeny={onDeny}
      />,
    );
    expect(
      screen.getByText('requests type ImageObject'),
    ).toBeInTheDocument();
  });

  it('fires onApprove with the request when Approve is clicked', () => {
    render(
      <RequestCard
        request={baseRequest}
        busy={false}
        onApprove={onApprove}
        onDeny={onDeny}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onApprove).toHaveBeenCalledWith(baseRequest);
  });

  it('fires onDeny with the request when Deny is clicked', () => {
    render(
      <RequestCard
        request={baseRequest}
        busy={false}
        onApprove={onApprove}
        onDeny={onDeny}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
    expect(onDeny).toHaveBeenCalledWith(baseRequest);
  });

  it('disables both action buttons + tags the card while busy', () => {
    render(
      <RequestCard
        request={baseRequest}
        busy
        onApprove={onApprove}
        onDeny={onDeny}
      />,
    );
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deny' })).toBeDisabled();
    expect(screen.getByTestId('request-card').getAttribute('data-busy')).toBe('true');
  });

  it('uses the catalog-level description key when requestType is "catalog"', () => {
    render(
      <RequestCard
        request={{ ...baseRequest, requestType: 'catalog' }}
        busy={false}
        onApprove={onApprove}
        onDeny={onDeny}
      />,
    );
    // The fallback for 'catalog' type hits descriptionKey =
    // 'requestsPanel.requestsAccess' which the mock translate returns as the
    // key itself (no resource/type vars).
    expect(
      screen.getByText('requestsPanel.requestsAccess'),
    ).toBeInTheDocument();
  });

  it('renders no timestamp when request.timestamp is falsy', () => {
    render(
      <RequestCard
        request={{ ...baseRequest, timestamp: '' }}
        busy={false}
        onApprove={onApprove}
        onDeny={onDeny}
      />,
    );
    expect(document.querySelector('time')).toBeNull();
  });

  it('renders the formatted timestamp when present', () => {
    render(
      <RequestCard
        request={baseRequest}
        busy={false}
        onApprove={onApprove}
        onDeny={onDeny}
      />,
    );
    // The exact format depends on the runtime locale; we just confirm
    // a <time> element with the ISO datetime exists.
    const time = screen.getByText((_, el) => el?.tagName === 'TIME');
    expect(time.getAttribute('datetime')).toBe(baseRequest.timestamp);
  });
});
