import { useRef, useState } from 'react';
import {
  Button,
  FileButton,
  Group,
  Stack,
  Text,
  Loader,
  Image,
  ActionIcon,
  Box,
  Alert,
} from '@mantine/core';
import { IconUpload, IconX, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

interface ImageUploadProps {
  onUploadUrlRequest: (file: File) => Promise<{ url: string; key: string }>;
  onUploadComplete: (key: string, file: File) => Promise<void>;
  accept?: string;
  label?: string;
  className?: string;
  initialImage?: string | null;
  maxSizeBytes?: number;
  minDimensions?: { width: number; height: number };
  maxDimensions?: { width: number; height: number };
  showErrorInline?: boolean;
}

type UploadStage = 'idle' | 'requesting-url' | 'uploading-to-s3' | 'completing';

export function ImageUpload({
  onUploadUrlRequest,
  onUploadComplete,
  accept = 'image/png,image/jpeg,image/webp',
  label = 'העלה תמונה',
  className,
  initialImage,
  maxSizeBytes = MAX_FILE_SIZE_BYTES,
  minDimensions,
  maxDimensions,
  showErrorInline = true,
}: ImageUploadProps) {
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  const [preview, setPreview] = useState<string | null>(initialImage ?? null);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<UploadStage>('idle');

  const isUploading = uploadStage !== 'idle';

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateFileType = (file: File): boolean => {
    const acceptedTypes = accept.split(',').map((type) => type.trim());
    return acceptedTypes.some((type) => {
      if (type.startsWith('.')) {
        return file.name.toLowerCase().endsWith(type.toLowerCase());
      }
      return file.type === type;
    });
  };

  const validateFileSize = (file: File): boolean => {
    return file.size <= maxSizeBytes;
  };

  const validateImageDimensions = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!minDimensions && !maxDimensions) {
        resolve(true);
        return;
      }

      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const { width, height } = img;

        if (minDimensions && (width < minDimensions.width || height < minDimensions.height)) {
          setError(
            `התמונה קטנה מדי. גודל מינימלי: ${minDimensions.width}x${minDimensions.height} פיקסלים`
          );
          resolve(false);
          return;
        }

        if (maxDimensions && (width > maxDimensions.width || height > maxDimensions.height)) {
          setError(
            `התמונה גדולה מדי. גודל מקסימלי: ${maxDimensions.width}x${maxDimensions.height} פיקסלים`
          );
          resolve(false);
          return;
        }

        resolve(true);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setError('שגיאה בטעינת התמונה');
        resolve(false);
      };

      img.src = objectUrl;
    });
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) return;

    // Clear previous error
    setError(null);

    // Validate file type
    if (!validateFileType(file)) {
      setError('סוג קובץ לא נתמך. אנא השתמש ב-JPG, PNG או WEBP');
      return;
    }

    // Validate file size
    if (!validateFileSize(file)) {
      setError(`הקובץ גדול מדי. גודל מקסימלי: ${formatFileSize(maxSizeBytes)}`);
      return;
    }

    // Validate image dimensions
    const dimensionsValid = await validateImageDimensions(file);
    if (!dimensionsValid) {
      return;
    }

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    const updateStage = (stage: UploadStage) => {
      stageRef.current = stage;
      setUploadStage(stage);
    };

    updateStage('requesting-url');
    try {
      // 1. Get upload URL
      const { url, key } = await onUploadUrlRequest(file);

      // 2. Upload to S3
      updateStage('uploading-to-s3');
      const response = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to upload image to storage');
      }

      // 3. Notify completion
      updateStage('completing');
      await onUploadComplete(key, file);

      notifications.show({
        title: 'הצלחה',
        message: 'התמונה הועלתה בהצלחה',
        color: 'green',
      });

      setError(null);
    } catch (error) {
      console.error('Upload error:', error);

      let errorMessage = 'העלאת התמונה נכשלה';
      const failureStage = stageRef.current;

      if (failureStage === 'requesting-url') {
        errorMessage = 'שגיאה ביצירת URL להעלאה';
      } else if (failureStage === 'uploading-to-s3') {
        errorMessage = 'שגיאה בהעלאת התמונה לשרת';
      } else if (failureStage === 'completing') {
        errorMessage = 'שגיאה בשמירת פרטי התמונה';
      }

      setError(errorMessage);
      notifications.show({
        title: 'שגיאה',
        message: errorMessage,
        color: 'red',
      });

      // Revert preview to initial image
      URL.revokeObjectURL(objectUrl);
      setPreview(initialImage ?? null);
    } finally {
      updateStage('idle');
    }
  };

  const clearPreview = () => {
    setPreview(null);
    setError(null);
    // Note: We don't delete from server here, just clear UI.
    // If we wanted to support delete, we'd need an onDelete prop.
  };

  const getLoadingText = (): string => {
    switch (uploadStage) {
      case 'requesting-url':
        return 'מכין העלאה...';
      case 'uploading-to-s3':
        return 'מעלה תמונה...';
      case 'completing':
        return 'משלים...';
      default:
        return label;
    }
  };

  return (
    <div className={className}>
      <Stack gap="xs">
        <Group align="flex-start">
          {preview ? (
            <Box pos="relative" w={80} h={80}>
              <Image src={preview} alt="Preview" w={80} h={80} radius="md" fit="cover" />
              {!isUploading && (
                <ActionIcon
                  onClick={clearPreview}
                  variant="filled"
                  color="dark"
                  size="xs"
                  radius="xl"
                  style={{ position: 'absolute', top: -5, right: -5 }}
                >
                  <IconX size={12} />
                </ActionIcon>
              )}
            </Box>
          ) : (
            <Box
              w={80}
              h={80}
              style={(theme) => ({
                border: `1px dashed ${theme.colors.gray[4]}`,
                borderRadius: theme.radius.md,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.gray[0],
              })}
            >
              <IconUpload size={24} color="gray" />
            </Box>
          )}
          <Stack gap="xs">
            <FileButton
              onChange={handleFileChange}
              accept={accept}
              disabled={isUploading}
              inputProps={{ disabled: isUploading }}
            >
              {(props) => (
                <Button
                  {...props}
                  variant="default"
                  disabled={isUploading}
                  leftSection={isUploading ? <Loader size="xs" /> : <IconUpload size={16} />}
                >
                  {isUploading ? getLoadingText() : label}
                </Button>
              )}
            </FileButton>
            <Text size="xs" c="dimmed">
              פורמטים נתמכים: JPG, PNG, WEBP
              <br />
              גודל מקסימלי: {formatFileSize(maxSizeBytes)}
            </Text>
          </Stack>
        </Group>
        {error && showErrorInline && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}
      </Stack>
    </div>
  );
}
