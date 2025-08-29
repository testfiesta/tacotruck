import * as crypto from 'node:crypto'

export interface TestCaseIdentifier {
  name: string
  classname: string
  suiteName?: string
  file?: string
}

export interface TestSuiteIdentifier {
  name: string
  file?: string
  timestamp?: string
}

export class ExternalIdGenerator {
  private readonly hashAlgorithm: string = 'sha256'
  private readonly idLength: number = 16

  /**
   * Generates a stable external ID for a test case based on its identifying characteristics.
   * The ID will be the same for the same test case across different runs.
   *
   * @param identifier - Test case identifying information
   * @returns A stable, unique external ID for the test case
   */
  generateTestCaseId(identifier: TestCaseIdentifier): string {
    const components = [
      identifier.name,
      identifier.classname,
      identifier.suiteName || '',
      identifier.file || '',
    ].filter(Boolean)

    const compositeKey = components.join('::')
    return this.createHash(compositeKey, 'tc')
  }

  /**
   * Generates a stable external ID for a test suite based on its identifying characteristics.
   * The ID will be the same for the same test suite across different runs.
   *
   * @param identifier - Test suite identifying information
   * @returns A stable, unique external ID for the test suite
   */
  generateTestSuiteId(identifier: TestSuiteIdentifier): string {
    const components = [
      identifier.name,
      identifier.file || '',
    ].filter(Boolean)

    const compositeKey = components.join('::')
    return this.createHash(compositeKey, 'ts')
  }

  generateHierarchicalTestCaseId(
    testCaseIdentifier: TestCaseIdentifier,
    testSuiteIdentifier: TestSuiteIdentifier,
  ): string {
    const suiteId = this.generateTestSuiteId(testSuiteIdentifier)
    const testCaseId = this.generateTestCaseId({
      ...testCaseIdentifier,
      suiteName: testSuiteIdentifier.name,
    })

    return `${suiteId}::${testCaseId}`
  }

  generateRunSpecificTestCaseId(identifier: TestCaseIdentifier, runId: string): string {
    const baseId = this.generateTestCaseId(identifier)
    return `${runId}::${baseId}`
  }

  extractBaseTestCaseId(runSpecificId: string): string {
    const parts = runSpecificId.split('::')
    if (parts.length >= 2) {
      return parts.slice(1).join('::')
    }
    return runSpecificId
  }

  validateExternalId(externalId: string, type: 'tc' | 'ts'): boolean {
    const pattern = new RegExp(`^${type}_[a-f0-9]{${this.idLength}}$`)
    return pattern.test(externalId)
  }

  private createHash(input: string, prefix: string): string {
    const hash = crypto
      .createHash(this.hashAlgorithm)
      .update(input, 'utf8')
      .digest('hex')
      .substring(0, this.idLength)

    return `${prefix}_${hash}`
  }

  generateBatchTestCaseIds(identifiers: TestCaseIdentifier[]): string[] {
    return identifiers.map(identifier => this.generateTestCaseId(identifier))
  }

  generateBatchTestSuiteIds(identifiers: TestSuiteIdentifier[]): string[] {
    return identifiers.map(identifier => this.generateTestSuiteId(identifier))
  }

  createTestCaseIdMap(identifiers: TestCaseIdentifier[]): Map<string, string> {
    const map = new Map<string, string>()

    for (const identifier of identifiers) {
      const key = `${identifier.classname}::${identifier.name}`
      const externalId = this.generateTestCaseId(identifier)
      map.set(key, externalId)
    }

    return map
  }
}

export const externalIdGenerator = new ExternalIdGenerator()
