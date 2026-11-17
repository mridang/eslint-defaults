import { AST_NODE_TYPES } from '@typescript-eslint/types';
import {
  commentsBefore,
  defineRule,
  isSameNode,
  report,
} from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';
import type { Rule } from 'eslint';

/**
 * `tslop/require-safety-comment-for-type-assertion`: every `as` needs a
 * `SAFETY:` comment.
 *
 * What it flags: a type assertion (`x as T`, `<T>x`) other than `as const`
 * that has no comment of the form `SAFETY: <reason>` before the assertion or
 * before the statement, property or `return` that holds it. The marker can be
 * changed with `{ markers: ['SAFETY', 'INVARIANT'] }`.
 *
 * Why: an assertion tells the compiler to trust the author. The reason it is
 * true belongs next to it, where the next reader (and a reviewer) can check it.
 *
 * How to fix: write what makes the assertion true (`// SAFETY: the schema
 * above already checked this`), or remove the assertion by narrowing properly.
 */

type TypeAssertion = TSESTree.TSAsExpression | TSESTree.TSTypeAssertion;

const DEFAULT_MARKERS: readonly string[] = ['SAFETY'];

const OWNER_KINDS = new Set([
  'ExpressionStatement',
  'PropertyDefinition',
  'ReturnStatement',
  'ThrowStatement',
  'VariableDeclaration',
]);

const isConstAssertion = (node: TypeAssertion): boolean =>
  node.typeAnnotation.type === AST_NODE_TYPES.TSTypeReference &&
  node.typeAnnotation.typeName.type === AST_NODE_TYPES.Identifier &&
  node.typeAnnotation.typeName.name === 'const';

const configuredMarkers = (option: unknown): readonly string[] => {
  const markers =
    typeof option === 'object' && option !== null && 'markers' in option
      ? option.markers
      : undefined;
  if (!Array.isArray(markers)) {
    return DEFAULT_MARKERS;
  }
  const cleaned = markers.flatMap((marker: unknown) =>
    typeof marker === 'string' && marker.trim().length > 0
      ? [marker.trim()]
      : [],
  );
  return cleaned.length > 0 ? cleaned : DEFAULT_MARKERS;
};

const markerPattern = (markers: readonly string[]): RegExp => {
  const alternation = markers
    .map((marker) => marker.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`))
    .join('|');
  return new RegExp(
    String.raw`(?:^|[^\p{L}\p{N}_])(?:${alternation})\s*:\s*\S`,
    'u',
  );
};

const hasJustificationBefore = (
  context: Rule.RuleContext,
  owner: TSESTree.Node,
  assertion: TypeAssertion,
  pattern: RegExp,
): boolean =>
  commentsBefore(context, owner).some(
    (comment) =>
      (comment.range?.[1] ?? 0) <= assertion.range[0] &&
      pattern.test(comment.value),
  );

const hasSafetyComment = (
  context: Rule.RuleContext,
  node: TypeAssertion,
  pattern: RegExp,
  current: TSESTree.Node = node,
): boolean => {
  if (hasJustificationBefore(context, current, node, pattern)) {
    return true;
  }
  const parent = current.parent ?? null;
  if (OWNER_KINDS.has(current.type)) {
    return (
      parent?.type === AST_NODE_TYPES.ExportNamedDeclaration &&
      isSameNode(current, parent.declaration) &&
      hasJustificationBefore(context, parent, node, pattern)
    );
  }
  return parent === null || parent.type === AST_NODE_TYPES.Program
    ? false
    : hasSafetyComment(context, node, pattern, parent);
};

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a nearby SAFETY comment for every TypeScript type assertion except const assertions.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          markers: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            minItems: 1,
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingSafetyComment:
        'This type assertion has no `{{marker}}:` justification. State the checked invariant immediately before the assertion or its containing statement.',
    },
  },
  create(context) {
    const markers = configuredMarkers(context.options[0]);
    const pattern = markerPattern(markers);
    const check = (node: TypeAssertion): void => {
      if (isConstAssertion(node) || hasSafetyComment(context, node, pattern)) {
        return;
      }
      report(context, node, 'missingSafetyComment', {
        marker: markers[0] ?? 'SAFETY',
      });
    };
    return { TSAsExpression: check, TSTypeAssertion: check };
  },
});
