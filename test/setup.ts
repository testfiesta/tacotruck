/* eslint-disable ts/method-signature-style */
/* eslint-disable ts/no-namespace */
/* eslint-disable no-restricted-globals */
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from 'vitest'

beforeAll(() => {
  process.env.NODE_ENV = 'test'

  if (!process.env.DEBUG_TESTS) {
    globalThis.console = {
      ...console,
      log: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }
  }
})

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks()

  // Reset modules to ensure clean state
  vi.resetModules()
})

afterEach(() => {
  // Restore all mocks after each test
  vi.restoreAllMocks()
})

afterAll(() => {
  // Clean up any global state
  vi.clearAllTimers()
  vi.useRealTimers()
})

// Global test utilities
global.TestUtils = {
  /**
   * Create a mock promise that can be resolved or rejected manually
   */
  createMockPromise: <T>() => {
    let resolve: (value: T) => void
    let reject: (reason?: any) => void

    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })

    return {
      promise,
      resolve: resolve!,
      reject: reject!,
    }
  },

  /**
   * Wait for a specified number of milliseconds
   */
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Create a mock ETL configuration for testing
   */
  createMockConfig: (overrides: any = {}) => ({
    name: 'test-config',
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
    ...overrides,
  }),

  /**
   * Create mock credentials for testing
   */
  createMockCredentials: (overrides: any = {}) => ({
    token: 'test-token-123',
    username: 'testuser',
    password: 'testpass',
    apiKey: 'test-api-key',
    ...overrides,
  }),

  /**
   * Create mock test data
   */
  createMockTestData: (overrides: any = {}) => ({
    source: 'test-integration',
    projects: [
      { id: 1, name: 'Project 1', status: 'active' },
      { id: 2, name: 'Project 2', status: 'completed' },
    ],
    ...overrides,
  }),

  /**
   * Create mock ETL result
   */
  createMockETLResult: (overrides: any = {}) => ({
    success: true,
    data: TestUtils.createMockTestData(),
    extractionResult: {
      data: TestUtils.createMockTestData(),
      metadata: {
        extractedAt: new Date(),
        endpoints: ['projects'],
        recordCounts: { projects: 2 },
        duration: 1000,
        errors: [],
      },
    },
    transformationResult: {
      data: TestUtils.createMockTestData(),
      metadata: {
        transformedAt: new Date(),
        duration: 500,
        recordCounts: { projects: 2 },
        appliedRules: ['source_control_info'],
        errors: [],
        warnings: [],
      },
    },
    loadingResult: {
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
    },
    performance: {
      totalDuration: 2300,
      phases: {},
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
    },
    errors: [],
    warnings: [],
    metadata: {
      startTime: new Date(),
      endTime: new Date(),
      duration: 2300,
      recordsProcessed: 2,
      integration: 'test-integration',
      source: 'test-integration',
    },
    ...overrides,
  }),
}

declare global {
  // eslint-disable-next-line vars-on-top
  var TestUtils: typeof global.TestUtils

  namespace Vi {
    interface AsymmetricMatchersContaining {
      toBeValidETLResult(): any
      toBeValidPerformanceMetrics(): any
      toBeValidErrorSummary(): any
    }
  }
}

expect.extend({
  toBeValidETLResult(received) {
    const requiredFields = ['success', 'errors', 'warnings', 'metadata']
    const missingFields = requiredFields.filter(field => !(field in received))

    if (missingFields.length > 0) {
      return {
        message: () => `Expected ETL result to have required fields: ${missingFields.join(', ')}`,
        pass: false,
      }
    }

    if (typeof received.success !== 'boolean') {
      return {
        message: () => 'Expected ETL result success field to be boolean',
        pass: false,
      }
    }

    if (!Array.isArray(received.errors)) {
      return {
        message: () => 'Expected ETL result errors field to be array',
        pass: false,
      }
    }

    if (!Array.isArray(received.warnings)) {
      return {
        message: () => 'Expected ETL result warnings field to be array',
        pass: false,
      }
    }

    return {
      message: () => 'ETL result is valid',
      pass: true,
    }
  },

  toBeValidPerformanceMetrics(received) {
    const requiredFields = ['totalDuration', 'phases', 'overallMetrics']
    const missingFields = requiredFields.filter(field => !(field in received))

    if (missingFields.length > 0) {
      return {
        message: () => `Expected performance metrics to have required fields: ${missingFields.join(', ')}`,
        pass: false,
      }
    }

    if (typeof received.totalDuration !== 'number') {
      return {
        message: () => 'Expected totalDuration to be number',
        pass: false,
      }
    }

    if (typeof received.phases !== 'object') {
      return {
        message: () => 'Expected phases to be object',
        pass: false,
      }
    }

    return {
      message: () => 'Performance metrics are valid',
      pass: true,
    }
  },

  toBeValidErrorSummary(received) {
    const requiredFields = ['totalErrors', 'retryableErrors', 'nonRetryableErrors', 'errorsByType', 'errors']
    const missingFields = requiredFields.filter(field => !(field in received))

    if (missingFields.length > 0) {
      return {
        message: () => `Expected error summary to have required fields: ${missingFields.join(', ')}`,
        pass: false,
      }
    }

    if (typeof received.totalErrors !== 'number') {
      return {
        message: () => 'Expected totalErrors to be number',
        pass: false,
      }
    }

    if (!Array.isArray(received.errors)) {
      return {
        message: () => 'Expected errors to be array',
        pass: false,
      }
    }

    return {
      message: () => 'Error summary is valid',
      pass: true,
    }
  },
})

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  statSync: vi.fn().mockReturnValue({ isDirectory: () => false }),
}))

vi.mock('path', async () => ({
  ...await vi.importActual('path'),
  resolve: vi.fn().mockImplementation((...args) => args.join('/')),
  join: vi.fn().mockImplementation((...args) => args.join('/')),
}))

global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true }),
    text: () => Promise.resolve('OK'),
  }),
)

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})
