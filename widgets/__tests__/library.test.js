import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import vm from 'vm'

function loadLibrary() {
    const code = readFileSync(resolve(__dirname, '..', 'library.js'), 'utf-8')

    const sandbox = {
        console: { log: vi.fn(), error: vi.fn() },
        fetch: vi.fn(),
        document: { querySelector: vi.fn() },
        VSS: {
            require: vi.fn(),
            getAccessToken: vi.fn(),
            getWebContext: vi.fn(),
            getExtensionContext: vi.fn(),
            getService: vi.fn(),
            ServiceIds: { ExtensionData: 'ExtensionData' },
        },
    }

    vm.createContext(sandbox)
    vm.runInContext(code, sandbox)
    return sandbox
}

describe('AlertType', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('DEPENDENCY has correct properties', () => {
        const dep = lib.GetAlertTypeFromValue("1")
        expect(dep.name).toBe('dependency')
        expect(dep.value).toBe(1)
        expect(dep.display).toBe('Dependency')
        expect(dep.displayPlural).toBe('dependencies')
    })

    it('SECRET has correct properties', () => {
        const secret = lib.GetAlertTypeFromValue("2")
        expect(secret.name).toBe('secret')
        expect(secret.value).toBe(2)
        expect(secret.display).toBe('Secret')
        expect(secret.displayPlural).toBe('secrets')
    })

    it('CODE has correct properties', () => {
        const code = lib.GetAlertTypeFromValue("3")
        expect(code.name).toBe('code')
        expect(code.value).toBe(3)
        expect(code.display).toBe('Code scanning')
        expect(code.displayPlural).toBe('code')
    })
})

describe('GetAlertTypeFromValue', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns DEPENDENCY for "1"', () => {
        const result = lib.GetAlertTypeFromValue("1")
        expect(result.name).toBe('dependency')
        expect(result.value).toBe(1)
    })

    it('returns SECRET for "2"', () => {
        const result = lib.GetAlertTypeFromValue("2")
        expect(result.name).toBe('secret')
    })

    it('returns CODE for "3"', () => {
        const result = lib.GetAlertTypeFromValue("3")
        expect(result.name).toBe('code')
    })

    it('returns null for unknown value', () => {
        expect(lib.GetAlertTypeFromValue("99")).toBeNull()
    })

    it('returns null for numeric 1 (expects string)', () => {
        expect(lib.GetAlertTypeFromValue(1)).toBeNull()
    })
})

describe('checkAlertActiveOnDate', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns true when alert is active on the given date', () => {
        const alert = { firstSeenDate: '2024-01-01T00:00:00Z' }
        expect(lib.checkAlertActiveOnDate(alert, '2024-01-15')).toBe(true)
    })

    it('returns false when alert was not yet seen', () => {
        const alert = { firstSeenDate: '2024-02-01T00:00:00Z' }
        expect(lib.checkAlertActiveOnDate(alert, '2024-01-15')).toBe(false)
    })

    it('returns false when alert was fixed before the date', () => {
        const alert = {
            firstSeenDate: '2024-01-01T00:00:00Z',
            fixedDate: '2024-01-10T00:00:00Z',
        }
        expect(lib.checkAlertActiveOnDate(alert, '2024-01-15')).toBe(false)
    })

    it('returns true when alert was fixed after the date', () => {
        const alert = {
            firstSeenDate: '2024-01-01T00:00:00Z',
            fixedDate: '2024-01-20T00:00:00Z',
        }
        expect(lib.checkAlertActiveOnDate(alert, '2024-01-15')).toBe(true)
    })

    it('returns false when alert was dismissed before the date', () => {
        const alert = {
            firstSeenDate: '2024-01-01T00:00:00Z',
            dismissal: { requestedOn: '2024-01-10T00:00:00Z' },
        }
        expect(lib.checkAlertActiveOnDate(alert, '2024-01-15')).toBe(false)
    })

    it('returns true when alert was dismissed after the date', () => {
        const alert = {
            firstSeenDate: '2024-01-01T00:00:00Z',
            dismissal: { requestedOn: '2024-01-20T00:00:00Z' },
        }
        expect(lib.checkAlertActiveOnDate(alert, '2024-01-15')).toBe(true)
    })

    it('returns true on the exact firstSeenDate', () => {
        const alert = { firstSeenDate: '2024-01-15T00:00:00Z' }
        expect(lib.checkAlertActiveOnDate(alert, '2024-01-15')).toBe(true)
    })
})

