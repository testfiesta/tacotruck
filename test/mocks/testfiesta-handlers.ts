import type { CreateProjectOutput } from '../../src/schemas/testfiesta'
import { http, HttpResponse } from 'msw'

const mockProject: CreateProjectOutput = {
  uid: 123,
  key: 'TEST_PROJECT',
  name: 'Test Project',
  customFields: {},
}

const _mockRun = {
  id: 'run-456',
  name: 'Test Run',
  projectKey: 'TEST_PROJECT',
  status: 'completed',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const _mockMilestone = {
  uid: 789,
  name: 'Test Milestone',
  startDate: new Date().toISOString(),
  dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
  status: 1,
  description: 'Test milestone description',
}

const BASE_URL = 'https://api.testfiesta.com/v1/:handle'

export const testfiestaHandlers = [
  http.get(`${BASE_URL}/projects`, ({ request }) => {
    const url = new URL(request.url)
    const limit = Number.parseInt(url.searchParams.get('limit') || '10')
    const offset = Number.parseInt(url.searchParams.get('offset') || '0')

    return HttpResponse.json({
      data: Array.from({ length: Math.min(limit, 5) }).map((_, i) => ({
        ...mockProject,
        uid: offset + i + 1,
        key: `TEST_PROJECT_${offset + i + 1}`,
        name: `Test Project ${offset + i + 1}`,
      })),
      pagination: {
        limit,
        offset,
        total: 25,
        hasMore: offset + limit < 25,
      },
    })
  }),
]
