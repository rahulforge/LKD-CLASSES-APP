export function sanitizeText(input: string, maxLength = 200): string {
  return String(input ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeDigits(input: string, maxLength = 20): string {
  return String(input ?? "")
    .replace(/\D/g, "")
    .slice(0, maxLength);
}

export function sanitizeMultiline(input: string, maxLength = 1000): string {
  return String(input ?? "")
    .replace(/\r/g, "")
    .replace(/[^\S\n]+/g, " ")
    .trim()
    .slice(0, maxLength);
}