describe('checkAlertDismissedOnDate', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns false when alert has no dismissal', () => {
        const alert = { firstSeenDate: '2024-01-01T00:00:00Z' }
        expect(lib.checkAlertDismissedOnDate(alert, '2024-01-15')).toBe(false)
    })

    it('returns true when alert was dismissed before the date', () => {
        const alert = {
            firstSeenDate: '2024-01-01T00:00:00Z',
            dismissal: { requestedOn: '2024-01-10T00:00:00Z' },
        }
        expect(lib.checkAlertDismissedOnDate(alert, '2024-01-15')).toBe(true)
    })

    it('returns false when alert was dismissed after the date', () => {
        const alert = {
            firstSeenDate: '2024-01-01T00:00:00Z',
            dismissal: { requestedOn: '2024-01-20T00:00:00Z' },
        }
        expect(lib.checkAlertDismissedOnDate(alert, '2024-01-15')).toBe(false)
    })

    it('returns false when alert was not yet seen', () => {
        const alert = {
            firstSeenDate: '2024-02-01T00:00:00Z',
            dismissal: { requestedOn: '2024-02-05T00:00:00Z' },
        }
        expect(lib.checkAlertDismissedOnDate(alert, '2024-01-15')).toBe(false)
    })

    it('returns false when alert was already fixed', () => {
        const alert = {
            firstSeenDate: '2024-01-01T00:00:00Z',
            fixedDate: '2024-01-05T00:00:00Z',
            dismissal: { requestedOn: '2024-01-10T00:00:00Z' },
        }
        expect(lib.checkAlertDismissedOnDate(alert, '2024-01-15')).toBe(false)
    })
})

describe('checkAlertFixedOnDate', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns falsy when alert has no fixedDate', () => {
        const alert = { firstSeenDate: '2024-01-01T00:00:00Z' }
        expect(lib.checkAlertFixedOnDate(alert, '2024-01-15')).toBeFalsy()
    })

    it('returns true when alert was fixed before the date', () => {
        const alert = {
            firstSeenDate: '2024-01-01T00:00:00Z',
            fixedDate: '2024-01-10T00:00:00Z',
        }
        expect(lib.checkAlertFixedOnDate(alert, '2024-01-15')).toBe(true)
    })

    it('returns false when alert was fixed after the date', () => {
        const alert = {
            firstSeenDate: '2024-01-01T00:00:00Z',
            fixedDate: '2024-01-20T00:00:00Z',
        }
        expect(lib.checkAlertFixedOnDate(alert, '2024-01-15')).toBe(false)
    })

    it('returns false when alert was not yet seen', () => {
        const alert = {
            firstSeenDate: '2024-02-01T00:00:00Z',
            fixedDate: '2024-02-05T00:00:00Z',
        }
        expect(lib.checkAlertFixedOnDate(alert, '2024-01-15')).toBe(false)
    })
})

describe('getAlertsTrendLine', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns an array of counts for each day', () => {
        const alerts = [
            { alertType: 'dependency', firstSeenDate: '2024-01-01T00:00:00Z' },
        ]
        const result = lib.getAlertsTrendLine(alerts, 'dependency', 3, 1, 'open')
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBeGreaterThanOrEqual(3)
    })

    it('returns all zeros when no alerts exist', () => {
        const result = lib.getAlertsTrendLine([], 'dependency', 3, 1, 'open')
        expect(result.every(v => v === 0)).toBe(true)
    })

    it('counts active alerts correctly for open filter', () => {
        const today = new Date().toISOString()
        const alerts = [
            { alertType: 'secret', firstSeenDate: '2020-01-01T00:00:00Z' },
            { alertType: 'secret', firstSeenDate: '2020-01-01T00:00:00Z' },
        ]
        const result = lib.getAlertsTrendLine(alerts, 'secret', 1, 1, 'open')
        // both alerts should be active on all days
        expect(result[result.length - 1]).toBe(2)
    })

    it('excludes fixed alerts from open count', () => {
        const alerts = [
            {
                alertType: 'code',
                firstSeenDate: '2020-01-01T00:00:00Z',
                fixedDate: '2020-01-02T00:00:00Z',
            },
        ]
        const result = lib.getAlertsTrendLine(alerts, 'code', 1, 1, 'open')
        // alert was fixed long ago, should be 0 on recent dates
        expect(result[result.length - 1]).toBe(0)
    })

    it('counts fixed alerts with fixed filter', () => {
        const alerts = [
            {
                alertType: 'code',
                firstSeenDate: '2020-01-01T00:00:00Z',
                fixedDate: '2020-01-02T00:00:00Z',
            },
        ]
        const result = lib.getAlertsTrendLine(alerts, 'code', 1, 1, 'fixed')
        // alert was fixed long ago, should show up as fixed on recent dates
        expect(result[result.length - 1]).toBe(1)
    })

    it('respects summaryBucket for grouping days', () => {
        const result = lib.getAlertsTrendLine([], 'dependency', 6, 3, 'open')
        // 7 days (0..6) with bucket of 3 = 3 data points (day 0, 3, 6)
        expect(result.length).toBe(3)
    })
})

