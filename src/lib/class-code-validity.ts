export const DEFAULT_CLASS_CODE_VALIDITY_DAYS = 365;

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export function getValidityDaysFromDate(selectedDate?: string | null, today = new Date()) {
  if (!selectedDate) {
    return DEFAULT_CLASS_CODE_VALIDITY_DAYS;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(selectedDate);
  if (!match) {
    throw new Error("Enter a valid date for the validity period");
  }

  const selectedDay = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (new Date(selectedDay).toISOString().slice(0, 10) !== selectedDate) {
    throw new Error("Enter a valid date for the validity period");
  }

  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = (selectedDay - todayDay) / DAY_IN_MILLISECONDS;

  if (!Number.isInteger(days) || days <= 0) {
    throw new Error("Validity date must be later than today");
  }

  return days;
}

export function getDateForValidityDays(days: number, today = new Date()) {
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return new Date(todayDay + days * DAY_IN_MILLISECONDS).toISOString().slice(0, 10);
}
