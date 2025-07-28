import type { ConfigType } from '../../utils/config-schema'
import { applySourceControlInfo } from '../../utils/batch-processor'
import { ErrorManager, ETLErrorType, TransformationError, ValidationError } from './error-manager'

export interface TransformationOptions {
  direction?: string
  integration?: string
  throttleCap?: number
  endpointSet?: string[]
  offsets?: Record<string, any>
  validateOutput?: boolean
  strictMode?: boolean
}

export interface TransformationResult {
  data: Record<string, any>
  metadata: {
    transformedAt: Date
    duration: number
    recordCounts: Record<string, number>
    appliedRules: string[]
    errors: any[]
    warnings: string[]
  }
}

export interface TransformationRule {
  name: string
  sourceField: string
  targetField?: string
  transform?: (value: any, record: any, context: any) => any
  validate?: (value: any, record: any) => boolean
  required?: boolean
  defaultValue?: any
}

export interface FieldMapping {
  source: string
  target: string
  transform?: string | ((value: any) => any)
  validation?: {
    required?: boolean
    type?: 'string' | 'number' | 'boolean' | 'array' | 'object'
    pattern?: RegExp
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
    enum?: any[]
  }
}

export class DataTransformer {
  private config: ConfigType
  private errorManager: ErrorManager
  private options: TransformationOptions
  private transformationRules: TransformationRule[] = []
  private fieldMappings: FieldMapping[] = []

  constructor(
    config: ConfigType,
    options: TransformationOptions = {},
    errorManager?: ErrorManager,
  ) {
    this.config = config
    this.options = {
      direction: 'target',
      integration: 'default',
      throttleCap: 5,
      endpointSet: [],
      offsets: {},
      validateOutput: true,
      strictMode: false,
      ...options,
    }
    this.errorManager = errorManager || new ErrorManager()
    this.initializeTransformationRules()
  }

  /**
   * Transform data according to mapping rules and configuration
   * @param data The data to transform
   * @returns Transformation result with transformed data and metadata
   */
  async transform(data: Record<string, any>): Promise<TransformationResult> {
    const startTime = Date.now()
    const transformedAt = new Date()
    const appliedRules: string[] = []
    const warnings: string[] = []

    // eslint-disable-next-line unused-imports/no-unused-vars
    const errors: any[] = []
    const recordCounts: Record<string, number> = {}

    try {
      this.validateInputData(data)

      // Create ETL-compatible config for source control processing
      const etlCompatConfig = {
        ...this.config,
        direction: this.options.direction,
        integration: this.options.integration,
        throttleCap: this.options.throttleCap,
        endpointSet: this.options.endpointSet,
        offsets: this.options.offsets,
      }

      // Apply source control information (from original ETL logic)
      let transformedData = applySourceControlInfo(data, etlCompatConfig as any)
      appliedRules.push('source_control_info')

      // Apply configuration overrides if they exist
      if (this.config.type === 'api' && 'overrides' in this.config) {
        const apiConfig = this.config as any
        if (apiConfig.overrides) {
          transformedData = this.applyConfigOverrides(transformedData, apiConfig.overrides)
          appliedRules.push('config_overrides')
        }
      }

      // Apply custom transformation rules
      transformedData = await this.applyTransformationRules(transformedData)
      appliedRules.push('custom_rules')

      // Apply field mappings
      transformedData = this.applyFieldMappings(transformedData)
      appliedRules.push('field_mappings')

      // Calculate record counts
      for (const [key, value] of Object.entries(transformedData)) {
        if (key !== 'source' && Array.isArray(value)) {
          recordCounts[key] = value.length
        }
        else if (key !== 'source' && value && typeof value === 'object') {
          recordCounts[key] = 1
        }
      }

      // Validate output if required
      if (this.options.validateOutput) {
        this.validateTransformedData(transformedData)
        appliedRules.push('output_validation')
      }

      const duration = Date.now() - startTime

      return {
        data: transformedData,
        metadata: {
          transformedAt,
          duration,
          recordCounts,
          appliedRules,
          errors: this.errorManager.getErrors().map(e => e.toJSON()),
          warnings,
        },
      }
    }
    catch (error) {
      const etlError = ErrorManager.handleError(error, ETLErrorType.TRANSFORMATION)
      this.errorManager.addError(etlError)
      throw etlError
    }
  }

