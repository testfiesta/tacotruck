import { z } from 'zod'

export const TestResultsSchema = z.object({
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

export const CreateSuiteSchema = z.object({
  name: z.string().min(1),
})

export const CreateSuiteResponseDataSchema = z.object({
  id: z.number(),
  name: z.string(),
})
export const GetSuitesResponseDataSchema = z.object({
  suites: z.array(z.object({
    id: z.number(),
    name: z.string(),
  })),
})

export const CreateSectionResponseDataSchema = z.object({
  id: z.number(),
  name: z.string(),
})

export const CreateProjectSchema = z.object({
  name: z.string().min(1),
  suite_mode: z.number().min(1).max(3),
})

export const GetProjectResponseDataSchema = z.object({
  id: z.number(),
  name: z.string(),
  suite_mode: z.number(),
})

export const CreateSectionSchema = z.object({
  name: z.string().min(1),
  suite_id: z.number().nullable().optional(),
})

export const CreateCaseSchema = z.object({
  title: z.string().min(1),
})

export const CreateResultSchema = z.object({
  results: z.array(z.object({
    case_id: z.number().or(z.string()),
    status_id: z.number().min(1).max(5),
    comment: z.string().optional(),
    defects: z.string().optional(),
  })),
})

export const CreateRunSchema = z.object({
  name: z.string().min(1),
  case_ids: z.array(z.number()),
  include_all: z.boolean(),
  suite_id: z.number().nullable().optional(),
})

export type GetProjectResponseData = z.infer<typeof GetProjectResponseDataSchema>
export type CreateSectionResponseData = z.infer<typeof CreateSectionResponseDataSchema>
export type CreateSuiteResponseData = z.infer<typeof CreateSuiteResponseDataSchema>
export type CreateSuiteInput = z.infer<typeof CreateSuiteSchema>
export type TestResults = z.infer<typeof TestResultsSchema>
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>
export type CreateSectionInput = z.infer<typeof CreateSectionSchema>
export type CreateCaseInput = z.infer<typeof CreateCaseSchema>
export type CreateResultInput = z.infer<typeof CreateResultSchema>
export type CreateRunInput = z.infer<typeof CreateRunSchema>
export type GetSuitesResponseData = z.infer<typeof GetSuitesResponseDataSchema>
