import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../utils/renderWithProviders';
import { CustomerDetail } from '../../pages/CustomerDetail';
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

const basePets: Pet[] = [
  {
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
  },
  {
    id: 'pet-2',
    customerId: 'cust-1',
    name: 'Misty',
    type: 'cat',
    gender: 'female',
    dateOfBirth: null,
    breed: null,
    isSterilized: null,
    isCastrated: null,
    imageUrl: null,
  },
];

const customersList: Customer[] = [baseCustomer];

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
  addPetToCustomer: vi.fn(),
  deleteCustomer: vi.fn(),
  deletePet: vi.fn(),
  getCustomer: vi.fn(),
  getCustomerPets: vi.fn(),
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
        queryDataStore.set(cacheKey, basePets);
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

describe('CustomerDetail mutation handlers', () => {
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

  function getMutationBySuccessMessage(message: string) {
    return capturedMutations.find((options) => {
      const { successToast } = options;
      if (successToast === false || successToast == null) {
        return false;
      }
      return successToast.message === message;
    });
  }

  function renderPage() {
    renderWithProviders(
      <Routes>
        <Route path="/customers/:id" element={<CustomerDetail />} />
      </Routes>,
      { router: { initialEntries: ['/customers/cust-1'] } }
    );
  }

  it('restores cached data when add pet mutation fails', () => {
    renderPage();
    const addPetOptions = getMutationBySuccessMessage('חיית המחמד נוספה בהצלחה');
    if (!addPetOptions?.onError) throw new Error('addPet onError handler missing');

    const context = {
      previousPets: [{ id: 'cached-pet' }],
      previousCustomer: { ...baseCustomer, petsCount: 5 },
      previousCustomersList: [{ ...baseCustomer, petsCount: 5 }],
    };

    addPetOptions.onError(new Error('failed'), undefined, context, undefined as never);

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

  it('restores cached data when delete customer mutation fails', () => {
    renderPage();
    const deleteCustomerOptions = getMutationBySuccessMessage('הלקוח נמחק');
    if (!deleteCustomerOptions?.onError) throw new Error('deleteCustomer onError handler missing');

    const context = {
      previousCustomers: [{ ...baseCustomer, petsCount: 10 }],
      previousCustomer: { ...baseCustomer, petsCount: 2 },
      previousPets: basePets,
    };

    deleteCustomerOptions.onError(
      new Error('delete failed'),
      undefined,
      context,
      undefined as never
    );

    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      queryKeys.customers(),
      context.previousCustomers
    );
    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      queryKeys.customer('cust-1'),
      context.previousCustomer
    );
    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      queryKeys.pets('cust-1'),
      context.previousPets
    );
  });

  it('restores cached data when delete pet mutation fails', () => {
    renderPage();
    const deletePetOptions = getMutationBySuccessMessage('חיית המחמד נמחקה');
    if (!deletePetOptions?.onError) throw new Error('deletePet onError handler missing');

    const context = {
      previousPet: basePets[0],
      previousPets: basePets,
      previousCustomer: { ...baseCustomer, petsCount: 4 },
      previousCustomersList: [{ ...baseCustomer, petsCount: 4 }],
    };

    deletePetOptions.onError(
      new Error('pet delete failed'),
      undefined,
      context,
      undefined as never
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