  /**
   * Add a transformation rule
   * @param rule The transformation rule to add
   */
  addTransformationRule(rule: TransformationRule): void {
    this.transformationRules.push(rule)
  }

  /**
   * Add multiple transformation rules
   * @param rules Array of transformation rules to add
   */
  addTransformationRules(rules: TransformationRule[]): void {
    this.transformationRules.push(...rules)
  }

  /**
   * Add a field mapping
   * @param mapping The field mapping to add
   */
  addFieldMapping(mapping: FieldMapping): void {
    this.fieldMappings.push(mapping)
  }

  /**
   * Add multiple field mappings
   * @param mappings Array of field mappings to add
   */
  addFieldMappings(mappings: FieldMapping[]): void {
    this.fieldMappings.push(...mappings)
  }

  /**
   * Apply transformation rules to data
   * @param data The data to transform
   * @returns Transformed data
   */
  private async applyTransformationRules(data: Record<string, any>): Promise<Record<string, any>> {
    if (this.transformationRules.length === 0) {
      return data
    }

    const result = { ...data }

    for (const [entityType, entityData] of Object.entries(result)) {
      if (entityType === 'source')
        continue

      if (Array.isArray(entityData)) {
        result[entityType] = await Promise.all(
          entityData.map(record => this.applyRulesToRecord(record, entityType)),
        )
      }
      else if (entityData && typeof entityData === 'object') {
        result[entityType] = await this.applyRulesToRecord(entityData, entityType)
      }
    }

    return result
  }

  /**
   * Apply transformation rules to a single record
   * @param record The record to transform
   * @param entityType The entity type context
   * @returns Transformed record
   */
  private async applyRulesToRecord(record: any, entityType: string): Promise<any> {
    const result = { ...record }

    for (const rule of this.transformationRules) {
      try {
        const sourceValue = this.getNestedValue(result, rule.sourceField)

        // Apply validation if specified
        if (rule.validate && !rule.validate(sourceValue, result)) {
          if (rule.required) {
            throw new ValidationError(
              `Validation failed for field ${rule.sourceField} in ${entityType}`,
              { field: rule.sourceField, entityType, value: sourceValue },
            )
          }
          continue // Skip transformation if validation fails and not required
        }

        // Apply transformation
        let transformedValue = sourceValue
        if (rule.transform) {
          transformedValue = await rule.transform(sourceValue, result, { entityType })
        }

        // Handle default values
        if ((transformedValue === undefined || transformedValue === null) && rule.defaultValue !== undefined) {
          transformedValue = rule.defaultValue
        }

        // Set the transformed value
        const targetField = rule.targetField || rule.sourceField
        this.setNestedValue(result, targetField, transformedValue)
      }
      catch (error) {
        const etlError = new TransformationError(
          `Failed to apply rule ${rule.name} to field ${rule.sourceField}`,
          {
            rule: rule.name,
            field: rule.sourceField,
            entityType,
            originalError: error instanceof Error ? error : new Error(String(error)),
          },
        )
        this.errorManager.addError(etlError)

        if (this.options.strictMode) {
          throw etlError
        }
      }
    }

    return result
  }

  /**
   * Apply field mappings to data
   * @param data The data to transform
   * @returns Data with field mappings applied
   */
  private applyFieldMappings(data: Record<string, any>): Record<string, any> {
    if (this.fieldMappings.length === 0) {
      return data
    }

    const result = { ...data }

    for (const [entityType, entityData] of Object.entries(result)) {
      if (entityType === 'source')
        continue

      if (Array.isArray(entityData)) {
        result[entityType] = entityData.map(record => this.applyMappingsToRecord(record, entityType))
      }
      else if (entityData && typeof entityData === 'object') {
        result[entityType] = this.applyMappingsToRecord(entityData, entityType)
      }
    }

    return result
  }

