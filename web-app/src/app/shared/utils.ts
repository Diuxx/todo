import { v4 as uuidv4 } from 'uuid';

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
