import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import vm from 'vm'
import { createRequire } from 'module'

function createMockTl() {
    return {
        debug: vi.fn(),
        warning: vi.fn(),
        setResult: vi.fn(),
        getVariable: vi.fn(),
        getInput: vi.fn(),
        getEndpointAuthorization: vi.fn(),
        TaskResult: {
            Succeeded: 0,
            Failed: 2,
            Skipped: 9,
        },
    }
}

function createFunctions() {
    const mockTl = createMockTl()
    const code = readFileSync(resolve(__dirname, '..', 'index.js'), 'utf-8')
    const fakeModule = { exports: {} }
    const fakeRequire = (mod: string) => {
        if (mod === 'azure-pipelines-task-lib/task') return mockTl
        if (mod === 'azure-devops-node-api') return {
            getHandlerFromToken: () => ({}),
            WebApi: vi.fn(),
        }
        throw new Error(`Unexpected require: ${mod}`)
    }
    // Set main to a DIFFERENT object so run() is NOT auto-invoked
    ;(fakeRequire as any).main = {}
    const sandbox = {
        require: fakeRequire,
        module: fakeModule,
        console,
        exports: fakeModule.exports,
        Object, Promise, Error, JSON, Array, setTimeout,
        __dirname: resolve(__dirname, '..'),
    }
    vm.createContext(sandbox)
    vm.runInContext(code, sandbox)
    return {
        mockTl,
        getSystemAccessToken: (fakeModule.exports as any).getSystemAccessToken,
    }
}

function createTaskRunner() {
    const mockTl = createMockTl()

    const mockRestGet = vi.fn()

    function MockWebApi() {
        return { rest: { get: mockRestGet } }
    }

    const fakeRequire = (mod: string) => {
        if (mod === 'azure-pipelines-task-lib/task') return mockTl
        if (mod === 'azure-devops-node-api') return {
            getHandlerFromToken: () => ({}),
            WebApi: MockWebApi,
        }
        throw new Error(`Unexpected require: ${mod}`)
    }

    const code = readFileSync(resolve(__dirname, '..', 'index.js'), 'utf-8')

    const fakeModule = { exports: {} }
    ;(fakeRequire as any).main = fakeModule

    const sandbox = {
        require: fakeRequire,
        module: fakeModule,
        console,
        exports: {},
        Object,
        Promise,
        Error,
        JSON,
        Array,
        setTimeout,
        __dirname: resolve(__dirname, '..'),
    }

    return { mockTl, mockRestGet, sandbox, code }
}

async function runTask(mockTl: any, mockRestGet: any, sandbox: any, code: string) {
    vm.createContext(sandbox)
    vm.runInContext(code, sandbox)
    // Allow async run() to settle
    await new Promise(resolve => setTimeout(resolve, 100))
}

function setupPRContext(mockTl: any, overrides: Record<string, string> = {}) {
    const defaults: Record<string, string> = {
        'Build.Reason': 'PullRequest',
        'System.CollectionUri': 'https://dev.azure.com/myorg/',
        'System.TeamFoundationCollectionUri': 'https://dev.azure.com/myorg/',
        'System.TeamProject': 'MyProject',
        'Build.Repository.ID': 'repo-123',
        'System.PullRequest.SourceBranch': 'refs/heads/feature-branch',
        'System.PullRequest.targetBranchName': 'main',
    }
    const vars = { ...defaults, ...overrides }
    mockTl.getVariable.mockImplementation((name: string) => vars[name])
    mockTl.getEndpointAuthorization.mockReturnValue({
        scheme: 'OAuth',
        parameters: { AccessToken: 'fake-token' },
    })
}

describe('run() - build reason check', () => {
    it('skips when build reason is not PullRequest', async () => {
        const { mockTl, mockRestGet, sandbox, code } = createTaskRunner()
        mockTl.getVariable.mockImplementation((name: string) => {
            if (name === 'Build.Reason') return 'IndividualCI'
            return undefined
        })

        await runTask(mockTl, mockRestGet, sandbox, code)

        expect(mockTl.setResult).toHaveBeenCalledWith(
            9,
            expect.stringContaining('Pull Request')
        )
    })
})

