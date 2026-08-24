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
  {
    name: 'dsh-wakatime/client',
    entry: { client: 'src/client.tsx' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2022',
    fixedExtension: false,
    clean: false,
    dts: false,
    sourcemap: true,
    deps: { neverBundle: ['react', 'react/jsx-runtime'] },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@27aaron/dsh-wakatime", factory: (require) => { var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  },
] satisfies UserConfig[]
