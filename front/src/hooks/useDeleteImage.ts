import { useState } from 'react';
import { notifications } from '@mantine/notifications';

interface UseDeleteImageOptions<T> {
  onDelete: (id: T) => Promise<void>;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export function useDeleteImage<T = void>({
  onDelete,
  successMessage = 'התמונה הוסרה בהצלחה',
  errorMessage = 'מחיקת התמונה נכשלה',
  onSuccess,
  onError,
}: UseDeleteImageOptions<T>) {
  const [deletingId, setDeletingId] = useState<T | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (id: T) => {
    setDeletingId(id);
    setIsDeleting(true);
    try {
      await onDelete(id);
      notifications.show({
        title: 'הצלחה',
        message: successMessage,
        color: 'green',
      });
      onSuccess?.();
    } catch (error) {
      console.error('Delete image error:', error);
      notifications.show({
        title: 'שגיאה',
        message: errorMessage,
        color: 'red',
      });
      onError?.(error);
    } finally {
      setDeletingId(null);
      setIsDeleting(false);
    }
  };

  return { handleDelete, deletingId, isDeleting };
}