describe('run() - no scan options selected', () => {
    it('skips when both scanning options are disabled', async () => {
        const { mockTl, mockRestGet, sandbox, code } = createTaskRunner()
        setupPRContext(mockTl)
        mockTl.getInput.mockImplementation((name: string) => {
            if (name === 'DepedencyAlertsScan') return 'false'
            if (name === 'CodeScanningAlerts') return 'false'
            return undefined
        })

        await runTask(mockTl, mockRestGet, sandbox, code)

        expect(mockTl.setResult).toHaveBeenCalledWith(
            9,
            expect.stringContaining('No options selected')
        )
    })
})

describe('run() - dependency scanning', () => {
    it('succeeds when no new dependency alerts are found', async () => {
        const { mockTl, mockRestGet, sandbox, code } = createTaskRunner()
        setupPRContext(mockTl)
        mockTl.getInput.mockImplementation((name: string) => {
            if (name === 'DepedencyAlertsScan') return 'true'
            if (name === 'CodeScanningAlerts') return 'false'
            return undefined
        })

        mockRestGet.mockResolvedValue({
            result: {
                count: 2,
                value: [
                    { alertId: 1, title: 'Alert 1' },
                    { alertId: 2, title: 'Alert 2' },
                ],
            },
        })

        await runTask(mockTl, mockRestGet, sandbox, code)

        expect(mockTl.setResult).toHaveBeenCalledWith(0)
    })

    it('fails when new dependency alerts are found on source branch', async () => {
        const { mockTl, mockRestGet, sandbox, code } = createTaskRunner()
        setupPRContext(mockTl)
        mockTl.getInput.mockImplementation((name: string) => {
            if (name === 'DepedencyAlertsScan') return 'true'
            if (name === 'CodeScanningAlerts') return 'false'
            return undefined
        })

        mockRestGet
            .mockResolvedValueOnce({
                result: {
                    count: 2,
                    value: [
                        { alertId: 1, title: 'Existing alert' },
                        { alertId: 99, title: 'New vulnerability' },
                    ],
                },
            })
            .mockResolvedValueOnce({
                result: {
                    count: 1,
                    value: [{ alertId: 1, title: 'Existing alert' }],
                },
            })

        await runTask(mockTl, mockRestGet, sandbox, code)

        expect(mockTl.setResult).toHaveBeenCalledWith(
            2,
            expect.stringContaining('New vulnerability')
        )
    })

    it('succeeds when source branch has no alerts at all', async () => {
        const { mockTl, mockRestGet, sandbox, code } = createTaskRunner()
        setupPRContext(mockTl)
        mockTl.getInput.mockImplementation((name: string) => {
            if (name === 'DepedencyAlertsScan') return 'true'
            if (name === 'CodeScanningAlerts') return 'false'
            return undefined
        })

        mockRestGet.mockResolvedValue({
            result: { count: 0, value: [] },
        })

        await runTask(mockTl, mockRestGet, sandbox, code)

        expect(mockTl.setResult).toHaveBeenCalledWith(0)
    })
})

describe('run() - code scanning', () => {
    it('fails when new code scanning alerts are found', async () => {
        const { mockTl, mockRestGet, sandbox, code } = createTaskRunner()
        setupPRContext(mockTl)
        mockTl.getInput.mockImplementation((name: string) => {
            if (name === 'DepedencyAlertsScan') return 'false'
            if (name === 'CodeScanningAlerts') return 'true'
            return undefined
        })

        mockRestGet
            .mockResolvedValueOnce({
                result: {
                    count: 1,
                    value: [{ alertId: 50, title: 'SQL Injection' }],
                },
            })
            .mockResolvedValueOnce({
                result: { count: 0, value: [] },
            })

        await runTask(mockTl, mockRestGet, sandbox, code)

        expect(mockTl.setResult).toHaveBeenCalledWith(
            2,
            expect.stringContaining('SQL Injection')
        )
    })
})

