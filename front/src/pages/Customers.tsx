import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Container,
  Group,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listCustomers,
  createCustomer,
  deleteCustomer,
  updateCustomer,
  type CreateCustomerBody,
  type Customer,
  type UpdateCustomerBody,
} from '../api/customers';
import { StatusCard } from '../components/StatusCard';
import { PageTitle } from '../components/PageTitle';
import { EntityCard } from '../components/EntityCard';
import { formatPetsCount } from '../utils/formatPetsCount';
import { extractErrorMessage } from '../lib/notifications';
import { queryKeys } from '../lib/queryKeys';
import { useApiMutation } from '../lib/useApiMutation';
import { EntityFormModal } from '../components/EntityFormModal';
import { applyCustomerUpdates } from '../utils/entityUpdates';

const sortCustomers = (rows: Customer[]) =>
  [...rows].sort((a, b) => a.name.localeCompare(b.name, 'he-IL'));

export function Customers() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const customersQueryKey = queryKeys.customers();
  const {
    data: customersData = [],
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: customersQueryKey,
    queryFn: ({ signal }: { signal: AbortSignal }) => listCustomers({ signal }),
    select: sortCustomers,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  function closeFormModal() {
    setModalOpen(false);
    setEditCustomerId(null);
  }

  function openCreateCustomer() {
    setEditCustomerId(null);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setCustomerAddress('');
    setModalOpen(true);
  }

  function openEditCustomer(customer: Customer) {
    setEditCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerEmail(customer.email ?? '');
    setCustomerPhone(customer.phone ?? '');
    setCustomerAddress(customer.address ?? '');
    setModalOpen(true);
  }

  const createCustomerMutation = useApiMutation({
    mutationFn: createCustomer,
    successToast: { message: 'הלקוח נוסף בהצלחה' },
    errorToast: { fallbackMessage: 'הוספת הלקוח נכשלה' },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: customersQueryKey });
      const previousCustomers = queryClient.getQueryData<Customer[]>(customersQueryKey) ?? [];
      const optimisticCustomer: Customer = {
        id: `optimistic-${Date.now()}`,
        name: payload.name,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        address: payload.address ?? null,
        petsCount: 0,
      };
      queryClient.setQueryData<Customer[]>(customersQueryKey, (old = []) =>
        sortCustomers([
          ...old.filter((customer) => customer.id !== optimisticCustomer.id),
          optimisticCustomer,
        ])
      );
      return { previousCustomers, optimisticId: optimisticCustomer.id };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(customersQueryKey, context?.previousCustomers ?? []);
    },
    onSuccess: (data, _variables, context) => {
      queryClient.setQueryData<Customer[]>(customersQueryKey, (old = []) => {
        const withoutOptimistic = context?.optimisticId
          ? old.filter((customer) => customer.id !== context.optimisticId)
          : old;
        return sortCustomers([...withoutOptimistic, data]);
      });
      closeFormModal();
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: customersQueryKey });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats() });
    },
  });

  const updateCustomerMutation = useApiMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCustomerBody }) =>
      updateCustomer(id, payload),
    successToast: { message: 'הלקוח עודכן בהצלחה' },
    errorToast: { fallbackMessage: 'עדכון הלקוח נכשל' },
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: customersQueryKey });
      const previousCustomers = queryClient.getQueryData<Customer[]>(customersQueryKey) ?? [];
      queryClient.setQueryData<Customer[]>(customersQueryKey, (old = []) =>
        sortCustomers(
          old.map((customer) =>
            customer.id === id ? applyCustomerUpdates(customer, payload) : customer
          )
        )
      );
      const customerKey = queryKeys.customer(id);
      await queryClient.cancelQueries({ queryKey: customerKey });
      const previousCustomer = queryClient.getQueryData<Customer>(customerKey);
      if (previousCustomer) {
        queryClient.setQueryData<Customer>(
          customerKey,
          applyCustomerUpdates(previousCustomer, payload)
        );
      }
      return { previousCustomers, previousCustomer, customerKey };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(customersQueryKey, context?.previousCustomers ?? []);
      if (context?.customerKey) {
        queryClient.setQueryData(context.customerKey, context.previousCustomer);
      }
    },
    onSuccess: (data, variables, context) => {
      if (!variables) {
        closeFormModal();
        return;
      }
      const { id, payload } = variables;
      queryClient.setQueryData<Customer[]>(customersQueryKey, (old = []) =>
        sortCustomers(
          old.map((customer) =>
            customer.id === (data?.id ?? id)
              ? (data ?? applyCustomerUpdates(customer, payload))
              : customer
          )
        )
      );
      if (context?.customerKey) {
        queryClient.setQueryData<Customer>(
          context.customerKey,
          data ??
            (context.previousCustomer
              ? applyCustomerUpdates(context.previousCustomer, payload)
              : context.previousCustomer)
        );
      }
      closeFormModal();
    },
    onSettled: (_data, _error, variables, context) => {
      void queryClient.invalidateQueries({ queryKey: customersQueryKey });
      const id = variables?.id ?? (context?.customerKey ? context.customerKey[1] : undefined);
      if (id) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.customer(id) });
      }
    },
  });

  const deleteCustomerMutation = useApiMutation({
    mutationFn: deleteCustomer,
    successToast: { message: 'הלקוח נמחק' },
    errorToast: { fallbackMessage: 'מחיקת הלקוח נכשלה' },
    onMutate: async (customerId: string) => {
      await queryClient.cancelQueries({ queryKey: customersQueryKey });
      const previousCustomers = queryClient.getQueryData<Customer[]>(customersQueryKey) ?? [];
      queryClient.setQueryData<Customer[]>(customersQueryKey, (old = []) =>
        old.filter((customer) => customer.id !== customerId)
      );
      await queryClient.cancelQueries({ queryKey: queryKeys.customer(customerId) });
      await queryClient.cancelQueries({ queryKey: queryKeys.pets(customerId) });
      const previousCustomer = queryClient.getQueryData(queryKeys.customer(customerId));
      const previousPets = queryClient.getQueryData(queryKeys.pets(customerId));
      return { previousCustomers, previousCustomer, previousPets, customerId };
    },
    onError: (_error, _customerId, context) => {
      queryClient.setQueryData(customersQueryKey, context?.previousCustomers ?? []);
      if (context?.customerId) {
        queryClient.setQueryData(queryKeys.customer(context.customerId), context?.previousCustomer);
        queryClient.setQueryData(queryKeys.pets(context.customerId), context?.previousPets);
      }
    },
    onSuccess: (_data, _variables, context) => {
      setDeleteModalOpen(false);
      setCustomerToDelete(null);
      if (context?.customerId) {
        void queryClient.removeQueries({ queryKey: queryKeys.customer(context.customerId) });
        void queryClient.removeQueries({ queryKey: queryKeys.pets(context.customerId) });
      }
    },
    onSettled: (_data, _error, _variables, context) => {
      void queryClient.invalidateQueries({ queryKey: customersQueryKey });
      if (context?.customerId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.customer(context.customerId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.pets(context.customerId) });
      }
    },
  });

  async function onSubmitCustomer() {
    const trimmedName = customerName.trim();
    if (!trimmedName) return;
    const basePayload = {
      email: customerEmail ? customerEmail : null,
      phone: customerPhone ? customerPhone : null,
      address: customerAddress ? customerAddress : null,
    };
    if (!editCustomerId) {
      const createPayload: CreateCustomerBody = {
        name: trimmedName,
        ...basePayload,
      };
      await createCustomerMutation.mutateAsync(createPayload);
    } else {
      const updatePayload: UpdateCustomerBody = {
        name: trimmedName,
        ...basePayload,
      };
      await updateCustomerMutation.mutateAsync({ id: editCustomerId, payload: updatePayload });
    }
  }

  function openDeleteModal(customer: Customer) {
    setCustomerToDelete(customer);
    setDeleteModalOpen(true);
  }

  async function onDeleteCustomer() {
    if (!customerToDelete) return;
    await deleteCustomerMutation.mutateAsync(customerToDelete.id);
  }

  const customers: Customer[] = customersData ?? [];

  const cards = useMemo(
    () =>
      customers.map((customer) => {
        const { email, id, name, phone, address, petsCount } = customer;

        const contactInfo = (
          <Stack gap={2}>
            {email && (
              <Text size="sm" c="dimmed">
                {email}
              </Text>
            )}
            {phone && (
              <Text size="sm" c="dimmed">
                {phone}
              </Text>
            )}
            {address && (
              <Text size="sm" c="dimmed">
                {address}
              </Text>
            )}
          </Stack>
        );

        return (
          <EntityCard
            key={id}
            id={id}
            title={name}
            badge={
              <Badge key="pet-count" variant="light" size="sm" color="blue">
                {formatPetsCount(petsCount)}
              </Badge>
            }
            deleteAction={{
              label: 'מחק לקוח',
              onClick: () => openDeleteModal(customer),
            }}
            editAction={() => openEditCustomer(customer)}
            onClick={() => navigate(`/customers/${id}`)}
            className="customer-card"
          >
            {contactInfo}
          </EntityCard>
        );
      }),
    [customers, navigate, openDeleteModal, openEditCustomer]
  );

  const loading = isPending;
  const queryError = isError ? extractErrorMessage(error, 'אירעה שגיאה בטעינת הלקוחות') : null;
  const isEmpty = !loading && !queryError && customers.length === 0;
  const mutationInFlight = createCustomerMutation.isPending || updateCustomerMutation.isPending;

  return (
    <Container size="lg" pt={{ base: 'xl', sm: 'xl' }} pb="xl">
      <Group justify="space-between" mb="md">
        <PageTitle order={2}>לקוחות</PageTitle>
        <Button onClick={openCreateCustomer} disabled={loading}>
          לקוח חדש
        </Button>
      </Group>

      {loading ? (
        <StatusCard status="loading" title="טוען לקוחות..." />
      ) : queryError ? (
        <StatusCard
          status="error"
          title="לא ניתן להציג לקוחות כעת"
          description={queryError}
          primaryAction={{ label: 'נסה שוב', onClick: () => void refetch() }}
        />
      ) : isEmpty ? (
        <StatusCard
          status="empty"
          title="אין עדיין לקוחות"
          description='לחץ על "לקוח חדש" כדי להוסיף את הלקוח הראשון שלך.'
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {cards}
        </SimpleGrid>
      )}

      <EntityFormModal
        opened={modalOpen}
        onClose={closeFormModal}
        title={editCustomerId ? 'עריכת לקוח' : 'לקוח חדש'}
        mode={editCustomerId ? 'edit' : 'create'}
        onSubmit={onSubmitCustomer}
        submitDisabled={!customerName}
        submitLoading={mutationInFlight}
      >
        <TextInput
          label="שם"
          value={customerName}
          onChange={({ currentTarget }) => setCustomerName(currentTarget.value)}
          required
        />
        <TextInput
          label="אימייל"
          type="email"
          value={customerEmail}
          onChange={({ currentTarget }) => setCustomerEmail(currentTarget.value)}
        />
        <TextInput
          label="טלפון"
          type="tel"
          value={customerPhone}
          onChange={({ currentTarget }) => setCustomerPhone(currentTarget.value)}
        />
        <TextInput
          label="כתובת"
          value={customerAddress}
          onChange={({ currentTarget }) => setCustomerAddress(currentTarget.value)}
        />
      </EntityFormModal>

      <Modal opened={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="מחיקת לקוח">
        <Stack>
          <Text>
            האם אתה בטוח שברצונך למחוק את הלקוח "{customerToDelete?.name}"? פעולה זו אינה ניתנת
            לביטול.
          </Text>
          <Group justify="right" mt="sm">
            <Button variant="default" onClick={() => setDeleteModalOpen(false)}>
              ביטול
            </Button>
            <Button
              color="red"
              onClick={onDeleteCustomer}
              loading={deleteCustomerMutation.isPending}
            >
              מחק
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
