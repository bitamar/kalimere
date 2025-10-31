import { useEffect, useMemo, useState } from 'react';
import { TextInput, Textarea } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { EntityFormModal } from './EntityFormModal';

export type VisitFormValues = {
  title: string;
  description: string;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
};

export type VisitFormSubmitValues = {
  scheduledStartAt: string;
  scheduledEndAt: string | null;
  title: string | null;
  description: string | null;
};

export type VisitFormModalProps = {
  opened: boolean;
  onClose: () => void;
  onSubmit: (values: VisitFormSubmitValues) => void | Promise<unknown>;
  submitLoading?: boolean;
  initialValues?: Partial<VisitFormValues> | null;
};

const initialFormValues: VisitFormValues = {
  title: '',
  description: '',
  scheduledStartAt: null,
  scheduledEndAt: null,
};

function toSubmitPayload(values: VisitFormValues): VisitFormSubmitValues | null {
  if (!values.scheduledStartAt) return null;

  const title = values.title.trim();
  const description = values.description.trim();

  return {
    scheduledStartAt: values.scheduledStartAt.toISOString(),
    scheduledEndAt: values.scheduledEndAt ? values.scheduledEndAt.toISOString() : null,
    title: title.length > 0 ? title : null,
    description: description.length > 0 ? description : null,
  };
}

export function VisitFormModal({
  opened,
  onClose,
  onSubmit,
  submitLoading,
  initialValues,
}: VisitFormModalProps) {
  const [values, setValues] = useState<VisitFormValues>(initialFormValues);

  useEffect(() => {
    if (!opened) {
      setValues(initialFormValues);
      return;
    }

    setValues({
      title: initialValues?.title ?? '',
      description: initialValues?.description ?? '',
      scheduledStartAt: initialValues?.scheduledStartAt ?? null,
      scheduledEndAt: initialValues?.scheduledEndAt ?? null,
    });
  }, [
    opened,
    initialValues?.title,
    initialValues?.description,
    initialValues?.scheduledStartAt,
    initialValues?.scheduledEndAt,
  ]);

  const submitDisabled = useMemo(() => values.scheduledStartAt === null, [values.scheduledStartAt]);

  const handleSubmit = () => {
    const payload = toSubmitPayload(values);
    if (!payload) return;
    onSubmit(payload);
  };

  return (
    <EntityFormModal
      opened={opened}
      onClose={onClose}
      title="תזמון ביקור"
      mode="create"
      onSubmit={handleSubmit}
      submitDisabled={submitDisabled}
      submitLoading={submitLoading ?? false}
      submitLabel="תזמן"
      modalProps={{ size: 'lg' }}
    >
      <DateTimePicker
        label="תחילת הביקור"
        value={values.scheduledStartAt}
        onChange={(date) => setValues((prev) => ({ ...prev, scheduledStartAt: date }))}
        required
        valueFormat="DD/MM/YYYY HH:mm"
      />

      <DateTimePicker
        label="סיום מתוכנן"
        value={values.scheduledEndAt}
        onChange={(date) => setValues((prev) => ({ ...prev, scheduledEndAt: date }))}
        clearable
        valueFormat="DD/MM/YYYY HH:mm"
      />

      <TextInput
        label="כותרת"
        value={values.title}
        onChange={({ currentTarget }) =>
          setValues((prev) => ({ ...prev, title: currentTarget.value }))
        }
      />

      <Textarea
        label="תיאור"
        autosize
        minRows={3}
        value={values.description}
        onChange={({ currentTarget }) =>
          setValues((prev) => ({ ...prev, description: currentTarget.value }))
        }
      />
    </EntityFormModal>
  );
}
