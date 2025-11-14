import dayjs from 'dayjs';
import { describe, expect, it, vi } from 'vitest';

describe('configureDayjsLocale', () => {
  it('sets dayjs to use the Hebrew locale', async () => {
    vi.resetModules();
    dayjs.locale('en');

    await import('./dayjsLocale');

    expect(dayjs.locale()).toBe('he');
  });
});
