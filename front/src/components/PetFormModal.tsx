import { useEffect, useMemo, useState } from 'react';
import { Select, TextInput } from '@mantine/core';
import { EntityFormModal } from './EntityFormModal';

import { ImageUpload } from './ImageUpload';

export type PetFormValues = {
  name: string;
  type: '' | 'dog' | 'cat';
  gender: '' | 'male' | 'female';
  breed: string;
  imageUrl: string | null;
};

export type PetFormSubmitValues = {
  name: string;
  type: 'dog' | 'cat';
  gender: 'male' | 'female';
  breed: string | null;
  imageUrl?: string | null;
};

export type PetFormModalInitialValues = Partial<Omit<PetFormValues, 'type' | 'gender'>> & {
  type?: 'dog' | 'cat';
  gender?: 'male' | 'female';
};

const initialFormValues: PetFormValues = {
  name: '',
  type: '',
  gender: '',
  breed: '',
  imageUrl: null,
};

const petTypeOptions = [
  { value: 'dog', label: 'כלב' },
  { value: 'cat', label: 'חתול' },
] as const;

const petGenderOptions = [
  { value: 'male', label: 'זכר' },
  { value: 'female', label: 'נקבה' },
] as const;

export type PetFormModalProps = {
  opened: boolean;
  mode: 'create' | 'edit';
  onClose: () => void;
  submitLoading?: boolean;
  initialValues?: PetFormModalInitialValues | null;
  onSubmit: (values: PetFormSubmitValues) => void | Promise<unknown>;
  onUploadUrlRequest?: (file: File) => Promise<{ url: string; key: string }>;
  onUploadComplete?: (key: string, file: File) => Promise<void>;
  onRemoveImage?: () => Promise<void>;
};

export function PetFormModal({
  opened,
  mode,
  onClose,
  submitLoading,
  initialValues,
  onSubmit,
  onUploadUrlRequest,
  onUploadComplete,
  onRemoveImage,
}: PetFormModalProps) {
  const [values, setValues] = useState<PetFormValues>(initialFormValues);
  const [imageUpdateValue, setImageUpdateValue] = useState<string | null | undefined>(undefined);
  const [imageOperationLoading, setImageOperationLoading] = useState(false);

  useEffect(() => {
    if (!opened) {
      setValues(initialFormValues);
      setImageUpdateValue(undefined);
      setImageOperationLoading(false);
      return;
    }

    setValues({
      name: initialValues?.name ?? '',
      type: initialValues?.type ?? '',
      gender: initialValues?.gender ?? '',
      breed: initialValues?.breed ?? '',
      imageUrl: initialValues?.imageUrl ?? null,
    });
    setImageUpdateValue(undefined);
    setImageOperationLoading(false);
  }, [
    opened,
    initialValues?.name,
    initialValues?.type,
    initialValues?.gender,
    initialValues?.breed,
    initialValues?.imageUrl,
  ]);

  const submitDisabled = useMemo(() => {
    return values.name.trim() === '' || values.type === '' || values.gender === '';
  }, [values.gender, values.name, values.type]);

  const handleSubmit = () => {
    const trimmedName = values.name.trim();
    const trimmedBreed = values.breed.trim();
    if (!trimmedName || values.type === '' || values.gender === '') {
      return;
    }

    const payload: PetFormSubmitValues = {
      name: trimmedName,
      type: values.type,
      gender: values.gender,
      breed: trimmedBreed === '' ? null : trimmedBreed,
    };

    if (imageUpdateValue !== undefined) {
      payload.imageUrl = imageUpdateValue;
    }

    onSubmit(payload);
  };

  return (
    <EntityFormModal
      opened={opened}
      onClose={onClose}
      title={mode === 'edit' ? 'עריכת חיית מחמד' : 'הוסף חיה חדשה'}
      mode={mode}
      onSubmit={handleSubmit}
      submitDisabled={submitDisabled}
      submitLoading={submitLoading || imageOperationLoading}
    >
      {mode === 'edit' && onUploadUrlRequest && onUploadComplete && (
        <ImageUpload
          onUploadUrlRequest={onUploadUrlRequest}
          onUploadComplete={async (key, file) => {
            await onUploadComplete(key, file);
            setImageUpdateValue(key);
          }}
          onPreviewChange={(previewUrl) => setValues((prev) => ({ ...prev, imageUrl: previewUrl }))}
          onLoadingChange={setImageOperationLoading}
          initialImage={values.imageUrl}
          className="mb-4"
          disabled={Boolean(submitLoading || imageOperationLoading)}
          hideUploadWhenHasValue={true}
          {...(onRemoveImage
            ? {
              onRemoveImage: async () => {
                await onRemoveImage();
                setImageUpdateValue(null);
                setValues((prev) => ({ ...prev, imageUrl: null }));
              },
            }
            : {})}
        />
      )}
      <TextInput
        label="שם"
        value={values.name}
        onChange={({ currentTarget }) =>
          setValues((prev) => ({ ...prev, name: currentTarget.value }))
        }
        required
      />
      <Select
        label="סוג"
        placeholder="בחר סוג"
        data={petTypeOptions}
        value={values.type}
        onChange={(val) =>
          setValues((prev) => ({ ...prev, type: (val as PetFormValues['type']) ?? '' }))
        }
        required
      />
      <Select
        label="מין"
        placeholder="בחר מין"
        data={petGenderOptions}
        value={values.gender}
        onChange={(val) =>
          setValues((prev) => ({ ...prev, gender: (val as PetFormValues['gender']) ?? '' }))
        }
        required
      />
      <TextInput
        label="גזע"
        value={values.breed}
        onChange={({ currentTarget }) =>
          setValues((prev) => ({ ...prev, breed: currentTarget.value }))
        }
      />
    </EntityFormModal>
  );
}
