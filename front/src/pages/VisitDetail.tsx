import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Container,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  Image,
  SimpleGrid,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusCard } from '../components/StatusCard';
import { PageTitle } from '../components/PageTitle';
import { ImageUpload } from '../components/ImageUpload';
import { queryKeys } from '../lib/queryKeys';
import { extractErrorMessage } from '../lib/notifications';
import { HttpError } from '../lib/http';
import { useApiMutation } from '../lib/useApiMutation';
import {
  getVisit,
  updateVisit,
  getVisitImageUploadUrl,
  addVisitImage,
  type VisitWithDetails,
  type UpdateVisitBody,
} from '../api/visits';
import { getCustomer, getPet } from '../api/customers';
import type { Customer, Pet } from '../api/customers';
import { listTreatments } from '../api/treatments';
import type { Treatment } from '../api/treatments';
import { formatDateAsLocalISO, parseDateValue } from '../lib/date';

const visitStatusLabels: Record<VisitWithDetails['status'], string> = {
  scheduled: 'מתוכנן',
  completed: 'הושלם',
  cancelled: 'בוטל',
};

const visitStatusColors: Record<VisitWithDetails['status'], string> = {
  scheduled: 'blue',
  completed: 'teal',
  cancelled: 'gray',
};

function formatDateTime(value: string | null) {
  if (!value) return 'לא צוין';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('he-IL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatDate(value: string | null) {
  if (!value) return 'לא צוין';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('he-IL');
}

function formatCurrency(cents: number | null) {
  if (cents === null || cents === undefined) return 'לא צוין';
  return `₪${(cents / 100).toFixed(2)}`;
}

function getVisitTitle(visit: VisitWithDetails) {
  if (visit.title) return visit.title;
  const date = new Date(visit.scheduledStartAt);
  if (!Number.isNaN(date.getTime())) {
    return `ביקור ${date.toLocaleDateString('he-IL')}`;
  }
  return 'ביקור';
}

export function VisitDetail() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const visitQueryKey = useMemo(
    () => (visitId ? queryKeys.visit(visitId) : (['visit'] as const)),
    [visitId]
  );

  const visitQuery = useQuery({
    queryKey: visitQueryKey,
    queryFn: ({ signal }: { signal: AbortSignal }) => getVisit(visitId!, { signal }),
    enabled: Boolean(visitId),
  });

  const visitData = visitQuery.data;
  const resolvedCustomerId = visitData?.customerId ?? null;
  const resolvedPetId = visitData?.petId ?? null;

  const customerQueryKey = useMemo(
    () =>
      resolvedCustomerId
        ? queryKeys.customer(resolvedCustomerId)
        : queryKeys.customer('placeholder'),
    [resolvedCustomerId]
  );

  const petQueryKey = useMemo(
    () =>
      resolvedCustomerId && resolvedPetId
        ? ([...queryKeys.pets(resolvedCustomerId), resolvedPetId] as const)
        : ([...queryKeys.pets('placeholder'), 'placeholder'] as const),
    [resolvedCustomerId, resolvedPetId]
  );

  const customerQuery = useQuery({
    queryKey: customerQueryKey,
    queryFn: ({ signal }: { signal: AbortSignal }) => getCustomer(resolvedCustomerId!, { signal }),
    enabled: Boolean(resolvedCustomerId),
  });

  const petQuery = useQuery({
    queryKey: petQueryKey,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      getPet(resolvedCustomerId!, resolvedPetId!, { signal }),
    enabled: Boolean(resolvedCustomerId && resolvedPetId),
  });

  const treatmentsQuery = useQuery({
    queryKey: queryKeys.treatments(),
    queryFn: ({ signal }: { signal: AbortSignal }) => listTreatments({ signal }),
  });

  const visitError = visitQuery.error;
  const isVisitNotFound = visitError instanceof HttpError && visitError.status === 404;

  const visit = visitData ?? null;
  const customer = customerQuery.data as Customer | undefined;
  const pet = petQuery.data as Pet | undefined;
  const treatments = (treatmentsQuery.data as Treatment[] | undefined) ?? [];

  const [noteText, setNoteText] = useState('');
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string | null>(null);
  const [treatmentPrice, setTreatmentPrice] = useState<number | ''>('');
  const [treatmentNextDueDate, setTreatmentNextDueDate] = useState<Date | null>(null);

  const treatmentOptions = useMemo(
    () => treatments.map((treatment) => ({ value: treatment.id, label: treatment.name })),
    [treatments]
  );

  const treatmentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const treatment of treatments) {
      map.set(treatment.id, treatment.name);
    }
    return map;
  }, [treatments]);

  const breadcrumbItems = useMemo(() => {
    const items = [{ title: 'לקוחות', href: '/customers' }];

    if (!visit) {
      items.push({ title: 'ביקור', href: '#' });
    } else {
      if (customer) {
        items.push({ title: customer.name, href: `/customers/${customer.id}` });
      }

      if (pet) {
        items.push({ title: pet.name, href: `/customers/${pet.customerId}/pets/${pet.id}` });
      } else {
        items.push({
          title: visit.petId,
          href: `/customers/${visit.customerId}/pets/${visit.petId}`,
        });
      }

      items.push({ title: getVisitTitle(visit), href: '#' });
    }

    return items.map((item, index) => {
      const isActive = item.href === '#';
      return (
        <Anchor
          key={index}
          onClick={(event) => {
            event.preventDefault();
            if (!isActive) navigate(item.href);
          }}
          style={{ cursor: isActive ? 'default' : 'pointer' }}
          {...(isActive ? { c: 'dimmed' } : {})}
        >
          {item.title}
        </Anchor>
      );
    });
  }, [customer, navigate, pet, visit]);

  const treatmentsErrorMessage = treatmentsQuery.error
    ? extractErrorMessage(treatmentsQuery.error, 'אירעה שגיאה בטעינת רשימת הטיפולים')
    : null;

  const updateVisitMutation = useApiMutation({
    mutationFn: ({ visitId: id, payload }: { visitId: string; payload: UpdateVisitBody }) =>
      updateVisit(id, payload),
    successToast: { message: 'הביקור עודכן בהצלחה' },
    errorToast: { fallbackMessage: 'עדכון הביקור נכשל' },
    onSuccess: (data) => {
      queryClient.setQueryData(visitQueryKey, data);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.petVisits(data.customerId, data.petId),
      });
    },
  });

  if (!visitId || isVisitNotFound) {
    return (
      <Container size="lg" pt={{ base: 'xl', sm: 'xl' }} pb="xl">
        <StatusCard
          status="notFound"
          title="הביקור לא נמצא"
          description="ייתכן שהביקור הוסר או שאינך מורשה לצפות בו."
          primaryAction={{ label: 'חזרה ללוח הבקרה', onClick: () => navigate('/') }}
        />
      </Container>
    );
  }

  if (visitQuery.isPending) {
    return (
      <Container size="lg" pt={{ base: 'xl', sm: 'xl' }} pb="xl">
        <StatusCard status="loading" title="טוען פרטי ביקור..." />
      </Container>
    );
  }

  if (visitError) {
    const message = extractErrorMessage(visitError, 'אירעה שגיאה בטעינת פרטי הביקור');
    return (
      <Container size="lg" pt={{ base: 'xl', sm: 'xl' }} pb="xl">
        <StatusCard
          status="error"
          title="לא ניתן להציג את פרטי הביקור"
          description={message}
          primaryAction={{ label: 'נסה שוב', onClick: () => void visitQuery.refetch() }}
          secondaryAction={
            <Button variant="subtle" onClick={() => navigate('/')}>
              חזרה ללוח הבקרה
            </Button>
          }
        />
      </Container>
    );
  }

  if (!visit) return null;

  const addNoteDisabled = noteText.trim().length === 0 || updateVisitMutation.isPending;
  const addTreatmentDisabled = !selectedTreatmentId || updateVisitMutation.isPending;

  async function handleAddNote() {
    const trimmed = noteText.trim();
    if (!visitId || trimmed.length === 0) return;
    await updateVisitMutation.mutateAsync({
      visitId,
      payload: { notes: [{ note: trimmed }] },
    });
    setNoteText('');
  }

  async function handleAddTreatment() {
    if (!visitId || !selectedTreatmentId) return;

    let priceCents: number | null = null;
    if (typeof treatmentPrice === 'number') {
      priceCents = Math.round(treatmentPrice * 100);
    }

    const nextDueDate = treatmentNextDueDate ? formatDateAsLocalISO(treatmentNextDueDate) : null;

    await updateVisitMutation.mutateAsync({
      visitId,
      payload: {
        treatments: [
          {
            treatmentId: selectedTreatmentId,
            priceCents,
            nextDueDate,
          },
        ],
      },
    });

    setSelectedTreatmentId(null);
    setTreatmentPrice('');
    setTreatmentNextDueDate(null);
  }

  return (
    <Container size="lg" pt={{ base: 'xl', sm: 'xl' }} pb="xl">
      <Breadcrumbs mb="md">{breadcrumbItems}</Breadcrumbs>

      <Card withBorder shadow="sm" radius="md" padding="lg" mb="xl">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <PageTitle order={2}>{getVisitTitle(visit)}</PageTitle>
              <Text size="sm" c="dimmed">
                מזהה ביקור: {visit.id}
              </Text>
            </Stack>
            <Badge variant="light" size="lg" color={visitStatusColors[visit.status]}>
              {visitStatusLabels[visit.status]}
            </Badge>
          </Group>

          <Stack gap="xs">
            <Text size="sm">
              לקוח:{' '}
              {customer ? (
                <Anchor
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(`/customers/${customer.id}`);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {customer.name}
                </Anchor>
              ) : (
                visit.customerId
              )}
            </Text>
            <Text size="sm">
              חיית מחמד:{' '}
              {pet ? (
                <Anchor
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(`/customers/${pet.customerId}/pets/${pet.id}`);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {pet.name}
                </Anchor>
              ) : (
                visit.petId
              )}
            </Text>
            <Text size="sm">מועד ביקור: {formatDateTime(visit.scheduledStartAt)}</Text>
            {visit.completedAt ? (
              <Text size="sm">הושלם: {formatDateTime(visit.completedAt)}</Text>
            ) : null}
          </Stack>

          {visit.description ? (
            <Card withBorder padding="md" radius="md" shadow="xs">
              <Text size="sm" c="dimmed">
                תיאור הביקור
              </Text>
              <Text mt="xs">{visit.description}</Text>
            </Card>
          ) : null}
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md" padding="lg" mb="xl">
        <Stack gap="md">
          <Text size="lg" fw={600}>
            תמונות
          </Text>

          {visit.images && visit.images.length > 0 ? (
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }}>
              {visit.images.map((img) => (
                <Image
                  key={img.id}
                  src={img.url}
                  radius="md"
                  h={120}
                  fit="cover"
                  alt={img.originalName || 'Visit image'}
                />
              ))}
            </SimpleGrid>
          ) : (
            <Text size="sm" c="dimmed">
              עדיין לא הועלו תמונות לביקור זה.
            </Text>
          )}

          <ImageUpload
            label="הוסף תמונה"
            onUploadUrlRequest={(file) => getVisitImageUploadUrl(visit.id, file.type, file.name)}
            onUploadComplete={async (key, file) => {
              await addVisitImage(visit.id, key, file.name, file.type);
              await queryClient.invalidateQueries({ queryKey: visitQueryKey });
            }}
          />
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md" padding="lg" mb="xl">
        <Stack gap="md">
          <Text size="lg" fw={600}>
            טיפולים בביקור
          </Text>

          {visit.treatments.length === 0 ? (
            <Text size="sm" c="dimmed">
              עדיין לא נוספו טיפולים לביקור זה.
            </Text>
          ) : (
            <Stack gap="sm">
              {visit.treatments.map((treatment) => (
                <Card key={treatment.id} withBorder padding="md" radius="md" shadow="xs">
                  <Stack gap={4}>
                    <Text fw={500}>
                      {treatmentNameMap.get(treatment.treatmentId) ?? treatment.treatmentId}
                    </Text>
                    <Text size="sm" c="dimmed">
                      מחיר: {formatCurrency(treatment.priceCents)}
                    </Text>
                    <Text size="sm" c="dimmed">
                      תאריך טיפול הבא: {formatDate(treatment.nextDueDate)}
                    </Text>
                    <Text size="xs" c="dimmed">
                      נוסף: {formatDateTime(treatment.createdAt)}
                    </Text>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}

          <Stack gap="xs">
            <Text size="sm" fw={500}>
              הוסף טיפול
            </Text>
            <Group gap="sm" align="flex-end" wrap="wrap">
              <Select
                label="טיפול"
                placeholder="בחר טיפול"
                data={treatmentOptions}
                value={selectedTreatmentId}
                onChange={(value) => setSelectedTreatmentId(value)}
                style={{ minWidth: '200px' }}
                searchable
              />
              <NumberInput
                label="מחיר (₪)"
                placeholder="לדוגמה 120"
                value={treatmentPrice}
                onChange={(value) => {
                  if (value === '' || value === null) {
                    setTreatmentPrice('');
                  } else if (typeof value === 'string') {
                    const parsed = Number(value);
                    setTreatmentPrice(Number.isNaN(parsed) ? '' : parsed);
                  } else {
                    setTreatmentPrice(value);
                  }
                }}
                min={0}
                decimalScale={2}
                style={{ minWidth: '140px' }}
              />
              <DatePickerInput
                label="תאריך טיפול הבא"
                value={treatmentNextDueDate}
                onChange={(value) => setTreatmentNextDueDate(parseDateValue(value))}
                placeholder="לא חובה"
                clearable
              />
              <Button
                onClick={handleAddTreatment}
                disabled={addTreatmentDisabled}
                loading={updateVisitMutation.isPending}
              >
                הוסף טיפול
              </Button>
            </Group>
            {treatmentsErrorMessage ? (
              <Text size="xs" c="red">
                {treatmentsErrorMessage}
              </Text>
            ) : null}
          </Stack>
        </Stack>
      </Card>

      <Card withBorder shadow="sm" radius="md" padding="lg">
        <Stack gap="md">
          <Text size="lg" fw={600}>
            הערות הביקור
          </Text>

          {visit.notes.length === 0 ? (
            <Text size="sm" c="dimmed">
              עדיין לא נוספו הערות לביקור זה.
            </Text>
          ) : (
            <Stack gap="sm">
              {visit.notes.map((note) => (
                <Card key={note.id} withBorder padding="md" radius="md" shadow="xs">
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">
                      {formatDateTime(note.createdAt)}
                    </Text>
                    <Text>{note.note}</Text>
                  </Stack>
                </Card>
              ))}
            </Stack>
          )}

          <Stack gap="xs">
            <Text size="sm" fw={500}>
              הוסף הערה
            </Text>
            <Textarea
              value={noteText}
              onChange={(event) => setNoteText(event.currentTarget.value)}
              minRows={3}
              autosize
              placeholder="תעד הערות או הוראות נוספות"
            />
            <Group justify="right">
              <Button
                onClick={handleAddNote}
                disabled={addNoteDisabled}
                loading={updateVisitMutation.isPending}
              >
                שמור הערה
              </Button>
            </Group>
          </Stack>
        </Stack>
      </Card>
    </Container>
  );
}
