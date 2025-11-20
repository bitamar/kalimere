import { useState } from 'react';
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
} from '@mantine/core';
import { IconUpload, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface ImageUploadProps {
  onUploadUrlRequest: (file: File) => Promise<{ url: string; key: string }>;
  onUploadComplete: (key: string, file: File) => Promise<void>;
  accept?: string;
  label?: string;
  className?: string;
  initialImage?: string | null;
}

export function ImageUpload({
  onUploadUrlRequest,
  onUploadComplete,
  accept = 'image/png,image/jpeg,image/webp',
  label = 'העלה תמונה',
  className,
  initialImage,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(initialImage ?? null);

  const handleFileChange = async (file: File | null) => {
    if (!file) return;

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    setIsUploading(true);
    try {
      // 1. Get upload URL
      const { url, key } = await onUploadUrlRequest(file);

      // 2. Upload to S3
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
      await onUploadComplete(key, file);
      notifications.show({
        title: 'הצלחה',
        message: 'התמונה הועלתה בהצלחה',
        color: 'green',
      });
    } catch (error) {
      console.error('Upload error:', error);
      notifications.show({
        title: 'שגיאה',
        message: 'העלאת התמונה נכשלה',
        color: 'red',
      });
      setPreview(initialImage ?? null);
    } finally {
      setIsUploading(false);
    }
  };

  const clearPreview = () => {
    setPreview(null);
    // Note: We don't delete from server here, just clear UI.
    // If we wanted to support delete, we'd need an onDelete prop.
  };

  return (
    <div className={className}>
      <Group align="flex-start">
        {preview ? (
          <Box pos="relative" w={80} h={80}>
            <Image src={preview} alt="Preview" w={80} h={80} radius="md" fit="cover" />
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
          <FileButton onChange={handleFileChange} accept={accept} disabled={isUploading}>
            {(props) => (
              <Button
                {...props}
                variant="default"
                disabled={isUploading}
                leftSection={isUploading ? <Loader size="xs" /> : <IconUpload size={16} />}
              >
                {isUploading ? 'מעלה...' : label}
              </Button>
            )}
          </FileButton>
          <Text size="xs" c="dimmed">
            פורמטים נתמכים: JPG, PNG, WEBP
          </Text>
        </Stack>
      </Group>
    </div>
  );
}
