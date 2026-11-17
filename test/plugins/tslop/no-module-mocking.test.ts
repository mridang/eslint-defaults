import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-module-mocking', code, [], 'file.ts');

describe('tslop/no-module-mocking', () => {
  it.each<[string, string, string]>([
    ['vi.mock global', 'vi.mock("./a");', 'moduleMock'],
    ['jest.doMock global', 'jest.doMock("./a");', 'moduleMock'],
    [
      'imported vi',
      'import { vi } from "vitest";\nvi.mock("./a");',
      'moduleMock',
    ],
    [
      'computed unstable_mockModule',
      'jest["unstable_mockModule"]("./a");',
      'moduleMock',
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
    ['spyOn is fine', 'vi.spyOn(a, "b");\ndeclare const a: { b(): void };'],
    ['other object named mock', 'const other = { mock() {} };\nother.mock();'],
    ['shadowed vi', 'const vi = { mock() {} };\nvi.mock();'],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
