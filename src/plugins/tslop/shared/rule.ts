import { AST_NODE_TYPES } from '@typescript-eslint/types';
import type { TSESTree } from '@typescript-eslint/types';
import type { Rule, Scope } from 'eslint';
import type { Node } from 'estree';

/** Any function-like node that can carry parameters and a return type. */
export type FunctionNode =
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression
  | TSESTree.TSDeclareFunction
  | TSESTree.TSEmptyBodyFunctionExpression;

/** Every node that owns a parameter list, including type-level signatures. */
export type ParameterOwner =
  | FunctionNode
  | TSESTree.TSCallSignatureDeclaration
  | TSESTree.TSConstructSignatureDeclaration
  | TSESTree.TSConstructorType
  | TSESTree.TSFunctionType
  | TSESTree.TSMethodSignature;

/** The selectors that visit every parameter owner. */
const PARAMETER_OWNER_SELECTORS = [
  'ArrowFunctionExpression',
  'FunctionDeclaration',
  'FunctionExpression',
  'TSCallSignatureDeclaration',
  'TSConstructSignatureDeclaration',
  'TSConstructorType',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
  'TSFunctionType',
  'TSMethodSignature',
] as const;

/** Visits every parameter owner with one handler. */
export function onParameterOwners(
  handler: (node: ParameterOwner) => void,
): Record<string, (node: ParameterOwner) => void> {
  return Object.fromEntries(
    PARAMETER_OWNER_SELECTORS.map((selector) => [selector, handler]),
  );
}

/** What a rule file exports before it is turned into an ESLint rule. */
interface RuleDefinition {
  meta: Rule.RuleMetaData;
  create: (context: Rule.RuleContext) => object;
}

/**
 * Wraps a rule whose visitors take TypeScript-ESTree nodes. ESLint types its
 * visitors with the plain ESTree nodes, which lack the TypeScript ones.
 */
export function defineRule(definition: RuleDefinition): Rule.RuleModule {
  return {
    meta: definition.meta,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the visitors take TypeScript-ESTree nodes, which ESLint's plain ESTree listener type cannot express
    create: (context) => definition.create(context) as Rule.RuleListener,
  };
}

/** What ESLint reports a node as. */
export function asEslintNode(node: TSESTree.Node): Rule.Node {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint types nodes as ESTree and the TypeScript parser produces TSESTree nodes; the two type families do not overlap
  return node as unknown as Rule.Node;
}

/** What the TypeScript parser produced for a node ESLint hands out as plain ESTree. */
export function asTypeScript<T extends TSESTree.Node>(node: Node): T {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint's scope and reference types are ESTree; with the TypeScript parser they are TSESTree nodes
  return node as unknown as T;
}

/** The options of a rule, whose shape its schema has already validated. */
export function ruleOptions<T extends object>(
  context: Rule.RuleContext,
): Partial<T> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint types rule options as any; the rule's schema validates this shape
  return (context.options[0] ?? {}) as Partial<T>;
}

/** Reports a node under a message id. */
export function report(
  context: Rule.RuleContext,
  node: TSESTree.Node,
  messageId: string,
  data?: Record<string, string | number>,
): void {
  context.report({ node: asEslintNode(node), messageId, data });
}

/** The innermost scope that holds a node. */
function scopeOf(context: Rule.RuleContext, node: TSESTree.Node): Scope.Scope {
  return context.sourceCode.getScope(asEslintNode(node));
}

/** Resolves an identifier to its binding by walking the scopes upward. */
function resolveInScope(
  scope: Scope.Scope | null,
  name: string,
): Scope.Variable | null {
  if (scope === null) {
    return null;
  }
  return scope.set.get(name) ?? resolveInScope(scope.upper, name);
}

/** Resolves an identifier to its binding by walking the scopes upward. */
export function resolveVariable(
  context: Rule.RuleContext,
  identifier: TSESTree.Identifier,
): Scope.Variable | null {
  return resolveInScope(scopeOf(context, identifier), identifier.name);
}

/** True when the identifier names a global that nothing in the file declares. */
export function isGlobalReference(
  context: Rule.RuleContext,
  identifier: TSESTree.Identifier,
): boolean {
  const variable = resolveVariable(context, identifier);
  return variable === null || variable.defs.length === 0;
}