  /**
   * Apply field mappings to a single record
   * @param record The record to transform
   * @param entityType The entity type context
   * @returns Record with mappings applied
   */
  private applyMappingsToRecord(record: any, entityType: string): any {
    const result = { ...record }

    for (const mapping of this.fieldMappings) {
      try {
        const sourceValue = this.getNestedValue(result, mapping.source)

        if (mapping.validation) {
          this.validateFieldValue(sourceValue, mapping.validation, mapping.source, entityType)
        }

        let transformedValue = sourceValue
        if (mapping.transform) {
          if (typeof mapping.transform === 'function') {
            transformedValue = mapping.transform(sourceValue)
          }
          else if (typeof mapping.transform === 'string') {
            transformedValue = this.applyBuiltInTransform(sourceValue, mapping.transform)
          }
        }

        this.setNestedValue(result, mapping.target, transformedValue)

        if (mapping.source !== mapping.target) {
          this.deleteNestedValue(result, mapping.source)
        }
      }
      catch (error) {
        const etlError = new TransformationError(
          `Failed to apply field mapping ${mapping.source} -> ${mapping.target}`,
          {
            mapping: `${mapping.source} -> ${mapping.target}`,
            entityType,
            originalError: error instanceof Error ? error : new Error(String(error)),
          },
        )
        this.errorManager.addError(etlError)

        if (this.options.strictMode) {
          throw etlError
        }
      }
    }

    return result
  }

  /**
   * Apply configuration overrides (from original ETL logic)
   * @param data The data to apply overrides to
   * @param overrides The overrides configuration
   * @returns Data with overrides applied
   */
  private applyConfigOverrides(data: Record<string, any>, overrides: any): Record<string, any> {
    const result = { ...data }

    for (const dataType of Object.keys(overrides)) {
      if (result[dataType]) {
        const overrideConfig = overrides[dataType]
        result[dataType] = this.applyOverridesToDataType(result[dataType], overrideConfig)
      }
    }

    return result
  }

  /**
   * Apply overrides to a specific data type (from original ETL logic)
   * @param dataTypeData The data for a specific type
   * @param overrides The overrides to apply
   * @returns Data with overrides applied
   */
  private applyOverridesToDataType(dataTypeData: any, overrides: any): any {
    if (!Array.isArray(dataTypeData)) {
      return dataTypeData
    }

    return dataTypeData.map((item: any) => ({
      ...item,
      ...overrides,
    }))
  }

  /**
   * Validate field value against validation rules
   * @param value The value to validate
   * @param validation The validation rules
   * @param fieldName The field name for error reporting
   * @param entityType The entity type for error reporting
   */
  private validateFieldValue(
    value: any,
    validation: FieldMapping['validation'],
    fieldName: string,
    entityType: string,
  ): void {
    if (!validation)
      return

    if (validation.required && (value === undefined || value === null)) {
      throw new ValidationError(
        `Required field ${fieldName} is missing`,
        { field: fieldName, entityType },
      )
    }

    if (value !== undefined && value !== null) {
      // Type validation
      if (validation.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value
        if (actualType !== validation.type) {
          throw new ValidationError(
            `Field ${fieldName} expected type ${validation.type}, got ${actualType}`,
            { field: fieldName, entityType, expectedType: validation.type, actualType },
          )
        }
      }

      if (typeof value === 'string') {
        if (validation.pattern && !validation.pattern.test(value)) {
          throw new ValidationError(
            `Field ${fieldName} does not match required pattern`,
            { field: fieldName, entityType, pattern: validation.pattern.source },
          )
        }

        if (validation.minLength && value.length < validation.minLength) {
          throw new ValidationError(
            `Field ${fieldName} is too short (minimum ${validation.minLength} characters)`,
            { field: fieldName, entityType, minLength: validation.minLength, actualLength: value.length },
          )
        }

        if (validation.maxLength && value.length > validation.maxLength) {
          throw new ValidationError(
            `Field ${fieldName} is too long (maximum ${validation.maxLength} characters)`,
            { field: fieldName, entityType, maxLength: validation.maxLength, actualLength: value.length },
          )
        }
      }

      // Number validations
      if (typeof value === 'number') {
        if (validation.min !== undefined && value < validation.min) {
          throw new ValidationError(
            `Field ${fieldName} is below minimum value ${validation.min}`,
            { field: fieldName, entityType, min: validation.min, actualValue: value },
          )
        }

        if (validation.max !== undefined && value > validation.max) {
          throw new ValidationError(
            `Field ${fieldName} is above maximum value ${validation.max}`,
            { field: fieldName, entityType, max: validation.max, actualValue: value },
          )
        }
      }

      // Enum validation
      if (validation.enum && !validation.enum.includes(value)) {
        throw new ValidationError(
          `Field ${fieldName} value not in allowed enum values`,
          { field: fieldName, entityType, allowedValues: validation.enum, actualValue: value },
        )
      }
    }
  }