describe('getDatePoints', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns an array of date strings', () => {
        const result = lib.getDatePoints(3, 1)
        expect(result.length).toBe(4)
        // each entry should be a YYYY-MM-DD string
        result.forEach(dateStr => {
            expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })
    })

    it('last date point is today', () => {
        const result = lib.getDatePoints(3, 1)
        const today = new Date().toISOString().split('T')[0]
        expect(result[result.length - 1]).toBe(today)
    })

    it('respects summaryBucket', () => {
        const result = lib.getDatePoints(6, 3)
        expect(result.length).toBe(3)
    })
})

describe('handleNames', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('replaces spaces with %20', () => {
        expect(lib.handleNames('my project')).toBe('my%20project')
    })

    it('replaces ampersands with %26', () => {
        expect(lib.handleNames('A&B')).toBe('A%26B')
    })

    it('replaces both spaces and ampersands', () => {
        expect(lib.handleNames('my project & stuff')).toBe('my%20project%20%26%20stuff')
    })

    it('returns unchanged string with no special chars', () => {
        expect(lib.handleNames('simple')).toBe('simple')
    })
})

describe('dumpObject', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns JSON string of the object', () => {
        const obj = { a: 1, b: 'hello' }
        const result = lib.dumpObject(obj)
        expect(JSON.parse(result)).toEqual(obj)
    })

    it('pretty prints with 2 space indent', () => {
        const obj = { a: 1 }
        const result = lib.dumpObject(obj)
        expect(result).toBe(JSON.stringify(obj, null, 2))
    })

    it('includes methods when showMethods is true', () => {
        const obj = { a: 1 }
        Object.defineProperty(obj, 'hidden', { value: 'secret', enumerable: false })
        const result = lib.dumpObject(obj, true)
        const parsed = JSON.parse(result)
        expect(parsed.hidden).toBe('secret')
    })
})

describe('getAlerts (no repoId)', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns -1 counts when no repoId is provided', async () => {
        const result = await lib.getAlerts('org', 'project', null, [], {}, {})
        expect(result.values.count).toBe(-1)
        expect(result.values.dependencyAlerts).toBe(-1)
        expect(result.values.secretAlerts).toBe(-1)
        expect(result.values.codeAlerts).toBe(-1)
    })
})

describe('storeAlerts', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('initializes storedAlertData on first call', async () => {
        const alertResult = { count: 2, value: [{ alertId: 1, firstSeenDate: '2024-01-01T00:00:00Z' }, { alertId: 2, firstSeenDate: '2024-01-01T00:00:00Z' }] }
        await lib.storeAlerts('repo-1', alertResult, 'MyRepo')
        const grouped = lib.getAlertsGroupedByRepo('org', 'project')
        expect(grouped.repoNames).toContain('MyRepo')
    })

    it('tags alerts with repositoryId', async () => {
        const alert = { alertId: 1, firstSeenDate: '2024-01-01T00:00:00Z' }
        const alertResult = { count: 1, value: [alert] }
        await lib.storeAlerts('repo-42', alertResult)
        const grouped = lib.getAlertsGroupedByRepo('org', 'project')
        // repo should appear with fallback name since no repoName provided
        expect(grouped.repoNames.some(n => n.includes('repo-42'))).toBe(true)
    })

    it('accumulates alerts across multiple calls', async () => {
        const result1 = { count: 1, value: [{ alertId: 1, firstSeenDate: '2024-01-01T00:00:00Z' }] }
        const result2 = { count: 1, value: [{ alertId: 2, firstSeenDate: '2024-01-01T00:00:00Z' }] }
        await lib.storeAlerts('repo-A', result1, 'RepoA')
        await lib.storeAlerts('repo-B', result2, 'RepoB')
        const grouped = lib.getAlertsGroupedByRepo('org', 'project')
        expect(grouped.repoNames).toContain('RepoA')
        expect(grouped.repoNames).toContain('RepoB')
    })

    it('does not tag alerts with repoName when not provided', async () => {
        const alert = { alertId: 1, firstSeenDate: '2024-01-01T00:00:00Z' }
        const alertResult = { count: 1, value: [alert] }
        await lib.storeAlerts('repo-1', alertResult)
        // alert.repositoryName should be undefined
        expect(alert.repositoryName).toBeUndefined()
    })

    it('tags alerts with repoName when provided', async () => {
        const alert = { alertId: 1 }
        const alertResult = { count: 1, value: [alert] }
        await lib.storeAlerts('repo-1', alertResult, 'MyRepo')
        expect(alert.repositoryName).toBe('MyRepo')
    })
})

