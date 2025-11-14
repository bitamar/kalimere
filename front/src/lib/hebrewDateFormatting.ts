const hebrewMonthFormatter = new Intl.DateTimeFormat('he', {
  month: 'long',
  year: 'numeric',
});

const hebrewWeekdayFormatter = new Intl.DateTimeFormat('he', {
  weekday: 'narrow',
});

export function formatHebrewMonthLabel(month: string) {
  return hebrewMonthFormatter.format(new Date(month));
}

export function formatHebrewWeekdayLabel(dateString: string) {
  return hebrewWeekdayFormatter.format(new Date(dateString));
}
