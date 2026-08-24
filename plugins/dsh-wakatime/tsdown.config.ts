import type { UserConfig } from 'tsdown'

export default [
  {
    name: 'dsh-wakatime',
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    fixedExtension: false,
    clean: false,
    dts: false,
    deps: { neverBundle: ['@deepseek-ai/schemastery'] },
  },
] satisfies UserConfig[]