describe('getAlertsGroupedByRepo', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns empty result when no stored data', () => {
        const result = lib.getAlertsGroupedByRepo('org', 'project')
        expect(result.repoNames).toEqual([])
        expect(result.datePoints).toEqual([])
        expect(result.series).toEqual([])
    })

    it('groups alerts by repository', async () => {
        const alertResult = {
            count: 2,
            value: [
                { alertId: 1, alertType: 'dependency', firstSeenDate: '2020-01-01T00:00:00Z', repositoryId: 'r1', repositoryName: 'RepoOne' },
                { alertId: 2, alertType: 'dependency', firstSeenDate: '2020-01-01T00:00:00Z', repositoryId: 'r2', repositoryName: 'RepoTwo' },
            ],
        }
        await lib.storeAlerts('r1', { count: 1, value: [alertResult.value[0]] }, 'RepoOne')
        await lib.storeAlerts('r2', { count: 1, value: [alertResult.value[1]] }, 'RepoTwo')
        const result = lib.getAlertsGroupedByRepo('org', 'project')
        expect(result.repoNames).toContain('RepoOne')
        expect(result.repoNames).toContain('RepoTwo')
        expect(result.series.length).toBe(2)
    })

    it('filters alerts by alertType when provided', async () => {
        const depAlert = { alertId: 1, alertType: 'dependency', firstSeenDate: '2020-01-01T00:00:00Z' }
        const secretAlert = { alertId: 2, alertType: 'secret', firstSeenDate: '2020-01-01T00:00:00Z' }
        await lib.storeAlerts('repo-1', { count: 1, value: [depAlert] }, 'RepoA')
        await lib.storeAlerts('repo-2', { count: 1, value: [secretAlert] }, 'RepoB')
        const depType = lib.GetAlertTypeFromValue('1') // dependency
        const result = lib.getAlertsGroupedByRepo('org', 'project', 21, 1, depType)
        // Only dependency alerts should be included
        expect(result.repoNames).toContain('RepoA')
        expect(result.repoNames).not.toContain('RepoB')
    })

    it('returns sorted repository names', async () => {
        await lib.storeAlerts('r1', { count: 1, value: [{ alertId: 1, firstSeenDate: '2020-01-01T00:00:00Z' }] }, 'ZebraRepo')
        await lib.storeAlerts('r2', { count: 1, value: [{ alertId: 2, firstSeenDate: '2020-01-01T00:00:00Z' }] }, 'AlphaRepo')
        const result = lib.getAlertsGroupedByRepo('org', 'project')
        expect(result.repoNames[0]).toBe('AlphaRepo')
        expect(result.repoNames[1]).toBe('ZebraRepo')
    })
})

describe('getAlertSeverityCounts', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns zero counts when no stored data matches alertType', async () => {
        // Store alerts with a different type so the filtered result is empty
        await lib.storeAlerts('repo-1', {
            count: 1,
            value: [{ alertId: 1, alertType: 'secret', severity: 'critical' }],
        }, 'MyRepo')
        const depType = lib.GetAlertTypeFromValue('1') // dependency
        const result = await lib.getAlertSeverityCounts('org', 'project', 'repo-1', depType)
        expect(result.find(s => s.severity === 'critical').count).toBe(0)
    })

    it('counts alerts by severity', async () => {
        await lib.storeAlerts('repo-1', {
            count: 3,
            value: [
                { alertId: 1, alertType: 'dependency', severity: 'critical' },
                { alertId: 2, alertType: 'dependency', severity: 'critical' },
                { alertId: 3, alertType: 'dependency', severity: 'high' },
            ],
        }, 'MyRepo')
        const depType = lib.GetAlertTypeFromValue('1') // dependency
        const result = await lib.getAlertSeverityCounts('org', 'project', 'repo-1', depType)
        expect(result.find(s => s.severity === 'critical').count).toBe(2)
        expect(result.find(s => s.severity === 'high').count).toBe(1)
        expect(result.find(s => s.severity === 'medium').count).toBe(0)
        expect(result.find(s => s.severity === 'low').count).toBe(0)
    })

    it('returns all four severity levels', async () => {
        await lib.storeAlerts('repo-1', { count: 0, value: [] }, 'MyRepo')
        const depType = lib.GetAlertTypeFromValue('1')
        const result = await lib.getAlertSeverityCounts('org', 'project', 'repo-1', depType)
        const severities = result.map(s => s.severity)
        expect(severities).toContain('critical')
        expect(severities).toContain('high')
        expect(severities).toContain('medium')
        expect(severities).toContain('low')
    })
})

