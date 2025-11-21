import { Image, type ImageProps } from '@mantine/core';
import type { Pet } from '../api/customers';

export interface PetImageProps {
  pet: Pet;
  variant?: 'avatar' | 'card';
}

export function PetImage({ pet, variant = 'card' }: PetImageProps) {
  const src = pet.imageUrl || (pet.type === 'dog' ? '/dog.png' : '/cat.png');
  const altText = pet.name;

  const variantProps: Partial<ImageProps> = {
    avatar: { w: 64, h: 64, radius: 'xl', fit: 'cover' as const },
    card: { w: '100%', h: 150, radius: 'md', fit: 'cover' as const, mb: 'xs' },
  }[variant];

  return <Image src={src} alt={altText} {...variantProps} />;
}
