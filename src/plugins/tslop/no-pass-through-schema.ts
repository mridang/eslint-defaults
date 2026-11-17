import { AST_NODE_TYPES } from '@typescript-eslint/types';
import {
  defineRule,
  definitionNode,
  nodesWithin,
  report,
  resolveVariable,
  visitorKeys,
} from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';
import type { Rule, Scope } from 'eslint';

/**
 * `tslop/no-pass-through-schema`: no `const A = B` where `B` is a schema.
 *
 * What it flags: a `const` whose initializer is only the name of a known Zod or
 * ArkType schema (`const User = UserSchema`), through any chain of `const`
 * aliases. Schemas are recognised from `zod` (and `zod/v3`, `zod/v4`,
 * `zod/mini`) and `arktype` imports, and from imports listed in the
 * `schemaImports` option (`{ from: './schemas', names: ['User'] }`).
 * Options: `libraries` (`['zod', 'arktype']` by default) and
 * `allowExportedAliases` (skip an alias that the module exports).
 *
 * Why: a second name for the same schema doubles what a reader has to follow
 * and lets the two drift apart.
 *
 * How to fix: use the original schema directly, or export it under the name
 * callers need.
 */

const ZOD_FACTORIES = new Set([
  'string',
  'number',
  'bigint',
  'boolean',
  'date',
  'symbol',
  'undefined',
  'null',
  'void',
  'any',
  'unknown',
  'never',
  'literal',
  'enum',
  'nativeEnum',
  'object',
  'strictObject',
  'looseObject',
  'array',
  'tuple',
  'record',
  'map',
  'set',
  'union',
  'discriminatedUnion',
  'intersection',
  'optional',
  'nullable',
  'nullish',
  'lazy',
  'promise',
  'custom',
  'preprocess',
  'instanceof',
  'templateLiteral',
  'file',
  'json',
]);
const ZOD_METHODS = new Set([
  'optional',
  'nullable',
  'nullish',
  'array',
  'or',
  'and',
  'refine',
  'superRefine',
  'check',
  'transform',
  'pipe',
  'default',
  'prefault',
  'catch',
  'brand',
  'readonly',
  'describe',
  'meta',
  'extend',
  'safeExtend',
  'merge',
  'pick',
  'omit',
  'partial',
  'required',
  'keyof',
  'strict',
  'strip',
  'passthrough',
  'catchall',
  'nonoptional',
  'unwrap',
  'min',
  'max',
  'length',
  'nonempty',
  'email',
  'url',
  'uuid',
  'regex',
  'includes',
  'startsWith',
  'endsWith',
  'trim',
  'toLowerCase',
  'toUpperCase',
  'int',
  'positive',
  'negative',
  'nonnegative',
  'nonpositive',
  'finite',
  'multipleOf',
  'safe',
  'gt',
  'gte',
  'lt',
  'lte',
]);
const ARK_METHODS = new Set([
  'array',
  'or',
  'and',
  'pipe',
  'narrow',
  'brand',
  'describe',
  'configure',
  'optional',
  'default',
  'pick',
  'omit',
  'partial',
  'required',
  'merge',
  'keyof',
  'extract',
  'exclude',
  'atLeast',
  'atMost',
  'moreThan',
  'lessThan',
  'atLeastLength',
  'atMostLength',
  'exactlyLength',
  'matching',
  'divisibleBy',
  'onUndeclaredKey',
  'onDeepUndeclaredKey',
]);
const ZOD_SOURCES = new Set([
  'zod',
  'zod/v3',
  'zod/v4',
  'zod/v4/classic',
  'zod/v4/mini',
  'zod/mini',
]);

type Kind =
  | 'ark-factory'
  | 'ark-module'
  | 'ark-schema'
  | 'schema'
  | 'zod-factory'
  | 'zod-module'
  | 'zod-namespace'
  | 'zod-schema';

interface Options {
  libraries?: ('arktype' | 'zod')[];
  allowExportedAliases?: boolean;
  schemaImports?: { from: string; names: string[] }[];
}

const memberName = (node: TSESTree.MemberExpression): string | null => {
  if (!node.computed && node.property.type === AST_NODE_TYPES.Identifier) {
    return node.property.name;
  }
  if (
    node.computed &&
    node.property.type === AST_NODE_TYPES.Literal &&
    typeof node.property.value === 'string'
  ) {
    return node.property.value;
  }
  return null;
};

