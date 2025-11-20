import { fetchJson } from '../lib/http';
import {
  createVisitBodySchema,
  updateVisitBodySchema,
  updateVisitParamsSchema,
  visitParamsSchema,
  visitResponseSchema,
  visitWithDetailsResponseSchema,
  visitsListResponseSchema,
} from '@kalimere/types/visits';
import type {
  CreateVisitBody,
  UpdateVisitBody,
  Visit,
  VisitWithDetails,
} from '@kalimere/types/visits';

type RequestOptions = {
  signal?: AbortSignal;
};

export type {
  CreateVisitBody,
  UpdateVisitBody,
  Visit,
  VisitWithDetails,
} from '@kalimere/types/visits';

export async function listPetVisits(
  customerId: string,
  petId: string,
  options: RequestOptions = {}
): Promise<Visit[]> {
  const requestInit = options.signal ? { signal: options.signal } : undefined;
  const json = await fetchJson<unknown>(
    `/customers/${customerId}/pets/${petId}/visits`,
    requestInit
  );
  const result = visitsListResponseSchema.parse(json);
  return result.visits;
}

export async function createVisit(input: CreateVisitBody): Promise<Visit> {
  const payload = createVisitBodySchema.parse(input);
  const json = await fetchJson<unknown>('/visits', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  const result = visitResponseSchema.parse(json);
  return result.visit;
}

export async function getVisit(
  visitId: string,
  options: RequestOptions = {}
): Promise<VisitWithDetails> {
  const params = visitParamsSchema.parse({ id: visitId });
  const requestInit = options.signal ? { signal: options.signal } : undefined;
  const json = await fetchJson<unknown>(`/visits/${params.id}`, requestInit);
  const result = visitWithDetailsResponseSchema.parse(json);
  return result.visit;
}

export async function updateVisit(
  visitId: string,
  input: UpdateVisitBody
): Promise<VisitWithDetails> {
  const params = updateVisitParamsSchema.parse({ id: visitId });
  const payload = updateVisitBodySchema.parse(input);
  const json = await fetchJson<unknown>(`/visits/${params.id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  const result = visitWithDetailsResponseSchema.parse(json);
  return result.visit;
}

export async function getVisitImageUploadUrl(
  visitId: string,
  contentType: string,
  originalName?: string
): Promise<{ url: string; key: string }> {
  const json = await fetchJson<unknown>(`/visits/${visitId}/images/upload-url`, {
    method: 'POST',
    body: JSON.stringify({ contentType, originalName }),
  });
  return json as { url: string; key: string };
}

export async function addVisitImage(
  visitId: string,
  key: string,
  originalName?: string,
  contentType?: string
): Promise<void> {
  await fetchJson(`/visits/${visitId}/images`, {
    method: 'POST',
    body: JSON.stringify({ key, originalName, contentType }),
  });
}
