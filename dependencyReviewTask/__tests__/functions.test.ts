import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('azure-pipelines-task-lib/task', () => ({
    debug: vi.fn(),
    warning: vi.fn(),
    setResult: vi.fn(),
    getVariable: vi.fn(),
    getInput: vi.fn(),
    getEndpointAuthorization: vi.fn(),
    TaskResult: { Succeeded: 0, Failed: 2, Skipped: 9 },
}))

vi.mock('azure-devops-node-api', () => ({
    getHandlerFromToken: vi.fn(() => ({})),
    WebApi: vi.fn(),
}))

import { getAlerts, checkAlertsForType } from '../index'

describe('getAlerts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns null for unknown alertType (type 2)', async () => {
        const mockConnection = { rest: { get: vi.fn() } }
        const result = await getAlerts(mockConnection as any, 'org', 'project', 'repo', 'main', 2)
        expect(result).toBeNull()
        expect(mockConnection.rest.get).not.toHaveBeenCalled()
    })

    it('returns null for alertType 0', async () => {
        const mockConnection = { rest: { get: vi.fn() } }
        const result = await getAlerts(mockConnection as any, 'org', 'project', 'repo', 'main', 0)
        expect(result).toBeNull()
    })

    it('calls REST API with correct URL for dependency alerts (type 1)', async () => {
        const mockGet = vi.fn().mockResolvedValue({ result: { count: 0, value: [] } })
        const mockConnection = { rest: { get: mockGet } }
        await getAlerts(mockConnection as any, 'myorg', 'myproject', 'repo-id', 'feature', 1)
        expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('criteria.alertType=1'))
        expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('myorg'))
        expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('feature'))
    })

    it('calls REST API with correct URL for code scanning alerts (type 3)', async () => {
        const mockGet = vi.fn().mockResolvedValue({ result: { count: 0, value: [] } })
        const mockConnection = { rest: { get: mockGet } }
        await getAlerts(mockConnection as any, 'org', 'proj', 'repo-id', 'main', 3)
        expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('criteria.alertType=3'))
    })

    it('returns the API response on success', async () => {
        const expected = { result: { count: 1, value: [{ alertId: 42, title: 'XSS' }] } }
        const mockGet = vi.fn().mockResolvedValue(expected)
        const mockConnection = { rest: { get: mockGet } }
        const result = await getAlerts(mockConnection as any, 'org', 'proj', 'repo', 'main', 1)
        expect(result).toEqual(expected)
    })

    it('returns undefined when API throws branch-does-not-exist error', async () => {
        const mockGet = vi.fn().mockRejectedValue(new Error('Branch does not exist'))
        const mockConnection = { rest: { get: mockGet } }
        const result = await getAlerts(mockConnection as any, 'org', 'proj', 'repo', 'new-branch', 1)
        expect(result).toBeUndefined()
    })

    it('returns undefined when API throws generic error', async () => {
        const mockGet = vi.fn().mockRejectedValue(new Error('Network failure'))
        const mockConnection = { rest: { get: mockGet } }
        const result = await getAlerts(mockConnection as any, 'org', 'proj', 'repo', 'main', 1)
        expect(result).toBeUndefined()
    })

    it('includes criteria.onlyDefaultBranchAlerts=true in URL', async () => {
        const mockGet = vi.fn().mockResolvedValue({ result: { count: 0, value: [] } })
        const mockConnection = { rest: { get: mockGet } }
        await getAlerts(mockConnection as any, 'org', 'proj', 'repo', 'main', 1)
        expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('criteria.onlyDefaultBranchAlerts=true'))
    })
})

describe('checkAlertsForType', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    function makeMockConnection(sourceAlerts: any[], targetAlerts: any[]) {
        const mockGet = vi.fn()
            .mockResolvedValueOnce({ result: { count: sourceAlerts.length, value: sourceAlerts } })
            .mockResolvedValueOnce({ result: { count: targetAlerts.length, value: targetAlerts } })
        return { rest: { get: mockGet } }
    }

    it('returns no new alerts when source branch has no alerts', async () => {
        const conn = makeMockConnection([], [])
        const result = await checkAlertsForType(conn as any, 'org', 'proj', 'repo', 1, 'feature', 'main')
        expect(result.newAlertsFound).toBe(false)
    })

    it('returns no new alerts when all source alerts exist on target', async () => {
        const conn = makeMockConnection(
            [{ alertId: 1, title: 'Alert A' }, { alertId: 2, title: 'Alert B' }],
            [{ alertId: 1, title: 'Alert A' }, { alertId: 2, title: 'Alert B' }]
        )
        const result = await checkAlertsForType(conn as any, 'org', 'proj', 'repo', 1, 'feature', 'main')
        expect(result.newAlertsFound).toBe(false)
    })

    it('returns new alerts when source has an alert not on target', async () => {
        const conn = makeMockConnection(
            [{ alertId: 1, title: 'Existing' }, { alertId: 99, title: 'New Vuln' }],
            [{ alertId: 1, title: 'Existing' }]
        )
        const result = await checkAlertsForType(conn as any, 'org', 'proj', 'repo', 1, 'feature', 'main')
        expect(result.newAlertsFound).toBe(true)
        expect(result.message).toContain('New Vuln')
    })

    it('includes alert URL in failure message', async () => {
        const conn = makeMockConnection(
            [{ alertId: 55, title: 'SQL Injection' }],
            []
        )
        const result = await checkAlertsForType(conn as any, 'myorg', 'myproject', 'repo-id', 1, 'feature-branch', 'main')
        expect(result.newAlertsFound).toBe(true)
        expect(result.message).toContain('55')
        expect(result.message).toContain('SQL Injection')
        expect(result.message).toContain('feature-branch')
    })

    it('uses "Code scanning" label for alertType 3', async () => {
        const conn = makeMockConnection(
            [{ alertId: 10, title: 'XSS' }],
            []
        )
        const result = await checkAlertsForType(conn as any, 'org', 'proj', 'repo', 3, 'feature', 'main')
        expect(result.message).toContain('Code scanning')
    })

    it('uses "Dependency" label for alertType 1', async () => {
        const conn = makeMockConnection(
            [{ alertId: 20, title: 'Vuln dep' }],
            []
        )
        const result = await checkAlertsForType(conn as any, 'org', 'proj', 'repo', 1, 'feature', 'main')
        expect(result.message).toContain('Dependency')
    })

    it('handles null source branch response', async () => {
        const mockGet = vi.fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ result: { count: 0, value: [] } })
        const conn = { rest: { get: mockGet } }
        const result = await checkAlertsForType(conn as any, 'org', 'proj', 'repo', 1, 'feature', 'main')
        expect(result.newAlertsFound).toBe(false)
    })
})
