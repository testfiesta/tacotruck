import { describe, expect, it } from 'vitest'
import { buildRequestData, mapData, mapDataWithIgnores } from '../data'

describe('data utils', () => {
  describe('mapData', () => {
    it('should map data according to the mapping', () => {
      const mapping = {
        oldKey1: 'newKey1',
        oldKey2: 'newKey2',
        sameKey: 'sameKey',
      }

      const data = {
        oldKey1: 'value1',
        oldKey2: 'value2',
        sameKey: 'value3',
        untouchedKey: 'value4',
      }

      const result = mapData(mapping, data)

      expect(result).toEqual({
        newKey1: 'value1',
        newKey2: 'value2',
        sameKey: 'value3',
        untouchedKey: 'value4',
      })
    })

    it('should handle empty mapping', () => {
      const mapping = {}
      const data = { key1: 'value1', key2: 'value2' }

      const result = mapData(mapping, data)

      expect(result).toEqual(data)
    })

    it('should handle empty data', () => {
      const mapping = { oldKey: 'newKey' }
      const data = {}

      const result = mapData(mapping, data)

      expect(result).toEqual({})
    })
  })

  describe('mapDataWithIgnores', () => {
    it('should map data and not ignore when patterns don\'t match', () => {
      const mapping = { oldKey: 'newKey' }
      const data = { oldKey: 'value', checkKey: 'good' }
      const ignore = { checkKey: ['bad.*', 'ignore.*'] }

      const result = mapDataWithIgnores(mapping, data, ignore)

      expect(result).toEqual({ newKey: 'value', checkKey: 'good' })
    })

    it('should return false when data matches ignore pattern', () => {
      const mapping = { oldKey: 'newKey' }
      const data = { oldKey: 'value', checkKey: 'badValue' }
      const ignore = { checkKey: ['bad.*'] }

      const result = mapDataWithIgnores(mapping, data, ignore)

      expect(result).toBe(false)
    })

    it('should handle multiple ignore patterns', () => {
      const mapping = { oldKey: 'newKey' }
      const data = { oldKey: 'value', checkKey: 'ignoreThis' }
      const ignore = { checkKey: ['bad.*', 'ignore.*'] }

      const result = mapDataWithIgnores(mapping, data, ignore)

      expect(result).toBe(false)
    })

    it('should handle empty ignore object', () => {
      const mapping = { oldKey: 'newKey' }
      const data = { oldKey: 'value' }

      const result = mapDataWithIgnores(mapping, data)

      expect(result).toEqual({ newKey: 'value' })
    })
  })

  describe('buildRequestData', () => {
    it('should structure data with the specified key', () => {
      const key = 'entries'
      const mapping = { oldKey1: 'newKey1', oldKey2: 'newKey2' }
      const data = { oldKey1: 'value1', oldKey2: 'value2' }

      const result = buildRequestData(key, mapping, data)

      expect(result).toEqual({
        newKey1: { entries: 'value1' },
        newKey2: { entries: 'value2' },
      })
    })

    it('should return mapped data when key is empty', () => {
      const key = ''
      const mapping = { oldKey1: 'newKey1', oldKey2: 'newKey2' }
      const data = { oldKey1: 'value1', oldKey2: 'value2' }

      const result = buildRequestData(key, mapping, data)

      expect(result).toEqual({
        newKey1: 'value1',
        newKey2: 'value2',
      })
    })
  })
})
