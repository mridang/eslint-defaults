import type { Rule } from 'eslint';
import type {
  BinaryExpression,
  Node,
  SimpleCallExpression,
  TemplateLiteral,
} from 'estree';

/**
 * `intl/prefer-intl`: use the platform's `Intl` instead of hand-written
 * English text.
 *
 * Why: a hand-written plural suffix, relative time or truncation only works
 * for English and for the cases its author thought of. `Intl.PluralRules`,
 * `Intl.RelativeTimeFormat` and `Intl.Segmenter` already know every language,
 * and `Intl.Segmenter` also never cuts an emoji or an accented letter in half.
 *
 * What it flags (each with its own message id):
 * - `pluralSuffix`: a template literal that ends a word and then interpolates
 *   `cond ? '' : 's'` (or `'es'`, or the mirrored form), whatever the test is.
 * - `pluralWords`: a conditional between two string literals where one is the
 *   other plus `s` or `es`, such as `n === 1 ? 'item' : 'items'`.
 * - `relativeTimeText`: a string or template that holds a number or a
 *   placeholder, a time unit and `ago` (`${n} days ago`, `3 hours ago`,
 *   `in ${n} minutes`), a unit-and-`ago` tail joined to a number
 *   (`' days ago'`), and the literals `'just now'` and `'yesterday'`.
 * - `relativeTimeMath`: a division by a unit size (`/ 60`, `/ 3600`,
 *   `/ 86400`, ...) in a function that also holds a time unit word as a string.
 *   A function that builds an `Intl.RelativeTimeFormat` or `Intl.DurationFormat`
 *   is exempt, because it is feeding Intl.
 * - `splitEmpty`: `.split('')`, which cuts text into UTF-16 units.
 * - `ellipsis`: `x.slice(0, N)` (or `substring`, `substr`) joined to `…` or
 *   `...` by a template literal or `+`.
 *
 * How to fix: count with `new Intl.PluralRules(locale).select(n)`, write
 * relative times with `new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })`,
 * and cut text with `Intl.Segmenter` (or a `for...of` loop, because a string
 * spread is banned by `@typescript-eslint/no-misused-spread`). Use your shared
 * helper (`countOf`, `relativeTime`, `truncate`), if the repository has one.
 * Where the text is not user facing, suppress it in the code with
 * `// eslint-disable-next-line intl/prefer-intl -- <reason>`.
 */

const UNITS = 'second|minute|hour|day|week|month|year';

/** A number or the `${}` placeholder of a template literal. */
const COUNT = String.raw`(?:\d+|\$\{\})`;

/** `${n} days ago`, `3 hours ago`, `${n}m ago`, `${n} day${} ago`. */
const AGO = new RegExp(
  String.raw`${COUNT}\s*(?:(?:${UNITS})s?(?:\$\{\})?|[smhdwy])\s+ago\b`,
  'iu',
);

/** `in ${n} minutes`, `in 3 days`. */
const IN_FUTURE = new RegExp(
  String.raw`\bin\s+${COUNT}\s*(?:${UNITS})s?\b`,
  'iu',
);

/** `' days ago'`, the tail left over when the number is concatenated. */
const AGO_TAIL = new RegExp(String.raw`^\s*(?:${UNITS})s?\s+ago\s*$`, 'iu');

/** A string that is only `just now` or `yesterday`. */
const RELATIVE_WORD = /^\s*(?:just now|yesterday)\s*$/iu;

/** A time unit as a whole word. */
const UNIT_WORD = new RegExp(String.raw`\b(?:${UNITS})s?\b`, 'iu');

/** A string that ends in a letter, so a plural suffix can follow it. */
const ENDS_IN_LETTER = /\p{L}$/u;

/** The divisors that turn a duration into minutes, hours, days or weeks. */
const UNIT_DIVISORS = new Set([
  60, 3600, 86_400, 604_800, 60_000, 3_600_000, 86_400_000,
]);

/** Building one of these in the same function means the arithmetic feeds Intl. */
const INTL_FORMATTERS = new Set(['RelativeTimeFormat', 'DurationFormat']);

