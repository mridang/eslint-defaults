import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { defineRule, report } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';

/**
 * `tslop/no-duplicate-consts`: one all-caps constant per value.
 *
 * What it flags: a top-level-style `const NAME = <static value>` (name in
 * `UPPER_SNAKE_CASE`; value a string, number, array or object literal built only
 * from other static values) that another file already declares with the same
 * name and the same value.
 *
 * Why: a copied constant drifts. When one copy changes, the others keep the old
 * value and nothing says so.
 *
 * How to fix: declare the constant once, export it and import it where needed.
 *
 * Limitation: the rule remembers the files it has already linted in this
 * process, so which file is "first" depends on the lint order, and a run
 * with several workers or a warm `--cache` can miss duplicates. Treat it as an
 * audit rule, not a gate.
 */

const ALL_CAPS = /^[A-Z][A-Z0-9_]*$/u;

const isSign = (operator: string): boolean =>
  operator === '+' || operator === '-';

const isSignedNumber = (
  node: TSESTree.Node,
): node is TSESTree.UnaryExpression & { argument: TSESTree.NumberLiteral } =>
  node.type === AST_NODE_TYPES.UnaryExpression &&
  isSign(node.operator) &&
  node.argument.type === AST_NODE_TYPES.Literal &&
  typeof node.argument.value === 'number';

const isPlainProperty = (
  property: TSESTree.ObjectLiteralElement,
): property is TSESTree.PropertyNonComputedName =>
  property.type === AST_NODE_TYPES.Property &&
  !property.computed &&
  !property.method &&
  property.kind === 'init';

const propertyKey = (
  property: TSESTree.PropertyNonComputedName,
): string | null => {
  if (property.key.type === AST_NODE_TYPES.Identifier) {
    return property.key.name;
  }
  return String(property.key.value);
};

const staticValue = (node: TSESTree.Node): string | null => {
  if (node.type === AST_NODE_TYPES.Literal) {
    return JSON.stringify(['literal', typeof node.value, String(node.value)]);
  }
  if (node.type === AST_NODE_TYPES.TemplateLiteral) {
    return node.expressions.length === 0
      ? JSON.stringify([
          'literal',
          'string',
          node.quasis.at(0)?.value.cooked ?? '',
        ])
      : null;
  }
  if (isSignedNumber(node)) {
    return JSON.stringify([
      'literal',
      'number',
      `${node.operator}${String(node.argument.value)}`,
    ]);
  }
  if (node.type === AST_NODE_TYPES.ArrayExpression) {
    const values = node.elements.map((element) =>
      element === null || element.type === AST_NODE_TYPES.SpreadElement
        ? null
        : staticValue(element),
    );
    return values.includes(null) ? null : JSON.stringify(['array', values]);
  }
  if (node.type === AST_NODE_TYPES.ObjectExpression) {
    const properties = node.properties.map((property) => {
      const key = isPlainProperty(property) ? propertyKey(property) : null;
      const value =
        key === null || !isPlainProperty(property)
          ? null
          : staticValue(property.value);
      return key === null || value === null ? null : [key, value];
    });
    return properties.includes(null)
      ? null
      : JSON.stringify(['object', properties]);
  }
  return null;
};

/** The constants seen so far per file, shared by every file linted in this process. */
const registry = new Map<string, Set<string>>();

/** The name of an all-caps `const` binding, or null for any other declarator. */
const constantName = (node: TSESTree.VariableDeclarator): string | null => {
  const isConst = node.parent.kind === 'const';
  return isConst &&
    node.id.type === AST_NODE_TYPES.Identifier &&
    ALL_CAPS.test(node.id.name)
    ? node.id.name
    : null;
};

export default defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Report all-caps constants duplicated by name and static value across files',
    },
    schema: [],
    messages: {
      duplicate: '{{name}} duplicates the constant in {{firstFile}}.',
    },
  },
  create(context) {
    const filename = context.filename;
    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      Program() {
        // The same file can be linted again (editor, watch mode): forget its old entries.
        // eslint-disable-next-line functional/immutable-data -- the process-wide registry of constants is the rule's one piece of shared state
        registry.set(filename, new Set());
      },
      VariableDeclarator(node: TSESTree.VariableDeclarator) {
        const name = constantName(node);
        const value =
          name === null || node.init === null ? null : staticValue(node.init);
        if (name === null || value === null) {
          return;
        }
        const key = `${name}:${value}`;
        const firstFile = [...registry].find(([, keys]) => keys.has(key))?.[0];
        if (firstFile === undefined) {
          // eslint-disable-next-line functional/immutable-data -- the process-wide registry of constants is the rule's one piece of shared state
          registry.get(filename)?.add(key);
          return;
        }
        if (firstFile !== filename) {
          report(context, node, 'duplicate', { name, firstFile });
        }
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
