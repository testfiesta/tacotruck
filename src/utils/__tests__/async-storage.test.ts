import { beforeEach, describe, expect, it } from 'vitest'
import asyncStorage from '../async-storage'

describe('asyncStorage', () => {
  beforeEach(() => {
    asyncStorage.clear()
  })

  it('should store and retrieve values', () => {
    asyncStorage.setItem('testKey', 'testValue')
    expect(asyncStorage.getItem('testKey')).toBe('testValue')
  })

  it('should return null for non-existent keys', () => {
    expect(asyncStorage.getItem('nonExistentKey')).toBeNull()
  })

  it('should remove items', () => {
    asyncStorage.setItem('testKey', 'testValue')
    asyncStorage.removeItem('testKey')
    expect(asyncStorage.getItem('testKey')).toBeNull()
  })

  it('should clear all items', () => {
    asyncStorage.setItem('key1', 'value1')
    asyncStorage.setItem('key2', 'value2')
    asyncStorage.clear()
    expect(asyncStorage.getItem('key1')).toBeNull()
    expect(asyncStorage.getItem('key2')).toBeNull()
  })

  it('should run callback with isolated storage context', () => {
    asyncStorage.setItem('outsideKey', 'outsideValue')

    asyncStorage.run(() => {
      expect(asyncStorage.getItem('outsideKey')).toBeNull()
      asyncStorage.setItem('insideKey', 'insideValue')
      expect(asyncStorage.getItem('insideKey')).toBe('insideValue')
    })

    expect(asyncStorage.getItem('insideKey')).toBeNull()
    expect(asyncStorage.getItem('outsideKey')).toBe('outsideValue')
  })

  it('should allow providing a custom store', () => {
    const customStore = new Map<string, any>()
    customStore.set('presetKey', 'presetValue')

    asyncStorage.run(() => {
      expect(asyncStorage.getItem('presetKey')).toBe('presetValue')
    }, customStore)
  })
})
