import { useEffect, useMemo, useState } from 'react';
import { TextInput, Textarea } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { EntityFormModal } from './EntityFormModal';
import { parseDateValue } from '../lib/date';

export type VisitFormValues = {
  title: string;
  description: string;
  scheduledStartAt: Date | null;
};

export type VisitFormSubmitValues = {
  scheduledStartAt: string;
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
};

function toSubmitPayload(values: VisitFormValues): VisitFormSubmitValues | null {
  if (!values.scheduledStartAt) return null;

  const title = values.title.trim();
  const description = values.description.trim();

  return {
    scheduledStartAt: values.scheduledStartAt.toISOString(),
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
    });
  }, [opened, initialValues?.title, initialValues?.description, initialValues?.scheduledStartAt]);

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
      size="lg"
    >
      <DateTimePicker
        label="מועד הביקור"
        value={values.scheduledStartAt}
        onChange={(value) =>
          setValues((prev) => ({ ...prev, scheduledStartAt: parseDateValue(value) }))
        }
        required
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
