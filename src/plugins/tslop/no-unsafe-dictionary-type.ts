import { AST_NODE_TYPES } from '@typescript-eslint/types';
import {
  classifyUnsafeDictionary,
  classifyUnsafeDictionaryValue,
  createTypeEnvironment,
} from './shared/dictionary-types.js';
import {
  defineRule,
  isSameNode,
  programOf,
  report,
  visitorKeys,
} from './shared/rule.js';
import { visibleTypeAlias } from './shared/type-alias-resolution.js';
import type { TypeEnvironment } from './shared/dictionary-types.js';
import type { TSESTree } from '@typescript-eslint/types';

/**
 * `tslop/no-unsafe-dictionary-type`: no dictionary whose values are `unknown`,
 * `any`, `object` or `{}`.
 *
 * What it flags: `Record<string, unknown>`, `{ [key: string]: any }`, mapped
 * types and local aliases of them whose direct value type is `unknown`, `any`,
 * `object`, an empty object type, or a union that contains one of those.
 * The constraint of a type parameter (`T extends Record<string, unknown>`) and
 * a plain use of an alias that is already reported at its declaration are not
 * reported again.
 *
 * Why: a dictionary of nothing in particular gives callers no value contract,
 * so every read needs a cast or a probe.
 *
 * How to fix: use the value type the owner of the data defines (a schema
 * derived type), and parse external payloads before inserting them.
 */

const TYPE_NODE_KINDS: ReadonlySet<string> = new Set([
  'TSAnyKeyword',
  'TSArrayType',
  'TSBigIntKeyword',
  'TSBooleanKeyword',
  'TSConditionalType',
  'TSConstructorType',
  'TSFunctionType',
  'TSImportType',
  'TSIndexedAccessType',
  'TSInferType',
  'TSIntersectionType',
  'TSIntrinsicKeyword',
  'TSLiteralType',
  'TSMappedType',
  'TSNamedTupleMember',
  'TSNeverKeyword',
  'TSNullKeyword',
  'TSNumberKeyword',
  'TSObjectKeyword',
  'TSStringKeyword',
  'TSSymbolKeyword',
  'TSTemplateLiteralType',
  'TSThisType',
  'TSTupleType',
  'TSTypeLiteral',
  'TSTypeOperator',
  'TSTypePredicate',
  'TSTypeQuery',
  'TSTypeReference',
  'TSUndefinedKeyword',
  'TSUnionType',
  'TSUnknownKeyword',
  'TSVoidKeyword',
]);

const isTypeNode = (node: TSESTree.Node): node is TSESTree.TypeNode =>
  TYPE_NODE_KINDS.has(node.type);

const typeReferenceName = (type: TSESTree.TSTypeReference): string | null =>
  type.typeName.type === AST_NODE_TYPES.Identifier ? type.typeName.name : null;

const isInsideTypeAlias = (node: TSESTree.Node): boolean => {
  const parent = node.parent ?? null;
  if (parent === null || parent.type === AST_NODE_TYPES.Program) {
    return false;
  }
  return (
    parent.type === AST_NODE_TYPES.TSTypeAliasDeclaration ||
    isInsideTypeAlias(parent)
  );
};

const isPlainAliasUse = (
  node: TSESTree.TypeNode,
  environment: TypeEnvironment,
): boolean => {
  if (
    node.type !== AST_NODE_TYPES.TSTypeReference ||
    node.typeArguments?.params.length
  ) {
    return false;
  }
  const name = typeReferenceName(node);
  return (
    name !== null &&
    visibleTypeAlias(name, node, environment.typeAliases) !== null &&
    !isInsideTypeAlias(node)
  );
};

const isInsideConstraint = (node: TSESTree.Node): boolean => {
  const parent = node.parent ?? null;
  if (parent === null || parent.type === AST_NODE_TYPES.Program) {
    return false;
  }
  return (
    (parent.type === AST_NODE_TYPES.TSTypeParameter &&
      isSameNode(node, parent.constraint)) ||
    isInsideConstraint(parent)
  );
};

const hasUnsafeTypeAncestor = (
  node: TSESTree.Node,
  environment: TypeEnvironment,
): boolean => {
  const parent = node.parent ?? null;
  if (parent === null || parent.type === AST_NODE_TYPES.Program) {
    return false;
  }
  return (
    (isTypeNode(parent) &&
      classifyUnsafeDictionary(parent, environment) !== null) ||
    hasUnsafeTypeAncestor(parent, environment)
  );
};

const shouldReport = (
  node: TSESTree.TypeNode,
  environment: TypeEnvironment,
): boolean =>
  !isInsideConstraint(node) &&
  !isPlainAliasUse(node, environment) &&
  classifyUnsafeDictionary(node, environment) !== null &&
  !hasUnsafeTypeAncestor(node, environment);

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow object-dictionary contracts whose direct value type is unknown, any, object, {}, or a union/alias containing one of those escape hatches.',
    },
    schema: [],
    messages: {
      unsafeDictionary:
        "This dictionary's {{value}} value type gives callers no concrete value contract. Use an owner/schema-derived value type; parse external payloads before insertion.",
    },
  },
  create(context) {
    const environmentOf = (): TypeEnvironment =>
      createTypeEnvironment(programOf(context), visitorKeys(context));

    const reportIfUnsafe = (node: TSESTree.TypeNode): void => {
      const environment = environmentOf();
      if (!shouldReport(node, environment)) {
        return;
      }
      const unsafe = classifyUnsafeDictionary(node, environment);
      if (unsafe !== null) {
        report(context, node, 'unsafeDictionary', {
          value: unsafe.unsafeValue,
        });
      }
    };

    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      TSTypeReference: reportIfUnsafe,
      TSTypeLiteral: reportIfUnsafe,
      TSMappedType: reportIfUnsafe,
      TSIndexSignature(node: TSESTree.TSIndexSignature) {
        if (
          node.typeAnnotation === undefined ||
          node.parent.type === AST_NODE_TYPES.TSTypeLiteral
        ) {
          return;
        }
        const unsafe = classifyUnsafeDictionaryValue(
          node.typeAnnotation.typeAnnotation,
          environmentOf(),
        );
        if (unsafe !== null) {
          report(context, node, 'unsafeDictionary', {
            value: unsafe.unsafeValue,
          });
        }
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