describe('getAlertConfidenceCounts', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('counts alerts by confidence level', async () => {
        await lib.storeAlerts('repo-1', {
            count: 4,
            value: [
                { alertId: 1, alertType: 'code', confidence: 'high' },
                { alertId: 2, alertType: 'code', confidence: 'high' },
                { alertId: 3, alertType: 'code', confidence: 'medium' },
                { alertId: 4, alertType: 'code', confidence: 'low' },
            ],
        }, 'MyRepo')
        const codeType = lib.GetAlertTypeFromValue('3') // code
        const result = await lib.getAlertConfidenceCounts('org', 'project', 'repo-1', codeType)
        expect(result.find(c => c.confidence === 'high').count).toBe(2)
        expect(result.find(c => c.confidence === 'medium').count).toBe(1)
        expect(result.find(c => c.confidence === 'low').count).toBe(1)
    })

    it('returns zero counts when no stored data matches alertType', async () => {
        await lib.storeAlerts('repo-1', {
            count: 1,
            value: [{ alertId: 1, alertType: 'dependency', confidence: 'high' }],
        }, 'MyRepo')
        const codeType = lib.GetAlertTypeFromValue('3') // code
        const result = await lib.getAlertConfidenceCounts('org', 'project', 'repo-1', codeType)
        expect(result.find(c => c.confidence === 'high').count).toBe(0)
    })

    it('returns all three confidence levels', async () => {
        await lib.storeAlerts('repo-1', { count: 0, value: [] }, 'MyRepo')
        const codeType = lib.GetAlertTypeFromValue('3')
        const result = await lib.getAlertConfidenceCounts('org', 'project', 'repo-1', codeType)
        const levels = result.map(c => c.confidence)
        expect(levels).toContain('high')
        expect(levels).toContain('medium')
        expect(levels).toContain('low')
    })
})