const memberKind = (owner: Kind | null, name: string | null): Kind | null => {
  if (name === null) {
    return null;
  }
  const zodOwner = owner === 'zod-module' || owner === 'zod-namespace';
  if (zodOwner && name === 'z') {
    return 'zod-namespace';
  }
  if (zodOwner && ZOD_FACTORIES.has(name)) {
    return 'zod-factory';
  }
  return owner === 'ark-module' && name === 'type' ? 'ark-factory' : null;
};

const librariesOf = (options: Options): readonly string[] =>
  options.libraries ?? ['zod', 'arktype'];

const importedName = (specifier: TSESTree.Node): string | null => {
  if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
    return specifier.imported.type === AST_NODE_TYPES.Identifier
      ? specifier.imported.name
      : specifier.imported.value;
  }
  return specifier.type === AST_NODE_TYPES.ImportDefaultSpecifier
    ? 'default'
    : null;
};

const isTypeOnlyImport = (
  declaration: TSESTree.Node | undefined,
  specifier: TSESTree.Node,
): boolean =>
  declaration?.type !== AST_NODE_TYPES.ImportDeclaration ||
  declaration.importKind === 'type' ||
  (specifier.type === AST_NODE_TYPES.ImportSpecifier &&
    specifier.importKind === 'type');

const zodImportKind = (name: string | null): Kind | null => {
  if (name === null) {
    return 'zod-module';
  }
  if (name === 'z' || name === 'default') {
    return 'zod-namespace';
  }
  return ZOD_FACTORIES.has(name) ? 'zod-factory' : null;
};

const arkImportKind = (name: string | null): Kind | null => {
  if (name === null) {
    return 'ark-module';
  }
  return name === 'type' ? 'ark-factory' : null;
};

const importKind = (
  options: Options,
  definition: Scope.Definition,
): Kind | null => {
  const specifier = definitionNode(definition);
  const declaration = specifier.parent;
  if (
    isTypeOnlyImport(declaration, specifier) ||
    declaration?.type !== AST_NODE_TYPES.ImportDeclaration
  ) {
    return null;
  }
  const source = declaration.source.value;
  const name = importedName(specifier);
  const libraries = librariesOf(options);
  if (
    name !== null &&
    options.schemaImports?.some(
      (entry) => entry.from === source && entry.names.includes(name),
    )
  ) {
    return 'schema';
  }
  if (libraries.includes('zod') && ZOD_SOURCES.has(source)) {
    const zod = zodImportKind(name);
    if (zod !== null) {
      return zod;
    }
  }
  return libraries.includes('arktype') && source === 'arktype'
    ? arkImportKind(name)
    : null;
};

/** The initializer of a `const` binding that holds a plain identifier or call. */
const constInitializer = (
  definition: Scope.Definition,
): TSESTree.Expression | null => {
  const declarator = definitionNode(definition);
  if (
    definition.type !== 'Variable' ||
    declarator.type !== AST_NODE_TYPES.VariableDeclarator
  ) {
    return null;
  }
  const isConst =
    declarator.parent.type === AST_NODE_TYPES.VariableDeclaration &&
    declarator.parent.kind === 'const';
  return isConst && declarator.id.type === AST_NODE_TYPES.Identifier
    ? declarator.init
    : null;
};

const identifierKind = (
  context: Rule.RuleContext,
  options: Options,
  node: TSESTree.Identifier,
  seen: ReadonlySet<Scope.Variable>,
): Kind | null => {
  const variable = resolveVariable(context, node);
  if (variable === null || seen.has(variable) || variable.defs.length !== 1) {
    return null;
  }
  const definition = variable.defs.at(0);
  if (definition === undefined) {
    return null;
  }
  if (definition.type === 'ImportBinding') {
    return importKind(options, definition);
  }
  const initializer = constInitializer(definition);
  return initializer === null
    ? null
    : schemaKind(context, options, initializer, new Set([...seen, variable]));
};

const callKind = (
  context: Rule.RuleContext,
  options: Options,
  node: TSESTree.CallExpression,
  seen: ReadonlySet<Scope.Variable>,
): Kind | null => {
  if (node.callee.type !== AST_NODE_TYPES.MemberExpression) {
    const factory = schemaKind(context, options, node.callee, seen);
    return factory === 'zod-factory' ? 'zod-schema' : factoryResult(factory);
  }
  const owner = schemaKind(context, options, node.callee.object, seen);
  const name = memberName(node.callee);
  if (
    owner === 'zod-schema' &&
    name === 'meta' &&
    node.arguments.length === 0
  ) {
    return null;
  }
  if (name !== null && owner === 'zod-schema' && ZOD_METHODS.has(name)) {
    return owner;
  }
  if (name !== null && owner === 'ark-schema' && ARK_METHODS.has(name)) {
    return owner;
  }
  const factory = memberKind(owner, name);
  return factory === 'zod-factory' ? 'zod-schema' : factoryResult(factory);
};

