import type { Customer, Pet, UpdateCustomerBody, UpdatePetBody } from '../api/customers';

export function applyCustomerUpdates(customer: Customer, payload: UpdateCustomerBody): Customer {
  return {
    ...customer,
    name: payload.name ?? customer.name,
    email: payload.email !== undefined ? payload.email : customer.email,
    phone: payload.phone !== undefined ? payload.phone : customer.phone,
    address: payload.address !== undefined ? payload.address : customer.address,
  };
}

export function applyPetUpdates(pet: Pet, payload: UpdatePetBody): Pet {
  return {
    ...pet,
    name: payload.name ?? pet.name,
    type: payload.type ?? pet.type,
    gender: payload.gender ?? pet.gender,
    dateOfBirth:
      payload.dateOfBirth !== undefined
        ? payload.dateOfBirth === null
          ? null
          : payload.dateOfBirth
        : pet.dateOfBirth,
    breed: payload.breed !== undefined ? payload.breed : pet.breed,
    isSterilized: payload.isSterilized !== undefined ? payload.isSterilized : pet.isSterilized,
    isCastrated: payload.isCastrated !== undefined ? payload.isCastrated : pet.isCastrated,
    imageUrl: payload.imageUrl !== undefined ? payload.imageUrl : pet.imageUrl,
  };
}
