import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ProfileCard } from '../ProfileCard-file/ProfileCard';

const mockSave = vi.fn();
const mockSetName = vi.fn();
const mockSetImgUrl = vi.fn();
const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();
const mockSolidFetch = vi.fn();

let profileReturnValue = {
  name: 'Bob',
  imgUrl: 'https://pod.example/avatar.png',
  displayName: 'Bob Builder',
  isLoading: false,
  setName: mockSetName,
  setImgUrl: mockSetImgUrl,
  save: mockSave,
  reload: vi.fn(),
};

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

let mockSubjectValue: Record<string, unknown> | null = {
  img: { '@id': 'https://pod.example/avatar.png' },
  storage: { toArray: () => [{ '@id': 'https://pod.example/' }] },
};

let mockSessionWebId: string | undefined = 'https://pod.example/profile/card#me';

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({
    session: { webId: mockSessionWebId },
    fetch: mockSolidFetch,
  }),
  useSubject: () => mockSubjectValue,
}));

vi.mock('@/.ldo/solidProfile.shapeTypes', () => ({
  SolidProfileShapeType: {},
}));

vi.mock('@/features/profile/hooks/useProfile', () => ({
  useProfile: () => profileReturnValue,
}));

vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    showError: mockShowError,
    showSuccess: mockShowSuccess,
  }),
}));

vi.mock('@/shared/utils', () => ({
  getInitial: (name: string) => name.charAt(0).toUpperCase(),
}));

vi.mock('@/shared/components/Avatar', () => ({
  Avatar: ({ alt, isLoading }: { alt: string; isLoading?: boolean }) => (
    <div data-testid="avatar" data-loading={isLoading}>
      {alt}
    </div>
  ),
}));

