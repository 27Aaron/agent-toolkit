import ReactTestRenderer from 'react-test-renderer'
import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WakatimeSettingsTab } from '../src/client.tsx'
import type { WakatimeUiRpcResult, WakatimeUsageData } from '../src/ui-contract.ts'

interface DeferredRpc {
  endpoint: string
  payload: any
  resolve: (result: WakatimeUiRpcResult<unknown>) => void
}

function renderedText(renderer: ReactTestRenderer.ReactTestRenderer): string {
  // toJSON() gives a JSON-safe snapshot of the host element tree.
  return JSON.stringify(renderer.toJSON())
}

function deferredQueue() {
  const calls: DeferredRpc[] = []
  const rpcCall = (endpoint: string, payload?: unknown): Promise<WakatimeUiRpcResult<unknown>> =>
    new Promise(resolve => { calls.push({ endpoint, payload, resolve }) })
  return { calls, rpcCall }
}

function usageResult(cumulativeText: string): WakatimeUiRpcResult<WakatimeUsageData> {
  return {
    ok: true,
    value: {
      available: true,
      start: '2026-08-20',
      end: '2026-08-26',
      days: [],
      totals: {
        totalSeconds: 0,
        aiSeconds: 0,
        aiAdditions: 0,
        aiDeletions: 0,
        humanAdditions: 0,
        humanDeletions: 0,
        aiInputTokens: 0,
        aiCachedInputTokens: 0,
        aiOutputTokens: 0,
        aiPromptLengthSum: 0,
        aiPromptEvents: 0,
        aiSessions: 0,
        aiModelTotalCost: 0,
      },
      projects: [],
      categories: [],
      languages: [],
      editors: [],
      machines: [],
      operatingSystems: [],
      aiModels: [],
      todayBreakdown: { date: '2026-08-26', projects: [], languages: [], categories: [] },
      dashboard: {
        cumulativeSeconds: 1,
        cumulativeText,
        dailyAverageSeconds: 0,
        dailyAverageIncludingOtherSeconds: 0,
        todaySeconds: 0,
      },
    },
  }
}

function statusResult(): WakatimeUiRpcResult<unknown> {
  return {
    ok: true,
    value: {
      config: {
        baseUrl: 'https://api.wakatime.com/api/v1',
        category: 'ai coding',
        trackReads: true,
        debug: false,
        heartbeatIntervalMs: 60000,
        dashboardRefreshIntervalMs: 300000,
        insightsRefreshIntervalMs: 1800000,
      },
      apiKeyConfigured: true,
      cli: { state: 'missing', source: 'none', managedPath: '/tmp/wakatime-cli' },
      tracking: { projectCount: 0, pendingFiles: 0, pendingProjects: [] },
      paths: { config: '/tmp/.wakatime.cfg', log: '/tmp/w.log', data: '/tmp/data' },
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('WakaTime settings tab data loading', () => {
  it('ignores an out-of-order usage response when the range changed', async () => {
    const { calls, rpcCall } = deferredQueue()
    vi.stubGlobal('window', { setInterval: () => 0, clearInterval: () => {} })

    let renderer: ReactTestRenderer.ReactTestRenderer | undefined
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        React.createElement(WakatimeSettingsTab, { rpcCall, t: (key: string) => key }),
      )
    })

    // Mount effects fired status + usage; resolve both so the dashboard with
    // its range menu is rendered.
    const status = calls.find(call => call.endpoint === 'status')
    status!.resolve(statusResult())
    const mountUsage = calls.find(call => call.endpoint === 'usage')
    mountUsage!.resolve(usageResult('initial-data'))
    await ReactTestRenderer.act(async () => {})

    // Two preset clicks in a row while both requests stay in flight: the
    // dashboard keeps rendering because usage data already exists.
    const clickPreset = async (label: string): Promise<void> => {
      const menuButton = renderer!.root.findByProps({ 'aria-haspopup': 'menu' })
      await ReactTestRenderer.act(async () => { menuButton.props.onClick() })
      const option = renderer!.root.findByProps({ role: 'menuitem', children: label })
      await ReactTestRenderer.act(async () => { option.props.onClick() })
    }
    await clickPreset('today')
    await clickPreset('last14Days')

    const usageCalls = calls.filter(call => call.endpoint === 'usage')
    expect(usageCalls.length).toBe(3)

    // Hostile ordering: the newer request (last14Days) resolves first, then
    // the older request (today) resolves last and must not overwrite it.
    await ReactTestRenderer.act(async () => { usageCalls[2]!.resolve(usageResult('newest-range-data')) })
    expect(renderedText(renderer!).includes('newest-range-data')).toBe(true)

    await ReactTestRenderer.act(async () => { usageCalls[1]!.resolve(usageResult('older-range-data')) })
    const tree = renderedText(renderer!)
    expect(tree.includes('newest-range-data')).toBe(true)
    expect(tree.includes('older-range-data')).toBe(false)

    await ReactTestRenderer.act(async () => { renderer!.unmount() })
  })
})
