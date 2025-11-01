import { describe, it, expect } from 'vitest';
import { formatDateAsLocalISO, parseDateValue } from '../../lib/date';

describe('date helpers', () => {
  describe('parseDateValue', () => {
    it('returns null when value is falsy', () => {
      expect(parseDateValue(null)).toBeNull();
      expect(parseDateValue(undefined)).toBeNull();
    });

    it('returns the same date instance when provided a Date', () => {
      const date = new Date(2024, 3, 10, 9, 30);
      expect(parseDateValue(date)).toBe(date);
    });

    it('converts ISO strings to Date objects', () => {
      const result = parseDateValue('2024-04-10T09:30:00.000Z');
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2024-04-10T09:30:00.000Z');
    });

    it('converts the first value of an array to a Date', () => {
      const first = new Date(2024, 5, 15, 14, 0);
      const result = parseDateValue([first, new Date()]);
      expect(result).toBe(first);
    });

    it('ignores missing array entries', () => {
      expect(parseDateValue([undefined, new Date()])).toBeNull();
    });
  });

  describe('formatDateAsLocalISO', () => {
    it('formats a date using local calendar parts without UTC conversion', () => {
      const date = new Date(2024, 6, 20, 12, 45, 30);
      expect(formatDateAsLocalISO(date)).toBe('2024-07-20');
    });
  });
});
