import { AsyncLocalStorage } from 'node:async_hooks'
/**
 * AsyncStorage implementation for Node.js using AsyncLocalStorage
 * Used to store and retrieve values across the application
 */

class AsyncStorage {
  private static instance: AsyncStorage
  private asyncLocalStorage = new AsyncLocalStorage<Map<string, any>>()
  private defaultStorage: Map<string, any> = new Map()

  private constructor() {}

  public static getInstance(): AsyncStorage {
    if (!AsyncStorage.instance) {
      AsyncStorage.instance = new AsyncStorage()
    }
    return AsyncStorage.instance
  }

  /**
   * Store a value in the storage
   * @param key The key to store the value under
   * @param value The value to store
   */
  public setItem(key: string, value: any): void {
    const store = this.asyncLocalStorage.getStore() || this.defaultStorage
    store.set(key, value)
  }

  /**
   * Get a value from the storage
   * @param key The key to retrieve the value for
   * @returns The stored value or null if not found
   */
  public getItem(key: string): any {
    const store = this.asyncLocalStorage.getStore() || this.defaultStorage
    return store.has(key) ? store.get(key) : null
  }

  /**
   * Remove a value from the storage
   * @param key The key to remove
   */
  public removeItem(key: string): void {
    const store = this.asyncLocalStorage.getStore() || this.defaultStorage
    store.delete(key)
  }

  /**
   * Clear all values from the storage
   */
  public clear(): void {
    const store = this.asyncLocalStorage.getStore() || this.defaultStorage
    store.clear()
  }

  /**
   * Run a function with a storage context
   * @param callback Function to execute within the storage context
   * @param store Optional storage to use for this context
   * @returns The result of the callback function
   */
  public run<T>(callback: () => T, store?: Map<string, any>): T {
    return this.asyncLocalStorage.run(
      store || new Map<string, any>(),
      callback,
    )
  }
}

export default AsyncStorage.getInstance()
