import { z } from 'zod'

export const ENTITY_TYPES = ['roles', 'milestones', 'cases', 'plans', 'runs', 'defects', 'executions', 'results']
export const CUSTOM_FIELD_ENTITY_TYPES = ['testCase', 'testResult'] as const

export const createProjectInputSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  customFields: z.object().default({}),
})

export const createProjectOutputSchema = z.object({
  uid: z.number(),
  name: z.string(),
  key: z.string(),
  customFields: z.object().default({}),
})

export const createTestRunInputSchema = z.object({
  externalId: z.string().optional(),
  source: z.string().optional(),
  link: z.string().optional(),
  priority: z.number().optional(),
  status: z.number().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  dueAt: z.string().optional(),
  tagUids: z.array(z.number()).optional(),
  configs: z.array(z.string()).optional(),
  caseUids: z.array(z.number()).optional(),
  milestoneUids: z.array(z.number()).optional(),
})

export const createMilestoneInputSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().optional(),
  dueAt: z.string().optional(),
  status: z.number().optional(),
  description: z.string().optional(),
  planIds: z.array(z.number()).optional(),
  runIds: z.array(z.number()).optional(),
  tagUids: z.array(z.number()).optional(),
})
export const updateMilestoneInputSchema = z.object({
  name: z.string().optional(),
  startDate: z.string().optional(),
  dueAt: z.string().optional(),
  status: z.number().optional(),
  description: z.string().optional(),
  planIds: z.array(z.number()).optional(),
  runIds: z.array(z.number()).optional(),
  tagUids: z.array(z.number()).optional(),
})
export const createCaseInputSchema = z.object({
  name: z.string().min(1),
  projectId: z.string().min(1),
  source: z.string().min(1),
  parentId: z.number(),
  steps: z.array(z.any()).default([]).optional(),
  repoUID: z.string().default('').optional(),
  externalId: z.string().optional(),
  customFields: z.record(z.string(), z.any()).default({}).optional(),
})

export const createFolderInputSchema = z.object({
  name: z.string().min(1),
  externalId: z.string().optional(),
  source: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
  parentUid: z.number(),
  projectUid: z.number(),
  position: z.number().optional(),
  integrationUid: z.number().optional(),
})

export const updateFolderInputSchema = z.object({
  name: z.string().min(1).optional(),
  externalId: z.string().optional(),
  source: z.string().optional(),
  customFields: z.record(z.string(), z.any()).optional(),
  parentUid: z.number().optional(),
  projectUid: z.number().optional(),
  position: z.number().optional(),
  integrationUid: z.number().optional(),
})

export const createTagInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  entityTypes: z.array(z.string()).default(ENTITY_TYPES),
})

export const updateTagInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  entityTypes: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
})

export const templateFieldSchema = z.object({
  name: z.string().min(1),
  dataType: z.string().min(1),
})

export const ruleSchema = z.object({
  ruleId: z.string(),
  name: z.string(),
  statusIds: z.array(z.union([z.string(), z.number()])),
  manageTags: z.boolean(),
  createDefects: z.boolean(),
  isTemplateRule: z.boolean().optional(),
})

export const createTemplateInputSchema = z.object({
  name: z.string().min(1),
  templateFields: z.array(templateFieldSchema).optional(),
})

export const updateTemplateInputSchema = z.object({
  name: z.string().min(1).optional(),
  templateFields: z.array(templateFieldSchema).optional(),
})

export const templateResponseSchema = z.object({
  uid: z.number(),
  name: z.string(),
  createdBy: z.string(),
  customFields: z.union([
    z.object({
      templateFields: z.array(templateFieldSchema).optional(),
    }),
    z.array(templateFieldSchema),
  ]).optional(),
  projectUid: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  isDefault: z.boolean(),
  entityType: z.string(),
  rules: z.array(ruleSchema),
  externalId: z.string().nullable(),
  source: z.string().nullable(),
  integrationUid: z.number().nullable(),
})

export const templateListResponseSchema = z.object({
  count: z.number(),
  items: z.array(templateResponseSchema),
  nextOffset: z.number().nullable().optional(),
})

export const customFieldTypesSchema = z.enum([
  'multi',
  'radio',
  'link',
  'text',
  'checkbox',
  'date',
  'file',
  'step',
  'dropdown',
  'integer',
])

export const customFieldEntityTypesSchema = z.enum([
  'testCase',
  'testResult',
])

export const createCustomFieldInputSchema = z.object({
  name: z.string().min(1),
  type: customFieldTypesSchema.optional(),
  source: z.string().optional(),
  options: z.array(z.string()).optional(),
  entityTypes: z.array(customFieldEntityTypesSchema).optional(),
})

export const updateCustomFieldInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: customFieldTypesSchema.optional(),
  source: z.string().optional(),
  options: z.array(z.string()).optional(),
  entityTypes: z.array(customFieldEntityTypesSchema).optional(),
})

export const customFieldResponseSchema = z.object({
  uid: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: customFieldTypesSchema.nullable(),
  slug: z.string().nullable(),
  options: z.array(z.string()).nullable(),
  source: z.string().nullable(),
  externalId: z.string().nullable(),
  ownerUid: z.string().nullable(),
  ownerType: z.string().nullable(),
  projectUid: z.number(),
  entityTypes: z.array(customFieldEntityTypesSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
})

export const customFieldListResponseSchema = z.object({
  count: z.number(),
  items: z.array(customFieldResponseSchema),
  nextOffset: z.number().nullable().optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>
export type CreateProjectOutput = z.infer<typeof createProjectOutputSchema>
export type CreateTestRunInput = z.infer<typeof createTestRunInputSchema>
export type CreateMilestoneInput = z.infer<typeof createMilestoneInputSchema>
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneInputSchema>
export type CreateCaseInput = z.infer<typeof createCaseInputSchema>
export type CreateFolderInput = z.infer<typeof createFolderInputSchema>
export type UpdateFolderInput = z.infer<typeof updateFolderInputSchema>
export type CreateTagInput = z.infer<typeof createTagInputSchema>
export type UpdateTagInput = z.infer<typeof updateTagInputSchema>
export type TemplateField = z.infer<typeof templateFieldSchema>
export type Rule = z.infer<typeof ruleSchema>
export type CreateTemplateInput = z.infer<typeof createTemplateInputSchema>
export type UpdateTemplateInput = z.infer<typeof updateTemplateInputSchema>
export type TemplateResponse = z.infer<typeof templateResponseSchema>
export type TemplateListResponse = z.infer<typeof templateListResponseSchema>
export type CustomFieldTypes = z.infer<typeof customFieldTypesSchema>
export type CustomFieldEntityTypes = z.infer<typeof customFieldEntityTypesSchema>
export type CreateCustomFieldInput = z.infer<typeof createCustomFieldInputSchema>
export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldInputSchema>
export type CustomFieldResponse = z.infer<typeof customFieldResponseSchema>
export type CustomFieldListResponse = z.infer<typeof customFieldListResponseSchema>
