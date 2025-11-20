import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { waitFor } from '@testing-library/react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { renderWithProviders } from '../utils/renderWithProviders';
import { usePetUpdateMutation } from '../../hooks/usePetUpdateMutation';
import * as customersApi from '../../api/customers';
import * as notifications from '../../lib/notifications';
import { queryKeys } from '../../lib/queryKeys';

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

let capturedQueryClient: QueryClient | null = null;

function getCapturedQueryClient() {
  if (!capturedQueryClient) {
    throw new Error('Query client not set');
  }
  return capturedQueryClient;
}

function TestComponent({ payload }: { payload: customersApi.UpdatePetBody }) {
  const queryClient = useQueryClient();
  capturedQueryClient = queryClient;
  const mutation = usePetUpdateMutation({ customerId: 'cust-1' });
  const { mutate } = mutation;

  useEffect(() => {
    mutate({ petId: 'pet-1', payload });
  }, [mutate, payload]);

  return null;
}

describe('usePetUpdateMutation', () => {
  const updatePetMock = vi.mocked(customersApi.updatePet);
  const showSuccessNotificationMock = vi.mocked(notifications.showSuccessNotification);

  beforeEach(() => {
    vi.clearAllMocks();
    capturedQueryClient = null;
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

  it('updates cached pet list and detail with mutation response', async () => {
    capturedQueryClient = null;
    const detailKey = ['pet', 'pet-1'] as const;
    const updatedPet = { ...petResponse, name: 'Updated Bolt' };
    updatePetMock.mockResolvedValueOnce(updatedPet);

    function CacheTestComponent() {
      const queryClient = useQueryClient();
      capturedQueryClient = queryClient;
      const mutation = usePetUpdateMutation({
        customerId: 'cust-1',
        petDetailQueryKey: detailKey,
      });
      const { mutateAsync } = mutation;

      useEffect(() => {
        void (async () => {
          queryClient.setQueryData(queryKeys.pets('cust-1'), [petResponse]);
          queryClient.setQueryData(detailKey, petResponse);
          await mutateAsync({ petId: 'pet-1', payload: { name: 'Updated Bolt' } });
        })();
      }, [mutateAsync, queryClient]);

      return null;
    }

    renderWithProviders(<CacheTestComponent />);

    await waitFor(() => expect(capturedQueryClient).not.toBeNull());
    const queryClient = getCapturedQueryClient();

    await waitFor(() => expect(updatePetMock).toHaveBeenCalled());
    const response = await updatePetMock.mock.results[0]?.value;
    expect(response).toEqual(updatedPet);
    await waitFor(() =>
      expect(showSuccessNotificationMock).toHaveBeenCalledWith('חיית המחמד עודכנה בהצלחה')
    );
    expect(queryClient.getQueryData(['pets', ''])).toBeUndefined();
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.pets('cust-1'))).toEqual([updatedPet])
    );
    expect(queryClient.getQueryData(detailKey)).toEqual(updatedPet);
  });

  it('applies payload updates when mutation returns undefined', async () => {
    capturedQueryClient = null;
    const detailKey = ['pet', 'pet-1'] as const;
    updatePetMock.mockResolvedValueOnce(undefined as unknown as customersApi.Pet);

    function UndefinedResponseTestComponent() {
      const queryClient = useQueryClient();
      capturedQueryClient = queryClient;
      const mutation = usePetUpdateMutation({
        customerId: 'cust-1',
        petDetailQueryKey: detailKey,
      });
      const { mutateAsync } = mutation;

      useEffect(() => {
        void (async () => {
          queryClient.setQueryData(queryKeys.pets('cust-1'), [petResponse]);
          queryClient.setQueryData(detailKey, petResponse);
          await mutateAsync({
            petId: 'pet-1',
            payload: { name: 'Name From Payload', breed: 'Collie' },
          });
        })();
      }, [mutateAsync, queryClient]);

      return null;
    }

    renderWithProviders(<UndefinedResponseTestComponent />);

    await waitFor(() => expect(capturedQueryClient).not.toBeNull());
    const queryClient = getCapturedQueryClient();

    await waitFor(() => expect(updatePetMock).toHaveBeenCalled());
    const response = await updatePetMock.mock.results[0]?.value;
    expect(response).toEqual(undefined);
    await waitFor(() =>
      expect(showSuccessNotificationMock).toHaveBeenCalledWith('חיית המחמד עודכנה בהצלחה')
    );
    expect(queryClient.getQueryData(['pets', ''])).toBeUndefined();
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.pets('cust-1'))).toEqual([
        { ...petResponse, name: 'Name From Payload', breed: 'Collie' },
      ])
    );
    expect(queryClient.getQueryData(detailKey)).toEqual({
      ...petResponse,
      name: 'Name From Payload',
      breed: 'Collie',
    });
  });
});
