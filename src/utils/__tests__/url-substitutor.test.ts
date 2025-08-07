import { describe, expect, it } from 'vitest'
import { substituteUrl, substituteUrlStrict } from '../url-substitutor'

describe('uRL Substitutor', () => {
  describe('substituteUrl', () => {
    it('should substitute values from object into URL template', () => {
      const template = 'api/v2/get_project/{project_id}'
      const values = {
        project_id: 1,
        name: 'sky',
      }

      const result = substituteUrl(template, values)
      expect(result).toBe('api/v2/get_project/1')
    })

    it('should handle multiple placeholders', () => {
      const template = 'api/v2/get_project/{project_id}/user/{name}'
      const values = {
        project_id: 1,
        name: 'sky',
      }

      const result = substituteUrl(template, values)
      expect(result).toBe('api/v2/get_project/1/user/sky')
    })

    it('should keep unmatched placeholders as-is', () => {
      const template = 'api/v2/get_project/{project_id}/user/{missing_key}'
      const values = {
        project_id: 1,
        name: 'sky',
      }

      const result = substituteUrl(template, values)
      expect(result).toBe('api/v2/get_project/1/user/{missing_key}')
    })

    it('should convert values to strings', () => {
      const template = 'api/v2/get_project/{project_id}'
      const values = {
        project_id: 123,
        name: 'sky',
      }

      const result = substituteUrl(template, values)
      expect(result).toBe('api/v2/get_project/123')
    })
  })

  describe('substituteUrlStrict', () => {
    it('should substitute values and not throw when all placeholders have values', () => {
      const template = 'api/v2/get_project/{project_id}'
      const values = {
        project_id: 1,
        name: 'sky',
      }

      const result = substituteUrlStrict(template, values)
      expect(result).toBe('api/v2/get_project/1')
    })

    it('should throw error when missing required values', () => {
      const template = 'api/v2/get_project/{project_id}/user/{missing_key}'
      const values = {
        project_id: 1,
        name: 'sky',
      }

      expect(() => substituteUrlStrict(template, values)).toThrow(
        'Missing required values for keys: missing_key',
      )
    })

    it('should handle multiple missing keys in error message', () => {
      const template = 'api/v2/get_project/{project_id}/user/{missing_key1}/test/{missing_key2}'
      const values = {
        project_id: 1,
        name: 'sky',
      }

      expect(() => substituteUrlStrict(template, values)).toThrow(
        'Missing required values for keys: missing_key1, missing_key2',
      )
    })
  })
})
