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

/**
 * Utility function to get the key associated with a specific value in a Map.
 * @param map The Map to search through.
 * @param value The value to find the corresponding key for.
 * @returns The key associated with the specified value, or undefined if not found.
 */
export function getKeyByValue<K, V>(map: Map<K, V>, value: V): K | undefined {
  for (const [key, val] of map.entries()) {
    if (val === value) {
      return key;
    }
  }

  return undefined;
}