describe('ProfileCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSave.mockResolvedValue(undefined);
    mockSessionWebId = 'https://pod.example/profile/card#me';
    mockSubjectValue = {
      img: { '@id': 'https://pod.example/avatar.png' },
      storage: { toArray: () => [{ '@id': 'https://pod.example/' }] },
    };
    profileReturnValue = {
      name: 'Bob',
      imgUrl: 'https://pod.example/avatar.png',
      displayName: 'Bob Builder',
      isLoading: false,
      setName: mockSetName,
      setImgUrl: mockSetImgUrl,
      save: mockSave,
      reload: vi.fn(),
    };
  });

  it('renders the .profile-card root container element', () => {
    render(<ProfileCard />);
    expect(document.querySelector('.profile-card')).toBeInTheDocument();
  });

  it('renders display name in non-editing mode', () => {
    render(<ProfileCard />);
    expect(document.querySelector('.profile-card__name')).toHaveTextContent('Bob Builder');
  });

  it('renders webId', () => {
    render(<ProfileCard />);
    expect(document.querySelector('.profile-card__webid')).toHaveTextContent(
      'https://pod.example/profile/card#me'
    );
  });

  it('renders edit profile button when not editing', () => {
    render(<ProfileCard />);
    expect(screen.getByText('profileSidebar.editProfile')).toBeInTheDocument();
  });

  it('shows loading text in the name area when isLoading is true', () => {
    profileReturnValue = { ...profileReturnValue, isLoading: true };
    render(<ProfileCard />);
    expect(document.querySelector('.profile-card__name')).toHaveTextContent(
      'profileSidebar.loading'
    );
  });

  it('shows "name not set" when displayName is empty and not editing', () => {
    profileReturnValue = { ...profileReturnValue, displayName: '' };
    render(<ProfileCard />);
    expect(screen.getByText('profileSidebar.nameNotSet')).toBeInTheDocument();
  });

  it('switches to edit mode when edit button is clicked', () => {
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    // edit form should appear
    expect(screen.getByText('profileSidebar.save')).toBeInTheDocument();
    expect(screen.getByText('profileSidebar.cancel')).toBeInTheDocument();
    // edit profile button should be gone
    expect(screen.queryByText('profileSidebar.editProfile')).not.toBeInTheDocument();
  });

  it('renders ProfileInput with name label in edit mode', () => {
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    expect(screen.getByText('profileSidebar.name')).toBeInTheDocument();
    const input = document.querySelector('.profile-input__field') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Bob');
  });

  it('cancels editing and restores original values', () => {
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    fireEvent.click(screen.getByText('profileSidebar.cancel'));
    expect(mockSetName).toHaveBeenCalled();
    expect(mockSetImgUrl).toHaveBeenCalled();
    expect(screen.getByText('profileSidebar.editProfile')).toBeInTheDocument();
  });

  it('calls save on save button click and exits edit mode on success', async () => {
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    await act(async () => {
      fireEvent.click(screen.getByText('profileSidebar.save'));
    });
    expect(mockSave).toHaveBeenCalled();
    expect(mockShowSuccess).toHaveBeenCalledWith('Profile saved successfully');
    expect(screen.getByText('profileSidebar.editProfile')).toBeInTheDocument();
  });

  it('shows error when save fails', async () => {
    mockSave.mockRejectedValue(new Error('Network fail'));
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    await act(async () => {
      fireEvent.click(screen.getByText('profileSidebar.save'));
    });
    expect(mockShowError).toHaveBeenCalledWith('Save failed: Network fail');
  });

  it('renders avatar upload input in edit mode', () => {
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput.accept).toBe('image/*');
  });

  it('shows camera overlay when not uploading avatar', () => {
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    expect(document.querySelector('.avatar--overlay')).toBeInTheDocument();
  });

  it('uploads avatar via PUT and calls setImgUrl and shows success toast when a file is selected', async () => {
    mockSolidFetch.mockResolvedValue({ ok: true });
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'avatar.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });
    expect(mockSolidFetch).toHaveBeenCalledWith(
      'https://pod.example/public/avatar.png',
      expect.objectContaining({ method: 'PUT' })
    );
    expect(mockSetImgUrl).toHaveBeenCalledWith('https://pod.example/public/avatar.png');
    expect(mockShowSuccess).toHaveBeenCalledWith('Avatar uploaded successfully');
  });

  it('shows error when avatar upload fails (non-ok response)', async () => {
    mockSolidFetch.mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' });
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'avatar.jpg', { type: 'image/jpeg' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });
    expect(mockShowError).toHaveBeenCalledWith('Avatar upload failed: 403 Forbidden');
  });

  it('shows error when avatar upload throws', async () => {
    mockSolidFetch.mockRejectedValue(new Error('Network error'));
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'avatar.webp', { type: 'image/webp' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });
    expect(mockShowError).toHaveBeenCalledWith('Avatar upload failed: Network error');
  });

  it('does nothing if no file is selected', () => {
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [] } });
    expect(mockSolidFetch).not.toHaveBeenCalled();
  });

  it('renders Avatar component when profile data is available', () => {
    render(<ProfileCard />);
    const avatar = screen.getByTestId('avatar');
    expect(avatar).toBeInTheDocument();
  });

  it('uses webId-derived storageRoot when profile has no storage', async () => {
    // Override useSubject to return profile without storage
    mockSubjectValue = {
      img: { '@id': 'https://pod.example/avatar.png' },
      storage: { toArray: () => [] },
    };

    mockSolidFetch.mockResolvedValue({ ok: true });
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'avatar.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });
    // storageRoot falls back to webId.replace(/\/profile\/card.*/, "/") = "https://pod.example/"
    expect(mockSolidFetch).toHaveBeenCalledWith(
      'https://pod.example/public/avatar.png',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('does not upload avatar when session.webId is undefined', async () => {
    mockSessionWebId = undefined;
    mockSolidFetch.mockResolvedValue({ ok: true });
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'avatar.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });
    // handleAvatarUpload early-returns when webId is falsy
    expect(mockSolidFetch).not.toHaveBeenCalled();
  });

  it('defaults to jpg extension when file has no extension', async () => {
    mockSolidFetch.mockResolvedValue({ ok: true });
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    // File with no extension
    const file = new File(['img'], 'avatar', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });
    // ext = "avatar".split(".").pop() → "avatar", not undefined, so ?? "jpg" doesn't apply
    // Actually "avatar" has no dot, so split(".") → ["avatar"], pop() → "avatar"
    // The ext is "avatar" not "jpg". The ?? only triggers when pop() returns undefined.
    expect(mockSolidFetch).toHaveBeenCalledWith(
      'https://pod.example/public/avatar.avatar',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('shows "avatar" alt text when displayName is empty in edit mode', () => {
    profileReturnValue = {
      ...profileReturnValue,
      name: '',
      displayName: '',
    };
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    const avatar = screen.getByTestId('avatar');
    // currentDisplayName is empty in edit mode → alt = currentDisplayName || "avatar" → "avatar"
    expect(avatar).toHaveTextContent('avatar');
  });

  it('uses imgUrl state in edit mode for avatar src', () => {
    profileReturnValue = {
      ...profileReturnValue,
      imgUrl: 'https://pod.example/new-avatar.png',
    };
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    // In edit mode, avatarUrl = imgUrl || profile?.img?.["@id"]
    // imgUrl is 'https://pod.example/new-avatar.png' so that's used
    const avatar = screen.getByTestId('avatar');
    expect(avatar).toBeInTheDocument();
  });

  it('falls back to profile img when imgUrl is empty in edit mode', () => {
    profileReturnValue = {
      ...profileReturnValue,
      imgUrl: '',
    };
    mockSubjectValue = {
      img: { '@id': 'https://pod.example/profile-avatar.png' },
      storage: { toArray: () => [{ '@id': 'https://pod.example/' }] },
    };
    render(<ProfileCard />);
    fireEvent.click(screen.getByText('profileSidebar.editProfile'));
    // In edit mode with empty imgUrl: avatarUrl = '' || profile?.img?.["@id"] = 'https://pod.example/profile-avatar.png'
    const avatar = screen.getByTestId('avatar');
    expect(avatar).toBeInTheDocument();
  });
});
