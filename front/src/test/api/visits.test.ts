import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createVisit,
  getVisit,
  listPetVisits,
  updateVisit,
  type Visit,
  type VisitWithDetails,
} from '../../api/visits';
import { fetchJson } from '../../lib/http';

vi.mock('../../lib/http', () => ({
  fetchJson: vi.fn(),
}));

const fetchJsonMock = vi.mocked(fetchJson);

const baseVisit: Visit = {
  id: '11111111-1111-4111-8111-111111111111',
  customerId: '22222222-2222-4222-8222-222222222222',
  petId: '33333333-3333-4333-8333-333333333333',
  status: 'scheduled',
  scheduledStartAt: '2024-04-10T09:30:00.000Z',
  scheduledEndAt: null,
  completedAt: null,
  title: 'Checkup',
  description: null,
  createdAt: '2024-04-01T10:00:00.000Z',
  updatedAt: '2024-04-01T10:00:00.000Z',
};

const visitWithDetails: VisitWithDetails = {
  ...baseVisit,
  treatments: [],
  notes: [],
};

describe('visits api', () => {
  beforeEach(() => {
    fetchJsonMock.mockReset();
  });

  it('listPetVisits forwards signal and returns parsed visits', async () => {
    const controller = new AbortController();
    fetchJsonMock.mockResolvedValueOnce({ visits: [baseVisit] });

    const result = await listPetVisits('cust-1', 'pet-1', { signal: controller.signal });

    expect(fetchJsonMock).toHaveBeenCalledWith('/customers/cust-1/pets/pet-1/visits', {
      signal: controller.signal,
    });
    expect(result).toEqual([baseVisit]);
  });

  it('listPetVisits works without options', async () => {
    fetchJsonMock.mockResolvedValueOnce({ visits: [baseVisit] });

    const result = await listPetVisits('cust-1', 'pet-1');

    expect(fetchJsonMock).toHaveBeenCalledWith('/customers/cust-1/pets/pet-1/visits', undefined);
    expect(result).toEqual([baseVisit]);
  });

  it('createVisit validates payload and returns created visit', async () => {
    fetchJsonMock.mockResolvedValueOnce({ visit: baseVisit });

    const payload = {
      customerId: baseVisit.customerId,
      petId: baseVisit.petId,
      scheduledStartAt: baseVisit.scheduledStartAt,
      title: baseVisit.title,
      description: baseVisit.description,
    } as const;

    const result = await createVisit(payload);

    expect(fetchJsonMock).toHaveBeenCalledWith('/visits', expect.any(Object));
    const [, requestInit] = fetchJsonMock.mock.calls[0] ?? [];
    expect(requestInit).toMatchObject({ method: 'POST' });
    expect(JSON.parse(requestInit?.body as string)).toEqual(payload);
    expect(result).toEqual(baseVisit);
  });

  it('getVisit validates params and returns visit with details', async () => {
    fetchJsonMock.mockResolvedValueOnce({ visit: visitWithDetails });

    const result = await getVisit(baseVisit.id);

    expect(fetchJsonMock).toHaveBeenCalledWith(`/visits/${baseVisit.id}`, undefined);
    expect(result).toEqual(visitWithDetails);
  });

  it('updateVisit validates params and payload', async () => {
    const updated: VisitWithDetails = {
      ...visitWithDetails,
      notes: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          visitId: baseVisit.id,
          note: 'Follow up',
          createdAt: '2024-04-11T08:00:00.000Z',
          updatedAt: '2024-04-11T08:00:00.000Z',
        },
      ],
    };
    fetchJsonMock.mockResolvedValueOnce({ visit: updated });

    const result = await updateVisit(baseVisit.id, { notes: [{ note: 'Follow up' }] });

    expect(fetchJsonMock).toHaveBeenCalledWith(`/visits/${baseVisit.id}`, expect.any(Object));
    const lastCall = fetchJsonMock.mock.calls[fetchJsonMock.mock.calls.length - 1] ?? [];
    const [, updateRequestInit] = lastCall as [string, RequestInit | undefined];
    expect(updateRequestInit).toMatchObject({ method: 'PUT' });
    expect(JSON.parse(updateRequestInit?.body as string)).toEqual({
      notes: [{ note: 'Follow up' }],
    });
    expect(result).toEqual(updated);
  });
});
