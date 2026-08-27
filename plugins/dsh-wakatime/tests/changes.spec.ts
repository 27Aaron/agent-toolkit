import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  diffsFromMeta,
  extractFileChanges,
  lineCount,
  lineDelta,
  resolveEntityPath,
} from '../src/changes.ts'

describe('line accounting', () => {
  it('counts empty and trailing-newline content consistently', () => {
    expect(lineCount(undefined)).toBe(0)
    expect(lineCount('')).toBe(0)
    expect(lineCount('one')).toBe(1)
    expect(lineCount('one\ntwo\n')).toBe(3)
    expect(lineDelta('one\ntwo', 'one\ntwo\nthree')).toBe(1)
  })

  it('validates filesystem diff metadata', () => {
    const meta = { diffs: [{ path: '/repo/a.ts', oldText: 'a', newText: 'a\nb' }] }
    expect(diffsFromMeta(meta)).toEqual(meta.diffs)
    expect(diffsFromMeta({ diffs: [] })).toBeUndefined()
    expect(diffsFromMeta({ diffs: [{ path: 1, oldText: 'a', newText: 'b' }] })).toBeUndefined()
  })
})

describe('extractFileChanges', () => {
  it('uses exact edit diff metadata when available', () => {
    expect(extractFileChanges(
      'edit',
      { file_path: '/repo/a.ts', old_string: 'x', new_string: 'y' },
      { diffs: [{ path: '/repo/a.ts', oldText: 'ctx\nx\nctx', newText: 'ctx\ny\nz\nctx' }] },
      undefined,
    )).toEqual([{ file: '/repo/a.ts', lineChanges: 1, isWrite: true }])
  })

  it('uses canonical before/after values for Code Mode sub-dispatches', () => {
    expect(extractFileChanges(
      'edit',
      { file_path: '/repo/a.ts', old_string: 'x', new_string: 'y' },
      undefined,
      { path: '/repo/a.ts', before: 'a\nb', after: 'a\nb\nc\nd' },
    )).toEqual([{ file: '/repo/a.ts', lineChanges: 2, isWrite: true }])
  })

  it('counts full written content from canonical values, like the CLI parser', () => {
    expect(extractFileChanges(
      'write', { file_path: '/repo/new.ts', content: 'a\nb' }, undefined,
      { path: '/repo/new.ts', before: null, after: 'a\nb' },
    )).toEqual([{ file: '/repo/new.ts', lineChanges: 2, isWrite: true }])
    expect(extractFileChanges(
      'write', { file_path: '/repo/a.ts', content: 'a\nb\nc' }, undefined,
      { path: '/repo/a.ts', before: 'a', after: 'a\nb\nc' },
    )).toEqual([{ file: '/repo/a.ts', lineChanges: 3, isWrite: true }])
    expect(extractFileChanges(
      'write', { file_path: '/repo/a.ts', content: 'same' }, { diffs: [] },
      { path: '/repo/a.ts', before: 'same', after: 'same' },
    )).toEqual([{ file: '/repo/a.ts', lineChanges: 1, isWrite: true }])
  })

  it('always tracks reads, like the CLI parser', () => {
    expect(extractFileChanges('read', { file_path: '/repo/a.ts' }, undefined, undefined))
      .toEqual([{ file: '/repo/a.ts', lineChanges: 0, isWrite: false }])
    expect(extractFileChanges('read_image', { file_path: '/repo/a.ts' }, undefined, undefined))
      .toEqual([{ file: '/repo/a.ts', lineChanges: 0, isWrite: false }])
    expect(extractFileChanges(
      'str_replace_editor',
      { command: 'view', path: '/repo/a.ts' },
      undefined,
      undefined,
    )).toEqual([{ file: '/repo/a.ts', lineChanges: 0, isWrite: false }])
  })

  it('supports the compatibility editor', () => {
    expect(extractFileChanges(
      'str_replace_editor',
      { command: 'str_replace', path: '/repo/a.ts', old_str: 'a\nb', new_str: 'c' },
      undefined,
      undefined,
    )).toEqual([{ file: '/repo/a.ts', lineChanges: -1, isWrite: true }])
    expect(extractFileChanges(
      'str_replace_editor',
      { command: 'insert', path: '/repo/a.ts', new_str: 'c\nd' },
      undefined,
      undefined,
    )).toEqual([{ file: '/repo/a.ts', lineChanges: 2, isWrite: true }])
    expect(extractFileChanges(
      'str_replace_editor',
      { command: 'create', path: '/repo/new.ts', file_text: 'a\nb' },
      undefined,
      undefined,
    )).toEqual([{ file: '/repo/new.ts', lineChanges: 2, isWrite: true }])
  })

  it('ignores failed shapes and unrelated tools', () => {
    expect(extractFileChanges('bash', { command: 'touch x' }, undefined, undefined)).toEqual([])
    expect(extractFileChanges('write', { content: 'x' }, undefined, undefined)).toEqual([])
    expect(extractFileChanges('edit', null, undefined, undefined)).toEqual([])
  })
})

describe('resolveEntityPath', () => {
  it('resolves relative paths and preserves absolute forms', () => {
    expect(resolveEntityPath('src/a.ts', '/repo')).toBe(path.resolve('/repo/src/a.ts'))
    expect(resolveEntityPath('/repo/a.ts', '/other')).toBe(path.normalize('/repo/a.ts'))
    expect(resolveEntityPath('C:\\repo\\a.ts', '/repo')).toBe(path.normalize('C:\\repo\\a.ts'))
  })
})
