import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageUpload } from '../../components/ImageUpload';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <MantineProvider>
      <Notifications />
      {component}
    </MantineProvider>
  );
};

describe('ImageUpload', () => {
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

  it('handles file upload flow', async () => {
    const user = userEvent.setup();
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
    const input = screen.getByRole('button', { name: /העלה תמונה/i });

    // Find the actual file input (hidden)
    const fileInput = input.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    if (fileInput) {
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
    }
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
});
