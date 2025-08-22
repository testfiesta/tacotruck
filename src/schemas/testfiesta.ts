import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  customFields: z.object().default({}),
})

export const createProjectResponseDataSchema = z.object({
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

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type CreateProjectResponseData = z.infer<typeof createProjectResponseDataSchema>
export type CreateTestRunInput = z.infer<typeof createTestRunInputSchema>
export type CreateMilestoneInput = z.infer<typeof createMilestoneInputSchema>
