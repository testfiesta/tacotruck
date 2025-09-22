import type { CreateProjectOutput } from '../../src/schemas/testfiesta'
import { http, HttpResponse } from 'msw'

const mockProject: CreateProjectOutput = {
  uid: 123,
  key: 'DEMOPRJ',
  name: 'Demo Project',
  customFields: {},
}

const mockRun = {
  uid: 252,
  name: 'Release v1.6.9',
  description: null,
  entityTypes: null,
  parentUid: null,
  projectUid: 1,
  createdAt: '2025-09-11T06:50:48.990Z',
  updatedAt: '2025-09-22T06:50:45.392Z',
  archivedAt: null,
  deletedAt: null,
  systemType: 'run',
  slug: null,
  customFields: {
    dueAt: '2025-11-30T06:50:48.990Z',
    status: 12,
    priority: 9,
    progress: 57,
    caseCount: 88,
    frequency: {
      1: 17,
      2: 24,
      3: 21,
      4: 26,
    },
  },
  externalCreatedAt: null,
  externalUpdatedAt: null,
  externalId: null,
  source: null,
  integrationUid: null,
  position: null,
  path: null,
  aggregates: {},
  createdBy: null,
}

const mockMilestone = {
  uid: 383,
  name: 'Sprint v1.0.0',
  description: null,
  entityTypes: null,
  parentUid: null,
  projectUid: 1,
  createdAt: '2025-06-14T06:50:51.591Z',
  updatedAt: '2025-09-22T06:50:45.392Z',
  archivedAt: '2025-09-22T06:50:51.599Z',
  deletedAt: null,
  systemType: 'milestone',
  slug: null,
  customFields: {
    dueAt: '2025-09-27T23:59:59.999Z',
    status: 23,
    tagUids: [3],
    progress: 100,
    syncedAt: '2025-09-22T06:50:51.591Z',
    frequency: {
      1: 1123,
      2: 1229,
      3: 1158,
      4: 1094,
    },
    startDate: '2025-09-22T00:00:00.000Z',
  },
  externalCreatedAt: null,
  externalUpdatedAt: null,
  externalId: null,
  source: null,
  integrationUid: null,
  position: null,
  path: null,
  aggregates: {},
  createdBy: null,
}

const mockCase = {
  uid: 1345,
  projectUid: 1,
  repoUid: null,
  externalId: '',
  source: '',
  name: 'WCAG-015: Timed responses provide sufficient warning',
  link: null,
  steps: [
    {
      id: 1,
      title: 'Log In and Wait',
      shared: false,
      children: [],
      description: 'Log into the application and remain inactive',
    },
    {
      id: 2,
      title: 'Wait for Warning',
      shared: false,
      children: [],
      description: 'Wait for session timeout warning to appear',
    },
    {
      id: 3,
      title: 'Verify Warning Time',
      shared: false,
      children: [],
      description: 'Verify warning appears with sufficient time to respond (at least 20 seconds)',
    },
    {
      id: 4,
      title: 'Test Session Extension',
      shared: false,
      children: [],
      description: 'Verify option to extend session is provided and functions correctly',
    },
  ],
  customFields: {
    expectedResultByStep: false,
    expectedResult: 'Users are warned before session timeouts and can extend their sessions',
  },
  testCaseRef: 1345,
  testCaseTemplateUid: null,
  version: 1,
  active: true,
  externalCreatedAt: null,
  externalUpdatedAt: null,
  createdAt: '2025-05-11T06:50:45.516Z',
  updatedAt: '2025-09-22T06:50:45.392Z',
  deletedAt: null,
  createdBy: '3135458a-e129-45fc-8e61-31d72c102e39',
  status: 24,
  priority: 3,
  syncedAt: null,
  parentUid: 182,
  event: null,
  testResultTemplateUid: null,
  tags: [
    {
      uid: 1,
      name: 'automated',
      description: null,
      entityTypes: ['cases', 'executions', 'runs', 'plans', 'milestones'],
      parentUid: null,
      projectUid: null,
      createdAt: '2025-09-22T06:50:26.211Z',
      updatedAt: '2025-09-22T06:50:26.211Z',
      archivedAt: null,
      deletedAt: null,
      systemType: 'tag',
      slug: null,
      customFields: null,
      externalCreatedAt: null,
      externalUpdatedAt: null,
      externalId: null,
      source: null,
      integrationUid: null,
      position: null,
      path: null,
      aggregates: {},
      createdBy: null,
    },
    {
      uid: 2,
      name: 'unit',
      description: null,
      entityTypes: ['cases', 'executions', 'runs', 'plans', 'milestones'],
      parentUid: null,
      projectUid: null,
      createdAt: '2025-09-22T06:50:26.211Z',
      updatedAt: '2025-09-22T06:50:26.211Z',
      archivedAt: null,
      deletedAt: null,
      systemType: 'tag',
      slug: null,
      customFields: null,
      externalCreatedAt: null,
      externalUpdatedAt: null,
      externalId: null,
      source: null,
      integrationUid: null,
      position: null,
      path: null,
      aggregates: {},
      createdBy: null,
    },
    {
      uid: 3,
      name: 'functional',
      description: null,
      entityTypes: ['cases', 'executions', 'runs', 'plans', 'milestones'],
      parentUid: null,
      projectUid: null,
      createdAt: '2025-09-22T06:50:26.211Z',
      updatedAt: '2025-09-22T06:50:26.211Z',
      archivedAt: null,
      deletedAt: null,
      systemType: 'tag',
      slug: null,
      customFields: null,
      externalCreatedAt: null,
      externalUpdatedAt: null,
      externalId: null,
      source: null,
      integrationUid: null,
      position: null,
      path: null,
      aggregates: {},
      createdBy: null,
    },
  ],
}

