import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { defineRule, isGlobalReference, report } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';
import type { Rule } from 'eslint';

/**
 * `tslop/no-bare-new-map`: no `new Map()` without a type to infer from.
 *
 * What it flags: `new Map()` with no arguments and no type arguments, in a
 * place that gives it no type (`const cache = new Map();`). It is not flagged
 * when the type comes from the context: type arguments (`new Map<string,
 * number>()`), an annotated variable or property (`const m: Map<string, number>
 * = new Map()`), an `as` or `satisfies` clause, or a typed parameter default.
 * This is the port of the Oxlint `no-restricted-syntax` selector
 * `NewExpression[callee.name='Map'][arguments.length=0]:not([typeArguments])`,
 * minus the cases where the type is known.
 *
 * Why: a bare `new Map()` is a `Map<any, any>`, which silently turns off type
 * checking for everything stored in it.
 *
 * How to fix: give the map its type arguments or an annotation, or build it from
 * entries so the types are inferred.
 */

const hasContextualType = (node: TSESTree.NewExpression): boolean => {
  const parent = node.parent;
  switch (parent.type) {
    case AST_NODE_TYPES.VariableDeclarator: {
      return parent.id.typeAnnotation !== undefined;
    }
    case AST_NODE_TYPES.PropertyDefinition:
    case AST_NODE_TYPES.AccessorProperty: {
      return parent.typeAnnotation !== undefined;
    }
    case AST_NODE_TYPES.AssignmentPattern: {
      return (
        'typeAnnotation' in parent.left &&
        parent.left.typeAnnotation !== undefined
      );
    }
    case AST_NODE_TYPES.TSAsExpression:
    case AST_NODE_TYPES.TSSatisfiesExpression:
    case AST_NODE_TYPES.TSTypeAssertion: {
      return true;
    }
    default: {
      return false;
    }
  }
};

const isGlobalMapCall = (
  context: Rule.RuleContext,
  node: TSESTree.NewExpression,
): boolean =>
  node.callee.type === AST_NODE_TYPES.Identifier &&
  node.callee.name === 'Map' &&
  isGlobalReference(context, node.callee);

export default defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow `new Map()` with no arguments and no type that tells TypeScript what it holds.',
    },
    schema: [],
    messages: {
      bareMap:
        'Bare new Map() infers Map<any, any>. Provide type arguments, an annotation or entries so types can be inferred.',
    },
  },
  create(context) {
    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      NewExpression(node: TSESTree.NewExpression) {
        if (
          node.arguments.length === 0 &&
          node.typeArguments === undefined &&
          isGlobalMapCall(context, node) &&
          !hasContextualType(node)
        ) {
          report(context, node, 'bareMap');
        }
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
