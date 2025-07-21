import { describe, expect, it } from 'vitest'
import { err, ok, tryAsync, tryFn } from '../result'

describe('result', () => {
  describe('ok', () => {
    it('should create an Ok result', () => {
      const result = ok<number, string>(42)
      expect(result.isOk).toBe(true)
      expect(result.isErr).toBe(false)
      expect(result.unwrap()).toBe(42)
    })

    it('should map Ok values', () => {
      const result = ok<number, string>(42)
      const mapped = result.map(x => x * 2)
      expect(mapped.isOk).toBe(true)
      expect(mapped.unwrap()).toBe(84)
    })

    it('should return value with unwrapOr', () => {
      const result = ok<number, string>(42)
      expect(result.unwrapOr(0)).toBe(42)
    })

    it('should match with ok handler', () => {
      const result = ok<number, string>(42)
      const value = result.match({
        ok: val => `Success: ${val}`,
        err: e => `Error: ${e}`,
      })
      expect(value).toBe('Success: 42')
    })
  })

  describe('err', () => {
    it('should create an Err result', () => {
      const result = err<number, string>('error')
      expect(result.isOk).toBe(false)
      expect(result.isErr).toBe(true)
      expect(() => result.unwrap()).toThrow('error')
    })

    it('should not map Err values', () => {
      const result = err<number, string>('error')
      const mapped = result.map(x => x * 2)
      expect(mapped.isErr).toBe(true)
      expect(() => mapped.unwrap()).toThrow('error')
    })

    it('should return default with unwrapOr', () => {
      const result = err<number, string>('error')
      expect(result.unwrapOr(0)).toBe(0)
    })

    it('should match with err handler', () => {
      const result = err<number, string>('error')
      const value = result.match({
        ok: val => `Success: ${val}`,
        err: e => `Error: ${e}`,
      })
      expect(value).toBe('Error: error')
    })
  })

  describe('tryFn', () => {
    it('should return Ok for successful function', () => {
      const result = tryFn(() => 42)
      expect(result.isOk).toBe(true)
      expect(result.unwrap()).toBe(42)
    })

    it('should return Err for throwing function', () => {
      const result = tryFn(() => {
        throw new Error('test error')
      })
      expect(result.isErr).toBe(true)
      expect(() => result.unwrap()).toThrow('test error')
    })
  })

  describe('tryAsync', () => {
    it('should return Ok for successful async function', async () => {
      const result = await tryAsync(async () => 42)
      expect(result.isOk).toBe(true)
      expect(result.unwrap()).toBe(42)
    })

    it('should return Err for throwing async function', async () => {
      const result = await tryAsync(async () => {
        throw new Error('test error')
      })
      expect(result.isErr).toBe(true)
      expect(() => result.unwrap()).toThrow('test error')
    })
  })
})
