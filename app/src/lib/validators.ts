export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

export function normalizeEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase();
}

export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned[0] === '1');
}

export function isValidDateOfBirth(dob: string | null | undefined): boolean {
  if (!dob) return false;

  const trimmedDob = dob.trim();
  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmedDob);

  let date: Date;
  if (isoDateMatch) {
    const [, yearStr, monthStr, dayStr] = isoDateMatch;
    const year = Number.parseInt(yearStr, 10);
    const month = Number.parseInt(monthStr, 10);
    const day = Number.parseInt(dayStr, 10);

    date = new Date(year, month - 1, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return false;
    }
  } else {
    date = new Date(trimmedDob);
    if (Number.isNaN(date.getTime())) return false;
  }

  const now = new Date();
  if (date > now) return false;
  const maxAge = new Date();
  maxAge.setFullYear(maxAge.getFullYear() - 150);
  if (date < maxAge) return false;
  return true;
}

export function normalizePhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return phone;
}
