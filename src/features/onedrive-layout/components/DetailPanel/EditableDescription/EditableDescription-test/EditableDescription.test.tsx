import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditableDescription } from '../EditableDescription-file/EditableDescription';

const mockCommitData = vi.fn().mockResolvedValue({ isError: false });
const mockGetResource = vi.fn(() => ({}));
const mockCreateData = vi.fn<() => { description: string | undefined }>(() => ({
  description: '',
}));

vi.mock('@ldo/solid-react', () => ({
  useLdo: () => ({
    createData: mockCreateData,
    commitData: mockCommitData,
    getResource: mockGetResource,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string, fallback?: string) => fallback ?? key],
}));

const mockShowError = vi.fn();
vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({
    showError: mockShowError,
    showSuccess: vi.fn(),
    confirm: vi.fn(),
  }),
}));

describe('EditableDescription', () => {
  beforeEach(() => {
    mockCommitData.mockClear();
    mockCommitData.mockResolvedValue({ isError: false });
    mockShowError.mockClear();
  });

  it('renders the initial description', () => {
    render(
      <EditableDescription
        metadataUri="https://pod/app/doc/index.ttl"
        initial="hello"
      />,
    );
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
  });

  it('renders an empty input when initial is undefined', () => {
    render(
      <EditableDescription
        metadataUri="https://pod/app/doc/index.ttl"
        initial={undefined}
      />,
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('');
  });

  it('commits a new description on blur', async () => {
    const user = userEvent.setup();
    render(
      <EditableDescription
        metadataUri="https://pod/app/doc/index.ttl"
        initial=""
      />,
    );
    const input = screen.getByRole('textbox');
    await user.type(input, 'new description');
    input.blur();
    await waitFor(() => expect(mockCommitData).toHaveBeenCalledOnce());
  });

  it('does not commit when the value is unchanged on blur', () => {
    render(
      <EditableDescription
        metadataUri="https://pod/app/doc/index.ttl"
        initial="hello"
      />,
    );
    const input = screen.getByRole('textbox');
    input.focus();
    input.blur();
    expect(mockCommitData).not.toHaveBeenCalled();
  });

  it('commits on Enter key', async () => {
    const user = userEvent.setup();
    render(
      <EditableDescription
        metadataUri="https://pod/app/doc/index.ttl"
        initial=""
      />,
    );
    const input = screen.getByRole('textbox');
    await user.type(input, 'x{Enter}');
    await waitFor(() => expect(mockCommitData).toHaveBeenCalledOnce());
  });

  it('shows the saving indicator while the commit is in flight', async () => {
    const user = userEvent.setup();
    let resolveCommit!: (value: { isError: boolean }) => void;
    mockCommitData.mockReturnValue(
      new Promise((resolve) => {
        resolveCommit = resolve;
      }),
    );
    render(
      <EditableDescription
        metadataUri="https://pod/app/doc/index.ttl"
        initial=""
      />,
    );
    const input = screen.getByRole('textbox');
    await user.type(input, 'x{Enter}');
    expect(await screen.findByText(/saving/i)).toBeInTheDocument();
    resolveCommit({ isError: false });
  });

  it('shows an error message when commit fails', async () => {
    const user = userEvent.setup();
    mockCommitData.mockResolvedValue({ isError: true, message: 'bad shape' });
    render(
      <EditableDescription
        metadataUri="https://pod/app/doc/index.ttl"
        initial="original"
      />,
    );
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'changed{Enter}');
    await waitFor(() => expect(mockShowError).toHaveBeenCalled());
  });

  it('sets description to undefined when the trimmed value is empty', async () => {
    const user = userEvent.setup();
    const draft = { description: 'old' as string | undefined };
    mockCreateData.mockReturnValue(draft);
    render(
      <EditableDescription
        metadataUri="https://pod/app/doc/index.ttl"
        initial="old"
      />,
    );
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '   {Enter}');
    await waitFor(() => expect(mockCommitData).toHaveBeenCalledOnce());
    // Trimmed value is '' so draft.description should be set to undefined
    expect(draft.description).toBeUndefined();
  });

  it('calls onSaved callback after a successful commit', async () => {
    const user = userEvent.setup();
    mockCommitData.mockResolvedValue({ isError: false });
    const onSaved = vi.fn();
    render(
      <EditableDescription
        metadataUri="https://pod/app/doc/index.ttl"
        initial=""
        onSaved={onSaved}
      />,
    );
    const input = screen.getByRole('textbox');
    await user.type(input, 'new value{Enter}');
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  });

  it('resets to the new initial when metadataUri changes', () => {
    const { rerender } = render(
      <EditableDescription
        metadataUri="https://pod/app/file-a/index.ttl"
        initial="A's description"
      />,
    );
    expect(screen.getByDisplayValue("A's description")).toBeInTheDocument();
    rerender(
      <EditableDescription
        metadataUri="https://pod/app/file-b/index.ttl"
        initial="B's description"
      />,
    );
    expect(screen.getByDisplayValue("B's description")).toBeInTheDocument();
  });
});
