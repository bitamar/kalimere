import type { DateValue } from '@mantine/dates';

/**
 * Mantine date inputs may emit a Date, a string, or an array (range pickers),
 * so we normalize the value before storing it in state.
 */
export function parseDateValue(
  value: DateValue | (DateValue | undefined)[] | null | undefined
): Date | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const [first] = value;
    if (!first) return null;
    return first instanceof Date ? first : new Date(first);
  }
  return value instanceof Date ? value : new Date(value);
}

/**
 * Formats a date using the local timezone without converting it to UTC,
 * ensuring day/month values remain stable for persisted visit data.
 */
export function formatDateAsLocalISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
