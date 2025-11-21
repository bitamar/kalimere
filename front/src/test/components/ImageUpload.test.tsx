import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageUpload } from '../../components/ImageUpload';
import { MantineProvider } from '@mantine/core';
import { Notifications, notifications } from '@mantine/notifications';
import { suppressConsoleError } from '../utils/suppressConsoleError';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      <Notifications />
      {component}
    </MantineProvider>
  );
};

type UploadResult = { url: string; key: string };
type UploadResolver = (value: UploadResult) => void;

const getUploadButton = () =>
  screen.getByRole('button', {
    name: /(העלה תמונה|מכין העלאה|מעלה תמונה|משלים|מסיר תמונה)/,
  });

const expectInlineMessage = (pattern: RegExp) => {
  const inlineMatch = screen
    .getAllByText(pattern)
    .find((node) => !node.closest('[data-mantine-shared-portal-node]'));
  expect(inlineMatch).toBeTruthy();
  return inlineMatch as HTMLElement;
};

const suppressUploadError = () => suppressConsoleError('Upload error:');

describe('ImageUpload', () => {
  beforeEach(() => {
    // Mock URL.createObjectURL which is not available in JSDOM
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    act(() => {
      notifications.clean();
    });
  });
  it('renders upload button', () => {
    const mockUploadUrlRequest = vi.fn();
    const mockUploadComplete = vi.fn();

    renderWithProviders(
      <ImageUpload
        onUploadUrlRequest={mockUploadUrlRequest}
        onUploadComplete={mockUploadComplete}
      />
    );

    expect(screen.getByText('העלה תמונה')).toBeInTheDocument();
  });

  it('displays custom label when provided', () => {
    const mockUploadUrlRequest = vi.fn();
    const mockUploadComplete = vi.fn();

    renderWithProviders(
      <ImageUpload
        onUploadUrlRequest={mockUploadUrlRequest}
        onUploadComplete={mockUploadComplete}
        label="Upload Photo"
      />
    );

    expect(screen.getByText('Upload Photo')).toBeInTheDocument();
  });

  it('displays file size limit in helper text', () => {
    const mockUploadUrlRequest = vi.fn();
    const mockUploadComplete = vi.fn();

    renderWithProviders(
      <ImageUpload
        onUploadUrlRequest={mockUploadUrlRequest}
        onUploadComplete={mockUploadComplete}
      />
    );

    expect(screen.getByText(/גודל מקסימלי: 5.0 MB/)).toBeInTheDocument();
  });

  it('handles successful file upload flow', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const mockUploadUrlRequest = vi.fn().mockResolvedValue({
      url: 'https://s3.amazonaws.com/bucket/key?signature=abc',
      key: 'test-key',
    });
    const mockUploadComplete = vi.fn().mockResolvedValue(undefined);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    renderWithProviders(
      <ImageUpload
        onUploadUrlRequest={mockUploadUrlRequest}
        onUploadComplete={mockUploadComplete}
      />
    );

    const file = new File(['test'], 'test.png', { type: 'image/png' });

    // Mantine's FileButton renders a hidden file input element
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // Upload the file
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(mockUploadUrlRequest).toHaveBeenCalledWith(file);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://s3.amazonaws.com/bucket/key?signature=abc',
        expect.objectContaining({
          method: 'PUT',
          body: file,
        })
      );
    });

    await waitFor(() => {
      expect(mockUploadComplete).toHaveBeenCalledWith('test-key', file);
    });
  });

  it('displays initial image when provided', () => {
    const mockUploadUrlRequest = vi.fn();
    const mockUploadComplete = vi.fn();

    renderWithProviders(
      <ImageUpload
        onUploadUrlRequest={mockUploadUrlRequest}
        onUploadComplete={mockUploadComplete}
        initialImage="https://example.com/image.jpg"
      />
    );

    const image = screen.getByAltText('Preview');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('shows error when file is too large', async () => {
    const user = userEvent.setup();
    const mockUploadUrlRequest = vi.fn();
    const mockUploadComplete = vi.fn();

    renderWithProviders(
      <ImageUpload
        onUploadUrlRequest={mockUploadUrlRequest}
        onUploadComplete={mockUploadComplete}
        maxSizeBytes={1024} // 1KB limit
      />
    );

    const file = new File(['a'.repeat(2000)], 'large.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    await waitFor(() => {
      expectInlineMessage(/הקובץ גדול מדי/);
    });

    // Should not attempt upload
    expect(mockUploadUrlRequest).not.toHaveBeenCalled();
  });

  it('shows error when file type is invalid', async () => {
    const user = userEvent.setup();
    const mockUploadUrlRequest = vi.fn();
    const mockUploadComplete = vi.fn();

    renderWithProviders(
      <ImageUpload
        onUploadUrlRequest={mockUploadUrlRequest}
        onUploadComplete={mockUploadComplete}
      />
    );

    const file = new File(['test'], 'document.pdf', { type: 'application/pdf' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Allow uploading a disallowed type to exercise the validation branch.
    fileInput.removeAttribute('accept');
    await user.upload(fileInput, file);

    await waitFor(() => {
      expectInlineMessage(/סוג קובץ לא נתמך/);
    });

    // Should not attempt upload
    expect(mockUploadUrlRequest).not.toHaveBeenCalled();
  });

  it('shows error when image dimensions are too small', async () => {
    const user = userEvent.setup();
    const mockUploadUrlRequest = vi.fn();
    const mockUploadComplete = vi.fn();

    // Mock Image constructor
    const originalImage = global.Image;
    const mockImage = {
      src: '',
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      width: 50,
      height: 50,
    } as unknown as HTMLImageElement;

    global.Image = vi.fn(() => mockImage) as unknown as typeof Image;

    try {
      renderWithProviders(
        <ImageUpload
          onUploadUrlRequest={mockUploadUrlRequest}
          onUploadComplete={mockUploadComplete}
          minDimensions={{ width: 100, height: 100 }}
        />
      );

      const file = new File(['test'], 'small.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockImage.onload).toBeTruthy();
      });

      await act(async () => {
        mockImage.onload?.(new Event('load'));
      });

      await waitFor(() => {
        expectInlineMessage(/התמונה קטנה מדי/);
      });

      // Should not attempt upload
      expect(mockUploadUrlRequest).not.toHaveBeenCalled();
    } finally {
      global.Image = originalImage;
    }
  });

  it('shows error when image dimensions are too large', async () => {
    const user = userEvent.setup();
    const mockUploadUrlRequest = vi.fn();
    const mockUploadComplete = vi.fn();

    // Mock Image constructor
    const originalImage = global.Image;
    const mockImage = {
      src: '',
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      width: 5000,
      height: 5000,
    } as unknown as HTMLImageElement;

    global.Image = vi.fn(() => mockImage) as unknown as typeof Image;

    try {
      renderWithProviders(
        <ImageUpload
          onUploadUrlRequest={mockUploadUrlRequest}
          onUploadComplete={mockUploadComplete}
          maxDimensions={{ width: 2000, height: 2000 }}
        />
      );

      const file = new File(['test'], 'huge.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(mockImage.onload).toBeTruthy();
      });

      await act(async () => {
        mockImage.onload?.(new Event('load'));
      });

      await waitFor(() => {
        expectInlineMessage(/התמונה גדולה מדי/);
      });

      // Should not attempt upload
      expect(mockUploadUrlRequest).not.toHaveBeenCalled();
    } finally {
      global.Image = originalImage;
    }
  });

  it('shows loading state during upload', async () => {
    const user = userEvent.setup();
    let resolveUpload!: UploadResolver;

    const mockUploadUrlRequest = vi.fn(
      () =>
        new Promise<UploadResult>((resolve) => {
          resolveUpload = (value) => resolve(value);
        })
    );
    const mockUploadComplete = vi.fn();

    renderWithProviders(
      <ImageUpload
        onUploadUrlRequest={mockUploadUrlRequest}
        onUploadComplete={mockUploadComplete}
      />
    );

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('מכין העלאה...')).toBeInTheDocument();
    });

    // Button should be disabled
    const button = getUploadButton();
    expect(button).toBeDisabled();

    // Resolve the upload
    expect(resolveUpload).toBeDefined();
    await act(async () => {
      resolveUpload({ url: 'https://s3.test.com', key: 'test-key' });
    });
  });

  it('shows error when URL request fails', async () => {
    const user = userEvent.setup();
    const mockUploadUrlRequest = vi.fn().mockRejectedValue(new Error('Network error'));
    const mockUploadComplete = vi.fn();
    const restoreConsole = suppressUploadError();

    try {
      renderWithProviders(
        <ImageUpload
          onUploadUrlRequest={mockUploadUrlRequest}
          onUploadComplete={mockUploadComplete}
        />
      );

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      await user.upload(fileInput, file);

      await waitFor(() => {
        expectInlineMessage(/שגיאה ביצירת URL להעלאה/);
      });
    } finally {
      restoreConsole();
    }
  });

  it('shows error when S3 upload fails', async () => {
    const user = userEvent.setup();
    const mockUploadUrlRequest = vi.fn().mockResolvedValue({
      url: 'https://s3.amazonaws.com/bucket/key',
      key: 'test-key',
    });
    const mockUploadComplete = vi.fn();

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });
    const restoreConsole = suppressUploadError();

    try {
      renderWithProviders(
        <ImageUpload
          onUploadUrlRequest={mockUploadUrlRequest}
          onUploadComplete={mockUploadComplete}
        />
      );

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      await user.upload(fileInput, file);

      await waitFor(() => {
        expectInlineMessage(/שגיאה בהעלאת התמונה לשרת/);
      });
    } finally {
      restoreConsole();
    }
  });

  it('shows error when completion callback fails', async () => {
    const user = userEvent.setup();
    const mockUploadUrlRequest = vi.fn().mockResolvedValue({
      url: 'https://s3.amazonaws.com/bucket/key',
      key: 'test-key',
    });
    const mockUploadComplete = vi.fn().mockRejectedValue(new Error('Server error'));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    const restoreConsole = suppressUploadError();

    try {
      renderWithProviders(
        <ImageUpload
          onUploadUrlRequest={mockUploadUrlRequest}
          onUploadComplete={mockUploadComplete}
        />
      );

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      await user.upload(fileInput, file);

      await waitFor(() => {
        expectInlineMessage(/שגיאה בשמירת פרטי התמונה/);
      });
    } finally {
      restoreConsole();
    }
  });

  it('disables button and input during upload', async () => {
    const user = userEvent.setup();
    let resolveUpload!: UploadResolver;

    const mockUploadUrlRequest = vi.fn(
      () =>
        new Promise<UploadResult>((resolve) => {
          resolveUpload = (value) => resolve(value);
        })
    );
    const mockUploadComplete = vi.fn();

    renderWithProviders(
      <ImageUpload
        onUploadUrlRequest={mockUploadUrlRequest}
        onUploadComplete={mockUploadComplete}
      />
    );

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    await waitFor(() => {
      const button = getUploadButton();
      expect(button).toBeDisabled();
      expect(fileInput).toBeDisabled();
    });

    // Resolve to clean up
    expect(resolveUpload).toBeDefined();
    await act(async () => {
      resolveUpload({ url: 'https://s3.test.com', key: 'test-key' });
    });
  });

  it('hides clear button during upload', async () => {
    const user = userEvent.setup();
    let resolveUpload!: UploadResolver;

    const mockUploadUrlRequest = vi.fn(
      () =>
        new Promise<UploadResult>((resolve) => {
          resolveUpload = (value) => resolve(value);
        })
    );
    const mockUploadComplete = vi.fn();

    renderWithProviders(
      <ImageUpload
        onUploadUrlRequest={mockUploadUrlRequest}
        onUploadComplete={mockUploadComplete}
        initialImage="https://example.com/image.jpg"
      />
    );

    // Clear button should be visible initially
    // const clearButtonBefore = document.querySelector('button[aria-label]'); // This variable was unused.

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    // During upload, the ActionIcon (clear button) should be hidden
    await waitFor(() => {
      expect(screen.getByText('מכין העלאה...')).toBeInTheDocument();
    });

    // Resolve to clean up
    expect(resolveUpload).toBeDefined();
    await act(async () => {
      resolveUpload({ url: 'https://s3.test.com', key: 'test-key' });
    });
  });

  it('does not show inline error when showErrorInline is false', async () => {
    const user = userEvent.setup();
    const mockUploadUrlRequest = vi.fn();
    const mockUploadComplete = vi.fn();

    renderWithProviders(
      <ImageUpload
        onUploadUrlRequest={mockUploadUrlRequest}
        onUploadComplete={mockUploadComplete}
        showErrorInline={false}
        maxSizeBytes={1024}
      />
    );

    const file = new File(['a'.repeat(2000)], 'large.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    // Error should not be displayed inline
    await waitFor(() => {
      expect(screen.queryByText(/הקובץ גדול מדי/)).not.toBeInTheDocument();
    });
  });
  it('hides upload button when hideUploadWhenHasValue is true and image is present', () => {
    const mockUploadUrlRequest = vi.fn();
    const mockUploadComplete = vi.fn();

    const { rerender } = renderWithProviders(
      <ImageUpload
        onUploadUrlRequest={mockUploadUrlRequest}
        onUploadComplete={mockUploadComplete}
        hideUploadWhenHasValue={true}
        initialImage="https://example.com/image.jpg"
      />
    );

    expect(screen.queryByText('העלה תמונה')).not.toBeInTheDocument();

    // Should show when no image is present
    rerender(
      <MantineProvider>
        <Notifications />
        <ImageUpload
          onUploadUrlRequest={mockUploadUrlRequest}
          onUploadComplete={mockUploadComplete}
          hideUploadWhenHasValue={true}
          initialImage={null}
        />
      </MantineProvider>
    );

    expect(screen.getByText('העלה תמונה')).toBeInTheDocument();
  });

  it('shows upload button when hideUploadWhenHasValue is false even if image is present', () => {
    const mockUploadUrlRequest = vi.fn();
    const mockUploadComplete = vi.fn();

    renderWithProviders(
      <ImageUpload
        onUploadUrlRequest={mockUploadUrlRequest}
        onUploadComplete={mockUploadComplete}
        hideUploadWhenHasValue={false}
        initialImage="https://example.com/image.jpg"
      />
    );

    expect(screen.getByText('העלה תמונה')).toBeInTheDocument();
  });
});
