import type { DateValue } from '@mantine/dates';

/**
 * Mantine date inputs may emit either a Date instance or a string depending on
 * the picker, so we normalize the value before storing it in state.
 */
export function parseDateValue(value: DateValue): Date | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const [first] = value;
    if (!first) return null;
    return first instanceof Date ? first : new Date(first);
  }
  return value instanceof Date ? value : new Date(value);
}
