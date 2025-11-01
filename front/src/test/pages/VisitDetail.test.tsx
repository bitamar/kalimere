import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route, MemoryRouter } from 'react-router-dom';
import { VisitDetail } from '../../pages/VisitDetail';
import * as visitsApi from '../../api/visits';
import * as customersApi from '../../api/customers';
import * as treatmentsApi from '../../api/treatments';
import type { VisitWithDetails } from '../../api/visits';
import type { Customer, Pet } from '../../api/customers';
import type { Treatment } from '../../api/treatments';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider, DirectionProvider } from '@mantine/core';
import { queryKeys } from '../../lib/queryKeys';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../api/visits');
vi.mock('../../api/customers');
vi.mock('../../api/treatments');

const baseVisit: VisitWithDetails = {
  id: 'visit-1',
  customerId: 'cust-1',
  petId: 'pet-1',
  status: 'scheduled',
  scheduledStartAt: '2024-04-10T09:30:00.000Z',
  scheduledEndAt: null,
  completedAt: null,
  title: 'ביקור בדיקה',
  description: null,
  createdAt: '2024-04-01T10:00:00.000Z',
  updatedAt: '2024-04-01T10:00:00.000Z',
  treatments: [],
  notes: [],
};

const baseCustomer: Customer = {
  id: 'cust-1',
  name: 'Dana Vet',
  email: 'dana@example.com',
  phone: '050-1231234',
  address: 'Tel Aviv',
  petsCount: 1,
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
};

const treatmentCatalog: Treatment[] = [
  {
    id: 'treat-1',
    userId: 'user-1',
    name: 'חיסון שנתי',
    defaultIntervalMonths: 12,
    price: 250,
  },
];

type RenderVisitOptions = {
  visit?: VisitWithDetails;
  customer?: Customer;
  pet?: Pet;
  treatments?: Treatment[];
  route?: string;
  visitError?: unknown;
};

