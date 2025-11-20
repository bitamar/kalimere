import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { usePetUpdateMutation } from '../../hooks/usePetUpdateMutation';
import * as customersApi from '../../api/customers';
import * as notifications from '../../lib/notifications';

vi.mock('../../api/customers');
vi.mock('../../lib/notifications');

const petResponse: customersApi.Pet = {
  id: 'pet-1',
  customerId: 'cust-1',
  name: 'Bolt',
  type: 'dog',
  gender: 'male',
  dateOfBirth: null,
  breed: null,
  isSterilized: null,
  isCastrated: null,
  imageUrl: null,
};

function TestComponent({ payload }: { payload: customersApi.UpdatePetBody }) {
  const mutation = usePetUpdateMutation({ customerId: 'cust-1' });

  useEffect(() => {
    mutation.mutate({ petId: 'pet-1', payload });
  }, [payload, mutation]);

  return null;
}

describe('usePetUpdateMutation', () => {
  const updatePetMock = vi.mocked(customersApi.updatePet);
  const showSuccessNotificationMock = vi.mocked(notifications.showSuccessNotification);

  beforeEach(() => {
    vi.clearAllMocks();
    updatePetMock.mockResolvedValue(petResponse);
  });

  it('shows success toast for non-image updates', async () => {
    renderWithProviders(
      <TestComponent
        payload={{
          name: 'Bolt',
          type: 'dog',
          gender: 'male',
          breed: null,
        }}
      />
    );

    await waitFor(() => expect(updatePetMock).toHaveBeenCalled());
    expect(showSuccessNotificationMock).toHaveBeenCalledWith('חיית המחמד עודכנה בהצלחה');
  });

  it('suppresses success toast for image-only updates', async () => {
    renderWithProviders(<TestComponent payload={{ imageUrl: 'image-key' }} />);

    await waitFor(() => expect(updatePetMock).toHaveBeenCalled());
    expect(showSuccessNotificationMock).not.toHaveBeenCalled();
  });

  it('suppresses success toast for image removals', async () => {
    renderWithProviders(<TestComponent payload={{ imageUrl: null }} />);

    await waitFor(() => expect(updatePetMock).toHaveBeenCalled());
    expect(showSuccessNotificationMock).not.toHaveBeenCalled();
  });
});
