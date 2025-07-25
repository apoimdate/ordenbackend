/**
 * Type guard functions for null checking and type narrowing
 */

/**
 * Checks if a value is defined (not null or undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Checks if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Checks if a value is a valid number (not NaN)
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Checks if a value is a non-empty array
 */
export function isNonEmptyArray<T>(value: T[] | null | undefined): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Asserts that a value is defined, throws if not
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value is null or undefined');
  }
}

/**
 * Returns the value if defined, otherwise returns the default value
 */
export function getValueOrDefault<T>(value: T | null | undefined, defaultValue: T): T {
  return isDefined(value) ? value : defaultValue;
}

/**
 * Filters out null and undefined values from an array
 */
export function filterDefined<T>(array: (T | null | undefined)[]): T[] {
  return array.filter(isDefined);
}

/**
 * Checks if a value is an object (not null, array, or primitive)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Type guard for checking if an object has a specific property
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K
): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

/**
 * Type guard for checking if an object has multiple properties
 */
export function hasProperties<K extends string>(
  obj: unknown,
  ...keys: K[]
): obj is Record<K, unknown> {
  return isObject(obj) && keys.every(key => key in obj);
}