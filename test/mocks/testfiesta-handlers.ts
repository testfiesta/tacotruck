import type { CreateProjectOutput } from '../../src/schemas/testfiesta'

import { randomUUID } from 'node:crypto'

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

const mockFolder = {
  uid: 100,
  name: 'Test Cases Folder',
  description: null,
  entityTypes: ['cases'],
  parentUid: 5,
  projectUid: 1,
  createdAt: '2025-09-22T06:50:45.516Z',
  updatedAt: '2025-09-22T06:50:45.392Z',
  archivedAt: null,
  deletedAt: null,
  systemType: 'folder',
  slug: null,
  customFields: {
    time: 0.004178,
    tests: 25,
    errors: 0,
    skipped: 0,
    failures: 0,
    testcases: [],
  },
  externalCreatedAt: '2025-09-22T06:50:45.000Z',
  externalUpdatedAt: '2025-09-22T06:50:45.000Z',
  externalId: 'ts_42f7ae138512de96',
  source: 'junit-xml',
  integrationUid: null,
  position: null,
  path: null,
  aggregates: {},
  createdBy: null,
}

const mockTag = {
  uid: 1,
  name: 'automated',
  description: null,
  entityTypes: ['cases', 'executions', 'runs', 'plans', 'milestones'],
  parentUid: null,
  projectUid: null,
  createdAt: '2025-08-21T04:56:52.720Z',
  updatedAt: '2025-08-21T04:56:52.720Z',
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

  http.post(`${BASE_URL}/projects/:projectKey/cases`, async ({ request, params }) => {
    const { projectKey: _projectKey } = params
    const cases = await request.json() as any[]

    const createdCases = cases.map((caseData, index) => ({
      externalId: caseData.externalId || `${index + 1}`,
      source: caseData.source || 'github',
      name: caseData.name,
      customFields: (caseData.customFields && Object.keys(caseData.customFields).length > 0) ? caseData.customFields : null,
      projectUid: Number.parseInt(caseData.projectId) || 1,
      parentUid: caseData.parentId,
      repoUid: caseData.repoUID ? Number.parseInt(caseData.repoUID) : null,
      priority: 1,
      active: true,
      version: 1,
      createdBy: randomUUID(),
      uid: 1362 + index, // Sequential UIDs starting from 1362
      testCaseRef: 1362 + index,
      steps: caseData.steps || [],
      event: null,
      link: null,
      testCaseTemplateUid: null,
      externalCreatedAt: null,
      externalUpdatedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      status: null,
      syncedAt: null,
      testResultTemplateUid: null,
    }))

    return HttpResponse.json(createdCases)
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

  http.get(`${BASE_URL}/projects/:projectKey/folders`, ({ request, params }) => {
    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get('limit') || '10')
    const offset = Number.parseInt(url.searchParams.get('offset') || '0')
    const { projectKey: _projectKey } = params

    const totalFolders = 217
    const actualItemCount = Math.min(limit, Math.max(0, totalFolders - offset))
    const items = Array.from({ length: actualItemCount }).map((_, i) => ({
      ...mockFolder,
      uid: offset + i + 100,
      name: i === 0 ? mockFolder.name : `Test Folder ${offset + i + 1}`,
      externalId: `folder-${randomUUID().substring(0, 8)}`,
      customFields: {
        time: 0.004178 + (i * 0.001),
        tests: 25 + (i * 5),
        errors: 0,
        skipped: 0,
        failures: 0,
        testcases: [],
      },
      externalCreatedAt: new Date().toISOString(),
      externalUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

    return HttpResponse.json({
      count: totalFolders,
      items,
      nextOffset: offset + limit < totalFolders ? offset + limit : null,
    })
  }),

  http.get(`${BASE_URL}/projects/:projectKey/folders/:folderId`, ({ params }) => {
    const { projectKey: _projectKey, folderId } = params
    const folderUid = Number.parseInt(folderId as string)

    return HttpResponse.json({
      ...mockFolder,
      uid: folderUid,
      name: folderUid === 100 ? mockFolder.name : `Test Folder ${folderUid}`,
      externalId: `folder-${randomUUID().substring(0, 8)}`,
      customFields: {
        time: 0.004178 + ((folderUid - 100) * 0.001),
        tests: 25 + ((folderUid - 100) * 5),
        errors: 0,
        skipped: 0,
        failures: 0,
        testcases: [],
      },
      externalCreatedAt: new Date().toISOString(),
      externalUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }),

  http.post(`${BASE_URL}/projects/:projectKey/folders`, async ({ request, params }) => {
    const { projectKey: _projectKey } = params
    const folderData = await request.json() as any

    return HttpResponse.json({
      uid: 150,
      name: folderData.name,
      slug: folderData.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
      source: folderData.source || null,
      externalId: folderData.externalId || null,
      parentUid: folderData.parentUid !== undefined ? folderData.parentUid : null,
      customFields: folderData.customFields || null,
      projectUid: folderData.projectUid,
      entityTypes: ['cases'],
      systemType: 'folder',
      position: folderData.position || null,
      path: `${folderData.parentUid !== undefined ? folderData.parentUid : 5}.150`,
      integrationUid: folderData.integrationUid || null,
      description: folderData.description || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archivedAt: null,
      deletedAt: null,
      externalCreatedAt: null,
      externalUpdatedAt: null,
      aggregates: {},
      createdBy: null,
    })
  }),

  http.put(`${BASE_URL}/projects/:projectKey/folders/:folderId`, async ({ request, params }) => {
    const { projectKey: _projectKey, folderId } = params
    const folderUid = Number.parseInt(folderId as string)
    const updateData = await request.json() as any

    // Create a merged object that properly handles partial updates
    const updatedFolder = {
      ...mockFolder,
      uid: folderUid,
      name: updateData.name !== undefined ? updateData.name : mockFolder.name,
      description: updateData.description !== undefined ? updateData.description : mockFolder.description,
      parentUid: updateData.parentUid !== undefined ? updateData.parentUid : mockFolder.parentUid,
      projectUid: updateData.projectUid !== undefined ? updateData.projectUid : mockFolder.projectUid,
      customFields: updateData.customFields !== undefined ? updateData.customFields : mockFolder.customFields,
      externalId: updateData.externalId !== undefined ? updateData.externalId : mockFolder.externalId,
      source: updateData.source !== undefined ? updateData.source : mockFolder.source,
      integrationUid: updateData.integrationUid !== undefined ? updateData.integrationUid : mockFolder.integrationUid,
      position: updateData.position !== undefined ? updateData.position : mockFolder.position,
      externalCreatedAt: new Date().toISOString(),
      externalUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return HttpResponse.json(updatedFolder)
  }),

  http.delete(`${BASE_URL}/projects/:projectKey/folders/:folderId`, ({ params }) => {
    const { projectKey: _projectKey, folderId } = params
    const folderUid = Number.parseInt(folderId as string)

    return HttpResponse.json({
      success: true,
      message: `Folder ${folderUid} deleted successfully`,
    })
  }),

  http.get(`${BASE_URL}/tags`, ({ request }) => {
    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get('limit') || '10')
    const offset = Number.parseInt(url.searchParams.get('offset') || '0')

    const tagNames = ['automated', 'unit', 'functional', 'exploratory']
    const totalTags = 4
    const actualItemCount = Math.min(limit, Math.max(0, totalTags - offset))
    const items = Array.from({ length: actualItemCount }).map((_, i) => ({
      ...mockTag,
      uid: offset + i + 1,
      name: tagNames[offset + i] || `tag-${offset + i + 1}`,
      slug: null,
      description: null,
      updatedAt: '2025-08-21T04:56:52.720Z',
    }))

    return HttpResponse.json({
      count: totalTags,
      items,
      nextOffset: offset + actualItemCount < totalTags ? offset + actualItemCount : null,
    })
  }),

  http.get(`${BASE_URL}/tags/:tagId`, ({ params }) => {
    const { tagId } = params
    const tagUid = Number.parseInt(tagId as string)

    const tagNames = ['automated', 'unit', 'functional', 'exploratory']
    const tagName = tagNames[tagUid - 1] || `tag-${tagUid}`

    return HttpResponse.json({
      ...mockTag,
      uid: tagUid,
      name: tagName,
      slug: null,
      description: null,
      updatedAt: '2025-08-21T04:56:52.720Z',
    })
  }),

  http.post(`${BASE_URL}/tags`, async ({ request }) => {
    const tagData = await request.json() as any

    return HttpResponse.json({
      uid: 200,
      name: tagData.name,
      slug: null,
      description: tagData.description || null,
      entityTypes: tagData.entityTypes || ['cases', 'executions', 'runs', 'plans', 'milestones'],
      parentUid: null,
      projectUid: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archivedAt: null,
      deletedAt: null,
      systemType: 'tag',
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
    })
  }),

  http.put(`${BASE_URL}/tags/:tagId`, async ({ request, params }) => {
    const { tagId } = params
    const tagUid = Number.parseInt(tagId as string)
    const updateData = await request.json() as any

    // Create a merged object that properly handles partial updates
    const updatedTag = {
      ...mockTag,
      uid: tagUid,
      name: updateData.name !== undefined ? updateData.name : mockTag.name,
      slug: null,
      description: updateData.description !== undefined ? updateData.description : mockTag.description,
      entityTypes: updateData.entityTypes !== undefined ? updateData.entityTypes : mockTag.entityTypes,
      archivedAt: updateData.archived !== undefined ? (updateData.archived ? new Date().toISOString() : null) : mockTag.archivedAt,
      updatedAt: new Date().toISOString(),
    }

    return HttpResponse.json(updatedTag)
  }),

  http.delete(`${BASE_URL}/tags/:tagId`, ({ params }) => {
    const { tagId } = params
    const tagUid = Number.parseInt(tagId as string)

    return HttpResponse.json({
      success: true,
      message: `Tag ${tagUid} deleted successfully`,
    })
  }),
]
