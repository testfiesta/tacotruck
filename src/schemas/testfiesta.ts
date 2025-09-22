import { z } from 'zod'

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
  status: z.number().min(1),
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
  startDate: z.string().min(1),
  dueAt: z.string().min(1),
  status: z.number().min(1),
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
  entityTypes: z.array(z.string()).optional(),
})

export const updateTagInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  entityTypes: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>
export type CreateProjectOutput = z.infer<typeof createProjectOutputSchema>
export type CreateTestRunInput = z.infer<typeof createTestRunInputSchema>
export type CreateMilestoneInput = z.infer<typeof createMilestoneInputSchema>
export type CreateCaseInput = z.infer<typeof createCaseInputSchema>
export type CreateFolderInput = z.infer<typeof createFolderInputSchema>
export type UpdateFolderInput = z.infer<typeof updateFolderInputSchema>
export type CreateTagInput = z.infer<typeof createTagInputSchema>
export type UpdateTagInput = z.infer<typeof updateTagInputSchema>
