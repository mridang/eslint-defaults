import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { defineRule, report, ruleOptions } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';

/**
 * `tslop/no-duplicate-types`: one declaration per object contract.
 *
 * What it flags: an interface (without `extends`) or an object type alias that
 * is structurally identical to one declared earlier, in this file or in another
 * file linted in the same process. Property order does not matter; names,
 * optionality, `readonly` and types do. Declarations with fewer than
 * `minProperties` (default 2) members are ignored. Options: `minProperties` and
 * `message`.
 *
 * Why: two copies of one contract drift apart, and every change has to be made
 * twice.
 *
 * How to fix: keep one declaration, export it and import it where needed.
 *
 * Limitations: the Oxlint original also compares Zod, Valibot and ArkType
 * object schemas and Drizzle tables; this port compares type declarations only.
 * Like `no-duplicate-consts`, it remembers files linted earlier in the process,
 * so the "first" file depends on lint order. Treat it as an audit rule.
 */

type Parameters_ = Map<string, string>;

const keyOf = (node: TSESTree.Node): string | null => {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name;
  }
  if (node.type === AST_NODE_TYPES.Literal) {
    if (typeof node.value === 'string') {
      return JSON.stringify(node.value);
    }
    return typeof node.value === 'number' ? String(node.value) : null;
  }
  return null;
};

const typeName = (node: TSESTree.Node): string | null => {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name;
  }
  if (node.type !== AST_NODE_TYPES.TSQualifiedName) {
    return null;
  }
  const left = typeName(node.left);
  return left === null ? null : `${left}.${node.right.name}`;
};

const isNumeric = (value: unknown): boolean =>
  typeof value === 'number' || typeof value === 'bigint';

const isNegatedNumber = (
  node: TSESTree.TSLiteralType['literal'],
): node is TSESTree.UnaryExpressionMinus & { argument: TSESTree.Literal } =>
  node.type === AST_NODE_TYPES.UnaryExpression &&
  node.operator === '-' &&
  node.argument.type === AST_NODE_TYPES.Literal &&
  isNumeric(node.argument.value);

const literal = (node: TSESTree.TSLiteralType): string | null => {
  const value = node.literal;
  if (value.type === AST_NODE_TYPES.Literal) {
    if (typeof value.value === 'string') {
      return JSON.stringify(value.value);
    }
    if (typeof value.value === 'number' || typeof value.value === 'boolean') {
      return String(value.value);
    }
    if (typeof value.value === 'bigint') {
      return `${value.value}n`;
    }
  }
  if (isNegatedNumber(value)) {
    const operand = value.argument.value;
    return `-${String(operand)}${typeof operand === 'bigint' ? 'n' : ''}`;
  }
  return null;
};

/** Orders canonical forms. Only equality of the sorted result matters, so any stable order will do. */
const compareText = (left: string, right: string): number =>
  // eslint-disable-next-line no-restricted-properties -- these are internal keys compared for equality, not text shown to a person
  left.localeCompare(right);

const memberText = (
  member: TSESTree.TypeElement,
  parameters: Parameters_,
): string | null => {
  if (
    member.type !== AST_NODE_TYPES.TSPropertySignature ||
    member.computed ||
    member.typeAnnotation === undefined
  ) {
    return null;
  }
  const key = keyOf(member.key);
  const type = canonical(member.typeAnnotation.typeAnnotation, parameters);
  if (key === null || type === null) {
    return null;
  }
  return `prop(${key},${member.optional ? '?' : '!'},${member.readonly ? 'ro' : 'rw'},${type})`;
};

const members = (
  list: readonly TSESTree.TypeElement[],
  parameters: Parameters_,
): string | null => {
  const result = list.map((member) => memberText(member, parameters));
  const texts = result.filter((text): text is string => text !== null);
  return texts.length === result.length
    ? `{${texts.toSorted(compareText).join(',')}}`
    : null;
};

const KEYWORDS = new Set([
  'TSAnyKeyword',
  'TSBigIntKeyword',
  'TSBooleanKeyword',
  'TSNeverKeyword',
  'TSNullKeyword',
  'TSNumberKeyword',
  'TSObjectKeyword',
  'TSStringKeyword',
  'TSSymbolKeyword',
  'TSUndefinedKeyword',
  'TSUnknownKeyword',
  'TSVoidKeyword',
]);

