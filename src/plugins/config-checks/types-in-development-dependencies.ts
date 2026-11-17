/**
 * Why: `@types/*` packages only describe types for the compiler. Listed under
 * `dependencies` they are installed in production for nothing and become a
 * requirement of every consumer of the package.
 *
 * Flags: any `@types/*` property under `dependencies` in package.json, on that
 * property.
 *
 * Fix: move it to `devDependencies`.
 */
import type { Rule } from 'eslint';

/** A node of the JSONC parser that package.json is linted with. */
interface JsonNode {
  type: string;
  loc: Rule.Node['loc'];
  parent?: JsonNode;
  key?: { value?: string; name?: string };
  value?: JsonNode;
  properties?: JsonNode[];
}

const keyOf = (node: JsonNode): string =>
  node.key?.value ?? node.key?.name ?? '';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require `@types/*` packages to be development dependencies.',
    },
    schema: [],
    messages: {
      misplaced:
        '`{{name}}` only provides types: move it from `dependencies` to `devDependencies`.',
    },
  },
  create(context) {
    return {
      /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
      JSONProperty(raw: unknown) {
        const node = raw as JsonNode;
        if (
          keyOf(node) !== 'dependencies' ||
          node.parent?.parent?.type !== 'JSONExpressionStatement' ||
          node.value?.type !== 'JSONObjectExpression'
        ) {
          return;
        }
        (node.value.properties ?? [])
          .filter((member) => keyOf(member).startsWith('@types/'))
          // eslint-disable-next-line unicorn/no-array-for-each -- reporting is a side effect per element, there is no value to map
          .forEach((member) => {
            context.report({
              loc: member.loc!,
              messageId: 'misplaced',
              data: { name: keyOf(member) },
            });
          });
      },
      /* eslint-enable sonarjs/function-name -- end of the visitor keys */
    };
  },
};

export default rule;