async function renderVisitDetailPage({
  visit = baseVisit,
  customer = baseCustomer,
  pet = basePet,
  treatments = treatmentCatalog,
  route = `/visits/${visit.id}`,
  visitError,
}: RenderVisitOptions = {}) {
  if (!document.getElementById('__mantine-portal')) {
    const portalRoot = document.createElement('div');
    portalRoot.setAttribute('id', '__mantine-portal');
    document.body.appendChild(portalRoot);
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const visitKey = queryKeys.visit(visit.id);

  if (visitError) {
    await queryClient
      .prefetchQuery({
        queryKey: visitKey,
        queryFn: async () => {
          throw visitError;
        },
      })
      .catch(() => {});
  } else {
    await queryClient.prefetchQuery({
      queryKey: visitKey,
      queryFn: async () => visit,
    });
  }

  queryClient.setQueryData(queryKeys.customer(customer.id), customer);
  queryClient.setQueryData([...queryKeys.pets(customer.id), pet.id] as const, pet);
  queryClient.setQueryData(queryKeys.treatments(), treatments);

  return render(
    <DirectionProvider>
      <MantineProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/visits/:visitId" element={<VisitDetail />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </MantineProvider>
    </DirectionProvider>
  );
}

describe('VisitDetail page', () => {
  const getVisitMock = vi.mocked(visitsApi.getVisit);
  const updateVisitMock = vi.mocked(visitsApi.updateVisit);
  const getCustomerMock = vi.mocked(customersApi.getCustomer);
  const getPetMock = vi.mocked(customersApi.getPet);
  const listTreatmentsMock = vi.mocked(treatmentsApi.listTreatments);

  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    getVisitMock.mockResolvedValue(baseVisit);
    updateVisitMock.mockResolvedValue(baseVisit);
    getCustomerMock.mockResolvedValue(baseCustomer);
    getPetMock.mockResolvedValue(basePet);
    listTreatmentsMock.mockResolvedValue(treatmentCatalog);
  });

  it('renders visit details and allows navigation to related records', async () => {
    const populatedVisit: VisitWithDetails = {
      ...baseVisit,
      description: 'בדיקה כללית',
      treatments: [
        {
          id: 'vt-1',
          visitId: 'visit-1',
          treatmentId: 'treat-1',
          priceCents: 18000,
          nextDueDate: '2024-06-01',
          createdAt: '2024-04-10T09:30:00.000Z',
          updatedAt: '2024-04-10T09:30:00.000Z',
        },
      ],
      notes: [
        {
          id: 'note-1',
          visitId: 'visit-1',
          note: 'החיה במצב מצוין',
          createdAt: '2024-04-10T09:45:00.000Z',
          updatedAt: '2024-04-10T09:45:00.000Z',
        },
      ],
    };
    getVisitMock.mockResolvedValue(populatedVisit);
    await renderVisitDetailPage({ visit: populatedVisit });

    expect(await screen.findByRole('heading', { name: populatedVisit.title! })).toBeInTheDocument();
    expect(await screen.findByText('החיה במצב מצוין')).toBeInTheDocument();
    const treatmentLabels = await screen.findAllByText('חיסון שנתי');
    expect(treatmentLabels.length).toBeGreaterThan(0);

    const customerLink = (await screen.findAllByText('Dana Vet')).find(
      (element) => element instanceof HTMLAnchorElement && element.style.cursor === 'pointer'
    );
    if (!(customerLink instanceof HTMLAnchorElement)) {
      throw new Error('Expected a clickable customer link');
    }
    await userEvent.click(customerLink);
    expect(navigateMock).toHaveBeenCalledWith('/customers/cust-1');

    const petLink = (await screen.findAllByText('Bolt')).find(
      (element) => element instanceof HTMLAnchorElement && element.style.cursor === 'pointer'
    );
    if (!(petLink instanceof HTMLAnchorElement)) {
      throw new Error('Expected a clickable pet link');
    }
    await userEvent.click(petLink);
    expect(navigateMock).toHaveBeenCalledWith('/customers/cust-1/pets/pet-1');
  });

  it('allows adding a note to the visit', async () => {
    const updatedVisit: VisitWithDetails = {
      ...baseVisit,
      notes: [
        {
          id: 'note-2',
          visitId: baseVisit.id,
          note: 'יש לבצע בדיקת דם נוספת',
          createdAt: '2024-04-11T08:00:00.000Z',
          updatedAt: '2024-04-11T08:00:00.000Z',
        },
      ],
    };
    updateVisitMock.mockResolvedValueOnce(updatedVisit);

    await renderVisitDetailPage();

    const textarea = await screen.findByPlaceholderText('תעד הערות או הוראות נוספות');
    await userEvent.type(textarea, 'יש לבצע בדיקת דם נוספת');

    const saveButton = await screen.findByRole('button', { name: 'שמור הערה' });
    await userEvent.click(saveButton);

    await waitFor(() => expect(updateVisitMock).toHaveBeenCalled());
    expect(updateVisitMock).toHaveBeenCalledWith('visit-1', {
      notes: [{ note: 'יש לבצע בדיקת דם נוספת' }],
    });

    expect(await screen.findByText('יש לבצע בדיקת דם נוספת')).toBeInTheDocument();
    expect(
      (screen.getByPlaceholderText('תעד הערות או הוראות נוספות') as HTMLTextAreaElement).value
    ).toBe('');
  });

  it('allows adding a treatment with price', async () => {
    const updatedVisit: VisitWithDetails = {
      ...baseVisit,
      treatments: [
        {
          id: 'vt-2',
          visitId: baseVisit.id,
          treatmentId: 'treat-1',
          priceCents: 12300,
          nextDueDate: '2024-08-15',
          createdAt: '2024-04-12T10:00:00.000Z',
          updatedAt: '2024-04-12T10:00:00.000Z',
        },
      ],
    };
    updateVisitMock.mockResolvedValueOnce(updatedVisit);

    await renderVisitDetailPage();

    const treatmentField = (await screen.findAllByLabelText('טיפול')).find(
      (element): element is HTMLInputElement => element instanceof HTMLInputElement
    );
    if (!treatmentField) {
      throw new Error('Expected treatment select input');
    }
    await userEvent.click(treatmentField);
    await userEvent.click(await screen.findByRole('option', { name: 'חיסון שנתי', hidden: true }));

    const priceInput = await screen.findByLabelText('מחיר (₪)');
    await userEvent.clear(priceInput);
    await userEvent.type(priceInput, '123');

    const addButton = await screen.findByRole('button', { name: 'הוסף טיפול' });
    await userEvent.click(addButton);

    await waitFor(() => expect(updateVisitMock).toHaveBeenCalled());
    expect(updateVisitMock).toHaveBeenCalledWith('visit-1', {
      treatments: [
        {
          treatmentId: 'treat-1',
          priceCents: 12300,
          nextDueDate: null,
        },
      ],
    });

    const treatmentCards = await screen.findAllByText('חיסון שנתי');
    const [firstTreatmentCard] = treatmentCards;
    expect(firstTreatmentCard).toBeTruthy();
    expect(await screen.findByText(/מחיר:\s*₪\s*123\.00/)).toBeInTheDocument();
  });
});