describe('getTimeToCloseData', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns empty dataPoints when storedAlertData has no matching alerts', async () => {
        // Store only secret alerts, but query for dependency
        await lib.storeAlerts('repo-1', {
            count: 1,
            value: [{ alertId: 1, alertType: 'secret' }],
        }, 'MyRepo')
        const depType = lib.GetAlertTypeFromValue('1') // dependency
        const result = await lib.getTimeToCloseData('org', 'project', 'repo-1', depType)
        expect(result.dataPoints).toEqual([])
        expect(result.labels).toEqual([])
    })

    it('calculates time to close for fixed alerts', async () => {
        const firstSeen = '2024-01-01T00:00:00Z'
        const fixedDate = '2024-01-11T00:00:00Z' // 10 days later
        await lib.storeAlerts('repo-1', {
            count: 1,
            value: [{ alertId: 1, alertType: 'dependency', firstSeenDate: firstSeen, fixedDate }],
        }, 'MyRepo')
        const depType = lib.GetAlertTypeFromValue('1')
        const result = await lib.getTimeToCloseData('org', 'project', 'repo-1', depType, 9999)
        expect(result.dataPoints).toContain(10)
        expect(result.labels[0]).toBe('2024-01-11')
    })

    it('calculates time to close for dismissed alerts', async () => {
        const firstSeen = '2024-01-01T00:00:00Z'
        const dismissedOn = '2024-01-06T00:00:00Z' // 5 days later
        await lib.storeAlerts('repo-1', {
            count: 1,
            value: [{
                alertId: 1,
                alertType: 'dependency',
                firstSeenDate: firstSeen,
                dismissal: { requestedOn: dismissedOn },
            }],
        }, 'MyRepo')
        const depType = lib.GetAlertTypeFromValue('1')
        const result = await lib.getTimeToCloseData('org', 'project', 'repo-1', depType, 9999)
        expect(result.dataPoints).toContain(5)
    })

    it('returns analysisStartDate and analysisEndDate', async () => {
        await lib.storeAlerts('repo-1', { count: 0, value: [] }, 'MyRepo')
        const depType = lib.GetAlertTypeFromValue('1')
        const result = await lib.getTimeToCloseData('org', 'project', 'repo-1', depType)
        expect(result.analysisStartDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(result.analysisEndDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('excludes alerts fixed before the cutoff window', async () => {
        // Alert fixed 200 days ago, but default daysBack is 90
        const firstSeen = '2020-01-01T00:00:00Z'
        const fixedDate = '2020-01-10T00:00:00Z'
        await lib.storeAlerts('repo-1', {
            count: 1,
            value: [{ alertId: 1, alertType: 'dependency', firstSeenDate: firstSeen, fixedDate }],
        }, 'MyRepo')
        const depType = lib.GetAlertTypeFromValue('1')
        const result = await lib.getTimeToCloseData('org', 'project', 'repo-1', depType, 90)
        // The fix was 5+ years ago, should not be within the 90-day window
        expect(result.dataPoints).toEqual([])
    })

    it('does not include open (unfixed) alerts in dataPoints', async () => {
        await lib.storeAlerts('repo-1', {
            count: 1,
            value: [{ alertId: 1, alertType: 'dependency', firstSeenDate: '2024-01-01T00:00:00Z' }],
        }, 'MyRepo')
        const depType = lib.GetAlertTypeFromValue('1')
        const result = await lib.getTimeToCloseData('org', 'project', 'repo-1', depType, 9999)
        expect(result.dataPoints).toEqual([])
    })
})

describe('getAlertsTrendLines', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns empty arrays when storedAlertData is null and repoId is -1', async () => {
        const result = await lib.getAlertsTrendLines('org', 'proj', '-1', 3, 1, null, false)
        expect(result.secretAlertsTrend).toEqual([])
        expect(result.dependencyAlertsTrend).toEqual([])
        expect(result.codeAlertsTrend).toEqual([])
    })

    it('returns 3 trend arrays for overviewType=false with stored data', async () => {
        await lib.storeAlerts('repo-1', {
            count: 3,
            value: [
                { alertId: 1, alertType: 'secret', firstSeenDate: '2020-01-01T00:00:00Z' },
                { alertId: 2, alertType: 'dependency', firstSeenDate: '2020-01-01T00:00:00Z' },
                { alertId: 3, alertType: 'code', firstSeenDate: '2020-01-01T00:00:00Z' },
            ],
        }, 'TestRepo')
        const result = await lib.getAlertsTrendLines('org', 'proj', '-1', 1, 1, null, false)
        expect(result.secretAlertsTrend).toBeDefined()
        expect(result.dependencyAlertsTrend).toBeDefined()
        expect(result.codeAlertsTrend).toBeDefined()
        // Each alert is from 2020, well within any window, so shows as active on today
        expect(result.secretAlertsTrend[result.secretAlertsTrend.length - 1]).toBe(1)
        expect(result.dependencyAlertsTrend[result.dependencyAlertsTrend.length - 1]).toBe(1)
        expect(result.codeAlertsTrend[result.codeAlertsTrend.length - 1]).toBe(1)
    })

    it('returns open/dismissed/fixed trends for overviewType=true', async () => {
        await lib.storeAlerts('repo-1', {
            count: 2,
            value: [
                { alertId: 1, alertType: 'dependency', firstSeenDate: '2020-01-01T00:00:00Z' },
                { alertId: 2, alertType: 'dependency', firstSeenDate: '2020-01-01T00:00:00Z', fixedDate: '2020-01-10T00:00:00Z' },
            ],
        }, 'TestRepo')
        const alertType = lib.GetAlertTypeFromValue('1') // dependency
        const result = await lib.getAlertsTrendLines('org', 'proj', '-1', 1, 1, alertType, true)
        expect(result.alertsOpenTrend).toBeDefined()
        expect(result.alertsDismissedTrend).toBeDefined()
        expect(result.alertFixedTrend).toBeDefined()
        // Alert 1 is still open; Alert 2 was fixed long ago
        expect(result.alertsOpenTrend[result.alertsOpenTrend.length - 1]).toBe(1)
        expect(result.alertFixedTrend[result.alertFixedTrend.length - 1]).toBe(1)
    })

    it('does not include overviewType=false keys in overviewType=true result', async () => {
        await lib.storeAlerts('repo-1', { count: 0, value: [] }, 'TestRepo')
        const alertType = lib.GetAlertTypeFromValue('1')
        const result = await lib.getAlertsTrendLines('org', 'proj', '-1', 1, 1, alertType, true)
        expect(result.secretAlertsTrend).toBeUndefined()
        expect(result.dependencyAlertsTrend).toBeUndefined()
        expect(result.codeAlertsTrend).toBeUndefined()
    })

    it('filters by alertType in overviewType=true mode', async () => {
        await lib.storeAlerts('repo-1', {
            count: 3,
            value: [
                { alertId: 1, alertType: 'dependency', firstSeenDate: '2020-01-01T00:00:00Z' },
                { alertId: 2, alertType: 'secret', firstSeenDate: '2020-01-01T00:00:00Z' },
                { alertId: 3, alertType: 'code', firstSeenDate: '2020-01-01T00:00:00Z' },
            ],
        }, 'TestRepo')
        const alertType = lib.GetAlertTypeFromValue('1') // dependency only
        const result = await lib.getAlertsTrendLines('org', 'proj', '-1', 1, 1, alertType, true)
        // Only 1 dependency alert should be counted as open
        expect(result.alertsOpenTrend[result.alertsOpenTrend.length - 1]).toBe(1)
    })
})

