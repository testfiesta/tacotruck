import type { ConfigType } from '../config-schema'
import { describe, expect, it } from 'vitest'
import { buildUrls } from '../url-builder'

describe('url-builder', () => {
  describe('buildUrls', () => {
    it('should build basic URLs without placeholders', () => {
      const config: ConfigType = {
        name: 'test-api',
        type: 'api',
        base_path: '/api',
      }

      const rawPath = '/users'
      const data = {}

      const result = buildUrls(config, rawPath, data, 'users', 'index')

      expect(result).toEqual(['/api/users'])
    })

    it('should build index URLs with placeholders', () => {
      const config: ConfigType = {
        name: 'test-api',
        type: 'api',
        base_path: '/api',
      }

      const rawPath = '/projects/{projects.id}/tasks'
      const data = {
        projects: [
          { source_id: '123' },
          { source_id: '456' },
        ],
      }

      const result = buildUrls(config, rawPath, data, 'tasks', 'index')

      expect(result).toContain('/api/projects/123/tasks')
      expect(result).toContain('/api/projects/456/tasks')
      expect(result.length).toBe(2)
    })

    it('should build index URLs with custom reference location', () => {
      const config: ConfigType = {
        name: 'test-api',
        type: 'api',
        base_path: '/api',
      }

      const rawPath = '/projects/{projects.custom_id}/tasks'
      const data = {
        projects: [
          { custom_id: 'abc' },
          { custom_id: 'def' },
        ],
      }

      const result = buildUrls(config, rawPath, data, 'tasks', 'index')

      expect(result).toContain('/api/projects/abc/tasks')
      expect(result).toContain('/api/projects/def/tasks')
      expect(result.length).toBe(2)
    })

    it('should build index URLs with denormalized keys', () => {
      const config: ConfigType = {
        name: 'test-api',
        type: 'api',
        base_path: '/api',
        typeConfig: {
          denormalized_keys: {
            tasks: {
              'projects.id': 'project_id',
            },
          },
        },
      }

      const rawPath = '/projects/{projects.id}/tasks'
      const data = {
        projects: [
          { project_id: '123' },
          { project_id: '456' },
        ],
      }

      const result = buildUrls(config, rawPath, data, 'tasks', 'index')

      expect(result).toContain('/api/projects/123/tasks')
      expect(result).toContain('/api/projects/456/tasks')
      expect(result.length).toBe(2)
    })

    it('should build get URLs with IDs', () => {
      const config: ConfigType = {
        name: 'test-api',
        type: 'api',
        base_path: '/api',
      }

      const rawPath = '/tasks/{tasks.id}'
      const data = {}
      const ids = {
        tasks: [
          { id: '123' },
          { id: '456' },
        ],
      }

      const result = buildUrls(config, rawPath, data, 'tasks', 'get', ids)

      expect(result).toContain('/api/tasks/123')
      expect(result).toContain('/api/tasks/456')
      expect(result.length).toBe(2)
    })

    it('should build get URLs with custom reference location', () => {
      const config: ConfigType = {
        name: 'test-api',
        type: 'api',
        base_path: '/api',
      }

      const rawPath = '/tasks/{tasks.custom_id}'
      const data = {}
      const ids = {
        tasks: [
          { custom_id: 'abc' },
          { custom_id: 'def' },
        ],
      }

      const result = buildUrls(config, rawPath, data, 'tasks', 'get', ids)

      expect(result).toContain('/api/tasks/abc')
      expect(result).toContain('/api/tasks/def')
      expect(result.length).toBe(2)
    })

    it('should handle multiple placeholders in the URL', () => {
      const config: ConfigType = {
        name: 'test-api',
        type: 'api',
        base_path: '/api',
      }

      const rawPath = '/projects/{projects.id}/users/{users.id}'
      const data = {
        projects: [{ source_id: 'p1' }],
        users: [{ source_id: 'u1' }, { source_id: 'u2' }],
      }

      const result = buildUrls(config, rawPath, data, 'tasks', 'index')

      expect(result).toContain('/api/projects/p1/users/u1')
      expect(result).toContain('/api/projects/p1/users/u2')
      expect(result.length).toBe(2)
    })

    it('should return original URL when no IDs are provided for get request', () => {
      const config: ConfigType = {
        name: 'test-api',
        type: 'api',
        base_path: '/api',
      }

      const rawPath = '/tasks/{tasks.id}'
      const data = {}

      const result = buildUrls(config, rawPath, data, 'tasks', 'get')

      expect(result).toEqual(['/api/tasks/{tasks.id}'])
    })
  })
})
