import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-call-only-assertions', code, [], 'file.ts');

describe('tslop/no-call-only-assertions', () => {
  it.each<[string, string, string]>([
    [
      'only toHaveBeenCalled',
      'it("a", () => { expect(fn).toHaveBeenCalled(); });\ndeclare const fn: () => void;',
      'callOnlyAssertions',
    ],
    [
      'only call counts',
      'test("a", () => { expect(fn).toHaveBeenCalledTimes(1); expect(fn).not.toBeCalled(); });\ndeclare const fn: () => void;',
      'callOnlyAssertions',
    ],
  ])('reports %s', (_name, code, id) => {
    const ids = lint(code);
    if (id === '__any__') {
      expect(ids.length).toBeGreaterThan(0);
    } else {
      expect(ids).toContain(id);
    }
  });

  it.each<[string, string]>([
    [
      'toHaveBeenCalledWith is real data',
      'it("a", () => { expect(fn).toHaveBeenCalledWith(1); });\ndeclare const fn: () => void;',
    ],
    [
      'mixed assertions',
      'it("a", () => { expect(fn).toHaveBeenCalled(); expect(1).toBe(1); });\ndeclare const fn: () => void;',
    ],
    [
      'node assert counts',
      'it("a", () => { expect(fn).toHaveBeenCalled(); assert.equal(1, 1); });\ndeclare const fn: () => void;\ndeclare const assert: { equal(a: number, b: number): void };',
    ],
    ['no assertions at all', 'it("a", () => {});'],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
