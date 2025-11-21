import { useQueryClient } from '@tanstack/react-query';
import { updatePet, type Pet, type UpdatePetBody } from '../api/customers';
import { useApiMutation } from '../lib/useApiMutation';
import { queryKeys } from '../lib/queryKeys';
import { applyPetUpdates } from '../utils/entityUpdates';
import { showSuccessNotification } from '../lib/notifications';

export type UpdatePetVariables = {
  petId: string;
  payload: UpdatePetBody;
};

type UpdatePetContext = {
  previousPets: Pet[];
  previousPetDetail: Pet | undefined;
};

type UsePetUpdateMutationParams = {
  customerId: string | null | undefined;
  petDetailQueryKey?: readonly unknown[];
  onSuccess?: (
    data: Pet | undefined,
    variables: UpdatePetVariables,
    context: UpdatePetContext | undefined
  ) => void;
};

function isImageOnlyUpdate(payload: UpdatePetBody) {
  return (
    payload.imageUrl !== undefined &&
    Object.entries(payload).every(([key, value]) => key === 'imageUrl' || value === undefined)
  );
}

export function usePetUpdateMutation({
  customerId,
  petDetailQueryKey,
  onSuccess,
}: UsePetUpdateMutationParams) {
  const queryClient = useQueryClient();
  const petsQueryKey = queryKeys.pets(customerId ?? '');

  return useApiMutation<Pet | undefined, unknown, UpdatePetVariables, UpdatePetContext>({
    mutationFn: ({ petId, payload }) => {
      if (!customerId) {
        throw new Error('Missing customer id');
      }
      return updatePet(customerId, petId, payload);
    },
    successToast: false,
    errorToast: { fallbackMessage: 'עדכון חיית המחמד נכשל' },
    onMutate: async ({ petId, payload }) => {
      if (!customerId) return { previousPets: [] as Pet[], previousPetDetail: undefined };

      await queryClient.cancelQueries({ queryKey: petsQueryKey });
      if (petDetailQueryKey) await queryClient.cancelQueries({ queryKey: petDetailQueryKey });

      const previousPets = queryClient.getQueryData<Pet[]>(petsQueryKey) ?? [];
      const previousPetDetail = petDetailQueryKey
        ? queryClient.getQueryData<Pet | undefined>(petDetailQueryKey)
        : undefined;

      queryClient.setQueryData<Pet[]>(petsQueryKey, (old = []) =>
        old.map((pet) => (pet.id === petId ? applyPetUpdates(pet, payload) : pet))
      );

      if (petDetailQueryKey && previousPetDetail) {
        queryClient.setQueryData<Pet>(
          petDetailQueryKey,
          applyPetUpdates(previousPetDetail, payload)
        );
      }

      return { previousPets, previousPetDetail };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(petsQueryKey, context?.previousPets ?? []);
      if (petDetailQueryKey && context?.previousPetDetail) {
        queryClient.setQueryData(petDetailQueryKey, context.previousPetDetail);
      }
    },
    onSuccess: (data, variables, context) => {
      const { petId, payload } = variables;
      const targetId = data?.id ?? petId;
      queryClient.setQueryData<Pet[]>(petsQueryKey, (old = []) =>
        old.map((pet) => (pet.id === targetId ? (data ?? applyPetUpdates(pet, payload)) : pet))
      );

      if (petDetailQueryKey) {
        queryClient.setQueryData<Pet | undefined>(petDetailQueryKey, (old) =>
          old && old.id !== targetId ? old : (data ?? (old ? applyPetUpdates(old, payload) : old))
        );
      }

      if (!isImageOnlyUpdate(payload)) showSuccessNotification('חיית המחמד עודכנה בהצלחה');

      onSuccess?.(data, variables, context);
    },
    onSettled: () => {
      if (customerId) {
        void queryClient.invalidateQueries({ queryKey: petsQueryKey });
      }
      if (petDetailQueryKey) {
        void queryClient.invalidateQueries({ queryKey: petDetailQueryKey });
      }
    },
  });
}
