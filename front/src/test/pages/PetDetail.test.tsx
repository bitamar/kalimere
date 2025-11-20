import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { PetDetail } from '../../pages/PetDetail';
import * as customersApi from '../../api/customers';
import * as visitsApi from '../../api/visits';
import { renderWithProviders } from '../utils/renderWithProviders';
import { suppressConsoleError } from '../utils/suppressConsoleError';
import { HttpError } from '../../lib/http';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../api/customers');
vi.mock('../../api/visits');

const mockPet: customersApi.Pet = {
  id: 'pet-1',
  customerId: 'cust-1',
  name: 'Bolt',
  type: 'dog',
  gender: 'male',
  dateOfBirth: '2020-06-01',
  breed: 'Border Collie',
  isSterilized: true,
  isCastrated: false,
  imageUrl: null,
};

const mockCustomer: customersApi.Customer = {
  id: 'cust-1',
  name: 'Dana Vet',
  email: 'dana@example.com',
  phone: '050-1231234',
  address: 'Tel Aviv',
  petsCount: 1,
};

describe('PetDetail page', () => {
  const getPetMock = vi.mocked(customersApi.getPet);
  const getCustomerMock = vi.mocked(customersApi.getCustomer);
  const deletePetMock = vi.mocked(customersApi.deletePet);
  const updatePetMock = vi.mocked(customersApi.updatePet);
  const listPetVisitsMock = vi.mocked(visitsApi.listPetVisits);
  let restoreConsoleError: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    getPetMock.mockResolvedValue(mockPet);
    getCustomerMock.mockResolvedValue(mockCustomer);
    deletePetMock.mockResolvedValue();
    updatePetMock.mockResolvedValue(mockPet);
    listPetVisitsMock.mockResolvedValue([]);
    restoreConsoleError?.();
    restoreConsoleError = null;
  });

  function renderPetDetail() {
    return renderWithProviders(
      <Routes>
        <Route path="/customers/:customerId/pets/:petId" element={<PetDetail />} />
      </Routes>,
      {
        router: {
          initialEntries: ['/customers/cust-1/pets/pet-1'],
        },
      }
    );
  }

  it('renders pet details and owner information', async () => {
    renderPetDetail();

    await waitFor(() => expect(getPetMock).toHaveBeenCalled());
    const [petCustomerId, petId] = getPetMock.mock.calls[0] ?? [];
    expect(petCustomerId).toBe('cust-1');
    expect(petId).toBe('pet-1');

    await waitFor(() => expect(getCustomerMock).toHaveBeenCalled());
    const [customerIdArg] = getCustomerMock.mock.calls[0] ?? [];
    expect(customerIdArg).toBe('cust-1');

    expect(await screen.findByRole('heading', { name: 'Bolt' })).toBeInTheDocument();
    expect(await screen.findByText('כלב')).toBeInTheDocument();
    expect(await screen.findByText('זכר')).toBeInTheDocument();
    expect(await screen.findByText('Border Collie')).toBeInTheDocument();
    expect(await screen.findByText('Dana Vet')).toBeInTheDocument();
  });

  it('navigates to customer page when owner link is clicked', async () => {
    const user = userEvent.setup();
    renderPetDetail();

    await waitFor(() => expect(getPetMock).toHaveBeenCalled());
    await waitFor(() => expect(getCustomerMock).toHaveBeenCalled());

    const ownerLink = await screen.findByText('Dana Vet');

    await user.click(ownerLink);

    expect(navigateMock).toHaveBeenCalledWith('/customers/cust-1');
  });

  it('allows editing the pet details', async () => {
    const user = userEvent.setup();
    const updatedPet: customersApi.Pet = {
      ...mockPet,
      name: 'Bolt Updated',
      breed: 'Labrador',
    };
    updatePetMock.mockResolvedValue(updatedPet);
    getPetMock.mockResolvedValueOnce(mockPet).mockResolvedValue(updatedPet);

    renderPetDetail();

    await waitFor(() => expect(getPetMock).toHaveBeenCalled());

    const menuButton = await screen.findByTestId('pet-actions-trigger');
    await user.click(menuButton);

    const actionsDropdown = await screen.findByTestId('pet-actions-dropdown');
    await user.click(within(actionsDropdown).getByText('ערוך חיית מחמד'));

    const dialog = await screen.findByRole('dialog', { name: 'עריכת חיית מחמד' });
    const nameInput = within(dialog).getByLabelText(/שם/);
    await user.clear(nameInput);
    await user.type(nameInput, 'Bolt Updated');

    const breedInput = within(dialog).getByLabelText(/גזע/);
    await user.clear(breedInput);
    await user.type(breedInput, 'Labrador');

    await user.click(within(dialog).getByRole('button', { name: 'שמור' }));

    await waitFor(() => expect(updatePetMock).toHaveBeenCalled());
    expect(updatePetMock).toHaveBeenCalledWith('cust-1', 'pet-1', {
      name: 'Bolt Updated',
      type: 'dog',
      gender: 'male',
      breed: 'Labrador',
    });

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'עריכת חיית מחמד' })).not.toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Bolt Updated' })).toBeInTheDocument()
    );
  });

  it('shows the current profile image in edit mode and allows removing it', async () => {
    const user = userEvent.setup();
    const petWithImage: customersApi.Pet = {
      ...mockPet,
      imageUrl: 'https://images.example.com/pet.jpg',
    };
    getPetMock.mockResolvedValue(petWithImage);
    updatePetMock.mockResolvedValue({ ...petWithImage, imageUrl: null });

    renderPetDetail();

    await waitFor(() => expect(getPetMock).toHaveBeenCalled());

    const menuButton = await screen.findByTestId('pet-actions-trigger');
    await user.click(menuButton);

    const actionsDropdown = await screen.findByTestId('pet-actions-dropdown');
    await user.click(within(actionsDropdown).getByText('ערוך חיית מחמד'));

    const dialog = await screen.findByRole('dialog', { name: 'עריכת חיית מחמד' });
    const preview = await within(dialog).findByRole('img', { name: 'Preview' });
    expect(preview).toHaveAttribute('src', petWithImage.imageUrl);

    const removeButton = within(dialog).getByRole('button', { name: 'הסר תמונה' });
    await user.click(removeButton);

    await waitFor(() =>
      expect(updatePetMock).toHaveBeenCalledWith('cust-1', 'pet-1', { imageUrl: null })
    );

    await waitFor(() =>
      expect(within(dialog).queryByRole('img', { name: 'Preview' })).not.toBeInTheDocument()
    );
  });

  it('allows deleting the pet and returns to customer page', async () => {
    const user = userEvent.setup();
    renderPetDetail();

    await waitFor(() => expect(getPetMock).toHaveBeenCalled());

    // Open actions menu
    const menuButton = await screen.findByTestId('pet-actions-trigger');
    await user.click(menuButton);

    // Click delete option
    const deleteOption = await screen.findByTestId('pet-actions-dropdown');
    await user.click(within(deleteOption).getByText('מחק חיית מחמד'));

    // Confirm deletion in modal
    await user.click(await screen.findByRole('button', { name: 'מחק' }));

    await waitFor(() => expect(deletePetMock).toHaveBeenCalled());
    const [deleteCustomerId, deletePetId] = deletePetMock.mock.calls[0] ?? [];
    expect(deleteCustomerId).toBe('cust-1');
    expect(deletePetId).toBe('pet-1');
    expect(navigateMock).toHaveBeenCalledWith('/customers/cust-1');
  });

  it('shows error state when loading the pet fails', async () => {
    getPetMock.mockRejectedValueOnce(new Error('Request failed: 500'));
    getPetMock.mockResolvedValueOnce(mockPet);
    restoreConsoleError = suppressConsoleError(/Request failed|Failed to load/);
    renderPetDetail();

    await waitFor(() =>
      expect(screen.getByText('לא ניתן להציג את חיית המחמד כעת')).toBeInTheDocument()
    );
    expect(screen.getByText('Request failed: 500')).toBeInTheDocument();

    const user = userEvent.setup();
    const retryButton = screen.getByRole('button', { name: /נסה שוב/ });
    const backButton = screen.getByRole('button', { name: 'חזרה ללקוח' });

    await user.click(backButton);
    expect(navigateMock).toHaveBeenCalledWith('/customers/cust-1');
    navigateMock.mockClear();

    await user.click(retryButton);
    await waitFor(() => expect(getPetMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getAllByText('Bolt').length).toBeGreaterThan(0));
  });

  it('shows not found state when pet does not exist', async () => {
    getPetMock.mockRejectedValueOnce(new HttpError(404, 'Not found'));
    restoreConsoleError = suppressConsoleError(/Not found|NOT_FOUND/);
    renderPetDetail();

    expect(await screen.findByText('חיית המחמד לא נמצאה')).toBeInTheDocument();
    expect(screen.getByText('ייתכן שהחיה נמחקה או שאינך מורשה לצפות בה.')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'חזרה ללקוח' }));
    expect(navigateMock).toHaveBeenCalledWith('/customers/cust-1');
  });

  it('allows closing the delete modal without deleting the pet', async () => {
    const user = userEvent.setup();
    renderPetDetail();

    await waitFor(() => expect(getPetMock).toHaveBeenCalled());

    await user.click(await screen.findByTestId('pet-actions-trigger'));
    const firstDropdown = await screen.findByTestId('pet-actions-dropdown');
    await user.click(within(firstDropdown).getByText('מחק חיית מחמד'));

    const modal = await screen.findByRole('dialog', { name: 'מחיקת חיית מחמד' });
    await user.click(within(modal).getByRole('button', { name: 'ביטול' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'מחיקת חיית מחמד' })).not.toBeInTheDocument()
    );

    await user.click(await screen.findByTestId('pet-actions-trigger'));
    const secondDropdown = await screen.findByTestId('pet-actions-dropdown');
    await user.click(within(secondDropdown).getByText('מחק חיית מחמד'));
    await screen.findByRole('dialog', { name: 'מחיקת חיית מחמד' });

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByTestId('pet-actions-trigger')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'מחיקת חיית מחמד' })).not.toBeInTheDocument()
    );

    expect(deletePetMock).not.toHaveBeenCalled();
  });

  it('renders visits and navigates to the visit detail page', async () => {
    const visit = {
      id: 'visit-1',
      customerId: mockCustomer.id,
      petId: mockPet.id,
      status: 'scheduled' as const,
      scheduledStartAt: '2024-04-10T09:30:00.000Z',
      scheduledEndAt: null,
      completedAt: null,
      title: 'חיסון שנתי',
      description: 'בדיקה כללית',
      createdAt: '2024-04-01T10:00:00.000Z',
      updatedAt: '2024-04-01T10:00:00.000Z',
    };
    listPetVisitsMock.mockResolvedValueOnce([visit]);

    renderPetDetail();

    await waitFor(() => expect(listPetVisitsMock).toHaveBeenCalled());

    expect(await screen.findByText('חיסון שנתי')).toBeInTheDocument();
    expect(screen.getByText('בדיקה כללית')).toBeInTheDocument();

    const viewButton = await screen.findByRole('button', { name: 'צפה בפרטים' });
    await userEvent.click(viewButton);
    expect(navigateMock).toHaveBeenCalledWith(`/visits/${visit.id}`);
  });

  it('shows an error message when visit loading fails', async () => {
    listPetVisitsMock.mockRejectedValueOnce(new Error('visit-failure'));
    renderPetDetail();

    await waitFor(() => expect(listPetVisitsMock).toHaveBeenCalled());

    expect(await screen.findByText('visit-failure')).toBeInTheDocument();
  });
});
