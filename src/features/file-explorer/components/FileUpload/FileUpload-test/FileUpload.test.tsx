import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { SolidContainer } from '@ldo/connected-solid';
import { FileUpload } from '../FileUpload-file/FileUpload';

const mockShowError = vi.fn();
const mockShowSuccess = vi.fn();
const mockUpload = vi.fn();
let mockValidation: Record<string, unknown> | null = null;
let mockTboxError: string | null = null;
let mockIsUploading = false;

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));

vi.mock('@ldo/solid-react', () => ({
  useSolidAuth: () => ({ session: { webId: 'https://pod.example/profile/card#me' } }),
}));

vi.mock('@/shared/contexts/NotificationContext', () => ({
  useNotifications: () => ({ showError: mockShowError, showSuccess: mockShowSuccess }),
}));

vi.mock('@/features/file-explorer/hooks/useFileValidation', () => ({
  useFileValidation: () => ({ validation: mockValidation, tboxError: mockTboxError }),
}));

vi.mock('@/features/file-explorer/hooks/useFileUpload', () => ({
  useFileUpload: () => ({ isUploading: mockIsUploading, upload: mockUpload }),
}));

const mockContainer = { uri: 'https://pod.example/my-solid-app/' } as unknown as SolidContainer;

const baseProps = {
  mainContainer: mockContainer,
  catalogUri: 'https://pod.example/catalog.ttl',
  profileHasCatalog: true,
};