describe('fillSelectRepoDropdown', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('always adds "Select a repository" as first option', () => {
        const appended = []
        const mockDropDown = { append: (text) => appended.push(text) }
        lib.fillSelectRepoDropdown(mockDropDown, [])
        expect(appended[0]).toContain('Select a repository')
    })

    it('adds "All repos in this project" option when showAllRepos=true', () => {
        const appended = []
        const mockDropDown = { append: (text) => appended.push(text) }
        lib.fillSelectRepoDropdown(mockDropDown, [], true)
        expect(appended.some(s => s.includes('All repos'))).toBe(true)
    })

    it('does not add "All repos" option when showAllRepos=false', () => {
        const appended = []
        const mockDropDown = { append: (text) => appended.push(text) }
        lib.fillSelectRepoDropdown(mockDropDown, [])
        expect(appended.some(s => s.includes('All repos'))).toBe(false)
    })

    it('sorts repos alphabetically before adding options', () => {
        const appended = []
        const mockDropDown = { append: (text) => appended.push(text) }
        const repos = [{ id: '2', name: 'ZebraRepo' }, { id: '1', name: 'AlphaRepo' }]
        lib.fillSelectRepoDropdown(mockDropDown, repos)
        const repoOptions = appended.slice(1) // skip "Select a repository"
        expect(repoOptions[0]).toContain('AlphaRepo')
        expect(repoOptions[1]).toContain('ZebraRepo')
    })
})

describe('getSelectedRepoIdFromDropdown', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns the value from the dropdown', () => {
        const mockDropDown = { val: () => 'repo-123' }
        expect(lib.getSelectedRepoIdFromDropdown(mockDropDown)).toBe('repo-123')
    })
})

describe('getSelectedRepoNameFromDropdown', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns the selected option text from the dropdown', () => {
        const mockDropDown = { find: () => ({ text: () => 'My Repo' }) }
        expect(lib.getSelectedRepoNameFromDropdown(mockDropDown)).toBe('My Repo')
    })
})

describe('logWidgetSettings', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns parsed settings object', () => {
        const settings = { repoId: 'abc', alertType: '1' }
        const widgetSettings = { customSettings: { data: JSON.stringify(settings) } }
        const mockVSS = { getExtensionContext: vi.fn().mockReturnValue({ version: '1.0.0' }) }
        const result = lib.logWidgetSettings(widgetSettings, mockVSS, 'Test Widget')
        expect(result).toEqual(settings)
    })

    it('calls console.log with description and extension version', () => {
        const widgetSettings = { customSettings: { data: JSON.stringify({ x: 1 }) } }
        const mockVSS = { getExtensionContext: vi.fn().mockReturnValue({ version: '9.9.9' }) }
        lib.logWidgetSettings(widgetSettings, mockVSS, 'My Widget')
        expect(lib.console.log).toHaveBeenCalledWith(
            expect.stringContaining('My Widget')
        )
        expect(lib.console.log).toHaveBeenCalledWith(
            expect.stringContaining('9.9.9')
        )
    })
})

describe('getWidgetId', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns widget ID constructed from publisherId and extensionId', () => {
        const mockVSS = {
            getExtensionContext: vi.fn().mockReturnValue({
                publisherId: 'RobBos',
                extensionId: 'GHAzDoWidget',
            }),
        }
        const result = lib.getWidgetId(mockVSS)
        expect(result).toBe('RobBos.GHAzDoWidget.GHAzDoWidget.Configuration')
    })

    it('includes .GHAzDoWidget.Configuration suffix', () => {
        const mockVSS = {
            getExtensionContext: vi.fn().mockReturnValue({
                publisherId: 'Publisher',
                extensionId: 'Extension',
            }),
        }
        const result = lib.getWidgetId(mockVSS)
        expect(result).toContain('.GHAzDoWidget.Configuration')
    })
})

describe('showRepoInfo', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns early without updating progressDiv when repos is undefined', async () => {
        const progressDiv = { repoCount: { textContent: '5' } }
        await lib.showRepoInfo(undefined, { name: 'proj' }, 'org', progressDiv, 0)
        expect(progressDiv.repoCount.textContent).toBe('5')
    })

    it('updates repoCount in progressDiv by the number of repos', async () => {
        const progressDiv = { repoCount: { textContent: '3' } }
        const repos = [{ id: 'r1', name: 'Repo1', size: 100 }]
        await lib.showRepoInfo(repos, { name: 'proj' }, 'org', progressDiv, 0)
        expect(progressDiv.repoCount.textContent).toBe(4)
    })

    it('queues repos with size > 0 in getAlertCalls but skips size-0 repos', async () => {
        const progressDiv = { repoCount: { textContent: '0' } }
        const repos = [
            { id: 'r1', name: 'EmptyRepo', size: 0 },
            { id: 'r2', name: 'FullRepo', size: 100 },
        ]
        await lib.showRepoInfo(repos, { name: 'proj' }, 'org', progressDiv, 0)
        expect(lib.getAlertCalls.length).toBe(1)
        expect(lib.getAlertCalls[0].repo.name).toBe('FullRepo')
    })
})

