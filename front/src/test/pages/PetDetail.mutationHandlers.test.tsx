import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../utils/renderWithProviders';
import { PetDetail } from '../../pages/PetDetail';
import { queryKeys } from '../../lib/queryKeys';
import type { Customer, Pet } from '../../api/customers';
import * as apiMutationModule from '../../lib/useApiMutation';
import type { ApiMutationOptions } from '../../lib/useApiMutation';

const baseCustomer: Customer = {
  id: 'cust-1',
  name: 'Dana Vet',
  email: 'dana@example.com',
  phone: '050-1231234',
  address: 'Tel Aviv',
  petsCount: 2,
};

const basePet: Pet = {
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

const customersList: Customer[] = [baseCustomer];
const petsList: Pet[] = [basePet];

const queryDataStore = new Map<string, unknown>();

const queryClientMock = {
  cancelQueries: vi.fn(),
  getQueryData: vi.fn((key: unknown) => queryDataStore.get(JSON.stringify(key))),
  setQueryData: vi.fn((key: unknown, updater: unknown) => {
    const cacheKey = JSON.stringify(key);
    const previous = queryDataStore.get(cacheKey);
    const value =
      typeof updater === 'function'
        ? (updater as (current: unknown) => unknown)(previous)
        : updater;
    queryDataStore.set(cacheKey, value);
    return value;
  }),
  invalidateQueries: vi.fn(),
};

vi.mock('../../api/customers', () => ({
  getPet: vi.fn(),
  deletePet: vi.fn(),
  getCustomer: vi.fn(),
  updatePet: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();

  const useQueryMock = vi.fn(({ queryKey }: { queryKey: unknown }) => {
    const cacheKey = JSON.stringify(queryKey);
    if (!queryDataStore.has(cacheKey)) {
      if (Array.isArray(queryKey) && queryKey[0] === 'customers') {
        queryDataStore.set(cacheKey, customersList);
      } else if (Array.isArray(queryKey) && queryKey[0] === 'customer') {
        queryDataStore.set(cacheKey, baseCustomer);
      } else if (Array.isArray(queryKey) && queryKey[0] === 'pets') {
        if (queryKey.length === 2) {
          queryDataStore.set(cacheKey, petsList);
        } else {
          queryDataStore.set(cacheKey, basePet);
        }
      } else {
        queryDataStore.set(cacheKey, undefined);
      }
    }

    return {
      data: queryDataStore.get(cacheKey),
      error: null,
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    };
  });

  return {
    ...actual,
    useQuery: useQueryMock,
    useQueryClient: () => queryClientMock,
  };
});

describe('PetDetail mutation handlers', () => {
  const capturedMutations: ApiMutationOptions<unknown, unknown, unknown, unknown>[] = [];

  beforeEach(() => {
    queryDataStore.clear();
    queryClientMock.cancelQueries.mockClear();
    queryClientMock.getQueryData.mockClear();
    queryClientMock.setQueryData.mockClear();
    queryClientMock.invalidateQueries.mockClear();
    capturedMutations.length = 0;

    vi.spyOn(apiMutationModule, 'useApiMutation').mockImplementation((options) => {
      capturedMutations.push(options);
      const mutationResult = { mutateAsync: vi.fn(), isPending: false } as const;
      return mutationResult as unknown as ReturnType<typeof apiMutationModule.useApiMutation>;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderPage() {
    renderWithProviders(
      <Routes>
        <Route path="/customers/:customerId/pets/:petId" element={<PetDetail />} />
      </Routes>,
      { router: { initialEntries: ['/customers/cust-1/pets/pet-1'] } }
    );
  }

  it('restores cached data when pet deletion fails', () => {
    renderPage();
    const deletePetOptions = capturedMutations[0];
    if (!deletePetOptions?.onError) throw new Error('deletePet onError handler missing');

    const context = {
      previousPet: { ...basePet, name: 'Cached Pet' },
      previousPets: petsList,
      previousCustomer: { ...baseCustomer, petsCount: 3 },
      previousCustomersList: [{ ...baseCustomer, petsCount: 3 }],
    };

    const initialCalls = queryClientMock.setQueryData.mock.calls.length;

    deletePetOptions.onError(new Error('failure'), undefined, context, undefined as never);

    expect(queryClientMock.setQueryData.mock.calls.length).toBe(initialCalls + 4);
    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      [...queryKeys.pets('cust-1'), basePet.id],
      context.previousPet
    );
    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      queryKeys.pets('cust-1'),
      context.previousPets
    );
    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      queryKeys.customer('cust-1'),
      context.previousCustomer
    );
    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      queryKeys.customers(),
      context.previousCustomersList
    );
  });
});
