import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SharePanel } from '../SharePanel-file/SharePanel';

const mockGrant = vi.fn();
const mockRevoke = vi.fn();
const mockLoadAcl = vi.fn();

let mockAclState = {
  grantees: [] as string[],
  loading: false,
  error: null as string | null,
  isSaving: false,
  loadAcl: mockLoadAcl,
  grant: mockGrant,
  revoke: mockRevoke,
};

let mockSessionWebId: string | undefined = 'https://owner.example/profile/card#me';
let mockResourceLoading = false;
let mockSubjectMap: Record<string, Record<string, unknown> | null> = {
  'https://alice.example/profile/card#me': { name: 'Alice', fn: null },
  'https://bob.example/profile/card#me': { name: 'Bob', fn: null },
};

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: { webId: mockSessionWebId } }),
  useResource: () => ({ isLoading: () => mockResourceLoading }),
  useSubject: (_type: unknown, webId: string) => mockSubjectMap[webId] ?? null,
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: {},
}));

vi.mock('@/infrastructure/solid/resourceGuards', () => ({
  isLoadable: () => true,
}));

vi.mock('@/features/sharing/hooks/useAclManager', () => ({
  useAclManager: () => mockAclState,
}));

vi.mock('@/shared/utils', () => ({
  getInitial: (name: string) => name.charAt(0).toUpperCase(),
}));

const baseProps = {
  containerUri: 'https://pod.example/my-solid-app/files/doc/',
  catalogUri: 'https://pod.example/catalog.ttl',
  contacts: [
    'https://owner.example/profile/card#me',
    'https://alice.example/profile/card#me',
    'https://bob.example/profile/card#me',
  ],
  sharedEntry: {
    metadataUri: 'https://pod.example/my-solid-app/files/doc/index.ttl',
    binaryUri: 'https://pod.example/my-solid-app/files/doc/file.pdf',
    classUri: 'http://schema.org/DigitalDocument',
    mediaType: 'application/pdf',
    byteSize: 1024,
    title: 'Test',
    description: 'Desc',
    modified: '2024-01-01',
  },
};

