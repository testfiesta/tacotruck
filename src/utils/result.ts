export class Ok<T, E> {
  readonly value: T
  readonly isOk: boolean = true
  readonly isErr: boolean = false

  constructor(value: T) {
    this.value = value
  }

  /**
   * Unwrap the value or throw if it's an error
   */
  unwrap(): T {
    return this.value
  }

  /**
   * Map the success value to another value
   */
  map<U>(fn: (value: T) => U): Result<U, E> {
    return new Ok<U, E>(fn(this.value))
  }

  /**
   * Return the value or a default if it's an error
   */
  unwrapOr(_default: T): T {
    return this.value
  }

  /**
   * Execute a function if the result is Ok
   */
  match<U>(options: { ok: (value: T) => U, err: (error: E) => U }): U {
    return options.ok(this.value)
  }
}

/**
 * Error variant of Result
 */
export class Err<T, E> {
  readonly error: E
  readonly isOk: boolean = false
  readonly isErr: boolean = true

  constructor(error: E) {
    this.error = error
  }

  /**
   * Unwrap the value or throw if it's an error
   */
  unwrap(): T {
    throw this.error
  }

  /**
   * Map the success value to another value (no-op for Err)
   */
  map<U>(_fn: (value: T) => U): Result<U, E> {
    return new Err<U, E>(this.error)
  }

  /**
   * Return the value or a default if it's an error
   */
  unwrapOr(defaultValue: T): T {
    return defaultValue
  }

  /**
   * Execute a function if the result is Err
   */
  match<U>(options: { ok: (value: T) => U, err: (error: E) => U }): U {
    return options.err(this.error)
  }
}

/**
 * Result type - either Ok<T, E> or Err<T, E>
 */
export type Result<T, E> = Ok<T, E> | Err<T, E>

/**
 * Helper function to create an Ok result
 */
export function ok<T, E>(value: T): Result<T, E> {
  return new Ok<T, E>(value)
}

/**
 * Helper function to create an Err result
 */
export function err<T, E>(error: E): Result<T, E> {
  return new Err<T, E>(error)
}

/**
 * Try to execute a function and return a Result
 */
export function tryFn<T>(fn: () => T): Result<T, Error> {
  try {
    return ok(fn())
  }
  catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Try to execute an async function and return a Result
 */
export async function tryAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
  try {
    const value = await fn()
    return ok(value)
  }
  catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)))
  }
}
