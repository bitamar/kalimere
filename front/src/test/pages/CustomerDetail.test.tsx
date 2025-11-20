import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { CustomerDetail } from '../../pages/CustomerDetail';
import * as customersApi from '../../api/customers';
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

const basePets: customersApi.PetSummary[] = [
  { id: 'pet-1', name: 'Bolt', type: 'dog' },
  { id: 'pet-2', name: 'Misty', type: 'cat' },
];

const enrichPet = (pet: customersApi.PetSummary) => ({
  ...pet,
  customerId: baseCustomer.id,
  gender: 'male' as const,
  dateOfBirth: null,
  breed: null,
  isSterilized: null,
  isCastrated: null,
  imageUrl: null,
});

const baseCustomer: customersApi.Customer = {
  id: 'cust-1',
  name: 'Dana Vet',
  email: 'dana@example.com',
  phone: '050-1231234',
  address: 'Tel Aviv',
  petsCount: 2,
};

describe('CustomerDetail page', () => {
  const getCustomerMock = vi.mocked(customersApi.getCustomer);
  const addPetMock = vi.mocked(customersApi.addPetToCustomer);
  const deleteCustomerMock = vi.mocked(customersApi.deleteCustomer);
  const deletePetMock = vi.mocked(customersApi.deletePet);
  const getCustomerPetsMock = vi.mocked(customersApi.getCustomerPets);
  const updateCustomerMock = vi.mocked(customersApi.updateCustomer);
  const updatePetMock = vi.mocked(customersApi.updatePet);
  let restoreConsoleError: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    getCustomerMock.mockResolvedValue(baseCustomer);
    // Add mock for getCustomerPets
    getCustomerPetsMock.mockResolvedValue(basePets.map(enrichPet));
    addPetMock.mockResolvedValue({
      id: 'pet-new',
      customerId: 'cust-1',
      name: 'New Pet',
      type: 'dog',
      gender: 'male',
      dateOfBirth: null,
      breed: null,
      isSterilized: null,
      isCastrated: null,
      imageUrl: null,
    });
    deleteCustomerMock.mockResolvedValue();
    deletePetMock.mockResolvedValue();
    updateCustomerMock.mockResolvedValue(baseCustomer);
    updatePetMock.mockResolvedValue(enrichPet(basePets[0]!));
    restoreConsoleError?.();
    restoreConsoleError = null;
  });

  it('allows editing customer details', async () => {
    updateCustomerMock.mockResolvedValue({
      ...baseCustomer,
      name: 'Dana Updated',
      phone: '050-9999999',
      email: null,
      address: null,
    });

    renderCustomerDetail();

    await waitFor(() => expect(getCustomerMock).toHaveBeenCalled());

    const user = userEvent.setup();
    const customerInfoCard = (await screen.findByText('פרטי לקוח')).closest(
      '.customer-info-card'
    ) as HTMLElement | null;
    if (!customerInfoCard) throw new Error('Customer info card not found');
    const editButton = within(customerInfoCard).getByRole('button', {
      name: 'ערוך',
    }) as HTMLButtonElement;
    await user.click(editButton);

    const dialog = (await screen.findByRole('dialog', { name: 'עריכת לקוח' })) as HTMLElement;
    const nameInput = within(dialog).getByLabelText(/שם/);
    await user.clear(nameInput);
    await user.type(nameInput, 'Dana Updated');
    const phoneInput = within(dialog).getByLabelText(/טלפון/);
    await user.clear(phoneInput);
    await user.type(phoneInput, '050-9999999');
    const emailInput = within(dialog).getByLabelText(/אימייל/);
    await user.clear(emailInput);
    const addressInput = within(dialog).getByLabelText(/כתובת/);
    await user.clear(addressInput);

    await user.click(within(dialog).getByRole('button', { name: 'שמור' }) as HTMLButtonElement);

    await waitFor(() => expect(updateCustomerMock).toHaveBeenCalled());
    expect(updateCustomerMock).toHaveBeenCalledWith('cust-1', {
      name: 'Dana Updated',
      email: null,
      phone: '050-9999999',
      address: null,
    });
  });

  it('allows editing a pet', async () => {
    updatePetMock.mockResolvedValue({
      ...enrichPet(basePets[0]!),
      name: 'Bolt Updated',
    });

    renderCustomerDetail();

    await waitFor(() => expect(getCustomerPetsMock).toHaveBeenCalled());

    const user = userEvent.setup();
    const boltCard = (await screen.findByText('Bolt')).closest('.pet-card') as HTMLElement | null;
    if (!boltCard) throw new Error('Pet card not found');

    await user.click(within(boltCard).getByRole('button', { name: 'ערוך' }) as HTMLButtonElement);

    const dialog = (await screen.findByRole('dialog', { name: 'עריכת חיית מחמד' })) as HTMLElement;
    const nameInput = within(dialog).getByLabelText(/שם/);
    await user.clear(nameInput);
    await user.type(nameInput, 'Bolt Updated');

    await user.click(within(dialog).getByRole('button', { name: 'שמור' }) as HTMLButtonElement);

    await waitFor(() => expect(updatePetMock).toHaveBeenCalled());
    expect(updatePetMock).toHaveBeenCalledWith('cust-1', 'pet-1', {
      name: 'Bolt Updated',
      type: 'dog',
      gender: 'male',
      breed: null,
    });
  });

  afterEach(() => {
    restoreConsoleError?.();
    restoreConsoleError = null;
  });

  function renderCustomerDetail() {
    return renderWithProviders(
      <Routes>
        <Route path="/customers/:id" element={<CustomerDetail />} />
      </Routes>,
      { router: { initialEntries: ['/customers/cust-1'] } }
    );
  }

  it('renders customer summary information and pets', async () => {
    renderCustomerDetail();

    await waitFor(() => expect(getCustomerMock).toHaveBeenCalled());

    expect(await screen.findByRole('heading', { name: 'Dana Vet' })).toBeInTheDocument();
    expect(await screen.findByText('dana@example.com')).toBeInTheDocument();
    expect(await screen.findByText('050-1231234')).toBeInTheDocument();
    expect(await screen.findByText('Tel Aviv')).toBeInTheDocument();
    expect(await screen.findByText('Bolt')).toBeInTheDocument();
    expect(await screen.findByText('Misty')).toBeInTheDocument();
  });

  it('allows deleting a pet and updates the list', async () => {
    getCustomerPetsMock
      .mockResolvedValueOnce(basePets.map(enrichPet))
      .mockResolvedValueOnce(basePets.filter((pet) => pet.id !== 'pet-1').map(enrichPet));

    renderCustomerDetail();
    await waitFor(() => expect(getCustomerMock).toHaveBeenCalled());
    await waitFor(() => expect(getCustomerPetsMock).toHaveBeenCalled());

    const user = userEvent.setup();

    // Wait for pets to be fully loaded
    const boltTitle = await screen.findByText('Bolt');

    // Get the pet card for Bolt
    const boltCard = boltTitle.closest('.pet-card') as HTMLElement;
    expect(boltCard).toBeInTheDocument();

    // Find the menu button within the pet card
    const menuButton = within(boltCard).getByRole('button', {
      hidden: true,
      name: 'פתח תפריט פעולות', // Icon button exposes its label via aria-label
    });

    // Click the menu button to open the dropdown
    await user.click(menuButton);

    // Click the delete option
    const deletePetOption = await screen.findByRole('menuitem', { name: 'מחק חיית מחמד' });
    await user.click(deletePetOption);

    // Confirm deletion in the modal
    const deletePetModal = await screen.findByRole('dialog', { name: 'מחיקת חיית מחמד' });
    await user.click(within(deletePetModal).getByRole('button', { name: 'מחק' }));

    // Verify the pet was deleted
    await waitFor(() => expect(deletePetMock).toHaveBeenCalledWith('cust-1', 'pet-1'));
    await waitFor(() => expect(screen.queryByText('Bolt')).not.toBeInTheDocument());
  });

  it('allows deleting the customer and navigates back to list', async () => {
    renderCustomerDetail();
    await waitFor(() => expect(getCustomerMock).toHaveBeenCalled());

    const user = userEvent.setup();

    // Wait for the customer details to load completely
    await screen.findByRole('heading', { name: 'Dana Vet' });

    // Find the customer title group container
    const titleGroup = screen
      .getByRole('heading', { name: 'Dana Vet' })
      .closest('.customer-title-group');
    expect(titleGroup).toBeInTheDocument();

    // Find the menu button that's a direct child of the title group
    const menuButton = within(titleGroup as HTMLElement).getByRole('button', {
      name: 'פתח תפריט פעולות לקוח',
    });

    // Click the menu button to open the dropdown
    await user.click(menuButton);

    // Click the delete option in the dropdown menu
    await user.click(await screen.findByRole('menuitem', { name: 'מחק לקוח' }));

    // Confirm deletion in the modal
    const deleteCustomerModal = await screen.findByRole('dialog', { name: 'מחיקת לקוח' });
    await user.click(within(deleteCustomerModal).getByRole('button', { name: 'מחק' }));

    // Verify the customer was deleted
    await waitFor(() => expect(deleteCustomerMock).toHaveBeenCalledWith('cust-1'));
    expect(navigateMock).toHaveBeenCalledWith('/customers');
  });

  it('navigates to customers list when breadcrumb link is clicked', async () => {
    renderCustomerDetail();
    await screen.findByRole('heading', { name: 'Dana Vet' });

    const user = userEvent.setup();
    const customersLink = screen.getAllByText('לקוחות')[0]!;
    await user.click(customersLink);

    expect(navigateMock).toHaveBeenCalledWith('/customers');
  });

  it('allows retrying data load after an error', async () => {
    getCustomerMock.mockRejectedValueOnce(new Error('load failed'));
    getCustomerPetsMock.mockRejectedValueOnce(new Error('pets failed'));
    getCustomerMock.mockResolvedValue(baseCustomer);
    getCustomerPetsMock.mockResolvedValue(basePets.map(enrichPet));

    renderCustomerDetail();

    const retryButton = await screen.findByRole('button', { name: 'נסה שוב' });
    const user = userEvent.setup();
    await user.click(retryButton);

    await waitFor(() => expect(getCustomerMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(getCustomerPetsMock).toHaveBeenCalledTimes(2));
  });

  it('returns to customers list from not found state', async () => {
    getCustomerMock.mockRejectedValueOnce(new HttpError(404, 'Not Found'));

    renderCustomerDetail();

    const backButton = await screen.findByRole('button', { name: 'חזרה לרשימת הלקוחות' });
    const user = userEvent.setup();
    await user.click(backButton);

    expect(navigateMock).toHaveBeenCalledWith('/customers');
  });

  it('shows empty state when customer has no pets', async () => {
    // Just use the normal baseCustomer - no need to add a pets property
    getCustomerMock.mockResolvedValueOnce(baseCustomer);
    // Mock getCustomerPets to return an empty array
    getCustomerPetsMock.mockResolvedValueOnce([]);

    renderCustomerDetail();

    expect(await screen.findByText('אין עדיין חיות מחמד ללקוח זה')).toBeInTheDocument();
    expect(
      screen.getByText('לחץ על "+ הוסף חיה" כדי להוסיף חיית מחמד ראשונה.')
    ).toBeInTheDocument();
  });

  it('shows not found state when customer does not exist', async () => {
    getCustomerMock.mockRejectedValueOnce(new HttpError(404, 'Not Found'));

    renderCustomerDetail();

    restoreConsoleError = suppressConsoleError(/NOT_FOUND/);

    await screen.findByText('הלקוח לא נמצא');
    expect(screen.getByText('ייתכן שהלקוח נמחק או שאינך מורשה לצפות בו.')).toBeInTheDocument();
  });

  it('shows error state when loading the customer fails', async () => {
    getCustomerMock.mockRejectedValueOnce(new Error('Request failed: 500'));
    restoreConsoleError = suppressConsoleError(/Failed to load data/);

    renderCustomerDetail();

    await waitFor(() => expect(screen.getByText('לא ניתן להציג את הלקוח כעת')).toBeInTheDocument());
    expect(screen.getByText('Request failed: 500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /נסה שוב/ })).toBeInTheDocument();
  });

  it('allows retry after error', async () => {
    getCustomerMock.mockRejectedValueOnce(new Error('Request failed: 500'));
    getCustomerMock.mockResolvedValueOnce(baseCustomer);
    restoreConsoleError = suppressConsoleError(/Failed to load data/);

    renderCustomerDetail();

    await screen.findByText('לא ניתן להציג את הלקוח כעת');

    await userEvent.click(screen.getByRole('button', { name: /נסה שוב/ }));

    await waitFor(() => expect(getCustomerMock).toHaveBeenCalledTimes(2));
    await screen.findByRole('heading', { name: 'Dana Vet' });
  });

  it('allows adding a new pet and shows it after refresh', async () => {
    renderCustomerDetail();

    const user = userEvent.setup();
    await screen.findByText('Bolt');

    const newPet: customersApi.PetSummary = {
      id: 'pet-new',
      name: 'New Pet',
      type: 'dog',
    };

    // Set up the mock response for getCustomerPets to include the new pet
    const updatedPets = [...basePets, newPet].map((pet) => ({
      ...pet,
      customerId: baseCustomer.id,
      gender: 'male' as const,
      dateOfBirth: null,
      breed: null,
      isSterilized: null,
      isCastrated: null,
      imageUrl: null,
    }));
    getCustomerPetsMock.mockResolvedValueOnce(updatedPets);

    // Open pet form
    await user.click(screen.getByRole('button', { name: '+ הוסף חיה' }));
    const modal = await screen.findByRole('dialog', { name: 'הוסף חיה חדשה' });

    // Fill the form efficiently
    const nameInput = await within(modal).findByLabelText(/שם/);
    await user.type(nameInput, 'New Pet');

    // Select dog option
    await user.click(await within(modal).findByLabelText(/סוג/));
    await user.click(await screen.findByRole('option', { name: 'כלב', hidden: true }));

    // Select male option
    await user.click(await within(modal).findByLabelText(/מין/));
    await user.click(await screen.findByRole('option', { name: 'זכר', hidden: true }));

    // Submit form
    await user.click(await within(modal).findByRole('button', { name: 'הוסף' }));

    // These longer timeouts ensure the test passes in CI environments
    await waitFor(
      () =>
        expect(addPetMock).toHaveBeenCalledWith('cust-1', {
          name: 'New Pet',
          type: 'dog',
          gender: 'male',
          breed: null,
        }),
      { timeout: 7000 }
    );

    // Wait for the getCustomerPets to be called again after adding the pet
    await waitFor(() => expect(getCustomerPetsMock).toHaveBeenCalledTimes(2), { timeout: 7000 });

    // Verify the new pet appears in the UI
    await waitFor(() => expect(screen.getByText('New Pet')).toBeInTheDocument(), { timeout: 7000 });
  }, 10000); // Keep explicit timeout parameter
});