const PLURAL_SUFFIXES = new Set(['s', 'es']);
const SLICERS = new Set(['slice', 'substring', 'substr']);
const ELLIPSIS_START = /^(?:…|\.\.\.)/u;
const ELLIPSIS_END = /(?:…|\.\.\.)$/u;

function stringValue(node: Node | null | undefined): string | undefined {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }
  if (
    node?.type === 'TemplateLiteral' &&
    node.expressions.length === 0 &&
    node.quasis[0]
  ) {
    return node.quasis[0].value.cooked ?? undefined;
  }
  return undefined;
}

function isEmptyAndSuffix(empty: string, suffix: string): boolean {
  return empty === '' && PLURAL_SUFFIXES.has(suffix);
}

/** The two branches of `cond ? '' : 's'` as a suffix, if that is what it is. */
function pluralSuffixOf(node: Node): boolean {
  if (node.type !== 'ConditionalExpression') {
    return false;
  }
  const a = stringValue(node.consequent);
  const b = stringValue(node.alternate);
  if (a === undefined || b === undefined) {
    return false;
  }
  return isEmptyAndSuffix(a, b) || isEmptyAndSuffix(b, a);
}

function isMethodCall(node: Node | undefined): node is SimpleCallExpression {
  if (node?.type !== 'CallExpression') {
    return false;
  }
  const { callee } = node;
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier'
  );
}

/** The method name of a call that `isMethodCall` accepted. */
function methodName(node: SimpleCallExpression): string {
  const { callee } = node;
  return callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier'
    ? callee.property.name
    : '';
}