describe('FileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidation = null;
    mockTboxError = null;
    mockIsUploading = false;
    mockUpload.mockResolvedValue(undefined);
  });

  it('renders the file upload form container element', () => {
    const { container } = render(<FileUpload {...baseProps} />);
    expect(container.querySelector('.file-upload')).toBeInTheDocument();
  });

  it('renders file input and choose label', () => {
    render(<FileUpload {...baseProps} />);
    expect(screen.getByText('fileUpload.chooseFile')).toBeInTheDocument();
    expect(screen.getByLabelText('fileUpload.chooseFile')).toBeInTheDocument();
  });

  it('does not show title/description/submit until a file is selected', () => {
    render(<FileUpload {...baseProps} />);
    expect(screen.queryByLabelText('fileUpload.title')).not.toBeInTheDocument();
    expect(screen.queryByText('fileUpload.upload')).not.toBeInTheDocument();
  });

  it('shows title, description, and submit after file selection', () => {
    render(<FileUpload {...baseProps} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText('test.txt')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('fileUpload.titlePlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('fileUpload.descriptionPlaceholder')).toBeInTheDocument();
    expect(screen.getByText('fileUpload.upload')).toBeInTheDocument();
  });

  it('updates description textarea value on change', () => {
    render(<FileUpload {...baseProps} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    fireEvent.change(input, { target: { files: [new File(['x'], 'f.txt', { type: 'text/plain' })] } });
    const textarea = screen.getByPlaceholderText('fileUpload.descriptionPlaceholder');
    fireEvent.change(textarea, { target: { value: 'A description' } });
    expect(textarea).toHaveValue('A description');
  });

  it('shows file metadata (type and size)', () => {
    render(<FileUpload {...baseProps} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    const file = new File(['x'.repeat(2048)], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText(/application\/pdf/)).toBeInTheDocument();
  });

  it('shows tboxError when present', () => {
    mockTboxError = 'Failed to load TBox';
    render(<FileUpload {...baseProps} />);
    expect(screen.getByText(/fileUpload.tboxError/)).toBeInTheDocument();
    expect(screen.getByText(/Failed to load TBox/)).toBeInTheDocument();
  });

  it('shows title violation when validation has name violation', () => {
    mockValidation = {
      valid: false,
      violations: [{ localName: 'name', label: 'Title', path: 'name', description: '' }],
      shape: null,
    };
    render(<FileUpload {...baseProps} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    fireEvent.change(input, { target: { files: [new File(['x'], 'f.txt', { type: 'text/plain' })] } });
    expect(screen.getByText(/fileUpload.fieldRequired/)).toBeInTheDocument();
  });

  it('shows auto violations list with description', () => {
    mockValidation = {
      valid: false,
      violations: [
        { localName: 'encoding', label: 'Encoding', path: 'encoding', description: 'Required encoding' },
      ],
      shape: null,
    };
    render(<FileUpload {...baseProps} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    fireEvent.change(input, { target: { files: [new File(['x'], 'f.txt', { type: 'text/plain' })] } });
    expect(screen.getByText('fileUpload.missingRequired')).toBeInTheDocument();
    expect(screen.getByText('Encoding')).toBeInTheDocument();
    expect(screen.getByText(/Required encoding/)).toBeInTheDocument();
  });

  it('shows auto violations list without description detail', () => {
    mockValidation = {
      valid: false,
      violations: [
        { localName: 'encoding', label: 'Encoding', path: 'encoding', description: '' },
      ],
      shape: null,
    };
    render(<FileUpload {...baseProps} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    fireEvent.change(input, { target: { files: [new File(['x'], 'f.txt', { type: 'text/plain' })] } });
    expect(screen.getByText('fileUpload.missingRequired')).toBeInTheDocument();
    expect(screen.getByText('Encoding')).toBeInTheDocument();
  });

  it('disables submit when validation is invalid', () => {
    mockValidation = {
      valid: false,
      violations: [{ localName: 'name', label: 'Title', path: 'name', description: '' }],
      shape: null,
    };
    render(<FileUpload {...baseProps} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    fireEvent.change(input, { target: { files: [new File(['x'], 'f.txt', { type: 'text/plain' })] } });
    const button = screen.getByText('fileUpload.fillRequired');
    expect(button).toBeDisabled();
  });

  it('disables submit when uploading', () => {
    mockIsUploading = true;
    render(<FileUpload {...baseProps} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    fireEvent.change(input, { target: { files: [new File(['x'], 'f.txt', { type: 'text/plain' })] } });
    const button = screen.getByText('fileUpload.uploading');
    expect(button).toBeDisabled();
  });

  it('shows shape label when validation has shape', () => {
    mockValidation = {
      valid: true,
      violations: [],
      shape: { label: 'ImageObject' },
    };
    render(<FileUpload {...baseProps} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    fireEvent.change(input, { target: { files: [new File(['x'], 'f.png', { type: 'image/png' })] } });
    expect(screen.getByText(/ImageObject/)).toBeInTheDocument();
  });

  it('submits form and calls upload, then resets', async () => {
    const onSuccess = vi.fn();
    render(<FileUpload {...baseProps} onUploadSuccess={onSuccess} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    const file = new File(['data'], 'report.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    const titleInput = screen.getByPlaceholderText('fileUpload.titlePlaceholder');
    fireEvent.change(titleInput, { target: { value: 'My Report' } });

    await act(async () => {
      fireEvent.submit(screen.getByText('fileUpload.upload').closest('form')!);
    });

    expect(mockUpload).toHaveBeenCalledWith(expect.objectContaining({
      file,
      title: 'My Report',
      mainContainer: mockContainer,
      catalogUri: 'https://pod.example/catalog.ttl',
      profileHasCatalog: true,
    }));
    expect(mockShowSuccess).toHaveBeenCalledWith('fileUpload.uploadSuccess');
    expect(onSuccess).toHaveBeenCalled();
  });

  it('shows error when upload fails', async () => {
    mockUpload.mockRejectedValue(new Error('Network error'));
    render(<FileUpload {...baseProps} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    fireEvent.change(input, { target: { files: [new File(['x'], 'f.txt', { type: 'text/plain' })] } });

    const titleInput = screen.getByPlaceholderText('fileUpload.titlePlaceholder');
    fireEvent.change(titleInput, { target: { value: 'Test' } });

    await act(async () => {
      fireEvent.submit(screen.getByText('fileUpload.upload').closest('form')!);
    });

    expect(mockShowError).toHaveBeenCalledWith('fileUpload.uploadError');
  });

  it('does not call upload when form is submitted without selecting a file', async () => {
    render(<FileUpload {...baseProps} />);
    const form = document.querySelector('.file-upload')!;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('does not call upload when form is submitted with invalid validation', async () => {
    mockValidation = {
      valid: false,
      violations: [{ localName: 'name', label: 'Title', path: 'name', description: '' }],
      shape: null,
    };
    render(<FileUpload {...baseProps} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    fireEvent.change(input, { target: { files: [new File(['x'], 'f.txt', { type: 'text/plain' })] } });

    const form = document.querySelector('.file-upload')!;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('shows unknownType when file has no MIME type', () => {
    render(<FileUpload {...baseProps} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    const file = new File(['data'], 'blob', { type: '' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText(/fileUpload.unknownType/)).toBeInTheDocument();
  });

  it('seeds the file from prefilledFile prop on mount', () => {
    const prefilled = new File(['x'], 'prefilled.txt', { type: 'text/plain' });
    render(<FileUpload {...baseProps} prefilledFile={prefilled} />);
    expect(screen.getByText('prefilled.txt')).toBeInTheDocument();
  });

  it('does not require user to click the file input when prefilledFile is provided', () => {
    const prefilled = new File(['x'], 'auto.txt', { type: 'text/plain' });
    render(<FileUpload {...baseProps} prefilledFile={prefilled} />);
    expect(screen.getByText('fileUpload.title')).toBeInTheDocument();
  });

  it('shows a cancel button after a file is selected', () => {
    render(<FileUpload {...baseProps} />);
    expect(screen.queryByText('fileUpload.cancel')).not.toBeInTheDocument();
    const input = screen.getByLabelText('fileUpload.chooseFile');
    fireEvent.change(input, { target: { files: [new File(['x'], 'f.txt', { type: 'text/plain' })] } });
    expect(screen.getByText('fileUpload.cancel')).toBeInTheDocument();
  });

  it('clears the form when cancel is clicked', () => {
    render(<FileUpload {...baseProps} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    fireEvent.change(input, { target: { files: [new File(['x'], 'report.pdf', { type: 'application/pdf' })] } });

    const titleInput = screen.getByPlaceholderText('fileUpload.titlePlaceholder');
    fireEvent.change(titleInput, { target: { value: 'My Report' } });

    fireEvent.click(screen.getByText('fileUpload.cancel'));

    expect(screen.queryByText('report.pdf')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('fileUpload.titlePlaceholder')).not.toBeInTheDocument();
    expect(screen.queryByText('fileUpload.cancel')).not.toBeInTheDocument();
  });

  it('calls onUploadSuccess when cancel is clicked so the form closes', () => {
    const onSuccess = vi.fn();
    render(<FileUpload {...baseProps} onUploadSuccess={onSuccess} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    fireEvent.change(input, { target: { files: [new File(['x'], 'f.txt', { type: 'text/plain' })] } });

    fireEvent.click(screen.getByText('fileUpload.cancel'));

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('disables the cancel button while uploading', () => {
    mockIsUploading = true;
    render(<FileUpload {...baseProps} />);
    const input = screen.getByLabelText('fileUpload.chooseFile');
    fireEvent.change(input, { target: { files: [new File(['x'], 'f.txt', { type: 'text/plain' })] } });
    expect(screen.getByText('fileUpload.cancel')).toBeDisabled();
  });
});
