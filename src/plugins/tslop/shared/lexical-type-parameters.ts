import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { isSameNode, nodesWithin } from './rule.js';
import type { TSESTree } from '@typescript-eslint/types';

type VisitorKeys = Readonly<Record<string, readonly string[]>>;

function inferTypeParameterNames(
  node: TSESTree.Node,
  visitorKeys: VisitorKeys,
): readonly string[] {
  return nodesWithin(node, visitorKeys).flatMap((child) =>
    child.type === AST_NODE_TYPES.TSInferType
      ? [child.typeParameter.name.name]
      : [],
  );
}

function bindersAt(
  current: TSESTree.Node | null,
  descendant: TSESTree.Node,
  visitorKeys: VisitorKeys,
): readonly string[] {
  if (current === null || current.type === AST_NODE_TYPES.Program) {
    return [];
  }
  const declared =
    'typeParameters' in current
      ? (current.typeParameters?.params ?? []).map(
          (parameter) => parameter.name.name,
        )
      : [];
  const mapped =
    current.type === AST_NODE_TYPES.TSMappedType &&
    (isSameNode(descendant, current.nameType) ||
      isSameNode(descendant, current.typeAnnotation))
      ? [current.key.name]
      : [];
  const inferred =
    current.type === AST_NODE_TYPES.TSConditionalType &&
    isSameNode(descendant, current.trueType)
      ? inferTypeParameterNames(current.extendsType, visitorKeys)
      : [];
  return [
    ...declared,
    ...mapped,
    ...inferred,
    ...bindersAt(current.parent, current, visitorKeys),
  ];
}

/** Collect type binders that are in scope at a node and can shadow module aliases. */
export function lexicalTypeParameterNames(
  node: TSESTree.Node,
  visitorKeys: VisitorKeys,
): ReadonlySet<string> {
  return new Set(bindersAt(node, node, visitorKeys));
}
