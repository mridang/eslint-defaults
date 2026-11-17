import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith(
    'no-pass-through-schema',
    code,
    [{ schemaImports: [{ from: './schemas', names: ['Base'] }] }],
    'file.ts',
  );

describe('tslop/no-pass-through-schema', () => {
  it.each<[string, string, string]>([
    [
      'zod alias',
      'import { z } from "zod";\nconst UserSchema = z.object({ id: z.string() });\nexport const User = UserSchema;',
      'passThroughSchema',
    ],
    [
      'configured import',
      'import { Base } from "./schemas";\nexport const Alias = Base;',
      'passThroughSchema',
    ],
    [
      'arktype alias',
      'import { type } from "arktype";\nconst A = type({ a: "string" });\nexport const B = A;',
      'passThroughSchema',
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
      'new schema from alias',
      'import { z } from "zod";\nconst A = z.string();\nexport const B = A.optional();',
    ],
    ['not a schema', 'const A = 1;\nexport const B = A;'],
    [
      'type-only import',
      'import type { Base } from "zod";\nexport const Alias = Base;',
    ],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
