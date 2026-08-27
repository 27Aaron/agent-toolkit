import type { UserConfig } from 'tsdown'

export default [
  {
    name: 'dsh-wakatime',
    // The contract ships as its own subpath so the dashboard bundle can import
    // the wire types and constants from this package instead of a local copy.
    entry: ['src/index.ts', 'src/ui-contract.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    fixedExtension: false,
    // Remove declarations for deleted source modules before tsc emits types.
    clean: true,
    dts: false,
    deps: { neverBundle: ['@deepseek-ai/schemastery'] },
  },
] satisfies UserConfig[]
