import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

let mockWebId: string | undefined = 'https://owner.example/profile/card#me';
vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: { webId: mockWebId } }),
}));

let capturedOnSelect: ((webId: string) => void) | undefined;
vi.mock('../PeopleView-file/OneDrivePeopleList', () => ({
  OneDrivePeopleList: ({
    ownerWebId,
    onSelect,
  }: {
    ownerWebId: string;
    onSelect: (webId: string) => void;
  }) => {
    capturedOnSelect = onSelect;
    return <div data-testid="contacts-list" data-owner={ownerWebId} />;
  },
}));

let lastDetailProps: Record<string, unknown> | undefined;
vi.mock('../PeopleView-file/PersonDetailView', () => ({
  PersonDetailView: (props: Record<string, unknown>) => {
    lastDetailProps = props;
    return (
      <div
        data-testid="person-detail-view"
        data-contact={String(props.contactWebId)}
        data-owner={String(props.ownerWebId)}
      >
        <button
          data-testid="detail-back-button"
          onClick={() => (props.onBack as () => void)()}
        >
          back
        </button>
      </div>
    );
  },
}));

import { PeopleView } from '../PeopleView-file/PeopleView';

describe('PeopleView', () => {
  beforeEach(() => {
    capturedOnSelect = undefined;
    lastDetailProps = undefined;
    mockWebId = 'https://owner.example/profile/card#me';
  });

  it('renders the contacts list (no detail view) by default', () => {
    render(<PeopleView />);
    expect(screen.getByTestId('contacts-list')).toBeInTheDocument();
    expect(screen.queryByTestId('person-detail-view')).not.toBeInTheDocument();
  });

  it('passes the owner WebID and a select callback to ContactsList', () => {
    render(<PeopleView />);
    expect(screen.getByTestId('contacts-list').getAttribute('data-owner')).toBe(
      'https://owner.example/profile/card#me',
    );
    expect(capturedOnSelect).toBeTypeOf('function');
  });

  it('mounts the PersonDetailView when a contact is selected', () => {
    render(<PeopleView />);
    act(() => {
      capturedOnSelect?.('https://alice.example/profile/card#me');
    });
    const detail = screen.getByTestId('person-detail-view');
    expect(detail.getAttribute('data-contact')).toBe(
      'https://alice.example/profile/card#me',
    );
    expect(detail.getAttribute('data-owner')).toBe(
      'https://owner.example/profile/card#me',
    );
    expect(screen.queryByTestId('contacts-list')).not.toBeInTheDocument();
  });

  it('returns to the contacts list when onBack fires from the detail view', () => {
    render(<PeopleView />);
    act(() => {
      capturedOnSelect?.('https://alice.example/profile/card#me');
    });
    act(() => {
      (lastDetailProps?.onBack as () => void)();
    });
    expect(screen.getByTestId('contacts-list')).toBeInTheDocument();
    expect(screen.queryByTestId('person-detail-view')).not.toBeInTheDocument();
  });

  it('falls back to empty string ownerWebId when session.webId is undefined', () => {
    mockWebId = undefined;
    render(<PeopleView />);
    // The ContactsList should still render with an empty ownerWebId
    expect(
      screen.getByTestId('contacts-list').getAttribute('data-owner'),
    ).toBe('');
  });
});