const factoryResult = (factory: Kind | null): Kind | null =>
  factory === 'ark-factory' ? 'ark-schema' : null;

const schemaKind = (
  context: Rule.RuleContext,
  options: Options,
  node: TSESTree.Node,
  seen: ReadonlySet<Scope.Variable> = new Set<Scope.Variable>(),
): Kind | null => {
  switch (node.type) {
    case AST_NODE_TYPES.Identifier: {
      return identifierKind(context, options, node, seen);
    }
    case AST_NODE_TYPES.MemberExpression: {
      return memberKind(
        schemaKind(context, options, node.object, seen),
        memberName(node),
      );
    }
    case AST_NODE_TYPES.CallExpression: {
      return callKind(context, options, node, seen);
    }
    default: {
      return null;
    }
  }
};

const SCHEMA_TARGETS = new Set<Kind | null>([
  'schema',
  'zod-schema',
  'ark-schema',
]);

/** A `const alias = Name` declarator. */
type Alias = TSESTree.VariableDeclarator & {
  id: TSESTree.Identifier;
  init: TSESTree.Identifier;
};

const isConstDeclarator = (
  node: TSESTree.Node,
): node is TSESTree.VariableDeclarator =>
  node.type === AST_NODE_TYPES.VariableDeclarator &&
  node.parent.type === AST_NODE_TYPES.VariableDeclaration &&
  node.parent.kind === 'const';

const isAlias = (node: TSESTree.Node): node is Alias =>
  isConstDeclarator(node) &&
  node.id.type === AST_NODE_TYPES.Identifier &&
  node.init?.type === AST_NODE_TYPES.Identifier;

/** The identifiers a module exports under their own binding. */
const exportedIdentifiers = (node: TSESTree.Node): TSESTree.Identifier[] => {
  if (node.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
    return node.declaration.type === AST_NODE_TYPES.Identifier
      ? [node.declaration]
      : [];
  }
  if (node.type !== AST_NODE_TYPES.ExportNamedDeclaration) {
    return [];
  }
  if (node.exportKind === 'type') {
    return [];
  }
  const declared =
    node.declaration?.type === AST_NODE_TYPES.VariableDeclaration
      ? node.declaration.declarations.flatMap((declaration) =>
          declaration.id.type === AST_NODE_TYPES.Identifier
            ? [declaration.id]
            : [],
        )
      : [];
  const listed =
    node.source === null
      ? node.specifiers.flatMap((specifier) =>
          specifier.exportKind !== 'type' &&
          specifier.local.type === AST_NODE_TYPES.Identifier
            ? [specifier.local]
            : [],
        )
      : [];
  return [...declared, ...listed];
};

export default defineRule({
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow pass-through aliases of known schemas' },
    schema: [
      {
        type: 'object',
        properties: {
          libraries: {
            type: 'array',
            items: { enum: ['zod', 'arktype'] },
            uniqueItems: true,
          },
          allowExportedAliases: { type: 'boolean' },
          schemaImports: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                from: { type: 'string' },
                names: { type: 'array', items: { type: 'string' } },
              },
              required: ['from', 'names'],
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      passThroughSchema:
        'Use {{schemaName}} directly instead of creating a pass-through schema alias.',
    },
  },
  create(context) {
    const options = (context.options[0] ?? {}) as Options;

    return {
      'Program:exit'(program: TSESTree.Program) {
        const nodes = nodesWithin(program, visitorKeys(context));
        const exported = new Set(
          options.allowExportedAliases === true
            ? nodes
                .flatMap((node) => exportedIdentifiers(node))
                .flatMap((node) => resolveVariable(context, node) ?? [])
            : [],
        );
        const aliases = nodes.flatMap((node) => {
          if (
            !isAlias(node) ||
            !SCHEMA_TARGETS.has(schemaKind(context, options, node.init))
          ) {
            return [];
          }
          const variable = resolveVariable(context, node.id);
          return variable !== null && exported.has(variable) ? [] : [node];
        });
        // eslint-disable-next-line functional/no-loop-statements -- reporting is a side effect per finding, and neither forEach nor map-for-effect is allowed
        for (const node of aliases) {
          report(context, node, 'passThroughSchema', {
            schemaName: node.init.name,
          });
        }
      },
    };
  },
});
