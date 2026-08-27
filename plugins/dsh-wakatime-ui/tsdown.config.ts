import type { UserConfig } from 'tsdown'

export default [
  {
    name: 'dsh-wakatime-ui',
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    fixedExtension: false,
    clean: false,
    dts: false,
  },
  {
    name: 'dsh-wakatime-ui/client',
    entry: { client: 'src/client.tsx' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2022',
    fixedExtension: false,
    clean: false,
    dts: false,
    sourcemap: true,
    // The browser module table can only answer baseline words, so a cross-package
    // specifier must never survive into lib/client.js: alwaysBundle forces the
    // contract subpath to be resolved and inlined at build time.
    deps: {
      neverBundle: ['react', 'react/jsx-runtime'],
      alwaysBundle: ['@27aaron/dsh-wakatime/ui-contract'],
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "@27aaron/dsh-wakatime-ui", factory: (require) => { var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  },
] satisfies UserConfig[]
