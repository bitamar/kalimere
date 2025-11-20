import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ensureAuthed } from '../plugins/auth.js';
import { ensureCustomerOwnership, ensurePetOwnership } from '../middleware/ownership.js';
import {
  createVisitBodySchema,
  createVisitImageBodySchema,
  updateVisitBodySchema,
  updateVisitParamsSchema,
  visitImageSchema,
  visitParamsSchema,
  visitResponseSchema,
  visitWithDetailsResponseSchema,
  visitsListResponseSchema,
} from '@kalimere/types/visits';
import { customerPetParamsSchema } from '@kalimere/types/customers';
import { uploadUrlResponseSchema } from '@kalimere/types/common';
import {
  addVisitImage,
  createVisitForUser,
  getVisitForUser,
  getVisitImageUploadUrl,
  listVisitsForPet,
  updateVisitForUser,
} from '../services/visit-service.js';
import { z } from 'zod';

const visitRoutesPlugin: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/visits',
    {
      preHandler: app.authenticate,
      schema: {
        body: createVisitBodySchema,
        response: {
          201: visitResponseSchema,
        },
      },
    },
    async (req, reply) => {
      ensureAuthed(req);
      const visit = await createVisitForUser(req.user.id, req.body);
      return reply.code(201).send({ visit });
    }
  );

  app.get(
    '/customers/:customerId/pets/:petId/visits',
    {
      preHandler: [
        app.authenticate,
        ensureCustomerOwnership('customerId'),
        ensurePetOwnership('petId'),
      ],
      schema: {
        params: customerPetParamsSchema,
        response: {
          200: visitsListResponseSchema,
        },
      },
    },
    async (req) => {
      const visits = await listVisitsForPet(req.params.petId);
      return { visits };
    }
  );

  app.get(
    '/visits/:id',
    {
      preHandler: app.authenticate,
      schema: {
        params: visitParamsSchema,
        response: {
          200: visitWithDetailsResponseSchema,
        },
      },
    },
    async (req) => {
      ensureAuthed(req);
      const visit = await getVisitForUser(req.user.id, req.params.id);
      return { visit };
    }
  );

  app.put(
    '/visits/:id',
    {
      preHandler: app.authenticate,
      schema: {
        params: updateVisitParamsSchema,
        body: updateVisitBodySchema,
        response: {
          200: visitWithDetailsResponseSchema,
        },
      },
    },
    async (req) => {
      ensureAuthed(req);
      const visit = await updateVisitForUser(req.user.id, req.params.id, req.body);
      return { visit };
    }
  );

  app.post(
    '/visits/:id/images/upload-url',
    {
      preHandler: app.authenticate,
      schema: {
        params: visitParamsSchema,
        body: z.object({ contentType: z.string() }),
        response: {
          200: uploadUrlResponseSchema,
        },
      },
    },
    async (req) => {
      ensureAuthed(req);
      const { contentType } = req.body;
      return getVisitImageUploadUrl(req.user.id, req.params.id, contentType);
    }
  );

  app.post(
    '/visits/:id/images',
    {
      preHandler: app.authenticate,
      schema: {
        params: visitParamsSchema,
        body: createVisitImageBodySchema,
        response: {
          201: visitImageSchema,
        },
      },
    },
    async (req, reply) => {
      ensureAuthed(req);
      const { key, originalName, contentType } = req.body;
      const image = await addVisitImage(
        req.user.id,
        req.params.id,
        key,
        originalName ?? undefined,
        contentType ?? undefined
      );
      return reply.code(201).send(image);
    }
  );
};

export const visitRoutes = visitRoutesPlugin;
