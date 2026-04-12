import { v4 as uuidv4 } from 'uuid';

/**
 * Returns the start of today with an optional offset in milliseconds.
 * @param offsetMs The offset in milliseconds to apply to the start of today.
 * @returns A Date object representing the start of today with the offset applied.
 */
export function startOfToday(offsetMs: number = 1): Date {
  const d = new Date();
  d.setHours(0, 0, 0, offsetMs);
  return d;
}

/**
 * Generates a UUID (Universally Unique Identifier) using the uuid library.
 * @returns A string representing a UUID.
 */
export function generateUUID(): string {
  return uuidv4();
}
