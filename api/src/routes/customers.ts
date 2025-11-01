import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ensureAuthed } from '../plugins/auth.js';
import {
  createCustomerBodySchema,
  createPetBodySchema,
  createPetParamsSchema,
  customerPetParamsSchema,
  customerPetsParamsSchema,
  customerPetsResponseSchema,
  customerResponseSchema,
  customersListResponseSchema,
  deleteCustomerParamsSchema,
  petResponseSchema,
  updateCustomerBodySchema,
  updateCustomerParamsSchema,
  updatePetBodySchema,
  updatePetImageBodySchema,
} from '@kalimere/types/customers';
import { okResponseSchema } from '@kalimere/types/common';
import { ensureCustomerOwnership, ensurePetOwnership } from '../middleware/ownership.js';
import {
  createCustomerForUser,
  createPetForCustomer,
  deleteCustomerForUser,
  deletePetForCustomer,
  getCustomerForUser,
  getPetForCustomer,
  listCustomersForUser,
  listPetsForCustomer,
  updateCustomerForUser,
  updatePetForCustomer,
  removePetImageForCustomer,
  updatePetImageForCustomer,
} from '../services/customer-service.js';

const customerRoutesPlugin: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/customers',
    {
      preHandler: app.authenticate,
      schema: {
        response: {
          200: customersListResponseSchema,
        },
      },
    },
    async (req) => {
      ensureAuthed(req);
      const customersList = await listCustomersForUser(req.user.id);
      return { customers: customersList };
    }
  );

  app.post(
    '/customers',
    {
      preHandler: app.authenticate,
      schema: {
        body: createCustomerBodySchema,
        response: {
          201: customerResponseSchema,
        },
      },
    },
    async (req, reply) => {
      ensureAuthed(req);
      const customer = await createCustomerForUser(req.user.id, req.body);
      return reply.code(201).send({ customer });
    }
  );

  app.get(
    '/customers/:id',
    {
      preHandler: [app.authenticate, ensureCustomerOwnership('id')],
      schema: {
        params: updateCustomerParamsSchema,
        response: {
          200: customerResponseSchema,
        },
      },
    },
    async (req) => {
      ensureAuthed(req);
      const customer = await getCustomerForUser(req.user.id, req.params.id);
      return { customer };
    }
  );

  app.put(
    '/customers/:id',
    {
      preHandler: [app.authenticate, ensureCustomerOwnership('id')],
      schema: {
        params: updateCustomerParamsSchema,
        body: updateCustomerBodySchema,
        response: {
          200: customerResponseSchema,
        },
      },
    },
    async (req) => {
      ensureAuthed(req);
      const customer = await updateCustomerForUser(req.user.id, req.params.id, req.body);
      return { customer };
    }
  );

  app.delete(
    '/customers/:id',
    {
      preHandler: [app.authenticate, ensureCustomerOwnership('id')],
      schema: {
        params: deleteCustomerParamsSchema,
        response: {
          200: okResponseSchema,
        },
      },
    },
    async (req) => {
      ensureAuthed(req);
      return deleteCustomerForUser(req.user.id, req.params.id);
    }
  );

  app.get(
    '/customers/:customerId/pets/:petId',
    {
      preHandler: [
        app.authenticate,
        ensureCustomerOwnership('customerId'),
        ensurePetOwnership('petId'),
      ],
      schema: {
        params: customerPetParamsSchema,
        response: {
          200: petResponseSchema,
        },
      },
    },
    async (req) => {
      const customerId = req.params.customerId;
      const pet = await getPetForCustomer(customerId, req.params.petId);
      return { pet };
    }
  );

  app.post(
    '/customers/:id/pets',
    {
      preHandler: [app.authenticate, ensureCustomerOwnership('id')],
      schema: {
        params: createPetParamsSchema,
        body: createPetBodySchema,
        response: {
          201: petResponseSchema,
        },
      },
    },
    async (req, reply) => {
      const customerId = req.params.id;
      const pet = await createPetForCustomer(customerId, req.body);
      return reply.code(201).send({ pet });
    }
  );

  app.put(
    '/customers/:customerId/pets/:petId',
    {
      preHandler: [
        app.authenticate,
        ensureCustomerOwnership('customerId'),
        ensurePetOwnership('petId'),
      ],
      schema: {
        params: customerPetParamsSchema,
        body: updatePetBodySchema,
        response: {
          200: petResponseSchema,
        },
      },
    },
    async (req) => {
      const customerId = req.params.customerId;
      const pet = await updatePetForCustomer(customerId, req.params.petId, req.body);
      return { pet };
    }
  );

  app.put(
    '/customers/:customerId/pets/:petId/image',
    {
      preHandler: [
        app.authenticate,
        ensureCustomerOwnership('customerId'),
        ensurePetOwnership('petId'),
      ],
      schema: {
        params: customerPetParamsSchema,
        body: updatePetImageBodySchema,
        response: {
          200: petResponseSchema,
        },
      },
    },
    async (req) => {
      const customerId = req.params.customerId;
      const pet = await updatePetImageForCustomer(customerId, req.params.petId, req.body.dataUrl);
      return { pet };
    }
  );

  app.delete(
    '/customers/:customerId/pets/:petId/image',
    {
      preHandler: [
        app.authenticate,
        ensureCustomerOwnership('customerId'),
        ensurePetOwnership('petId'),
      ],
      schema: {
        params: customerPetParamsSchema,
        response: {
          200: petResponseSchema,
        },
      },
    },
    async (req) => {
      const customerId = req.params.customerId;
      const pet = await removePetImageForCustomer(customerId, req.params.petId);
      return { pet };
    }
  );

  app.delete(
    '/customers/:customerId/pets/:petId',
    {
      preHandler: [
        app.authenticate,
        ensureCustomerOwnership('customerId'),
        ensurePetOwnership('petId'),
      ],
      schema: {
        params: customerPetParamsSchema,
        response: {
          200: okResponseSchema,
        },
      },
    },
    async (req) => {
      const customerId = req.params.customerId;
      return deletePetForCustomer(customerId, req.params.petId);
    }
  );

  app.get(
    '/customers/:id/pets',
    {
      preHandler: [app.authenticate, ensureCustomerOwnership('id')],
      schema: {
        params: customerPetsParamsSchema,
        response: {
          200: customerPetsResponseSchema,
        },
      },
    },
    async (req) => {
      const customerId = req.params.id;
      const petsList = await listPetsForCustomer(customerId);
      return { pets: petsList };
    }
  );
};

export const customerRoutes = customerRoutesPlugin;