describe('SharePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionWebId = 'https://owner.example/profile/card#me';
    mockResourceLoading = false;
    mockSubjectMap = {
      'https://alice.example/profile/card#me': { name: 'Alice', fn: null },
      'https://bob.example/profile/card#me': { name: 'Bob', fn: null },
    };
    mockAclState = {
      grantees: [],
      loading: false,
      error: null,
      isSaving: false,
      loadAcl: mockLoadAcl,
      grant: mockGrant,
      revoke: mockRevoke,
    };
  });

  it('calls loadAcl on mount to discover existing grantees', () => {
    render(<SharePanel {...baseProps} />);
    expect(mockLoadAcl).toHaveBeenCalled();
  });

  it('shows access management heading', () => {
    render(<SharePanel {...baseProps} />);
    expect(screen.getByText('sharePanel.access')).toBeInTheDocument();
  });

  it('shows loading access list message while ACL is loading', () => {
    mockAclState.loading = true;
    render(<SharePanel {...baseProps} />);
    expect(screen.getByText('sharePanel.loadingAccessList')).toBeInTheDocument();
  });

  it('shows ACL error message when loading fails', () => {
    mockAclState.error = 'Something went wrong';
    render(<SharePanel {...baseProps} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows translated error for "No ACL link header"', () => {
    mockAclState.error = 'No ACL link header found';
    render(<SharePanel {...baseProps} />);
    expect(screen.getByText('sharePanel.notSupported')).toBeInTheDocument();
  });

  it('shows "not shared" when no grantees', () => {
    render(<SharePanel {...baseProps} />);
    expect(screen.getByText('sharePanel.notShared')).toBeInTheDocument();
  });

  it('renders GranteeRow for each grantee with revoke button', () => {
    mockAclState.grantees = ['https://alice.example/profile/card#me'];
    render(<SharePanel {...baseProps} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('sharePanel.revoke')).toBeInTheDocument();
  });

  it('revoke button calls revoke with webId', () => {
    mockAclState.grantees = ['https://alice.example/profile/card#me'];
    render(<SharePanel {...baseProps} />);
    fireEvent.click(screen.getByText('sharePanel.revoke'));
    expect(mockRevoke).toHaveBeenCalledWith('https://alice.example/profile/card#me');
  });

  it('shows available contacts to grant access to (excluding owner and grantees)', () => {
    mockAclState.grantees = ['https://alice.example/profile/card#me'];
    render(<SharePanel {...baseProps} />);
    expect(screen.getByText('sharePanel.shareWith')).toBeInTheDocument();
    expect(screen.getByText('sharePanel.grant')).toBeInTheDocument();
  });

  it('grant button calls grant with webId', () => {
    render(<SharePanel {...baseProps} />);
    const grantButtons = screen.getAllByText('sharePanel.grant');
    fireEvent.click(grantButtons[0]);
    expect(mockGrant).toHaveBeenCalled();
  });

  it('shows "all have access" when all contacts are grantees', () => {
    mockAclState.grantees = [
      'https://alice.example/profile/card#me',
      'https://bob.example/profile/card#me',
    ];
    render(<SharePanel {...baseProps} />);
    expect(screen.getByText('sharePanel.allHaveAccess')).toBeInTheDocument();
  });

  it('shows "add contacts" when no non-owner contacts exist', () => {
    render(
      <SharePanel
        {...baseProps}
        contacts={['https://owner.example/profile/card#me']}
      />
    );
    expect(screen.getByText('sharePanel.addContacts')).toBeInTheDocument();
  });

  it('disables buttons when isSaving', () => {
    mockAclState.isSaving = true;
    mockAclState.grantees = ['https://alice.example/profile/card#me'];
    render(<SharePanel {...baseProps} />);
    expect(screen.getByText('sharePanel.revoke')).toBeDisabled();
    const grantBtns = screen.queryAllByText('sharePanel.grant');
    grantBtns.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('shows access mode label for grantees', () => {
    mockAclState.grantees = ['https://alice.example/profile/card#me'];
    render(<SharePanel {...baseProps} />);
    expect(screen.getByText('sharePanel.accessMode')).toBeInTheDocument();
  });

  // --- Branch coverage additions ---

  it('returns null when ownerWebId is empty (session.webId is undefined)', () => {
    mockSessionWebId = undefined;
    const { container } = render(<SharePanel {...baseProps} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows spinner in GranteeRow when contact resource is loading', () => {
    mockResourceLoading = true;
    mockAclState.grantees = ['https://alice.example/profile/card#me'];
    render(<SharePanel {...baseProps} />);
    expect(document.querySelector('.spinner--tiny')).toBeInTheDocument();
    expect(screen.getAllByText('sharePanel.loading').length).toBeGreaterThan(0);
  });

  it('shows spinner in ContactPickerRow when contact resource is loading', () => {
    mockResourceLoading = true;
    render(<SharePanel {...baseProps} />);
    // Alice and Bob are available contacts → ContactPickerRow renders for each
    const spinners = document.querySelectorAll('.spinner--tiny');
    expect(spinners.length).toBeGreaterThan(0);
  });

  it('displays contact.fn fallback when contact.name is null', () => {
    mockSubjectMap = {
      'https://alice.example/profile/card#me': { name: null, fn: 'Alice FN' },
    };
    mockAclState.grantees = ['https://alice.example/profile/card#me'];
    render(<SharePanel {...baseProps} />);
    expect(screen.getByText('Alice FN')).toBeInTheDocument();
  });

  it('uses webIdFallbackName when contact is null (both name and fn undefined)', () => {
    mockSubjectMap = {};
    mockAclState.grantees = ['https://unknown.example/profile/card#me'];
    render(<SharePanel {...baseProps} />);
    // webId without fragment → 'https://unknown.example/profile/card'
    // split('/') → ['https:', '', 'unknown.example', 'profile', 'card']
    // filter(Boolean) → ['https:', 'unknown.example', 'profile', 'card']
    // find: 'https:' starts with 'http' → skip; 'unknown.example' → found!
    expect(screen.getByText('unknown.example')).toBeInTheDocument();
  });

  it('falls back to webId itself when all path segments are filtered out', () => {
    // webId where all segments match exclusion conditions
    // 'profile', 'card' are excluded; segments starting with 'http' are excluded
    // So if URL is only http://profile/card#me → all filtered → ?? webId
    mockSubjectMap = {};
    const webId = 'https://profile/card#me';
    mockAclState.grantees = [webId];
    render(<SharePanel {...baseProps} contacts={[
      'https://owner.example/profile/card#me',
      webId,
    ]} />);
    // After filter(Boolean) and removing 'https:', 'profile', 'card':
    // 'https:' starts with 'http' → skip; 'profile' → excluded; 'card' → excluded
    // find returns undefined → falls back to ?? webId
    expect(screen.getByText(webId)).toBeInTheDocument();
  });
});
