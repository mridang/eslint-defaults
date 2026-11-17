/**
 * Why: `process.env.X` and `import.meta.env.X` are always strings (or
 * undefined). `process.env.PORT || 3000` therefore has the type
 * `string | number`: a deployment that sets PORT gets a string, one that does
 * not gets a number, and arithmetic or strict comparison on it breaks only in
 * the environment that sets the variable.
 *
 * Flags: a `||`, `??` or `?:` expression where one branch reads configuration
 * (directly, or through a variable initialised from it) and the result is a
 * union of string and number. With type information the union is read from the
 * checker; without it only the syntactic shape (configuration next to a number
 * literal) is flagged.
 *
 * An expression that is the direct argument of `Number`, `parseInt`,
 * `parseFloat` or `String`, or of a unary `+`, is already converted and is not
 * flagged.
 *
 * Fix: convert explicitly, `Number(process.env.PORT ?? 3000)`, or parse the
 * configuration once with the repository's schema library.
 */
import type { Rule } from 'eslint';
import type { Node } from 'estree';

/**
 * TypeScript `TypeFlags` bits: String, StringLiteral, TemplateLiteral and
 * StringMapping, then Number and NumberLiteral.
 */
const STRING_BITS = [4, 128, 134_217_728, 268_435_456];
const NUMBER_BITS = [8, 256];

/** Whether the single-bit `bit` is set in `flags`, without bitwise operators. */
function hasBit(flags: number, bit: number): boolean {
  return Math.trunc(flags / bit) % 2 === 1;
}

function hasAnyBit(flags: number, bits: number[]): boolean {
  return bits.some((bit) => hasBit(flags, bit));
}

interface TypeLike {
  flags: number;
  types?: TypeLike[];
}

/** A TypeScript compiler node, only passed back to the checker. */
interface TsNode {
  readonly kind: number;
}

interface Services {
  program?: {
    getTypeChecker(): { getTypeAtLocation(node: TsNode): TypeLike };
  } | null;
  esTreeNodeToTSNodeMap?: { get(node: Node): TsNode | undefined };
}

type AnyNode = Node & {
  expression?: Node;
  parent?: Node;
  object?: AnyNode;
  property?: AnyNode;
  computed?: boolean;
  meta?: AnyNode;
  name?: string;
};

/** A node read through the properties only some node kinds have. */
function asAnyNode(node: Node): AnyNode {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- AnyNode only adds optional properties that some ESTree node kinds have and the Node union does not declare
  return node as AnyNode;
}

function unwrap(node: AnyNode): AnyNode {
  const inner = node.expression;
  return inner !== undefined &&
    (node.type === ('TSNonNullExpression' as string) ||
      node.type === ('TSAsExpression' as string))
    ? unwrap(asAnyNode(inner))
    : node;
}

function isEnvObject(node: AnyNode): boolean {
  if (node.type !== 'MemberExpression' || node.computed) {
    return false;
  }
  const object = node.object as AnyNode;
  const isEnv = (node.property as AnyNode).name === 'env';
  if (object.type === 'Identifier') {
    return isEnv && object.name === 'process';
  }
  return (
    isEnv &&
    object.type === 'MetaProperty' &&
    (object.meta as AnyNode).name === 'import'
  );
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow combining a configuration value with a value of another primitive type.',
    },
    schema: [],
    messages: {
      mixed:
        'This configuration value is a string but the expression can also be a number. Convert explicitly, e.g. `Number(process.env.PORT ?? 3000)`, or parse it with the repository schema library.',
    },
  },
  create(context) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- parserServices is typed any; it is the TypeScript parser's services, or empty with another parser
    const services = context.sourceCode.parserServices as Services | undefined;
    const checker = services?.program?.getTypeChecker();

    type Scope = ReturnType<typeof context.sourceCode.getScope>;

    function lookup(scope: Scope | null, name: string): AnyNode | undefined {
      if (!scope) {
        return undefined;
      }
      const variable = scope.set.get(name);
      if (variable) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- eslint types a definition's node as any; a variable declarator has an init
        return (variable.defs[0]?.node as { init?: AnyNode } | undefined)?.init;
      }
      return lookup(scope.upper, name);
    }

    function isConfig(raw: AnyNode, seen: readonly unknown[] = []): boolean {
      const node = unwrap(raw);
      if (node.type === 'MemberExpression') {
        return isEnvObject(node.object);
      }
      if (node.type !== 'Identifier' || seen.includes(node)) {
        return false;
      }
      const init = lookup(context.sourceCode.getScope(node), node.name);
      return init ? isConfig(init, [...seen, node]) : false;
    }

    function isMixedType(node: Node): boolean {
      const tsNode = services?.esTreeNodeToTSNodeMap?.get(node);
      if (!checker || !tsNode) {
        return false;
      }
      const type = checker.getTypeAtLocation(tsNode);
      const parts = type.types ?? [type];
      return (
        parts.some((part) => hasAnyBit(part.flags, STRING_BITS)) &&
        parts.some((part) => hasAnyBit(part.flags, NUMBER_BITS))
      );
    }

    function isConverted(node: AnyNode): boolean {
      const { parent } = node;
      return (
        (parent?.type === 'CallExpression' &&
          ['Number', 'parseInt', 'parseFloat', 'String'].includes(
            asAnyNode(parent.callee).name ?? '',
          )) ||
        (parent?.type === 'UnaryExpression' && parent.operator === '+')
      );
    }

    function check(node: Node, operands: Node[]): void {
      if (isConverted(asAnyNode(node))) {
        return;
      }
      if (!operands.some((operand) => isConfig(asAnyNode(operand)))) {
        return;
      }
      const hasType = Boolean(checker);
      const mixed = hasType
        ? isMixedType(node)
        : operands.some(
            (operand) =>
              operand.type === 'Literal' && typeof operand.value === 'number',
          );
      if (mixed) {
        context.report({ node, messageId: 'mixed' });
      }
    }

    return {
      /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
      LogicalExpression(node) {
        if (node.operator === '||' || node.operator === '??') {
          check(node, [node.left, node.right]);
        }
      },
      ConditionalExpression(node) {
        check(node, [node.consequent, node.alternate]);
      },
      /* eslint-enable sonarjs/function-name -- end of the visitor keys */
    };
  },
};

export default rule;
