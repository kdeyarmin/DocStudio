import { logger } from './logger';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

interface ReadStorageJsonOptions<T> {
  fallback: T;
  storageName?: string;
  clearInvalid?: boolean;
  validate?: (value: unknown) => value is T;
  validator?: (value: unknown) => value is T;
}

export function readStorageJson<T>(
  storage: StorageLike,
  key: string,
  { fallback, storageName = 'storage', clearInvalid = false, validate, validator }: ReadStorageJsonOptions<T>
): T {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;

    const parsed: unknown = JSON.parse(raw);
    const validateFn = validator ?? validate;
    if (validateFn && !validateFn(parsed)) {
      throw new Error(`Invalid ${storageName} schema for key ${key}`);
    }
    return parsed as T;
  } catch (error) {
    logger.warn(`Failed to parse or validate ${storageName} value for ${key}`, {
      error: error instanceof Error ? error.message : String(error),
    });

    if (clearInvalid) {
      try {
        storage.removeItem(key);
      } catch {
        // Ignore storage cleanup failures.
      }
    }

    return fallback;
  }
}

export function writeStorageJson(storage: StorageLike, key: string, value: unknown): boolean {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
