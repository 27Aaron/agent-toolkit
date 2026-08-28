import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const packages = [
  { directory: 'plugins/dsh-wakatime', name: '@27aaron/dsh-wakatime' },
  { directory: 'plugins/dsh-wakatime-ui', name: '@27aaron/dsh-wakatime-ui' },
]
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+(?:[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

function command(binary, args, { inherit = false, ...options } = {}) {
  const result = spawnSync(binary, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    ...options,
  })
  if (result.error !== undefined) {
    throw new Error(`${binary} could not be started`)
  }
  return result
}

function runOrThrow(binary, args, options = {}) {
  const result = command(binary, args, options)
  if (result.status !== 0) {
    throw new Error(`${binary} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`)
  }
  return result
}

function packageInfo(item) {
  const file = join(root, item.directory, 'package.json')
  let manifest
  try {
    manifest = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    throw new Error(`could not read ${file}`)
  }
  if (manifest.name !== item.name) throw new Error(`${file} has unexpected package name`)
  if (typeof manifest.version !== 'string' || !semverPattern.test(manifest.version)) {
    throw new Error(`${file} has an invalid semver version`)
  }
  if (manifest.private === true) throw new Error(`${item.name} is private and cannot be published`)
  return { ...item, version: manifest.version }
}

function registryUrl() {
  const configured = process.env.NPM_REGISTRY?.trim()
  if (configured !== undefined && configured.length > 0) return configured.replace(/\/+$/, '')
  const result = command('npm', ['config', 'get', 'registry'])
  if (result.status !== 0) throw new Error('could not determine the npm registry')
  const registry = result.stdout.trim()
  if (registry.length === 0) return 'https://registry.npmjs.org'
  return registry.replace(/\/+$/, '')
}

function registryState(item, registry) {
  const result = command('npm', ['view', `${item.name}@${item.version}`, 'version', '--registry', registry])
  if (result.status === 0) return 'published'
  const details = `${result.stdout}\n${result.stderr}`.toLowerCase()
  // A missing package/version is the only expected non-zero result. Network,
  // auth, and registry failures must stop the release rather than look absent.
  if (/e404|\b404\b|not found|no match found/.test(details)) return 'missing'
  throw new Error(`could not query ${item.name}@${item.version} on ${registry}`)
}

function assertCleanWorktree() {
  const result = command('git', ['status', '--porcelain'])
  if (result.status !== 0) throw new Error('could not inspect git status')
  if (result.stdout.trim().length > 0) {
    throw new Error('release requires a clean, committed worktree; commit version changes first')
  }
}

function assertLoggedIn(registry) {
  if (process.env.RELEASE_AUTH === 'oidc') {
    if (process.env.GITHUB_ACTIONS !== 'true') {
      throw new Error('RELEASE_AUTH=oidc is only supported inside GitHub Actions')
    }
    console.log(`Using GitHub Actions OIDC trusted publishing for ${registry}`)
    return
  }
  const result = command('npm', ['whoami', '--registry', registry])
  if (result.status !== 0) {
    throw new Error(`not logged in to ${registry}; run npm login --registry ${registry}`)
  }
}

function publish(item, registry, tag) {
  runOrThrow('pnpm', [
    'publish',
    '--access', 'public',
    '--tag', tag,
    '--registry', registry,
    '--no-git-checks',
  ], { cwd: join(root, item.directory), inherit: true })
}

function pack(item) {
  runOrThrow('pnpm', ['pack', '--dry-run'], { cwd: join(root, item.directory), inherit: true })
}

function main() {
  const mode = process.argv[2] ?? '--check'
  if (!['--check', '--dry-run', '--publish'].includes(mode)) {
    throw new Error('usage: node .github/scripts/release.mjs --check|--dry-run|--publish')
  }

  const items = packages.map(packageInfo)
  const versions = new Set(items.map(item => item.version))
  if (versions.size !== 1) {
    throw new Error(`package versions must match for a paired release: ${items.map(item => `${item.name}@${item.version}`).join(', ')}`)
  }

  const registry = registryUrl()
  const states = items.map(item => ({ ...item, state: registryState(item, registry) }))
  console.log(`Release plan for ${items[0].version} on ${registry}`)
  for (const item of states) console.log(`- ${item.name}@${item.version}: ${item.state}`)

  if (mode === '--check') {
    if (states.every(item => item.state === 'published')) {
      console.log('Nothing to publish; all package versions already exist on the registry.')
    } else {
      console.log('A package version marked missing will be published after login and validation.')
    }
    return
  }

  if (mode === '--publish' && states.every(item => item.state === 'published')) {
    console.log('Nothing to publish; all package versions already exist on the registry.')
    return
  }

  if (mode === '--publish') assertCleanWorktree()

  // Packing is local and safe to repeat. It also verifies that pnpm rewrites
  // the UI workspace dependency to the matching core semver in the tarball.
  runOrThrow('pnpm', ['check'], { inherit: true })
  for (const item of items) pack(item)

  if (mode === '--dry-run') {
    console.log('Dry run complete; no package was uploaded.')
    return
  }

  assertLoggedIn(registry)
  const tag = process.env.NPM_TAG?.trim() || 'latest'
  for (const item of states) {
    if (item.state === 'published') {
      console.log(`Skipping existing ${item.name}@${item.version}`)
      continue
    }
    console.log(`Publishing ${item.name}@${item.version}`)
    publish(item, registry, tag)
  }
  console.log('Publish complete. Re-running this command will skip these immutable versions.')
}

try {
  main()
} catch (error) {
  console.error(`release: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