describe('run() - both scans enabled', () => {
    it('fails with combined message when both scans find new alerts', async () => {
        const { mockTl, mockRestGet, sandbox, code } = createTaskRunner()
        setupPRContext(mockTl)
        mockTl.getInput.mockImplementation((name: string) => {
            if (name === 'DepedencyAlertsScan') return 'true'
            if (name === 'CodeScanningAlerts') return 'true'
            return undefined
        })

        mockRestGet
            .mockResolvedValueOnce({
                result: {
                    count: 1,
                    value: [{ alertId: 10, title: 'Vulnerable dep' }],
                },
            })
            .mockResolvedValueOnce({
                result: { count: 0, value: [] },
            })
            .mockResolvedValueOnce({
                result: {
                    count: 1,
                    value: [{ alertId: 20, title: 'XSS found' }],
                },
            })
            .mockResolvedValueOnce({
                result: { count: 0, value: [] },
            })

        await runTask(mockTl, mockRestGet, sandbox, code)

        expect(mockTl.setResult).toHaveBeenCalledWith(
            2,
            expect.stringContaining('Vulnerable dep')
        )
    })
})

describe('run() - terminal state', () => {
    it('calls setResult exactly once (Succeeded) on happy path', async () => {
        const { mockTl, mockRestGet, sandbox, code } = createTaskRunner()
        setupPRContext(mockTl)
        mockTl.getInput.mockImplementation((name: string) => {
            if (name === 'DepedencyAlertsScan') return 'true'
            if (name === 'CodeScanningAlerts') return 'false'
            return undefined
        })
        mockRestGet.mockResolvedValue({ result: { count: 0, value: [] } })

        await runTask(mockTl, mockRestGet, sandbox, code)

        expect(mockTl.setResult).toHaveBeenCalledTimes(1)
        expect(mockTl.setResult).toHaveBeenCalledWith(0)
    })

    it('does not call setResult(Succeeded) after calling setResult(Failed)', async () => {
        const { mockTl, mockRestGet, sandbox, code } = createTaskRunner()
        setupPRContext(mockTl)
        mockTl.getInput.mockImplementation((name: string) => {
            if (name === 'DepedencyAlertsScan') return 'true'
            if (name === 'CodeScanningAlerts') return 'false'
            return undefined
        })
        mockRestGet
            .mockResolvedValueOnce({ result: { count: 1, value: [{ alertId: 10, title: 'Critical Vuln' }] } })
            .mockResolvedValueOnce({ result: { count: 0, value: [] } })

        await runTask(mockTl, mockRestGet, sandbox, code)

        expect(mockTl.setResult).toHaveBeenCalledTimes(1)
        expect(mockTl.setResult).toHaveBeenLastCalledWith(2, expect.stringContaining('Critical Vuln'))
    })
})

describe('run() - error handling', () => {
    it('calls setResult(Failed) with error message when an Error is thrown', async () => {
        const { mockTl, mockRestGet, sandbox, code } = createTaskRunner()
        mockTl.getVariable.mockImplementation(() => {
            throw new Error('Unexpected failure')
        })

        await runTask(mockTl, mockRestGet, sandbox, code)

        expect(mockTl.setResult).toHaveBeenCalledWith(
            2,
            expect.stringContaining('Unexpected failure')
        )
        expect(mockTl.setResult).toHaveBeenCalledTimes(1)
    })

    it('calls setResult(Failed) with generic message when a non-Error is thrown', async () => {
        const { mockTl, mockRestGet, sandbox, code } = createTaskRunner()
        mockTl.getVariable.mockImplementation(() => {
            throw 'some string error'
        })

        await runTask(mockTl, mockRestGet, sandbox, code)

        expect(mockTl.setResult).toHaveBeenCalledWith(
            2,
            'An unknown error occurred'
        )
        expect(mockTl.setResult).toHaveBeenCalledTimes(1)
    })
})

describe('getSystemAccessToken', () => {
    it('returns the access token when auth scheme is OAuth', () => {
        const { mockTl, getSystemAccessToken } = createFunctions()
        mockTl.getEndpointAuthorization.mockReturnValue({
            scheme: 'OAuth',
            parameters: { AccessToken: 'my-secret-token' },
        })
        const result = getSystemAccessToken()
        expect(result).toBe('my-secret-token')
        expect(mockTl.debug).toHaveBeenCalledWith('Got an OAuth authentication token')
    })

    it('calls warning and returns undefined when auth scheme is not OAuth', () => {
        const { mockTl, getSystemAccessToken } = createFunctions()
        mockTl.getEndpointAuthorization.mockReturnValue({
            scheme: 'Basic',
            parameters: {},
        })
        const result = getSystemAccessToken()
        expect(result).toBeUndefined()
        expect(mockTl.warning).toHaveBeenCalledWith('Could not determine credentials to use')
    })
})
