import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Container,
  Group,
  Image,
  Menu,
  Modal,
  Stack,
  Text,
} from '@mantine/core';
import { IconDots, IconPencil, IconX } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDisclosure } from '@mantine/hooks';
import {
  getPet,
  deletePet,
  getCustomer,
  updatePetImage,
  deletePetImage,
  type Customer,
  type Pet,
  type UpdatePetBody,
} from '../api/customers';
import { StatusCard } from '../components/StatusCard';
import { queryKeys } from '../lib/queryKeys';
import { extractErrorMessage, showErrorNotification } from '../lib/notifications';
import { HttpError } from '../lib/http';
import { useApiMutation } from '../lib/useApiMutation';
import { PageTitle } from '../components/PageTitle';
import {
  PetFormModal,
  type PetFormModalInitialValues,
  type PetFormSubmitValues,
} from '../components/PetFormModal';
import { usePetUpdateMutation } from '../hooks/usePetUpdateMutation';
import defaultPetImage from '../assets/pet-placeholder.svg';

async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const allowedImageMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function PetDetail() {
  const { customerId, petId } = useParams<{ customerId: string; petId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const customersListKey = queryKeys.customers();
  const customerQueryKey = customerId
    ? queryKeys.customer(customerId)
    : (['customer', ''] as const);
  const petsListKey = customerId ? queryKeys.pets(customerId) : (['pets', ''] as const);

  const petQueryKey = useMemo(() => {
    if (!customerId || !petId) return ['pet', ''];
    return [...queryKeys.pets(customerId), petId] as const;
  }, [customerId, petId]);

  const petQuery = useQuery({
    queryKey: petQueryKey,
    queryFn: ({ signal }: { signal: AbortSignal }) => getPet(customerId!, petId!, { signal }),
    enabled: Boolean(customerId && petId),
  });

  const customerQuery = useQuery({
    queryKey: customerQueryKey,
    queryFn: ({ signal }: { signal: AbortSignal }) => getCustomer(customerId!, { signal }),
    enabled: Boolean(customerId),
  });

  const [deleteModalOpen, { open: openDeleteModal, close: closeDeleteModal }] =
    useDisclosure(false);
  const [petFormOpen, { open: openPetForm, close: closePetForm }] = useDisclosure(false);
  const [petFormInitialValues, setPetFormInitialValues] =
    useState<PetFormModalInitialValues | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const applyPetImageUpdate = (updatedPet: Pet | undefined) => {
    if (!updatedPet) return;
    queryClient.setQueryData<Pet | undefined>(petQueryKey, updatedPet);
    queryClient.setQueryData<Pet[]>(petsListKey, (old = []) =>
      old.map((petItem) => (petItem.id === updatedPet.id ? updatedPet : petItem))
    );
  };

  function resetAndClosePetForm() {
    closePetForm();
    setPetFormInitialValues(null);
  }

  const deletePetMutation = useApiMutation({
    mutationFn: () => deletePet(customerId!, petId!),
    successToast: { message: 'חיית המחמד נמחקה' },
    errorToast: { fallbackMessage: 'מחיקת חיית המחמד נכשלה' },
    onMutate: async () => {
      if (!customerId || !petId) return;
      await queryClient.cancelQueries({ queryKey: petsListKey });
      await queryClient.cancelQueries({ queryKey: petQueryKey });
      await queryClient.cancelQueries({ queryKey: customerQueryKey });
      await queryClient.cancelQueries({ queryKey: customersListKey });
      const previousPet = queryClient.getQueryData(petQueryKey);
      const previousPets = queryClient.getQueryData<Pet[]>(petsListKey) ?? [];
      const previousCustomer = queryClient.getQueryData<Customer | undefined>(customerQueryKey);
      const previousCustomersList = queryClient.getQueryData<Customer[]>(customersListKey) ?? [];
      queryClient.setQueryData(petQueryKey, undefined);
      queryClient.setQueryData<Pet[]>(petsListKey, (old = []) =>
        old.filter((pet) => pet.id !== petId)
      );
      if (previousCustomer) {
        queryClient.setQueryData<Customer>(customerQueryKey, {
          ...previousCustomer,
          petsCount: Math.max(previousCustomer.petsCount - 1, 0),
        });
      }
      if (previousCustomersList.length > 0) {
        queryClient.setQueryData<Customer[]>(customersListKey, (old = []) =>
          old.map((customer) =>
            customer.id === customerId
              ? { ...customer, petsCount: Math.max(customer.petsCount - 1, 0) }
              : customer
          )
        );
      }
      return { previousPet, previousPets, previousCustomer, previousCustomersList };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousPet !== undefined) {
        queryClient.setQueryData(petQueryKey, context.previousPet);
      }
      queryClient.setQueryData(petsListKey, context?.previousPets ?? []);
      if (context?.previousCustomer) {
        queryClient.setQueryData(customerQueryKey, context.previousCustomer);
      }
      if (context?.previousCustomersList) {
        queryClient.setQueryData(customersListKey, context.previousCustomersList);
      }
    },
    onSuccess: () => {
      closeDeleteModal();
      navigate(`/customers/${customerId}`);
    },
    onSettled: () => {
      if (!customerId || !petId) return;
      void queryClient.invalidateQueries({ queryKey: petsListKey });
      void queryClient.invalidateQueries({ queryKey: petQueryKey });
      void queryClient.invalidateQueries({ queryKey: customerQueryKey });
      void queryClient.invalidateQueries({ queryKey: customersListKey });
    },
  });

  const updatePetMutation = usePetUpdateMutation({
    customerId,
    petDetailQueryKey: petQueryKey,
    onSuccess: () => {
      resetAndClosePetForm();
    },
  });

  const petMutationInFlight = updatePetMutation.isPending;

  const uploadPetImageMutation = useApiMutation<Pet, unknown, File>({
    mutationFn: async (file) => {
      if (!customerId || !petId) {
        throw new Error('Missing pet identifiers');
      }
      if (!allowedImageMimeTypes.has(file.type)) {
        throw new Error('סוג הקובץ אינו נתמך');
      }
      if (file.size > MAX_IMAGE_BYTES) {
        throw new Error('קובץ התמונה גדול מדי');
      }
      const dataUrl = await readFileAsDataUrl(file);
      return updatePetImage(customerId, petId, { dataUrl });
    },
    successToast: { message: 'תמונת חיית המחמד עודכנה' },
    errorToast: { fallbackMessage: 'עדכון תמונת חיית המחמד נכשל' },
    onSuccess: (updatedPet) => {
      applyPetImageUpdate(updatedPet);
    },
    onSettled: () => {
      if (!customerId || !petId) return;
      void queryClient.invalidateQueries({ queryKey: petsListKey });
      void queryClient.invalidateQueries({ queryKey: petQueryKey });
    },
  });

  const removePetImageMutation = useApiMutation<Pet, unknown, void>({
    mutationFn: async () => {
      if (!customerId || !petId) {
        throw new Error('Missing pet identifiers');
      }
      return deletePetImage(customerId, petId);
    },
    successToast: { message: 'תמונת חיית המחמד הוסרה' },
    errorToast: { fallbackMessage: 'הסרת תמונת חיית המחמד נכשלה' },
    onSuccess: (updatedPet) => {
      applyPetImageUpdate(updatedPet);
    },
    onSettled: () => {
      if (!customerId || !petId) return;
      void queryClient.invalidateQueries({ queryKey: petsListKey });
      void queryClient.invalidateQueries({ queryKey: petQueryKey });
    },
  });

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';
    if (!file) return;

    if (!allowedImageMimeTypes.has(file.type)) {
      showErrorNotification('ניתן להעלות רק תמונות PNG, JPEG או WEBP');
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      showErrorNotification('ניתן להעלות תמונות עד גודל של 2MB');
      return;
    }

    uploadPetImageMutation.mutate(file);
  };

  async function onSubmitPet(values: PetFormSubmitValues) {
    if (!petId) return;
    const payload: UpdatePetBody = {
      name: values.name,
      type: values.type,
      gender: values.gender,
      breed: values.breed,
    };
    await updatePetMutation.mutateAsync({ petId, payload });
  }

  const loading = petQuery.isPending || customerQuery.isPending;
  const petError = petQuery.error;
  const isPetNotFound = petError instanceof HttpError && petError.status === 404;

  const pet = petQuery.data;
  const customer = customerQuery.data;

  const breadcrumbItems = useMemo(() => {
    const items = [{ title: 'לקוחות', href: '/customers' }];

    if (customer) {
      items.push({ title: customer.name, href: `/customers/${customer.id}` });
    }

    if (pet) {
      items.push({ title: pet.name, href: '#' });
    }

    return items.map((item, index) => {
      const isActive = item.href === '#';
      return (
        <Anchor
          key={index}
          onClick={(e) => {
            e.preventDefault();
            if (!isActive) navigate(item.href);
          }}
          style={{ cursor: isActive ? 'default' : 'pointer' }}
          {...(isActive ? { c: 'dimmed' } : {})}
        >
          {item.title}
        </Anchor>
      );
    });
  }, [customer, pet, navigate]);

  if (!customerId || !petId || isPetNotFound) {
    return (
      <Container size="lg" pt={{ base: 'xl', sm: 'xl' }} pb="xl">
        <StatusCard
          status="notFound"
          title="חיית המחמד לא נמצאה"
          description="ייתכן שהחיה נמחקה או שאינך מורשה לצפות בה."
          primaryAction={{
            label: 'חזרה ללקוח',
            onClick: () => navigate(customerId ? `/customers/${customerId}` : '/customers'),
          }}
        />
      </Container>
    );
  }

  if (loading) {
    return (
      <Container size="lg" pt={{ base: 'xl', sm: 'xl' }} pb="xl">
        <StatusCard status="loading" title="טוען פרטי חיית מחמד..." />
      </Container>
    );
  }

  if (petQuery.error) {
    const message = extractErrorMessage(petQuery.error, 'אירעה שגיאה בטעינת חיית המחמד');
    return (
      <Container size="lg" pt={{ base: 'xl', sm: 'xl' }} pb="xl">
        <StatusCard
          status="error"
          title="לא ניתן להציג את חיית המחמד כעת"
          description={message}
          primaryAction={{ label: 'נסה שוב', onClick: () => void petQuery.refetch() }}
          secondaryAction={
            <Button
              variant="subtle"
              onClick={() => navigate(customerId ? `/customers/${customerId}` : '/customers')}
            >
              חזרה ללקוח
            </Button>
          }
        />
      </Container>
    );
  }

  if (!pet) {
    return null;
  }

  const ensuredPet = pet;

  const currentImage = ensuredPet.imageUrl ?? defaultPetImage;
  const hasCustomImage = Boolean(ensuredPet.imageUrl);

  function openPetEditModal() {
    setPetFormInitialValues({
      name: ensuredPet.name,
      type: ensuredPet.type,
      gender: ensuredPet.gender,
      breed: ensuredPet.breed ?? '',
    });
    openPetForm();
  }

  const typeLabel = ensuredPet.type === 'dog' ? 'כלב' : 'חתול';
  const genderLabel = ensuredPet.gender === 'male' ? 'זכר' : 'נקבה';

  return (
    <Container size="lg" pt={{ base: 'xl', sm: 'xl' }} pb="xl">
      <Breadcrumbs mb="md">{breadcrumbItems}</Breadcrumbs>

      <Group
        mb="xl"
        align="center"
        gap="md"
        className="pet-title-group"
        style={{ position: 'relative' }}
      >
        <Menu shadow="md" width={150} position="bottom-start">
          <Menu.Target>
            <Button
              variant="subtle"
              size="xs"
              aria-label="פתח תפריט פעולות"
              data-testid="pet-actions-trigger"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                padding: '4px',
                width: '24px',
                height: '24px',
              }}
            >
              <IconDots size={14} />
            </Button>
          </Menu.Target>
          <Menu.Dropdown data-testid="pet-actions-dropdown">
            <Menu.Item
              leftSection={<IconPencil size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                openPetEditModal();
              }}
            >
              ערוך חיית מחמד
            </Menu.Item>
            <Menu.Item
              color="red"
              leftSection={<IconX size={16} />}
              onClick={(e) => {
                e.stopPropagation();
                openDeleteModal();
              }}
            >
              מחק חיית מחמד
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>

        <PageTitle order={2}>{ensuredPet.name}</PageTitle>
        <Badge variant="light" size="lg" color={ensuredPet.type === 'dog' ? 'teal' : 'grape'}>
          {typeLabel}
        </Badge>
      </Group>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Card withBorder shadow="sm" radius="md" padding="lg" mb="xl">
        <Stack gap="md">
          <Text size="lg" fw={600}>
            תמונת חיית מחמד
          </Text>
          <Image
            src={currentImage}
            alt={`תמונה של ${ensuredPet.name}`}
            radius="md"
            h={240}
            fit="cover"
          />
          <Group gap="sm">
            <Button
              onClick={handleUploadClick}
              loading={uploadPetImageMutation.isPending}
              disabled={removePetImageMutation.isPending}
            >
              העלה תמונה
            </Button>
            {hasCustomImage && (
              <Button
                variant="default"
                onClick={() => removePetImageMutation.mutate()}
                loading={removePetImageMutation.isPending}
                disabled={uploadPetImageMutation.isPending}
              >
                הסר תמונה
              </Button>
            )}
          </Group>
          {!hasCustomImage && (
            <Text size="sm" c="dimmed">
              מוצגת תמונת ברירת מחדל עד שתעלה תמונה מותאמת אישית.
            </Text>
          )}
          <Text size="xs" c="dimmed">
            ניתן להעלות קבצי PNG, JPEG או WEBP עד לגודל של 2MB.
          </Text>
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md" padding="lg" mb="xl">
        <Stack gap="md">
          <Text size="lg" fw={600}>
            פרטי חיית מחמד
          </Text>
          <Group>
            <Badge variant="light" color="blue">
              {genderLabel}
            </Badge>
            {ensuredPet.breed && <Badge variant="outline">{ensuredPet.breed}</Badge>}
          </Group>
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              מזהה חיה: {ensuredPet.id}
            </Text>
            <Text size="sm" c="dimmed">
              מזהה לקוח: {ensuredPet.customerId}
            </Text>
          </Stack>
        </Stack>
      </Card>

      <PetFormModal
        opened={petFormOpen}
        onClose={resetAndClosePetForm}
        mode="edit"
        submitLoading={petMutationInFlight}
        initialValues={petFormInitialValues}
        onSubmit={onSubmitPet}
      />

      <Modal opened={deleteModalOpen} onClose={closeDeleteModal} title="מחיקת חיית מחמד">
        <Stack>
          <Text>
            האם אתה בטוח שברצונך למחוק את חיית המחמד "{ensuredPet.name}"? פעולה זו אינה ניתנת
            לביטול.
          </Text>
          <Group justify="right" mt="sm">
            <Button variant="default" onClick={closeDeleteModal}>
              ביטול
            </Button>
            <Button
              color="red"
              onClick={() => customerId && petId && deletePetMutation.mutate()}
              loading={deletePetMutation.isPending}
            >
              מחק
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