const BASE_URL = 'https://api.testfiesta.com/v1/:handle'

export const testfiestaHandlers = [
  http.get(`${BASE_URL}/projects`, ({ request }) => {
    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get('limit') || '10')
    const offset = Number.parseInt(url.searchParams.get('offset') || '0')

    const items = Array.from({ length: Math.min(limit, 5) }).map((_, i) => ({
      ...mockProject,
      uid: offset + i + 1,
      key: `TEST_PROJECT_${offset + i + 1}`,
      name: `Test Project ${offset + i + 1}`,
    }))

    return HttpResponse.json({
      count: 25,
      items,
      nextOffset: offset + limit < 25 ? offset + limit : null,
    })
  }),

  http.get(`${BASE_URL}/projects/:projectKey/cases`, ({ request, params }) => {
    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get('limit') || '10')
    const offset = Number.parseInt(url.searchParams.get('offset') || '0')
    const { projectKey: _projectKey } = params

    const items = Array.from({ length: Math.min(limit, 10) }).map((_, i) => ({
      ...mockCase,
      uid: offset + i + 1345,
      projectUid: 1,
      externalId: `tc_${(offset + i + 1).toString().padStart(4, '0')}`,
      name: i === 0 ? mockCase.name : `${mockCase.name} - Case ${offset + i + 1}`,
      testCaseRef: offset + i + 1345,
      parentUid: 182 + i,
      createdBy: mockCase.createdBy,
      updatedAt: new Date().toISOString(),
      steps: mockCase.steps.map(step => ({
        ...step,
        id: step.id + (i * 10),
      })),
    }))

    return HttpResponse.json({
      count: 1355,
      items,
      nextOffset: offset + limit < 1355 ? offset + limit : null,
    })
  }),

  http.get(`${BASE_URL}/projects/:projectKey/cases/:uid`, ({ params }) => {
    const { projectKey: _projectKey, uid } = params
    const caseUid = Number.parseInt(uid as string)

    return HttpResponse.json({
      ...mockCase,
      uid: caseUid,
      name: caseUid === 1345 ? mockCase.name : `${mockCase.name} - Case ${caseUid}`,
      testCaseRef: caseUid,
      externalId: `tc_${caseUid.toString().padStart(4, '0')}`,
      updatedAt: new Date().toISOString(),
    })
  }),

  http.get(`${BASE_URL}/projects/:projectKey/runs`, ({ request, params }) => {
    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get('limit') || '10')
    const offset = Number.parseInt(url.searchParams.get('offset') || '0')
    const { projectKey: _projectKey } = params

    const totalRuns = 100 // Total number of runs available
    const actualItemCount = Math.min(limit, Math.max(0, totalRuns - offset))
    const items = Array.from({ length: actualItemCount }).map((_, i) => ({
      ...mockRun,
      uid: offset + i + 252,
      name: i === 0 ? mockRun.name : `Release v1.6.${9 + i} - Run ${offset + i + 1}`,
      customFields: {
        ...mockRun.customFields,
        progress: Math.min(100, 57 + (i * 5)),
        caseCount: 88 + (i * 2),
      },
      updatedAt: new Date().toISOString(),
    }))

    return HttpResponse.json({
      count: totalRuns,
      items,
      nextOffset: offset + limit < totalRuns ? offset + limit : null,
    })
  }),

  http.get(`${BASE_URL}/projects/:projectKey/runs/:runId`, ({ params }) => {
    const { projectKey: _projectKey, runId } = params
    const runUid = Number.parseInt(runId as string)

    return HttpResponse.json({
      ...mockRun,
      uid: runUid,
      name: runUid === 252 ? mockRun.name : `Release v1.6.${9 + (runUid - 252)} - Run ${runUid}`,
      customFields: {
        ...mockRun.customFields,
        progress: Math.min(100, 57 + ((runUid - 252) * 5)),
        caseCount: 88 + ((runUid - 252) * 2),
      },
      updatedAt: new Date().toISOString(),
    })
  }),

  http.get(`${BASE_URL}/projects/:projectKey/milestones`, ({ request, params }) => {
    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get('limit') || '10')
    const offset = Number.parseInt(url.searchParams.get('offset') || '0')
    const { projectKey: _projectKey } = params

    const totalMilestones = 100
    const actualItemCount = Math.min(limit, Math.max(0, totalMilestones - offset))
    const items = Array.from({ length: actualItemCount }).map((_, i) => ({
      ...mockMilestone,
      uid: offset + i + 383,
      name: i === 0 ? mockMilestone.name : `Sprint v1.${i}.${offset + i} - Milestone ${offset + i + 1}`,
      customFields: {
        ...mockMilestone.customFields,
        progress: Math.max(0, Math.min(100, 100 - (i * 10))), // Decreasing progress
        status: 23 - (i % 3),
        tagUids: [3, 4, 5].slice(0, (i % 3) + 1),
        frequency: {
          1: 1123 + (i * 50),
          2: 1229 + (i * 60),
          3: 1158 + (i * 40),
          4: 1094 + (i * 30),
        },
      },
      updatedAt: new Date().toISOString(),
    }))

    return HttpResponse.json({
      count: totalMilestones,
      items,
      nextOffset: offset + limit < totalMilestones ? offset + limit : null,
    })
  }),

  http.get(`${BASE_URL}/projects/:projectKey/milestones/:milestoneId`, ({ params }) => {
    const { projectKey: _projectKey, milestoneId } = params
    const milestoneUid = Number.parseInt(milestoneId as string)

    return HttpResponse.json({
      ...mockMilestone,
      uid: milestoneUid,
      name: milestoneUid === 383 ? mockMilestone.name : `Sprint v1.${milestoneUid - 383}.0 - Milestone ${milestoneUid}`,
      customFields: {
        ...mockMilestone.customFields,
        progress: Math.max(0, Math.min(100, 100 - ((milestoneUid - 383) * 5))),
        status: 23 - ((milestoneUid - 383) % 3),
        tagUids: [3, 4, 5].slice(0, ((milestoneUid - 383) % 3) + 1),
        frequency: {
          1: 1123 + ((milestoneUid - 383) * 50),
          2: 1229 + ((milestoneUid - 383) * 60),
          3: 1158 + ((milestoneUid - 383) * 40),
          4: 1094 + ((milestoneUid - 383) * 30),
        },
      },
      updatedAt: new Date().toISOString(),
    })
  }),
]
