import { describe, expect, it } from 'vitest'
import { authSchemas } from '../auth'

describe('auth utils', () => {
  describe('authSchemas', () => {
    it('should define basic auth schema', () => {
      expect(authSchemas.basic).toBeDefined()
      expect(authSchemas.basic.inputs).toEqual(['base64Credentials'])
      expect(authSchemas.basic.location).toBe('header')
      expect(authSchemas.basic.key).toBe('Authorization')
      expect(authSchemas.basic.payload).toBe('Basic {base64Credentials}')
    })

    it('should define bearer auth schema', () => {
      expect(authSchemas.bearer).toBeDefined()
      expect(authSchemas.bearer.inputs).toEqual(['token'])
      expect(authSchemas.bearer.location).toBe('header')
      expect(authSchemas.bearer.key).toBe('Authorization')
      expect(authSchemas.bearer.payload).toBe('Bearer {token}')
    })
  })
})
