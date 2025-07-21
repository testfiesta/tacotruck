import type { Result } from './result'
import { z } from 'zod'
import { err, ok } from './result'

const authSchema = z.object({
  type: z.string(),
  location: z.enum(['header', 'query', 'body']),
  key: z.string().optional(),
  payload: z.string().optional(),
})

const endpointDefinitionSchema = z.object({
  path: z.string().optional(),
  bulk_path: z.string().optional(),
  single_path: z.string().optional(),
  data_key: z.string().optional(),
  include_source: z.boolean().optional(),
  update_key: z.string().optional(),
  payload_key: z.string().optional(),
  throttle: z.number().optional(),
  throttleTime: z.number().optional(),
}).refine(
  data => data.path !== undefined || data.bulk_path !== undefined || data.single_path !== undefined,
  { message: 'At least one of path, bulk_path, or single_path must be defined' },
)

const typeMappingSchema = z.record(z.string(), z.object({
  target_type: z.string(),
}).passthrough())
const entityConfigSchema = z.object({
  endpoints: z.record(z.string(), endpointDefinitionSchema),
})

export const dataType = ['api', 'junit', 'json']

const baseConfigSchema = z.object({
  name: z.string(),
  type: z.enum(dataType),
  base_path: z.string().optional(),
  auth: authSchema.optional(),
  requests_per_second: z.number().optional(),
  sourceThrottle: z.number().optional(),
  sourceThrottleTime: z.number().optional(),
  typeConfig: z.object({
    source: typeMappingSchema.optional(),
    denormalized_keys: z.record(z.string(), z.record(z.string(), z.string())).optional(),
  }).optional(),
})

const multiTargetSchema = z.object({
  path: z.string(),
  data_key: z.string(),
  include_source: z.boolean(),
})

const apiConfigSchema = baseConfigSchema.extend({
  type: z.literal('api'),
  multi_target: multiTargetSchema.optional(),
  source: z.record(z.string(), entityConfigSchema).optional(),
  target: z.record(z.string(), entityConfigSchema).optional(),
})

const jsonConfigSchema = baseConfigSchema.extend({
  type: z.literal('json'),
  file_path: z.string(),
})

const junitConfigSchema = baseConfigSchema.extend({
  type: z.literal('junit'),
  file_path: z.string(),
})
const configSchema = z.discriminatedUnion('type', [
  apiConfigSchema,
  jsonConfigSchema,
  junitConfigSchema,
])

const credentialsSchema = z.object({
  base_url: z.string(),
}).passthrough()

export type AuthConfig = z.infer<typeof authSchema>
export type EndpointDefinition = z.infer<typeof endpointDefinitionSchema>
export type TypeMapping = z.infer<typeof typeMappingSchema>
export type EntityConfig = z.infer<typeof entityConfigSchema>
export type BaseConfig = z.infer<typeof baseConfigSchema>
export type ApiConfig = z.infer<typeof apiConfigSchema>
export type JsonConfig = z.infer<typeof jsonConfigSchema>
export type JunitConfig = z.infer<typeof junitConfigSchema>
export type ConfigType = z.infer<typeof configSchema>
export type CredentialsConfig = z.infer<typeof credentialsSchema>

/**
 * Validate a configuration object using Zod schema
 * @param config Configuration object to validate
 * @returns Result with validated config or error
 */
export function validateConfig(config: unknown): Result<ConfigType, Error> {
  try {
    const validatedConfig = configSchema.parse(config)
    return ok(validatedConfig)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      const formattedError = new Error(
        `Configuration validation failed:\n${error.issues
          .map((e: z.core.$ZodIssue) => `- ${e.path.join('.')}: ${e.message}`)
          .join('\n')}`,
      )
      return err(formattedError)
    }
    return err(error instanceof Error ? error : new Error('Unknown validation error'))
  }
}

/**
 * Validate credentials configuration
 * @param credentials Credentials object to validate
 * @returns Result with validated credentials or error
 */
export function validateCredentials(credentials: unknown): Result<CredentialsConfig, Error> {
  try {
    const validatedCredentials = credentialsSchema.parse(credentials)
    return ok(validatedCredentials)
  }
  catch (error) {
    if (error instanceof z.ZodError) {
      const formattedError = new Error(
        `Credentials validation failed:\n${error.issues
          .map((e: z.core.$ZodIssue) => `- ${e.path.join('.')}: ${e.message}`)
          .join('\n')}`,
      )
      return err(formattedError)
    }
    return err(error instanceof Error ? error : new Error('Unknown validation error'))
  }
}

export const schemas = {
  auth: authSchema,
  endpointDefinition: endpointDefinitionSchema,
  typeMapping: typeMappingSchema,
  entityConfig: entityConfigSchema,
  baseConfig: baseConfigSchema,
  apiConfig: apiConfigSchema,
  jsonConfig: jsonConfigSchema,
  junitConfig: junitConfigSchema,
  config: configSchema,
  credentials: credentialsSchema,
}
