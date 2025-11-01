import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addPetToCustomer,
  createCustomer,
  deleteCustomer,
  deletePet,
  getCustomer,
  getCustomerPets,
  getPet,
  listCustomers,
} from '../../api/customers';
import { fetchJson } from '../../lib/http';

vi.mock('../../lib/http', () => ({
  fetchJson: vi.fn(),
}));

const fetchJsonMock = vi.mocked(fetchJson);

const customer = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: null,
  address: null,
  petsCount: 2,
};

const pet = {
  id: '22222222-2222-4222-8222-222222222222',
  customerId: customer.id,
  name: 'Rex',
  type: 'dog' as const,
  gender: 'male' as const,
  dateOfBirth: '2020-01-01',
  breed: null,
  isSterilized: null,
  isCastrated: null,
  imageUrl: null,
};

describe('customers api', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('listCustomers forwards signal and returns parsed customers', async () => {
    const controller = new AbortController();
    fetchJsonMock.mockResolvedValueOnce({ customers: [customer] });

    const result = await listCustomers({ signal: controller.signal });

    expect(fetchJsonMock).toHaveBeenCalledWith('/customers', { signal: controller.signal });
    expect(result).toEqual([customer]);
  });

  it('createCustomer validates input, sends payload, and returns parsed customer', async () => {
    const payload = { name: 'Jane Doe' };
    fetchJsonMock.mockResolvedValueOnce({ customer });

    const result = await createCustomer(payload);

    expect(fetchJsonMock).toHaveBeenCalledWith('/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    expect(result).toEqual(customer);
  });

  it('getCustomerPets fetches pets for customer', async () => {
    const controller = new AbortController();
    fetchJsonMock.mockResolvedValueOnce({ pets: [pet] });

    const result = await getCustomerPets(customer.id, { signal: controller.signal });

    expect(fetchJsonMock).toHaveBeenCalledWith(`/customers/${customer.id}/pets`, {
      signal: controller.signal,
    });
    expect(result).toEqual([pet]);
  });

  it('getCustomer fetches specific customer', async () => {
    fetchJsonMock.mockResolvedValueOnce({ customer });

    const result = await getCustomer(customer.id);

    expect(fetchJsonMock).toHaveBeenCalledWith(`/customers/${customer.id}`, undefined);
    expect(result).toEqual(customer);
  });

  it('getCustomer forwards signal when provided', async () => {
    const controller = new AbortController();
    fetchJsonMock.mockResolvedValueOnce({ customer });

    await getCustomer(customer.id, { signal: controller.signal });

    expect(fetchJsonMock).toHaveBeenCalledWith(`/customers/${customer.id}`, {
      signal: controller.signal,
    });
  });

  it('getPet fetches specific pet', async () => {
    fetchJsonMock.mockResolvedValueOnce({ pet });

    const result = await getPet(customer.id, pet.id);

    expect(fetchJsonMock).toHaveBeenCalledWith(
      `/customers/${customer.id}/pets/${pet.id}`,
      undefined
    );
    expect(result).toEqual(pet);
  });

  it('getPet forwards signal when provided', async () => {
    const controller = new AbortController();
    fetchJsonMock.mockResolvedValueOnce({ pet });

    await getPet(customer.id, pet.id, { signal: controller.signal });

    expect(fetchJsonMock).toHaveBeenCalledWith(`/customers/${customer.id}/pets/${pet.id}`, {
      signal: controller.signal,
    });
  });

  it('addPetToCustomer sends payload and returns created pet', async () => {
    const payload = {
      name: pet.name,
      type: pet.type,
      gender: pet.gender,
      dateOfBirth: null,
      breed: null,
      isSterilized: null,
      isCastrated: null,
    };
    fetchJsonMock.mockResolvedValueOnce({ pet });

    const result = await addPetToCustomer(customer.id, payload);

    expect(fetchJsonMock).toHaveBeenCalledWith(`/customers/${customer.id}/pets`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    expect(result).toEqual(pet);
  });

  it('deleteCustomer sends delete request', async () => {
    fetchJsonMock.mockResolvedValueOnce(undefined);

    await deleteCustomer(customer.id);

    expect(fetchJsonMock).toHaveBeenCalledWith(`/customers/${customer.id}`, {
      method: 'DELETE',
    });
  });

  it('deletePet sends delete request', async () => {
    fetchJsonMock.mockResolvedValueOnce(undefined);

    await deletePet(customer.id, pet.id);

    expect(fetchJsonMock).toHaveBeenCalledWith(`/customers/${customer.id}/pets/${pet.id}`, {
      method: 'DELETE',
    });
  });
});
