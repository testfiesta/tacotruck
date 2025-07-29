/* eslint-disable no-new */
import type { ConfigType } from '../../src/utils/config-schema'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ETLv2 } from '../../src/controllers/etl-base-v2'
import {
  AuthenticationError,
  AuthenticationManager,
  ConfigurationError,
  ConfigurationManager,
  DataExtractor,
  DataLoader,
  DataTransformer,
  ErrorManager,
  PerformanceMonitor,
} from '../../src/controllers/managers'

vi.mock('../../src/controllers/managers/configuration-manager')
vi.mock('../../src/controllers/managers/authentication-manager')
vi.mock('../../src/controllers/managers/data-extractor')
vi.mock('../../src/controllers/managers/data-transformer')
vi.mock('../../src/controllers/managers/data-loader')
vi.mock('../../src/controllers/managers/performance-monitor')
vi.mock('../../src/controllers/managers/error-manager')

describe('eTLv2', () => {
  const mockConfig: ConfigType = {
    name: 'test-etl',
    type: 'api',
    base_path: 'https://api.example.com',
    auth: {
      type: 'bearer',
      location: 'header',
      key: 'Authorization',
      payload: 'Bearer {token}',
    },
    source: {
      projects: {
        endpoints: {
          index: { path: '/projects' },
          get: { path: '/projects/{id}' },
        },
      },
    },
    target: {
      projects: {
        endpoints: {
          create: {
            bulk_path: '/bulk/projects',
            single_path: '/projects',
            data_key: 'entries',
            include_source: true,
          },
        },
      },
    },
  }

  const mockCredentials = {
    token: 'test-token-123',
  }

  const mockExtractionResult = {
    data: {
      source: 'test-etl',
      projects: [
        { id: 1, name: 'Project 1' },
        { id: 2, name: 'Project 2' },
      ],
    },
    metadata: {
      extractedAt: new Date(),
      endpoints: ['projects'],
      recordCounts: { projects: 2 },
      duration: 1000,
      errors: [],
    },
  }

  const mockTransformationResult = {
    data: {
      source: 'test-etl',
      projects: [
        { id: 1, name: 'Project 1', transformed: true },
        { id: 2, name: 'Project 2', transformed: true },
      ],
    },
    metadata: {
      transformedAt: new Date(),
      duration: 500,
      recordCounts: { projects: 2 },
      appliedRules: ['source_control_info'],
      errors: [],
      warnings: [],
    },
  }

  const mockLoadingResult = {
    metadata: {
      loadedAt: new Date(),
      duration: 800,
      totalRequests: 1,
      successfulRequests: 1,
      failedRequests: 0,
      recordCounts: { projects: 2 },
      endpoints: ['projects'],
      errors: [],
    },
    responses: {
      projects: { success: true, created: 2 },
    },
  }

  const mockPerformanceSummary = {
    totalDuration: 2300,
    phases: {
      extract: {
        startTime: new Date(),
        endTime: new Date(),
        duration: 1000,
        phase: 'extract' as const,
        recordsProcessed: 2,
      },
      transform: {
        startTime: new Date(),
        endTime: new Date(),
        duration: 500,
        phase: 'transform' as const,
        recordsProcessed: 2,
      },
      load: {
        startTime: new Date(),
        endTime: new Date(),
        duration: 800,
        phase: 'load' as const,
        recordsProcessed: 2,
      },
    },
    overallMetrics: {
      totalRecordsProcessed: 2,
      averageRecordsPerSecond: 0.87,
      peakMemoryUsage: 50000000,
      totalNetworkRequests: 3,
      totalErrors: 0,
      successRate: 100,
    },
    snapshots: [],
    recommendations: ['Performance looks good!'],
  }

  let etlv2: ETLv2
  let mockConfigManager: any
  let mockAuthManager: any
  let mockDataExtractor: any
  let mockDataTransformer: any
  let mockDataLoader: any
  let mockPerformanceMonitor: any
  let mockErrorManager: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock instances
    mockConfigManager = {
      validateConfiguration: vi.fn(),
      applySubstitutions: vi.fn(),
      getConfig: vi.fn().mockReturnValue(mockConfig),
      getIntegrationName: vi.fn().mockReturnValue('test-etl'),
      getBaseUrl: vi.fn().mockReturnValue('https://api.example.com'),
      getEndpointSet: vi.fn().mockReturnValue(['projects']),
      updateCredentials: vi.fn(),
    } as any

    mockAuthManager = {
      initializeFromConfig: vi.fn(),
      validateAuthConfiguration: vi.fn(),
      hasAuthentication: vi.fn().mockReturnValue(true),
      getProcessedAuthOptions: vi.fn().mockReturnValue({
        type: 'bearer',
        location: 'header',
        key: 'Authorization',
        payload: 'Bearer test-token-123',
      }),
      getAuthOptions: vi.fn().mockReturnValue({
        type: 'bearer',
      }),
      updateCredentials: vi.fn(),
    } as any

    mockDataExtractor = {
      extract: vi.fn().mockResolvedValue(mockExtractionResult),
      updateOptions: vi.fn(),
    } as any

    mockDataTransformer = {
      transform: vi.fn().mockResolvedValue(mockTransformationResult),
      addTransformationRules: vi.fn(),
      addFieldMappings: vi.fn(),
      clearRules: vi.fn(),
    } as any

    mockDataLoader = {
      load: vi.fn().mockResolvedValue(mockLoadingResult),
      loadToTarget: vi.fn().mockResolvedValue({ success: true }),
      updateOptions: vi.fn(),
      clearTargetUrls: vi.fn(),
    } as any

    mockPerformanceMonitor = {
      startMonitoring: vi.fn(),
      startPhase: vi.fn(),
      endPhase: vi.fn(),
      recordProcessed: vi.fn(),
      getSummary: vi.fn().mockReturnValue(mockPerformanceSummary),
      takeSnapshot: vi.fn(),
      reset: vi.fn(),
    } as any

    mockErrorManager = {
      addError: vi.fn(),
      getErrors: vi.fn().mockReturnValue([]),
      getSummary: vi.fn().mockReturnValue({
        totalErrors: 0,
        retryableErrors: 0,
        nonRetryableErrors: 0,
        errorsByType: {},
        errors: [],
      }),
      hasCriticalErrors: vi.fn().mockReturnValue(false),
      clear: vi.fn(),
    } as any

    vi.mocked(ConfigurationManager).mockImplementation(() => mockConfigManager)
    vi.mocked(AuthenticationManager).mockImplementation(() => mockAuthManager)
    vi.mocked(DataExtractor).mockImplementation(() => mockDataExtractor)
    vi.mocked(DataTransformer).mockImplementation(() => mockDataTransformer)
    vi.mocked(DataLoader).mockImplementation(() => mockDataLoader)
    vi.mocked(PerformanceMonitor).mockImplementation(() => mockPerformanceMonitor)
    vi.mocked(ErrorManager).mockImplementation(() => mockErrorManager)
  })

  describe('constructor', () => {
    it('should create a new ETLv2 instance with default options', () => {
      etlv2 = new ETLv2(mockConfig)

      expect(etlv2).toBeInstanceOf(ETLv2)
      expect(ConfigurationManager).toHaveBeenCalledWith(mockConfig, {
        credentials: undefined,
        allowMutation: true,
      })
    })

    it('should create instance with custom options', () => {
      const options = {
        credentials: mockCredentials,
        enablePerformanceMonitoring: false,
        strictMode: true,
        retryAttempts: 5,
        timeout: 60000,
      }

      etlv2 = new ETLv2(mockConfig, options)

      expect(ConfigurationManager).toHaveBeenCalledWith(mockConfig, {
        credentials: mockCredentials,
        allowMutation: true,
      })
      expect(AuthenticationManager).toHaveBeenCalledWith({
        credentials: mockCredentials,
      })
    })

    it('should initialize all managers correctly', () => {
      etlv2 = new ETLv2(mockConfig, { credentials: mockCredentials })

      expect(mockConfigManager.validateConfiguration).toHaveBeenCalled()
      expect(mockConfigManager.applySubstitutions).toHaveBeenCalled()
      expect(mockAuthManager.initializeFromConfig).toHaveBeenCalledWith(mockConfig)
      expect(mockAuthManager.validateAuthConfiguration).toHaveBeenCalled()
    })

    it('should handle configuration errors gracefully in non-strict mode', () => {
      mockConfigManager.validateConfiguration.mockImplementation(() => {
        throw new Error('Config validation failed')
      })

      expect(() => {
        etlv2 = new ETLv2(mockConfig, { strictMode: false })
      }).not.toThrow()

      expect(mockErrorManager.addError).toHaveBeenCalled()
    })

    it('should throw configuration errors in strict mode', () => {
      mockConfigManager.validateConfiguration.mockImplementation(() => {
        throw new ConfigurationError('Config validation failed')
      })

      expect(() => {
        etlv2 = new ETLv2(mockConfig, { strictMode: true })
      }).toThrow(ConfigurationError)
    })
  })

  describe('execute', () => {
    beforeEach(() => {
      etlv2 = new ETLv2(mockConfig, {
        credentials: mockCredentials,
        enablePerformanceMonitoring: true,
      })
    })

    it('should execute complete ETL process successfully', async () => {
      const result = await etlv2.execute()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockTransformationResult.data)
      expect(result.extractionResult).toEqual(mockExtractionResult)
      expect(result.transformationResult).toEqual(mockTransformationResult)
      expect(result.loadingResult).toEqual(mockLoadingResult)
      expect(result.performance).toEqual(mockPerformanceSummary)
      expect(result.errors).toEqual([])

      expect(mockPerformanceMonitor.startMonitoring).toHaveBeenCalled()
      expect(mockDataExtractor.extract).toHaveBeenCalledWith({})
      expect(mockDataTransformer.transform).toHaveBeenCalledWith(mockExtractionResult.data)
      expect(mockDataLoader.load).toHaveBeenCalledWith(mockTransformationResult.data)
    })

    it('should execute with specific IDs', async () => {
      const ids = { projects: [{ id: 1 }] }

      await etlv2.execute(ids)

      expect(mockDataExtractor.extract).toHaveBeenCalledWith(ids)
    })

    it('should handle errors and return unsuccessful result', async () => {
      const extractionError = new Error('Extraction failed')
      mockDataExtractor.extract.mockRejectedValue(extractionError)

      const result = await etlv2.execute()

      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()
      expect(result.extractionResult).toBeUndefined()
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should track performance metrics during execution', async () => {
      await etlv2.execute()

      expect(mockPerformanceMonitor.startMonitoring).toHaveBeenCalled()
      expect(mockPerformanceMonitor.startPhase).toHaveBeenCalledWith('extract')
      expect(mockPerformanceMonitor.startPhase).toHaveBeenCalledWith('transform')
      expect(mockPerformanceMonitor.startPhase).toHaveBeenCalledWith('load')
      expect(mockPerformanceMonitor.recordProcessed).toHaveBeenCalledTimes(3)
      expect(mockPerformanceMonitor.endPhase).toHaveBeenCalledTimes(3)
    })

    it('should skip performance monitoring when disabled', async () => {
      etlv2 = new ETLv2(mockConfig, {
        credentials: mockCredentials,
        enablePerformanceMonitoring: false,
      })

      const result = await etlv2.execute()

      expect(mockPerformanceMonitor.startMonitoring).not.toHaveBeenCalled()
      expect(result.performance).toBeUndefined()
    })

    it('should calculate metadata correctly', async () => {
      const result = await etlv2.execute()

      expect(result.metadata.startTime).toBeInstanceOf(Date)
      expect(result.metadata.endTime).toBeInstanceOf(Date)
      expect(result.metadata.duration).toBeGreaterThan(0)
      expect(result.metadata.recordsProcessed).toBe(2)
      expect(result.metadata.integration).toBe('test-etl')
      expect(result.metadata.source).toBe('test-etl')
    })
  })

  describe('individual phase methods', () => {
    beforeEach(() => {
      etlv2 = new ETLv2(mockConfig, {
        credentials: mockCredentials,
        enablePerformanceMonitoring: true,
      })
    })

    describe('extract', () => {
      it('should perform extraction with performance tracking', async () => {
        const result = await etlv2.extract()

        expect(result).toEqual(mockExtractionResult)
        expect(mockPerformanceMonitor.startPhase).toHaveBeenCalledWith('extract')
        expect(mockPerformanceMonitor.recordProcessed).toHaveBeenCalledWith(2)
        expect(mockPerformanceMonitor.endPhase).toHaveBeenCalled()
      })

      it('should handle extraction errors', async () => {
        const extractionError = new Error('Extraction failed')
        mockDataExtractor.extract.mockRejectedValue(extractionError)

        await expect(etlv2.extract()).rejects.toThrow('Extraction failed')
        expect(mockPerformanceMonitor.endPhase).toHaveBeenCalled()
      })
    })

    describe('transform', () => {
      it('should perform transformation with performance tracking', async () => {
        const result = await etlv2.transform(mockExtractionResult.data)

        expect(result).toEqual(mockTransformationResult)
        expect(mockPerformanceMonitor.startPhase).toHaveBeenCalledWith('transform')
        expect(mockPerformanceMonitor.recordProcessed).toHaveBeenCalledWith(2)
        expect(mockPerformanceMonitor.endPhase).toHaveBeenCalled()
      })

      it('should handle transformation errors', async () => {
        const transformationError = new Error('Transformation failed')
        mockDataTransformer.transform.mockRejectedValue(transformationError)

        await expect(etlv2.transform(mockExtractionResult.data)).rejects.toThrow('Transformation failed')
        expect(mockPerformanceMonitor.endPhase).toHaveBeenCalled()
      })
    })

    describe('load', () => {
      it('should perform loading with performance tracking', async () => {
        const result = await etlv2.load(mockTransformationResult.data)

        expect(result).toEqual(mockLoadingResult)
        expect(mockPerformanceMonitor.startPhase).toHaveBeenCalledWith('load')
        expect(mockPerformanceMonitor.recordProcessed).toHaveBeenCalledWith(2)
        expect(mockPerformanceMonitor.endPhase).toHaveBeenCalled()
      })

      it('should handle loading errors', async () => {
        const loadingError = new Error('Loading failed')
        mockDataLoader.load.mockRejectedValue(loadingError)

        await expect(etlv2.load(mockTransformationResult.data)).rejects.toThrow('Loading failed')
        expect(mockPerformanceMonitor.endPhase).toHaveBeenCalled()
      })
    })
  })

  describe('loadToTarget', () => {
    beforeEach(() => {
      etlv2 = new ETLv2(mockConfig, { credentials: mockCredentials })
    })

    it('should delegate to DataLoader', async () => {
      const data = { test: 'data' }
      const result = await etlv2.loadToTarget('projects', data, 'create')

      expect(mockDataLoader.loadToTarget).toHaveBeenCalledWith('projects', data, 'create')
      expect(result).toEqual({ success: true })
    })
  })

  describe('updateCredentials', () => {
    beforeEach(() => {
      etlv2 = new ETLv2(mockConfig, { credentials: mockCredentials })
    })

    it('should update credentials across all managers', () => {
      const newCredentials = { token: 'new-token' }

      etlv2.updateCredentials(newCredentials)

      expect(mockConfigManager.updateCredentials).toHaveBeenCalledWith(newCredentials)
      expect(mockAuthManager.updateCredentials).toHaveBeenCalledWith(newCredentials)
      expect(mockAuthManager.initializeFromConfig).toHaveBeenCalledWith(mockConfig)
      expect(mockDataExtractor.updateOptions).toHaveBeenCalled()
      expect(mockDataLoader.updateOptions).toHaveBeenCalled()
    })

    it('should handle credential update errors gracefully in non-strict mode', () => {
      etlv2 = new ETLv2(mockConfig, { strictMode: false })
      mockConfigManager.updateCredentials.mockImplementation(() => {
        throw new Error('Credential update failed')
      })

      expect(() => {
        etlv2.updateCredentials({ token: 'new-token' })
      }).not.toThrow()

      expect(mockErrorManager.addError).toHaveBeenCalled()
    })

    it('should throw credential update errors in strict mode', () => {
      etlv2 = new ETLv2(mockConfig, { strictMode: true })
      mockConfigManager.updateCredentials.mockImplementation(() => {
        throw new AuthenticationError('Credential update failed')
      })

      expect(() => {
        etlv2.updateCredentials({ token: 'new-token' })
      }).toThrow(AuthenticationError)
    })
  })

  describe('utility methods', () => {
    beforeEach(() => {
      etlv2 = new ETLv2(mockConfig, {
        credentials: mockCredentials,
        enablePerformanceMonitoring: true,
      })
    })

    describe('getErrorSummary', () => {
      it('should return error summary from ErrorManager', () => {
        const summary = etlv2.getErrorSummary()

        expect(mockErrorManager.getSummary).toHaveBeenCalled()
        expect(summary).toEqual({
          totalErrors: 0,
          retryableErrors: 0,
          nonRetryableErrors: 0,
          errorsByType: {},
          errors: [],
        })
      })
    })

    describe('getPerformanceSummary', () => {
      it('should return performance summary when monitoring is enabled', () => {
        const summary = etlv2.getPerformanceSummary()

        expect(mockPerformanceMonitor.getSummary).toHaveBeenCalled()
        expect(summary).toEqual(mockPerformanceSummary)
      })

      it('should return null when monitoring is disabled', () => {
        etlv2 = new ETLv2(mockConfig, { enablePerformanceMonitoring: false })

        const summary = etlv2.getPerformanceSummary()

        expect(summary).toBeNull()
      })
    })

    describe('hasCriticalErrors', () => {
      it('should return false when no critical errors exist', () => {
        expect(etlv2.hasCriticalErrors()).toBe(false)
        expect(mockErrorManager.hasCriticalErrors).toHaveBeenCalled()
      })

      it('should return true when critical errors exist', () => {
        mockErrorManager.hasCriticalErrors.mockReturnValue(true)

        expect(etlv2.hasCriticalErrors()).toBe(true)
      })
    })

    describe('getConfigInfo', () => {
      it('should return configuration information', () => {
        const configInfo = etlv2.getConfigInfo()

        expect(configInfo).toEqual({
          integration: 'test-etl',
          baseUrl: 'https://api.example.com',
          endpoints: ['projects'],
          hasAuth: true,
          authType: 'bearer',
        })
      })
    })

    describe('addTransformationRules', () => {
      it('should delegate to DataTransformer', () => {
        const rules = [{ name: 'test-rule', sourceField: 'test' }]

        etlv2.addTransformationRules(rules)

        expect(mockDataTransformer.addTransformationRules).toHaveBeenCalledWith(rules)
      })
    })

    describe('addFieldMappings', () => {
      it('should delegate to DataTransformer', () => {
        const mappings = [{ source: 'old_field', target: 'new_field' }]

        etlv2.addFieldMappings(mappings)

        expect(mockDataTransformer.addFieldMappings).toHaveBeenCalledWith(mappings)
      })
    })

    describe('takePerformanceSnapshot', () => {
      it('should delegate to PerformanceMonitor when monitoring is enabled', () => {
        const metadata = { checkpoint: 'test' }

        etlv2.takePerformanceSnapshot(metadata)

        expect(mockPerformanceMonitor.takeSnapshot).toHaveBeenCalledWith(metadata)
      })

      it('should not call PerformanceMonitor when monitoring is disabled', () => {
        etlv2 = new ETLv2(mockConfig, { enablePerformanceMonitoring: false })

        etlv2.takePerformanceSnapshot()

        expect(mockPerformanceMonitor.takeSnapshot).not.toHaveBeenCalled()
      })
    })

    describe('reset', () => {
      it('should reset all managers', () => {
        etlv2.reset()

        expect(mockErrorManager.clear).toHaveBeenCalled()
        expect(mockPerformanceMonitor.reset).toHaveBeenCalled()
        expect(mockDataTransformer.clearRules).toHaveBeenCalled()
        expect(mockDataLoader.clearTargetUrls).toHaveBeenCalled()
      })

      it('should not reset performance monitor when monitoring is disabled', () => {
        etlv2 = new ETLv2(mockConfig, { enablePerformanceMonitoring: false })

        etlv2.reset()

        expect(mockPerformanceMonitor.reset).not.toHaveBeenCalled()
      })
    })
  })

  describe('factory method fromConfig', () => {
    const mockLoadConfig = vi.fn()

    beforeEach(() => {
      vi.doMock('../../src/utils/enhanced-config-loader', () => ({
        loadConfig: mockLoadConfig,
      }))
    })

    afterEach(() => {
      vi.doUnmock('../../src/utils/enhanced-config-loader')
    })

    it('should create ETLv2 instance from config file', async () => {
      mockLoadConfig.mockReturnValue({
        isOk: true,
        unwrap: () => mockConfig,
      })

      const etl = await ETLv2.fromConfig({
        configPath: './test-config.json',
        credentials: mockCredentials,
        etlOptions: { strictMode: true },
      })

      expect(mockLoadConfig).toHaveBeenCalledWith({
        configPath: './test-config.json',
      })
      expect(etl).toBeInstanceOf(ETLv2)
    })

    it('should throw error when config loading fails', async () => {
      mockLoadConfig.mockReturnValue({
        isOk: false,
        unwrap: () => { throw new Error('Config not found') },
      })

      await expect(ETLv2.fromConfig()).rejects.toThrow('Failed to load ETL configuration')
    })

    it('should use default options when not provided', async () => {
      mockLoadConfig.mockReturnValue({
        isOk: true,
        unwrap: () => mockConfig,
      })

      await ETLv2.fromConfig()

      expect(mockLoadConfig).toHaveBeenCalledWith({
        configPath: undefined,
        credentials: undefined,
      })
    })
  })

  describe('private methods', () => {
    beforeEach(() => {
      etlv2 = new ETLv2(mockConfig, { credentials: mockCredentials })
    })

    describe('collectWarnings', () => {
      it('should collect warnings from performance monitor', () => {
        mockPerformanceMonitor.getSummary.mockReturnValue({
          ...mockPerformanceSummary,
          recommendations: ['consider optimizing', 'performance is good'],
        })

        // Access private method for testing
        const warnings = (etlv2 as any).collectWarnings()

        expect(warnings).toContain('consider optimizing')
        expect(warnings).not.toContain('performance is good') // Doesn't contain 'consider'
      })

      it('should add authentication warning when no auth is configured', () => {
        mockAuthManager.hasAuthentication.mockReturnValue(false)

        const warnings = (etlv2 as any).collectWarnings()

        expect(warnings).toContain('No authentication configured - this may limit API access')
      })
    })

    describe('calculateTotalRecords', () => {
      it('should calculate total records from data', () => {
        const data = {
          source: 'test',
          projects: [{ id: 1 }, { id: 2 }],
          users: [{ id: 1 }, { id: 2 }, { id: 3 }],
          metadata: { count: 5 }, // Single object, not array
        }

        const total = (etlv2 as any).calculateTotalRecords(data)

        expect(total).toBe(6)
      })

      it('should ignore source field in calculation', () => {
        const data = {
          source: 'test',
          projects: [{ id: 1 }],
        }

        const total = (etlv2 as any).calculateTotalRecords(data)

        expect(total).toBe(1)
      })

      it('should handle empty data', () => {
        const data = { source: 'test' }

        const total = (etlv2 as any).calculateTotalRecords(data)

        expect(total).toBe(0)
      })
    })
  })

  describe('error scenarios', () => {
    it('should handle manager initialization failures', () => {
      vi.mocked(ConfigurationManager).mockImplementation(() => {
        throw new Error('Manager initialization failed')
      })

      expect(() => {
        new ETLv2(mockConfig, { strictMode: false })
      }).not.toThrow()
    })

    it('should handle missing config gracefully', () => {
      expect(() => {
        new ETLv2(null as any, { strictMode: false })
      }).not.toThrow()
    })

    it('should handle malformed options', () => {
      expect(() => {
        new ETLv2(mockConfig, null as any)
      }).not.toThrow()
    })
  })
})
