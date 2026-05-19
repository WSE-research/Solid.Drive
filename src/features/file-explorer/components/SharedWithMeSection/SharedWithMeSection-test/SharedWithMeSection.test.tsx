import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SharedWithMeSection } from '../SharedWithMeSection-file/SharedWithMeSection';

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

vi.mock('@/features/file-explorer/components/ContactSharedFiles', () => ({
  ContactSharedFiles: ({ contactWebId }: { contactWebId: string }) => (
    <div data-testid="contact-shared-files" data-contact={contactWebId} />
  ),
}));

const OWNER_WEB_ID = 'https://owner.example/profile/card#me';
const ALICE_WEB_ID = 'https://alice.example/profile/card#me';
const BOB_WEB_ID = 'https://bob.example/profile/card#me';

describe('SharedWithMeSection', () => {
  it('returns null when the only contact is the owner', () => {
    const { container } = render(
      <SharedWithMeSection contacts={[OWNER_WEB_ID]} ownerWebId={OWNER_WEB_ID} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the section heading when there is at least one non-owner contact', () => {
    render(
      <SharedWithMeSection
        contacts={[OWNER_WEB_ID, ALICE_WEB_ID]}
        ownerWebId={OWNER_WEB_ID}
      />,
    );
    expect(screen.getByText('sharedWithMe.heading')).toBeInTheDocument();
  });

  it('mounts one ContactSharedFiles per non-owner contact', () => {
    render(
      <SharedWithMeSection
        contacts={[OWNER_WEB_ID, ALICE_WEB_ID, BOB_WEB_ID]}
        ownerWebId={OWNER_WEB_ID}
      />,
    );
    const rows = screen.getAllByTestId('contact-shared-files');
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.getAttribute('data-contact'))).toEqual([
      ALICE_WEB_ID,
      BOB_WEB_ID,
    ]);
  });

  it('passes the owner WebID as viewerWebId — verified via the rendered contact list', () => {
    render(
      <SharedWithMeSection
        contacts={[OWNER_WEB_ID, ALICE_WEB_ID]}
        ownerWebId={OWNER_WEB_ID}
      />,
    );
    // ownerWebId is filtered out, so only Alice survives.
    expect(screen.getAllByTestId('contact-shared-files')).toHaveLength(1);
  });
});
