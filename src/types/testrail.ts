import { z } from 'zod'

export const testResultsSchema = z.object({
  root: z.object({
    name: z.string(),
  }),
  sections: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    parent_id: z.string().nullable(),
  })),
  cases: z.array(z.object({
    id: z.string(),
    title: z.string(),
    section_id: z.string(),
  })),
  results: z.array(z.object({
    case_id: z.number().or(z.string()),
    status_id: z.number().min(1).max(5),
    comment: z.string().optional(),
    version: z.string().optional(),
    elapsed: z.string().optional(),
    defects: z.string().optional(),
  })),
})

export const createSuiteSchema = z.object({
  name: z.string().min(1),
})

export const createSuiteResponseDataSchema = z.object({
  id: z.number(),
  name: z.string(),
})

export const createSectionResponseDataSchema = z.object({
  id: z.number(),
  name: z.string(),
})

export const createProjectSchema = z.object({
  name: z.string().min(1),
  suite_mode: z.number().min(1).max(3),
})

export const createSectionSchema = z.object({
  name: z.string().min(1),
  suite_id: z.number().nullable().optional(),
})

export const createCaseSchema = z.object({
  title: z.string().min(1),
})

export const createResultSchema = z.object({
  results: z.array(z.object({
    case_id: z.number().or(z.string()),
    status_id: z.number().min(1).max(5),
    comment: z.string().optional(),
    defects: z.string().optional(),
  })),
})

export const createRunSchema = z.object({
  name: z.string().min(1),
  case_ids: z.array(z.number()),
  include_all: z.boolean(),
  suite_id: z.number().nullable().optional(),
})

export type CreateSectionResponseData = z.infer<typeof createSectionResponseDataSchema>
export type CreateSuiteResponseData = z.infer<typeof createSuiteResponseDataSchema>
export type CreateSuiteInput = z.infer<typeof createSuiteSchema>
export type TestResults = z.infer<typeof testResultsSchema>
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type CreateSectionInput = z.infer<typeof createSectionSchema>
export type CreateCaseInput = z.infer<typeof createCaseSchema>
export type CreateResultInput = z.infer<typeof createResultSchema>
export type CreateRunInput = z.infer<typeof createRunSchema>

export interface GetProjectResponseData {
  id: number
  name: string
  suite_mode: number
}

export interface TestRailClientOptions {
  baseUrl: string
  username: string
  password: string
}
