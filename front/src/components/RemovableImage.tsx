import { ActionIcon, Box, Image, Loader, type ImageProps } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { type CSSProperties } from 'react';

interface RemovableImageProps extends ImageProps {
  onRemove?: () => Promise<void> | void;
  isRemoving?: boolean;
  alt?: string;
  showRemoveButton?: boolean;
}

export function RemovableImage({
  onRemove,
  isRemoving = false,
  showRemoveButton = true,
  ...imageProps
}: RemovableImageProps) {
  const { style } = imageProps;
  const normalizedStyle = (style && typeof style === 'object' ? style : undefined) as
    | CSSProperties
    | undefined;

  return (
    <Box pos="relative" style={{ display: 'inline-block', ...(normalizedStyle ?? {}) }}>
      <Image {...imageProps} style={{ display: 'block', ...(normalizedStyle ?? {}) }} />

      {onRemove && showRemoveButton && (
        <Box
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            zIndex: 1,
          }}
        >
          {isRemoving ? (
            <Loader size="xs" color="red" />
          ) : (
            <ActionIcon
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void onRemove();
              }}
              variant="filled"
              color="dark"
              size="xs"
              radius="xl"
              aria-label="הסר תמונה"
            >
              <IconX size={12} />
            </ActionIcon>
          )}
        </Box>
      )}
    </Box>
  );
}
