import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { PetImage } from '../../components/PetImage';
import type { Pet } from '../../api/customers';

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

const mockDog: Pet = {
  id: 'pet-1',
  customerId: 'cust-1',
  name: 'Buddy',
  type: 'dog',
  gender: 'male',
  dateOfBirth: null,
  breed: null,
  isSterilized: null,
  isCastrated: null,
  imageUrl: null,
};

const mockCat: Pet = {
  id: 'pet-2',
  customerId: 'cust-1',
  name: 'Whiskers',
  type: 'cat',
  gender: 'female',
  dateOfBirth: null,
  breed: null,
  isSterilized: null,
  isCastrated: null,
  imageUrl: null,
};

describe('PetImage component', () => {
  describe('Image source', () => {
    it('displays custom image when provided', () => {
      const dogWithImage = { ...mockDog, imageUrl: 'https://example.com/my-dog.jpg' };
      renderWithProviders(<PetImage pet={dogWithImage} />);

      const img = screen.getByRole('img', { name: 'Buddy' });
      expect(img).toHaveAttribute('src', 'https://example.com/my-dog.jpg');
    });

    it('displays dog fallback image when no custom image for dog', () => {
      renderWithProviders(<PetImage pet={mockDog} />);

      const img = screen.getByRole('img', { name: 'Buddy' });
      expect(img).toHaveAttribute('src', '/dog.png');
    });

    it('displays cat fallback image when no custom image for cat', () => {
      renderWithProviders(<PetImage pet={mockCat} />);

      const img = screen.getByRole('img', { name: 'Whiskers' });
      expect(img).toHaveAttribute('src', '/cat.png');
    });

    it('uses pet name as alt text', () => {
      renderWithProviders(<PetImage pet={mockDog} />);

      expect(screen.getByRole('img', { name: 'Buddy' })).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('renders with avatar variant', () => {
      renderWithProviders(<PetImage pet={mockDog} variant="avatar" />);

      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
    });

    it('renders with card variant (default)', () => {
      renderWithProviders(<PetImage pet={mockDog} />);

      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
    });
  });
});
