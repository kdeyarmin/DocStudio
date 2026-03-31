export function normalizeUsPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11) return `+${digits}`;
  throw new Error("Invalid phone number format. Must be 10 or 11 digits.");
}
