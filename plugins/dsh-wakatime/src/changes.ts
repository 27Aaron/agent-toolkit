import * as path from 'node:path'

export interface FileChange {
  file: string
  lineChanges: number
  isWrite: boolean
}

export interface FileDiffHunk {
  path: string
  oldText: string | null
  newText: string
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

export function lineCount(text: string | null | undefined): number {
  return text === undefined || text === null || text.length === 0
    ? 0
    : text.split('\n').length
}

export function lineDelta(before: string | null | undefined, after: string | null | undefined): number {
  return lineCount(after) - lineCount(before)
}

export function diffsFromMeta(meta: unknown): FileDiffHunk[] | undefined {
  const candidate = record(meta)?.diffs
  if (!Array.isArray(candidate) || candidate.length === 0) return undefined
  const valid = candidate.every((item): item is FileDiffHunk => {
    const value = record(item)
    return value !== undefined
      && typeof value.path === 'string'
      && (value.oldText === null || typeof value.oldText === 'string')
      && typeof value.newText === 'string'
  })
  return valid ? candidate : undefined
}

function changesFromDiffs(
  meta: unknown,
  isWrite: boolean,
  mode: 'delta' | 'count',
): FileChange[] | undefined {
  const diffs = diffsFromMeta(meta)
  return diffs?.map(diff => ({
    file: diff.path,
    lineChanges: mode === 'count'
      ? lineCount(diff.newText)
      : lineDelta(diff.oldText, diff.newText),
    isWrite,
  }))
}

function changeFromCanonicalValue(
  value: unknown,
  fallbackFile: unknown,
  isWrite: boolean,
  mode: 'delta' | 'count',
): FileChange | undefined {
  const output = record(value)
  if (output === undefined) return undefined
  const file = typeof output.path === 'string' ? output.path : fallbackFile
  if (typeof file !== 'string' || file.length === 0) return undefined
  if ((output.before !== null && typeof output.before !== 'string') || typeof output.after !== 'string') {
    return undefined
  }
  return {
    file,
    lineChanges: mode === 'count'
      ? lineCount(output.after)
      : lineDelta(output.before as string | null, output.after),
    isWrite,
  }
}

export function extractFileChanges(
  tool: string,
  rawArguments: unknown,
  meta: unknown,
  value: unknown,
): FileChange[] {
  const args = record(rawArguments)
  if (args === undefined) return []

  switch (tool) {
    case 'edit': {
      // wakatime-cli's DeepSeek Harness parser reports every mutation as a
      // write (pkg/ai/deepseek.go dshToolHeartbeatInfo); match it so fallback
      // heartbeats and native parsing agree on write attribution.
      const fromDiffs = changesFromDiffs(meta, true, 'delta')
      if (fromDiffs !== undefined) return fromDiffs
      const canonical = changeFromCanonicalValue(value, args.file_path, true, 'delta')
      if (canonical !== undefined) return [canonical]
      if (typeof args.file_path !== 'string' || args.file_path.length === 0) return []
      return [{
        file: args.file_path,
        lineChanges: lineDelta(
          typeof args.old_string === 'string' ? args.old_string : undefined,
          typeof args.new_string === 'string' ? args.new_string : undefined,
        ),
        isWrite: true,
      }]
    }
    case 'write': {
      // Upstream counts the full written content (dshTextLineCount(content)),
      // not a before/after delta, so every source here counts new lines only.
      const canonical = changeFromCanonicalValue(value, args.file_path, true, 'count')
      if (canonical !== undefined) return [canonical]
      const fromDiffs = changesFromDiffs(meta, true, 'count')
      if (fromDiffs !== undefined) return fromDiffs
      if (typeof args.file_path !== 'string' || args.file_path.length === 0) return []
      return [{
        file: args.file_path,
        lineChanges: lineCount(typeof args.content === 'string' ? args.content : undefined),
        isWrite: true,
      }]
    }
    case 'read':
    case 'read_image': {
      if (typeof args.file_path !== 'string' || args.file_path.length === 0) return []
      return [{ file: args.file_path, lineChanges: 0, isWrite: false }]
    }
    case 'str_replace_editor': {
      const file = args.path
      if (typeof file !== 'string' || file.length === 0) return []
      switch (args.command) {
        case 'view':
          return [{ file, lineChanges: 0, isWrite: false }]
        case 'create':
          return [{
            file,
            lineChanges: lineCount(typeof args.file_text === 'string' ? args.file_text : undefined),
            isWrite: true,
          }]
        case 'str_replace':
          return [{
            file,
            lineChanges: lineDelta(
              typeof args.old_str === 'string' ? args.old_str : undefined,
              typeof args.new_str === 'string' ? args.new_str : undefined,
            ),
            isWrite: true,
          }]
        case 'insert':
          return [{
            file,
            lineChanges: lineCount(typeof args.new_str === 'string' ? args.new_str : undefined),
            isWrite: true,
          }]
        default:
          return []
      }
    }
    default:
      return []
  }
}

export function resolveEntityPath(file: string, projectFolder: string): string {
  if (path.isAbsolute(file) || path.win32.isAbsolute(file) || path.posix.isAbsolute(file)) {
    return path.normalize(file)
  }
  return path.resolve(projectFolder, file)
}