describe('showAlertInfo', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('updates progressDiv counts when repoAlerts has values', () => {
        const progressDiv = {
            dependencyAlertCount: { textContent: '0' },
            secretAlertCount: { textContent: '0' },
            codeAlertCount: { textContent: '0' },
        }
        lib.showAlertInfo('org', { name: 'proj' }, { name: 'repo' },
            { values: { dependencyAlerts: 2, secretAlerts: 1, codeAlerts: 3 } },
            progressDiv, 0)
        expect(progressDiv.dependencyAlertCount.textContent).toBe(2)
        expect(progressDiv.secretAlertCount.textContent).toBe(1)
        expect(progressDiv.codeAlertCount.textContent).toBe(3)
    })

    it('accumulates counts correctly across multiple calls', () => {
        const progressDiv = {
            dependencyAlertCount: { textContent: '3' },
            secretAlertCount: { textContent: '2' },
            codeAlertCount: { textContent: '1' },
        }
        lib.showAlertInfo('org', { name: 'proj' }, { name: 'repo' },
            { values: { dependencyAlerts: 1, secretAlerts: 1, codeAlerts: 1 } },
            progressDiv, 0)
        expect(progressDiv.dependencyAlertCount.textContent).toBe(4)
        expect(progressDiv.secretAlertCount.textContent).toBe(3)
        expect(progressDiv.codeAlertCount.textContent).toBe(2)
    })

    it('does not update progressDiv when repoAlerts is null', () => {
        const progressDiv = {
            dependencyAlertCount: { textContent: '5' },
            secretAlertCount: { textContent: '3' },
            codeAlertCount: { textContent: '2' },
        }
        lib.showAlertInfo('org', { name: 'proj' }, { name: 'repo' }, null, progressDiv, 0)
        expect(progressDiv.dependencyAlertCount.textContent).toBe('5')
    })
})

describe('getSavedDocument', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('returns the document when found', async () => {
        const mockDoc = { id: 'doc1', lastUpdated: new Date().toISOString(), data: {} }
        const mockDataService = { getDocument: vi.fn().mockResolvedValue(mockDoc) }
        lib.VSS.getService.mockResolvedValue(mockDataService)

        const result = await lib.getSavedDocument(lib.VSS, 'myCollection', 'doc1')

        expect(result).toEqual(mockDoc)
        expect(mockDataService.getDocument).toHaveBeenCalledWith('myCollection', 'doc1')
    })

    it('returns null when document fetch throws', async () => {
        const mockDataService = { getDocument: vi.fn().mockRejectedValue(new Error('not found')) }
        lib.VSS.getService.mockResolvedValue(mockDataService)

        const result = await lib.getSavedDocument(lib.VSS, 'myCollection', 'missing')

        expect(result).toBeNull()
    })
})

describe('saveDocument', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('calls setDocument with correct structure', async () => {
        const mockSavedDoc = { id: 'doc1' }
        const mockDataService = { setDocument: vi.fn().mockResolvedValue(mockSavedDoc) }
        lib.VSS.getService.mockResolvedValue(mockDataService)

        await lib.saveDocument(lib.VSS, 'myCollection', 'doc1', { key: 'value' })

        expect(mockDataService.setDocument).toHaveBeenCalledWith(
            'myCollection',
            expect.objectContaining({ id: 'doc1', data: { key: 'value' }, __eTag: -1 })
        )
    })

    it('handles setDocument error gracefully', async () => {
        const mockDataService = { setDocument: vi.fn().mockRejectedValue(new Error('save failed')) }
        lib.VSS.getService.mockResolvedValue(mockDataService)

        await lib.saveDocument(lib.VSS, 'myCollection', 'doc1', {})
        expect(lib.console.log).toHaveBeenCalledWith(expect.stringContaining('Error saving'))
    })
})

describe('removeDocument', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('calls deleteDocument with correct arguments', async () => {
        const mockDataService = { deleteDocument: vi.fn().mockResolvedValue(undefined) }
        lib.VSS.getService.mockResolvedValue(mockDataService)

        await lib.removeDocument(lib.VSS, 'myCollection', 'doc1')

        expect(mockDataService.deleteDocument).toHaveBeenCalledWith('myCollection', 'doc1')
    })

    it('handles deleteDocument error gracefully', async () => {
        const mockDataService = { deleteDocument: vi.fn().mockRejectedValue(new Error('delete failed')) }
        lib.VSS.getService.mockResolvedValue(mockDataService)

        await lib.removeDocument(lib.VSS, 'myCollection', 'doc1')
        expect(lib.console.log).toHaveBeenCalledWith(expect.stringContaining('Error deleting'))
    })
})

describe('getAlertsTrendLine - default filter', () => {
    let lib

    beforeEach(() => {
        lib = loadLibrary()
    })

    it('falls through to open-alert behaviour for unknown filter values', () => {
        const alerts = [{ alertType: 'dependency', firstSeenDate: '2020-01-01T00:00:00Z' }]
        const result = lib.getAlertsTrendLine(alerts, 'dependency', 1, 1, 'unknown-filter')
        expect(result[result.length - 1]).toBe(1)
    })
})
