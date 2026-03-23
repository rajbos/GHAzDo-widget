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
