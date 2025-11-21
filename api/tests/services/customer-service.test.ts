import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { resetDb } from '../utils/db.js';
import { db } from '../../src/db/client.js';
import { users } from '../../src/db/schema.js';
import {
  createCustomerForUser,
  createPetForCustomer,
  deleteCustomerForUser,
  deletePetForCustomer,
  getCustomerForUser,
  getPetForCustomer,
  getPetImageUploadUrl,
  listCustomersForUser,
  listPetsForCustomer,
  updateCustomerForUser,
  updatePetForCustomer,
} from '../../src/services/customer-service.js';
import { s3Service } from '../../src/services/s3.js';

async function createUser() {
  const [user] = await db
    .insert(users)
    .values({ email: `customer-${randomUUID()}@example.com`, name: 'Customer Tester' })
    .returning();
  return user;
}

describe('customer-service', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await resetDb();
  });

  afterEach(async () => {
    await resetDb();
    vi.restoreAllMocks();
  });

  it('manages customers and pets for a user', async () => {
    const user = await createUser();

    const customer = await createCustomerForUser(user.id, {
      name: '  Example Customer  ',
      email: 'example@example.com',
    });

    expect(customer).toMatchObject({
      name: 'Example Customer',
      email: 'example@example.com',
      petsCount: 0,
    });

    const list = await listCustomersForUser(user.id);
    expect(list).toEqual([expect.objectContaining({ id: customer.id, petsCount: 0 })]);

    const pet = await createPetForCustomer(customer.id, {
      name: 'Luna',
      type: 'cat',
      gender: 'female',
    });
    expect(pet).toMatchObject({ customerId: customer.id, name: 'Luna', type: 'cat' });

    const customerWithPet = await getCustomerForUser(user.id, customer.id);
    expect(customerWithPet.petsCount).toBe(1);

    const petsList = await listPetsForCustomer(customer.id);
    expect(petsList).toEqual([expect.objectContaining({ id: pet.id, name: 'Luna' })]);

    const fetchedPet = await getPetForCustomer(customer.id, pet.id);
    expect(fetchedPet).toMatchObject({ id: pet.id, name: 'Luna' });

    const updatedCustomer = await updateCustomerForUser(user.id, customer.id, { phone: '123456' });
    expect(updatedCustomer.phone).toBe('123456');

    await deletePetForCustomer(customer.id, pet.id);
    const listAfterPetDelete = await listPetsForCustomer(customer.id);
    expect(listAfterPetDelete).toEqual([]);

    const deletionResult = await deleteCustomerForUser(user.id, customer.id);
    expect(deletionResult).toEqual({ ok: true });

    const listAfterDelete = await listCustomersForUser(user.id);
    expect(listAfterDelete).toEqual([]);
  });

  it('throws not found for missing pet', async () => {
    const user = await createUser();
    const customer = await createCustomerForUser(user.id, { name: 'Missing', email: null });

    await expect(getPetForCustomer(customer.id, randomUUID())).rejects.toHaveProperty(
      'statusCode',
      404
    );
  });

  it('generates pet image upload keys under user/customer/pet scope', async () => {
    const user = await createUser();
    const customer = await createCustomerForUser(user.id, {
      name: '  Example Customer  ',
      email: 'example@example.com',
    });
    const pet = await createPetForCustomer(customer.id, {
      name: 'Luna',
      type: 'cat',
      gender: 'female',
    });

    const mockUrl = 'https://s3-upload.example.com';
    vi.spyOn(s3Service, 'getPresignedUploadUrl').mockResolvedValue(mockUrl);

    const { key, url } = await getPetImageUploadUrl(user.id, customer.id, pet.id, 'image/jpeg');

    expect(url).toBe(mockUrl);
    const [userSegment, customerSegment, petSegment, fileName] = key.split('/');
    expect(userSegment).toBe(user.id);
    expect(customerSegment).toBe(customer.id);
    expect(petSegment).toBe(pet.id);
    expect(fileName?.startsWith('profile-')).toBe(true);
    expect(s3Service.getPresignedUploadUrl).toHaveBeenCalledWith(key, 'image/jpeg');
  });

  it('deletes existing pet images when clearing the imageUrl', async () => {
    const user = await createUser();
    const customer = await createCustomerForUser(user.id, { name: 'Image Owner', email: null });
    const pet = await createPetForCustomer(customer.id, {
      name: 'Luna',
      type: 'cat',
      gender: 'female',
    });

    const deleteSpy = vi.spyOn(s3Service, 'deleteObject').mockResolvedValue();
    const downloadSpy = vi
      .spyOn(s3Service, 'getPresignedDownloadUrl')
      .mockResolvedValue('https://download.example.com/pet.jpg');

    // Get valid key first
    const { key } = await getPetImageUploadUrl(user.id, customer.id, pet.id, 'image/jpeg');

    await updatePetForCustomer(customer.id, pet.id, { imageUrl: key }, user.id);
    expect(downloadSpy).toHaveBeenCalled();

    const cleared = await updatePetForCustomer(customer.id, pet.id, { imageUrl: null }, user.id);

    expect(deleteSpy).toHaveBeenCalledWith(key);
    expect(cleared.imageUrl).toBeNull();

    const persisted = await getPetForCustomer(customer.id, pet.id);
    expect(persisted.imageUrl).toBeNull();
  });
});
