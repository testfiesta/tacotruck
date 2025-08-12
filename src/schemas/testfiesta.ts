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

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type CreateProjectResponseData = z.infer<typeof createProjectResponseDataSchema>