function canonical(
  node: TSESTree.TypeNode,
  parameters: Parameters_,
): string | null {
  if (KEYWORDS.has(node.type)) {
    return node.type;
  }
  switch (node.type) {
    case AST_NODE_TYPES.TSLiteralType: {
      const value = literal(node);
      return value === null ? null : `literal(${value})`;
    }
    case AST_NODE_TYPES.TSArrayType: {
      const element = canonical(node.elementType, parameters);
      return element === null ? null : `array(${element})`;
    }
    case AST_NODE_TYPES.TSTypeOperator: {
      const type =
        node.typeAnnotation === undefined
          ? null
          : canonical(node.typeAnnotation, parameters);
      return type === null ? null : `${node.operator}(${type})`;
    }
    case AST_NODE_TYPES.TSUnionType:
    case AST_NODE_TYPES.TSIntersectionType: {
      const forms = node.types.map((type) => canonical(type, parameters));
      const types = forms.filter((form): form is string => form !== null);
      if (types.length !== forms.length) {
        return null;
      }
      const joined = [...new Set(types)].toSorted(compareText).join(',');
      return `${node.type === AST_NODE_TYPES.TSUnionType ? 'union' : 'intersection'}(${joined})`;
    }
    case AST_NODE_TYPES.TSTypeLiteral: {
      return members(node.members, parameters);
    }
    case AST_NODE_TYPES.TSTypeReference: {
      const name = typeName(node.typeName);
      if (name === null) {
        return null;
      }
      const args = (node.typeArguments?.params ?? []).map((type) =>
        canonical(type, parameters),
      );
      return args.includes(null)
        ? null
        : `ref(${parameters.get(name) ?? name}<${args.join(',')}>)`;
    }
    default: {
      return null;
    }
  }
}

type Declaration =
  TSESTree.TSInterfaceDeclaration | TSESTree.TSTypeAliasDeclaration;

const fingerprint = (
  node: Declaration,
): { value: string; size: number } | null => {
  const parameters: Parameters_ = new Map(
    (node.typeParameters?.params ?? []).map((parameter, index) => [
      parameter.name.name,
      `$${index}`,
    ]),
  );
  if (node.type === AST_NODE_TYPES.TSTypeAliasDeclaration) {
    if (node.typeAnnotation.type !== AST_NODE_TYPES.TSTypeLiteral) {
      return null;
    }
    const value = members(node.typeAnnotation.members, parameters);
    return value === null
      ? null
      : { value, size: node.typeAnnotation.members.length };
  }
  if (node.extends.length > 0) {
    return null;
  }
  const value = members(node.body.body, parameters);
  return value === null ? null : { value, size: node.body.body.length };
};

interface Seen {
  start: number;
  name: string;
}

/** The declarations seen so far per file, shared by every file linted in this process. */
const registry = new Map<string, Map<string, Seen>>();

export default defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Report structurally identical TypeScript declarations',
    },
    schema: [
      {
        type: 'object',
        properties: {
          message: { type: 'string' },
          minProperties: { type: 'integer', minimum: 0 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      duplicate: '{{message}} First seen as {{firstName}} in {{firstFile}}.',
    },
  },
  create(context) {
    const options = ruleOptions<{ message: string; minProperties: number }>(
      context,
    );
    const filename = context.filename;
    const inspect = (node: Declaration): void => {
      const print = fingerprint(node);
      if (print === null || print.size < (options.minProperties ?? 2)) {
        return;
      }
      const first = [...registry]
        .flatMap(([file, entries]) => {
          const entry = entries.get(print.value);
          return entry === undefined ? [] : [{ ...entry, filename: file }];
        })
        .at(0);
      if (first === undefined) {
        // eslint-disable-next-line functional/immutable-data -- the process-wide registry of declarations is the rule's one piece of shared state
        registry.get(filename)?.set(print.value, {
          start: node.range[0],
          name: node.id.name,
        });
        return;
      }
      if (first.filename !== filename || first.start !== node.range[0]) {
        report(context, node, 'duplicate', {
          message:
            options.message ??
            'This type is structurally identical to an existing declaration.',
          firstName: first.name,
          firstFile: first.filename,
        });
      }
    };
    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      Program() {
        // The same file can be linted again (editor, watch mode): forget its old entries.
        // eslint-disable-next-line functional/immutable-data -- the process-wide registry of declarations is the rule's one piece of shared state
        registry.set(filename, new Map<string, Seen>());
      },
      TSTypeAliasDeclaration: inspect,
      TSInterfaceDeclaration: inspect,
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