  /**
   * Apply built-in transformation functions
   * @param value The value to transform
   * @param transformType The transformation type
   * @returns Transformed value
   */
  private applyBuiltInTransform(value: any, transformType: string): any {
    switch (transformType.toLowerCase()) {
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value
      case 'trim':
        return typeof value === 'string' ? value.trim() : value
      case 'string':
        return String(value)
      case 'number':
        return Number(value)
      case 'boolean':
        return Boolean(value)
      case 'date':
        return new Date(value)
      case 'iso_date':
        return new Date(value).toISOString()
      default:
        return value
    }
  }

  /**
   * Get nested value from object using dot notation
   * @param obj The object to get value from
   * @param path The dot-separated path
   * @returns The value at the path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined
    }, obj)
  }

  /**
   * Set nested value in object using dot notation
   * @param obj The object to set value in
   * @param path The dot-separated path
   * @param value The value to set
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!

    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {}
      }
      return current[key]
    }, obj)

    target[lastKey] = value
  }

  /**
   * Delete nested value from object using dot notation
   * @param obj The object to delete value from
   * @param path The dot-separated path
   */
  private deleteNestedValue(obj: any, path: string): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!

    const target = keys.reduce((current, key) => {
      return current && current[key] ? current[key] : null
    }, obj)

    if (target && lastKey in target) {
      delete target[lastKey]
    }
  }

  /**
   * Validate input data structure
   * @param data The data to validate
   */
  private validateInputData(data: Record<string, any>): void {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Input data must be an object')
    }

    // if (!data.source) {
    //   throw new ValidationError('Input data must include a source field')
    // }
  }

  /**
   * Validate transformed data
   * @param data The transformed data to validate
   */
  private validateTransformedData(data: Record<string, any>): void {
    if (!data || typeof data !== 'object') {
      throw new ValidationError('Transformed data must be an object')
    }

    // Additional validation logic can be added here
    // based on specific requirements
  }

  /**
   * Initialize transformation rules from configuration
   */
  private initializeTransformationRules(): void {
    // This can be extended to load transformation rules from configuration
    // For now, it's a placeholder for future enhancement
  }

  /**
   * Get error manager for accessing transformation errors
   * @returns The error manager instance
   */
  getErrorManager(): ErrorManager {
    return this.errorManager
  }

  /**
   * Update transformation options
   * @param options New options to merge
   */
  updateOptions(options: Partial<TransformationOptions>): void {
    this.options = { ...this.options, ...options }
  }

  /**
   * Clear all transformation rules and mappings
   */
  clearRules(): void {
    this.transformationRules = []
    this.fieldMappings = []
  }

  /**
   * Get current transformation rules
   * @returns Array of current transformation rules
   */
  getTransformationRules(): TransformationRule[] {
    return [...this.transformationRules]
  }

  /**
   * Get current field mappings
   * @returns Array of current field mappings
   */
  getFieldMappings(): FieldMapping[] {
    return [...this.fieldMappings]
  }
}