function isSlice(node: Node | undefined): node is SimpleCallExpression {
  if (!isMethodCall(node) || !SLICERS.has(methodName(node))) {
    return false;
  }
  const [first] = node.arguments;
  return first?.type === 'Literal' && first.value === 0;
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer Intl.PluralRules, Intl.RelativeTimeFormat and Intl.Segmenter over hand-written plurals, relative times and truncation.',
    },
    schema: [],
    messages: {
      pluralSuffix:
        'Hand-written plural suffix. Use Intl.PluralRules (or your shared helper, if the repository has one, such as countOf).',
      pluralWords:
        'Hand-written singular and plural words. Use Intl.PluralRules (or your shared helper, if the repository has one, such as countOf).',
      relativeTimeText:
        'Hand-written relative time. Use Intl.RelativeTimeFormat (or your shared helper, if the repository has one, such as relativeTime).',
      relativeTimeMath:
        'Hand-written time unit arithmetic. Use Intl.RelativeTimeFormat (or your shared helper, if the repository has one, such as relativeTime).',
      splitEmpty:
        "split('') cuts text into UTF-16 units. Use Intl.Segmenter or a for...of loop (a string spread is banned by no-misused-spread), or your shared helper, if the repository has one, such as truncate.",
      ellipsis:
        'Hand-written truncation with an ellipsis. Use Intl.Segmenter to cut at a grapheme (or your shared helper, if the repository has one, such as truncate).',
    },
  },
  create(context) {
    interface Frame {
      divisor?: Node;
      unitWord: boolean;
      intl: boolean;
    }
    /** The function frames being visited, innermost last. */
    const frames: Frame[] = [];
    const current = (): Frame | undefined => frames.at(-1);

    const enter = (): void => {
      // eslint-disable-next-line functional/immutable-data -- the frame stack follows the traversal
      frames.push({ unitWord: false, intl: false });
    };
    const exit = (): void => {
      // eslint-disable-next-line functional/immutable-data -- the frame stack follows the traversal
      const frame = frames.pop();
      if (frame?.divisor && frame.unitWord && !frame.intl) {
        context.report({ node: frame.divisor, messageId: 'relativeTimeMath' });
      }
    };
    const markFrame = (change: Partial<Frame>): void => {
      const frame = current();
      if (frame) {
        // eslint-disable-next-line functional/immutable-data -- the frame is the traversal's running state
        Object.assign(frame, change);
      }
    };

    const isRelativeText = (text: string): boolean =>
      AGO.test(text) ||
      IN_FUTURE.test(text) ||
      AGO_TAIL.test(text) ||
      RELATIVE_WORD.test(text);

    const checkText = (node: Node, text: string): void => {
      if (UNIT_WORD.test(text)) {
        markFrame({ unitWord: true });
      }
      if (isRelativeText(text)) {
        context.report({ node, messageId: 'relativeTimeText' });
      }
    };

    const checkInterpolation = (
      node: TemplateLiteral,
      expression: Node,
      index: number,
    ): void => {
      const before = node.quasis[index].value.cooked ?? '';
      if (pluralSuffixOf(expression) && ENDS_IN_LETTER.test(before)) {
        context.report({ node: expression, messageId: 'pluralSuffix' });
      }
      const after = node.quasis[index + 1].value.cooked ?? '';
      if (
        isSlice(expression) &&
        (ELLIPSIS_START.test(after) || ELLIPSIS_END.test(before))
      ) {
        context.report({ node: expression, messageId: 'ellipsis' });
      }
    };

    const isEllipsisJoin = (
      slice: Node,
      text: Node,
      node: BinaryExpression,
    ): boolean => {
      const value = stringValue(text);
      if (!isSlice(slice) || value === undefined) {
        return false;
      }
      const { left } = node;
      return slice === left
        ? ELLIPSIS_START.test(value)
        : ELLIPSIS_END.test(value);
    };

    const checkDivision = (node: BinaryExpression): void => {
      const { operator, right } = node;
      const isUnitSize =
        right.type === 'Literal' &&
        typeof right.value === 'number' &&
        UNIT_DIVISORS.has(right.value);
      if (operator === '/' && isUnitSize) {
        markFrame({ divisor: current()?.divisor ?? node });
      }
    };

    const checkEllipsisJoin = (node: BinaryExpression): void => {
      if (node.operator !== '+') {
        return;
      }
      const { left, right } = node;
      const sides: [Node, Node][] = [
        [left, right],
        [right, left],
      ];
      sides
        .filter(([slice, text]) => isEllipsisJoin(slice, text, node))
        // eslint-disable-next-line unicorn/no-array-for-each -- reporting is a side effect per element, there is no value to map
        .forEach(() => {
          context.report({ node, messageId: 'ellipsis' });
        });
    };

    const checkSuffixJoin = (node: BinaryExpression): void => {
      const { operator, left, right } = node;
      if (
        operator === '+' &&
        pluralSuffixOf(right) &&
        ENDS_IN_LETTER.test(stringValue(left) ?? '')
      ) {
        context.report({ node: right, messageId: 'pluralSuffix' });
      }
    };

    return {
      ':function': enter,
      ':function:exit': exit,

      /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
      Literal(node) {
        if (typeof node.value === 'string') {
          checkText(node, node.value);
        }
      },

      TemplateLiteral(node) {
        checkText(
          node,
          node.quasis.map((quasi) => quasi.value.cooked ?? '').join('${}'),
        );
        // eslint-disable-next-line unicorn/no-array-for-each -- reporting is a side effect per element, there is no value to map
        node.expressions.forEach((expression, index) => {
          checkInterpolation(node, expression, index);
        });
      },

      ConditionalExpression(node) {
        const a = stringValue(node.consequent);
        const b = stringValue(node.alternate);
        if (a === undefined || b === undefined) {
          return;
        }
        const [short, long] = a.length <= b.length ? [a, b] : [b, a];
        if (
          short.length >= 2 &&
          PLURAL_SUFFIXES.has(long.slice(short.length)) &&
          long.startsWith(short)
        ) {
          context.report({ node, messageId: 'pluralWords' });
        }
      },

      BinaryExpression(node) {
        checkDivision(node);
        checkEllipsisJoin(node);
        checkSuffixJoin(node);
      },

      NewExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.property.type === 'Identifier' &&
          INTL_FORMATTERS.has(node.callee.property.name)
        ) {
          markFrame({ intl: true });
        }
      },

      CallExpression(node) {
        if (
          isMethodCall(node) &&
          methodName(node) === 'split' &&
          node.arguments.length > 0 &&
          stringValue(node.arguments[0]) === ''
        ) {
          context.report({ node, messageId: 'splitEmpty' });
        }
      },
      /* eslint-enable sonarjs/function-name -- end of the visitor keys */
    };
  },
};

export default rule;