/** The syntax node of a definition. */
export function definitionNode(definition: Scope.Definition): TSESTree.Node {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- eslint's Definition types `node` as any; it is a TypeScript-ESTree node
  return definition.node as TSESTree.Node;
}

/** The syntax node a definition sits under, for example an import declaration. */
export function definitionParent(
  definition: Scope.Definition,
): TSESTree.Node | null {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- eslint types `parent` as an ESTree node; it is a TypeScript-ESTree node
  const parent = definition.parent as unknown as
    TSESTree.Node | null | undefined;
  return parent ?? null;
}

/** Whether two references name the same syntax node. */
export const isSameNode = (
  left: TSESTree.Node,
  right: TSESTree.Node | null | undefined,
): boolean => left === right;

/** The program node of the file being linted. */
export function programOf(context: Rule.RuleContext): TSESTree.Program {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- with the TypeScript parser every node of the tree is a TSESTree node
  return context.sourceCode.ast as unknown as TSESTree.Program;
}

/** The text of a node. */
export function textOf(context: Rule.RuleContext, node: TSESTree.Node): string {
  return context.sourceCode.getText(asEslintNode(node));
}

/** The comments right before a node. */
export function commentsBefore(context: Rule.RuleContext, node: TSESTree.Node) {
  return context.sourceCode.getCommentsBefore(asEslintNode(node));
}

/** The visitor keys of the parser, used to walk children. */
export function visitorKeys(
  context: Rule.RuleContext,
): Readonly<Record<string, readonly string[]>> {
  return context.sourceCode.visitorKeys;
}

/** Strips the wrappers that do not change what an expression evaluates to. */
export function unwrapExpression(node: TSESTree.Node): TSESTree.Node {
  switch (node.type) {
    case AST_NODE_TYPES.TSAsExpression:
    case AST_NODE_TYPES.TSTypeAssertion:
    case AST_NODE_TYPES.TSNonNullExpression:
    case AST_NODE_TYPES.TSSatisfiesExpression:
    case AST_NODE_TYPES.ChainExpression: {
      return unwrapExpression(node.expression);
    }
    default: {
      return node;
    }
  }
}

/** True for a value that is a syntax node. */
function isNode(value: unknown): value is TSESTree.Node {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string'
  );
}

/** The syntax nodes directly below a node, in visiting order. */
export function childNodes(
  node: TSESTree.Node,
  keys: Readonly<Record<string, readonly string[]>>,
): readonly TSESTree.Node[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- a node has no index signature; the visitor keys name only its child-node properties
  const fields = node as unknown as Readonly<Record<string, unknown>>;
  return (keys[node.type] ?? []).flatMap((key): readonly TSESTree.Node[] => {
    const value = fields[key];
    if (isNode(value)) {
      return [value];
    }
    return Array.isArray(value)
      ? (value as readonly unknown[]).filter((child): child is TSESTree.Node =>
          isNode(child),
        )
      : [];
  });
}

/** Every node below (and including) a node, parents before children. */
export function nodesWithin(
  node: TSESTree.Node,
  keys: Readonly<Record<string, readonly string[]>>,
): readonly TSESTree.Node[] {
  return [
    node,
    ...childNodes(node, keys).flatMap((child) => nodesWithin(child, keys)),
  ];
}

/** True for a path inside a test directory. */
const TEST_DIRECTORY = /(?:^|[/\\])(?:__tests__|tests?)(?:[/\\]|$)/iu;

/** True for a file named like a test. */
const TEST_SUFFIX = /[._](?:test|spec)\.[cm]?[jt]sx?$/iu;

/** Whether a file name belongs to a test. */
export function isTestFile(filename: string): boolean {
  return TEST_DIRECTORY.test(filename) || TEST_SUFFIX.test(filename);
}

/** The root identifier of a member or call chain: `expect(a).not.toBe` is `expect`. */
export function rootIdentifierName(node: TSESTree.Node): string | undefined {
  switch (node.type) {
    case AST_NODE_TYPES.Identifier: {
      return node.name;
    }
    case AST_NODE_TYPES.MemberExpression: {
      return rootIdentifierName(node.object);
    }
    case AST_NODE_TYPES.CallExpression: {
      return rootIdentifierName(node.callee);
    }
    case AST_NODE_TYPES.TaggedTemplateExpression: {
      return rootIdentifierName(node.tag);
    }
    default: {
      return undefined;
    }
  }
}
