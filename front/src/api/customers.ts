import { fetchJson } from '../lib/http';
import {
  createCustomerBodySchema,
  createPetBodySchema,
  customerPetParamsSchema,
  customerPetsResponseSchema,
  customerResponseSchema,
  customersListResponseSchema,
  petResponseSchema,
  updateCustomerBodySchema,
  updateCustomerParamsSchema,
  updatePetBodySchema,
  updatePetImageBodySchema,
} from '@kalimere/types/customers';
import type {
  CreateCustomerBody,
  CreatePetBody,
  Customer,
  Pet,
  UpdateCustomerBody,
  UpdatePetBody,
  UpdatePetImageBody,
} from '@kalimere/types/customers';

export type {
  CreateCustomerBody,
  CreatePetBody,
  Customer,
  CustomerPetsResponse,
  CustomerResponse,
  CustomersListResponse,
  Pet,
  PetResponse,
  UpdateCustomerBody,
  UpdatePetBody,
  UpdatePetImageBody,
} from '@kalimere/types/customers';

export type PetSummary = Pick<Pet, 'id' | 'name' | 'type'>;

type RequestOptions = {
  signal?: AbortSignal;
};

export async function listCustomers(options: RequestOptions = {}): Promise<Customer[]> {
  const requestInit = options.signal ? { signal: options.signal } : undefined;
  const json = await fetchJson<unknown>('/customers', requestInit);
  const result = customersListResponseSchema.parse(json);
  return result.customers;
}

export async function createCustomer(input: CreateCustomerBody): Promise<Customer> {
  const payload = createCustomerBodySchema.parse(input);
  const json = await fetchJson<unknown>('/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const result = customerResponseSchema.parse(json);
  return result.customer;
}

export async function updateCustomer(
  customerId: string,
  input: UpdateCustomerBody
): Promise<Customer> {
  const params = updateCustomerParamsSchema.parse({ id: customerId });
  const payload = updateCustomerBodySchema.parse(input);
  const json = await fetchJson<unknown>(`/customers/${params.id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const result = customerResponseSchema.parse(json);
  return result.customer;
}

export async function getCustomerPets(
  customerId: string,
  options: RequestOptions = {}
): Promise<Pet[]> {
  const requestInit = options.signal ? { signal: options.signal } : undefined;
  const json = await fetchJson<unknown>(`/customers/${customerId}/pets`, requestInit);
  const result = customerPetsResponseSchema.parse(json);
  return result.pets;
}

export async function getCustomer(
  customerId: string,
  options: RequestOptions = {}
): Promise<Customer> {
  const requestInit = options.signal ? { signal: options.signal } : undefined;
  const json = await fetchJson<unknown>(`/customers/${customerId}`, requestInit);
  const result = customerResponseSchema.parse(json);
  return result.customer;
}

export async function getPet(
  customerId: string,
  petId: string,
  options: RequestOptions = {}
): Promise<Pet> {
  const requestInit = options.signal ? { signal: options.signal } : undefined;
  const json = await fetchJson<unknown>(`/customers/${customerId}/pets/${petId}`, requestInit);
  const result = petResponseSchema.parse(json);
  return result.pet;
}

export async function addPetToCustomer(customerId: string, input: CreatePetBody): Promise<Pet> {
  const payload = createPetBodySchema.parse(input);
  const json = await fetchJson<unknown>(`/customers/${customerId}/pets`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const result = petResponseSchema.parse(json);
  return result.pet;
}

export async function updatePet(
  customerId: string,
  petId: string,
  input: UpdatePetBody
): Promise<Pet> {
  const params = customerPetParamsSchema.parse({ customerId, petId });
  const payload = updatePetBodySchema.parse(input);
  const json = await fetchJson<unknown>(`/customers/${params.customerId}/pets/${params.petId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const result = petResponseSchema.parse(json);
  return result.pet;
}

export async function updatePetImage(
  customerId: string,
  petId: string,
  input: UpdatePetImageBody
): Promise<Pet> {
  const params = customerPetParamsSchema.parse({ customerId, petId });
  const payload = updatePetImageBodySchema.parse(input);
  const json = await fetchJson<unknown>(
    `/customers/${params.customerId}/pets/${params.petId}/image`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
  const result = petResponseSchema.parse(json);
  return result.pet;
}

export async function deletePetImage(customerId: string, petId: string): Promise<Pet> {
  const params = customerPetParamsSchema.parse({ customerId, petId });
  const json = await fetchJson<unknown>(
    `/customers/${params.customerId}/pets/${params.petId}/image`,
    {
      method: 'DELETE',
    }
  );
  const result = petResponseSchema.parse(json);
  return result.pet;
}

export async function deleteCustomer(customerId: string): Promise<void> {
  await fetchJson(`/customers/${customerId}`, {
    method: 'DELETE',
  });
}

export async function deletePet(customerId: string, petId: string): Promise<void> {
  await fetchJson(`/customers/${customerId}/pets/${petId}`, {
    method: 'DELETE',
  });
}
