import type { Linter } from 'eslint';

/*
 * The rules of the ultracite ESLint preset (mridang/eslint-defaults#110), decided one by one
 * against the repositories that use this preset. Enabled rules run as errors, with options only
 * where ultracite sets them. A rule left out is in coreExclusions with the reason, or in
 * unavailableRules when the plugin the preset depends on does not ship it.
 */

/** The reason a rule is left off, by rule name. */
type Reasons = Record<string, string>;

/** Core ESLint rules switched on for every code file. */
export const coreRuleSettings: Linter.RulesRecord = {
  // A setter without its getter is almost always a mistake.
  'accessor-pairs': 'error',
  // A map, filter or find callback that forgets to return gives a wrong result.
  'array-callback-return': 'error',
  // Drops braces and return around single expressions; Prettier keeps the result.
  'arrow-body-style': 'error',
  // A var used outside its block reads a value the code did not mean.
  'block-scoped-var': 'error',
  // Aliases of this must share one name.
  'consistent-this': 'error',
  // Braces around every block; a missing brace is a classic bug and Prettier keeps them.
  curly: 'error',
  // A switch must handle the unexpected value.
  'default-case': 'error',
  // A default that is not last is read wrongly.
  'default-case-last': 'error',
  // == coerces its operands; === says what is meant.
  eqeqeq: 'error',
  // A function name that differs from the property it is assigned to confuses stack traces.
  'func-name-matching': 'error',
  // Anonymous function expressions give unreadable stack traces.
  'func-names': 'error',
  // A getter and its setter belong next to each other.
  'grouped-accessor-pairs': 'error',
  // for-in also visits inherited keys.
  'guard-for-in': 'error',
  // a ||= b says what a = a || b says, once.
  'logical-assignment-operators': 'error',
  // Callback pyramids hide the flow (default limit 10).
  'max-nested-callbacks': 'error',
  // A single & or | in a condition is nearly always a typo for && or ||.
  'no-bitwise': 'error',
  // arguments.caller and callee are removed in strict mode.
  'no-caller': 'error',
  // A constructor that returns a value breaks new.
  'no-constructor-return': 'error',
  // /=/ at the start of a regex reads as a division assignment.
  'no-div-regex': 'error',
  // Two imports of one module; separate type imports are allowed.
  'no-duplicate-imports': ['error', { allowSeparateTypeImports: true }],
  // No else after a return.
  'no-else-return': 'error',
  // == null hides which of null and undefined is meant.
  'no-eq-null': 'error',
  // eval runs strings as code.
  'no-eval': 'error',
  // Changing built-in prototypes breaks other code.
  'no-extend-native': 'error',
  // bind on a function that never uses this does nothing.
  'no-extra-bind': 'error',
  // A label that is not needed.
  'no-extra-label': 'error',
  // Top-level declarations leak into the global scope in scripts.
  'no-implicit-globals': 'error',
  // Function declarations in blocks behave differently across engines.
  'no-inner-declarations': 'error',
  // __iterator__ is obsolete.
  'no-iterator': 'error',
  // A label with the name of a variable is confusing.
  'no-label-var': 'error',
  // Labels make control flow hard to follow.
  'no-labels': 'error',
  // A bare block does nothing in modern code.
  'no-lone-blocks': 'error',
  // An if as the only statement of an else is an else if.
  'no-lonely-if': 'error',
  // A function created in a loop captures the loop variable.
  'no-loop-func': 'error',
  // a = b = c hides a second assignment.
  'no-multi-assign': 'error',
  // Backslash line continuation in strings breaks silently with trailing spaces.
  'no-multi-str': 'error',
  // No negated condition with an else.
  'no-negated-condition': 'error',
  // Nested ternaries are hard to read; the core rule is not affected by Prettier.
  'no-nested-ternary': 'error',
  // new without using the result is a hidden side effect.
  'no-new': 'error',
  // new Function runs strings as code.
  'no-new-func': 'error',
  // new String, Number and Boolean create objects, not primitives.
  'no-new-wrappers': 'error',
  // Use {} instead of new Object().
  'no-object-constructor': 'error',
  // Octal escapes are deprecated.
  'no-octal-escape': 'error',
  // Reassigning a parameter hides the original argument.
  'no-param-reassign': 'error',
  // A value returned from a Promise executor is ignored.
  'no-promise-executor-return': 'error',
  // __proto__ is deprecated.
  'no-proto': 'error',
  // return a = b reads like a comparison.
  'no-return-assign': 'error',
  // javascript: URLs are a script injection vector.
  'no-script-url': 'error',
  // x === x is always true except for NaN; use Number.isNaN.
  'no-self-compare': 'error',
  // The comma operator hides side effects.
  'no-sequences': 'error',
  // "${x}" in a plain string is a template literal typed with the wrong quotes.
  'no-template-curly-in-string': 'error',
  // A variable that is read but never assigned is always undefined.
  'no-unassigned-vars': 'error',
  // let x = undefined is let x.
  'no-undef-init': 'error',
  // A line break before ( or [ can silently call the previous line; safe with Prettier and semicolons.
  'no-unexpected-multiline': 'error',
  // A loop condition nothing changes loops forever. The checkConditionalExpressions option is ESLint 10 only, so it is left out.
  'no-unmodified-loop-condition': 'error',
  // x ? true : false is x.
  'no-unneeded-ternary': 'error',
  // A loop that always exits on its first pass is an if.
  'no-unreachable-loop': 'error',
  // A value assigned and never read.
  'no-useless-assignment': 'error',
  // .call and .apply that change nothing.
  'no-useless-call': 'error',
  // { ["a"]: 1 } is { a: 1 }.
  'no-useless-computed-key': 'error',
  // "a" + "b" is "ab".
  'no-useless-concat': 'error',
  // import { a as a } renames nothing.
  'no-useless-rename': 'error',
  // A return at the end of a function does nothing.
  'no-useless-return': 'error',
  // let and const instead of var.
  'no-var': 'error',
  // void is allowed only as a statement, which is how a floating promise is marked on purpose.
  'no-void': ['error', { allowAsStatement: true }],
  // No warning-tag comments left in code; track work in issues.
  'no-warning-comments': 'error',
  // { a: a } is { a }.
  'object-shorthand': 'error',
  // One declaration per variable.
  'one-var': ['error', 'never'],
  // x = x + 1 is x += 1.
  'operator-assignment': 'error',
  // Arrow functions for callbacks.
  'prefer-arrow-callback': 'error',
  // A binding that is never reassigned is const.
  'prefer-const': 'error',
  // ** instead of Math.pow.
  'prefer-exponentiation-operator': 'error',
  // 0b11 instead of parseInt("11", 2).
  'prefer-numeric-literals': 'error',
  // Object.hasOwn instead of Object.prototype.hasOwnProperty.call.
  'prefer-object-has-own': 'error',
  // Spread instead of Object.assign({}, ...).
  'prefer-object-spread': 'error',
  // A regex literal instead of new RegExp("constant").
  'prefer-regex-literals': 'error',
  // Rest parameters instead of arguments.
  'prefer-rest-params': 'error',
  // Spread instead of .apply.
  'prefer-spread': 'error',
  // Template literals instead of string concatenation.
  'prefer-template': 'error',
  // A rethrown error keeps its cause.
  'preserve-caught-error': 'error',
  // parseInt takes an explicit radix.
  radix: 'error',
  // An assignment that can use a stale value after an await.
  'require-atomic-updates': 'error',
  // The u flag makes a regex read code points, not UTF-16 halves; the fix needs a human because u rejects some escapes.
  'require-unicode-regexp': 'error',
  // No unnecessary "use strict" in modules.
  strict: 'error',
  // A Symbol has a description for debugging.
  'symbol-description': 'error',
  // No byte order mark.
  'unicode-bom': 'error',
  // var declarations at the top of their scope.
  'vars-on-top': 'error',
  // No yoda conditions.
  yoda: 'error',
};

/**
 * Core ESLint rules switched on for JavaScript files only. On TypeScript files the compiler or a
 * typescript-eslint rule replaces them, and where that rule is excluded the decision is recorded
 * in hardened.ts.
 */
export const coreJavaScriptRuleSettings: Linter.RulesRecord = {
  // camelCase names in JavaScript; TypeScript is covered by typescript-eslint.
  camelcase: 'error',
  // A method that never uses this is a function.
  'class-methods-use-this': 'error',
  // Return a value on every path or on none.
  'consistent-return': 'error',
  // Default parameters come last.
  'default-param-last': 'error',
  // a.b instead of a["b"].
  'dot-notation': 'error',
  // [] instead of new Array().
  'no-array-constructor': 'error',
  // An empty function is a forgotten body.
  'no-empty-function': 'error',
  // this outside a class or method is undefined.
  'no-invalid-this': 'error',
  // A name that hides one of an outer scope.
  'no-shadow': 'error',
  // An expression whose value is thrown away.
  'no-unused-expressions': 'error',
  // Use after declaration.
  'no-use-before-define': 'error',
  // A constructor that only calls super.
  'no-useless-constructor': 'error',
  // setTimeout("code") runs a string.
  'no-implied-eval': 'error',
  // Throw Error objects, which carry a stack.
  'no-throw-literal': 'error',
  // Destructuring instead of indexing and property reads.
  'prefer-destructuring': 'error',
  // Reject with an Error.
  'prefer-promise-reject-errors': 'error',
  // An async function with no await.
  'require-await': 'error',
};

/** The eslint-plugin-import rules beyond its recommended set. */
export const importRuleSettings: Linter.RulesRecord = {
  // export let can change under importers.
  'import/no-mutable-exports': 'error',
  // Import a sibling package by name, not by relative path.
  'import/no-relative-packages': 'error',
  // Type imports as a separate import type line; auto-fixed.
  'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
  // A module that imports itself.
  'import/no-self-import': 'error',
  // Import cycles give undefined values at start-up. Slow on big repositories.
  'import/no-cycle': 'error',
  // import { default as x } is import x.
  'import/no-named-default': 'error',
  // import foo from a module whose named export foo means something else.
  'import/no-named-as-default': 'error',
  // foo.bar on a default import that also has a named bar.
  'import/no-named-as-default-member': 'error',
  // No AMD require and define.
  'import/no-amd': 'error',
  // One import line per module.
  'import/no-duplicates': 'error',
  // No absolute paths in imports.
  'import/no-absolute-path': 'error',
  // No loader! in imports.
  'import/no-webpack-loader-syntax': 'error',
  // A blank line after the imports; Prettier keeps it.
  'import/newline-after-import': 'error',
  // ./a/../b is ./b.
  'import/no-useless-path-segments': 'error',
  // import and module.exports in one file break in Node.
  'import/no-import-module-exports': 'error',
  // import {} from "x" is import "x".
  'import/no-empty-named-blocks': 'error',
  // Do not import what the source marks @deprecated.
  'import/no-deprecated': 'error',
  // Fixed order of import groups; auto-fixed.
  'import/order': [
    'error',
    {
      groups: [
        'builtin',
        'external',
        'internal',
        'parent',
        'sibling',
        'index',
        'object',
        'type',
      ],
    },
  ],
};

/** The React, React Hooks and JSX accessibility rules beyond the recommended sets. */
export const reactRuleSettings: Linter.RulesRecord = {
  // A button without type submits forms by accident.
  'react/button-has-type': 'error',
  // A checked input without onChange cannot be changed.
  'react/checked-requires-onchange-or-readonly': 'error',
  // defaultProps must match propTypes.
  'react/default-props-match-prop-types': 'error',
  // No propTypes of other components.
  'react/forbid-foreign-prop-types': 'error',
  // No any, array or object in propTypes.
  'react/forbid-prop-types': 'error',
  // useState pairs are named value and setValue.
  'react/hook-use-state': 'error',
  // An iframe without sandbox has full powers.
  'react/iframe-missing-sandbox': 'error',
  // A new context value on every render re-renders all consumers.
  'react/jsx-no-constructed-context-values': 'error',
  // {count && <X />} renders 0.
  'react/jsx-no-leaked-render': 'error',
  // javascript: URLs in JSX.
  'react/jsx-no-script-url': 'error',
  // A fragment around one child.
  'react/jsx-no-useless-fragment': 'error',
  // No braces around plain string props; auto-fixed.
  'react/jsx-curly-brace-presence': 'error',
  // Components are PascalCase.
  'react/jsx-pascal-case': 'error',
  // The same props object spread twice.
  'react/jsx-props-no-spread-multi': 'error',
  // this.state read inside setState gives stale values.
  'react/no-access-state-in-setstate': 'error',
  // dangerouslySetInnerHTML is an XSS vector.
  'react/no-danger': 'error',
  // setState in componentDidMount.
  'react/no-did-mount-set-state': 'error',
  // setState in componentDidUpdate.
  'react/no-did-update-set-state': 'error',
  // No namespace JSX names.
  'react/no-namespace': 'error',
  // shouldComponentUpdate on a PureComponent.
  'react/no-redundant-should-component-update': 'error',
  // this in a function component.
  'react/no-this-in-sfc': 'error',
  // Misspelt lifecycle and static names.
  'react/no-typos': 'error',
  // No UNSAFE_ lifecycle methods.
  'react/no-unsafe': 'error',
  // A component defined inside a component is remounted on every render.
  'react/no-unstable-nested-components': 'error',
  // A declared prop nothing reads.
  'react/no-unused-prop-types': 'error',
  // State nothing reads.
  'react/no-unused-state': 'error',
  // A new object as a default prop re-renders every time.
  'react/no-object-type-as-default-prop': 'error',
  // setState in componentWillUpdate.
  'react/no-will-update-set-state': 'error',
  // Props are read-only; auto-fixed.
  'react/prefer-read-only-props': 'error',
  // <div></div> is <div />.
  'react/self-closing-comp': 'error',
  // style takes an object.
  'react/style-prop-object': 'error',
  // <br> and <img> take no children.
  'react/void-dom-elements-no-children': 'error',
  // React Compiler check of the rules of hooks.
  'react-hooks/hooks': 'error',
  // A capitalised function is called as a component, not as a function.
  'react-hooks/capitalized-calls': 'error',
  // useMemo must return a value.
  'react-hooks/void-use-memo': 'error',
  // useMemo dependencies the compiler cannot match.
  'react-hooks/memo-dependencies': 'error',
  // An effect dependency that is a new value each render.
  'react-hooks/memoized-effect-dependencies': 'error',
  // Effect dependencies must list everything the effect reads.
  'react-hooks/exhaustive-effect-dependencies': 'error',
  // Derive values while rendering, not through state set in an effect.
  'react-hooks/no-deriving-state-in-effects': 'error',
  // The rules of hooks cannot be suppressed.
  'react-hooks/rule-suppression': 'error',
  // Link text such as "click here" tells a screen reader nothing.
  'jsx-a11y/anchor-ambiguous-text': 'error',
  // Every control has an accessible name.
  'jsx-a11y/control-has-associated-label': 'error',
  // html needs a valid lang.
  'jsx-a11y/lang': 'error',
  // aria-hidden on a focusable element hides it from assistive technology.
  'jsx-a11y/no-aria-hidden-on-focusable': 'error',
  // A native element instead of a role on a div.
  'jsx-a11y/prefer-tag-over-role': 'error',
};

/** The ultracite rules left off, with the reason. Each names a rule of an installed plugin. */
export const coreExclusions = {
  'no-await-in-loop':
    'functional/no-loop-statements already makes every loop justify itself, and a sequential await in a loop (order matters) would otherwise need two suppressions for one reason.',
  'no-magic-numbers':
    'Recorded decision: the typescript-eslint twin is excluded for the same reason (hardened.ts), and 28,961 findings are mostly test data and HTTP codes.',
  'sort-keys':
    'Taste rule with no bug-finding value: 26,419 findings, and key order is often meaningful (config, HTTP headers, translations).',
  'func-style':
    'Taste rule: it bans function declarations (7,881 findings), which the repositories use throughout and which keep hoisting and readable stack traces.',
  'prefer-named-capture-group':
    'Taste rule with no bug-finding value: 678 regexes would need hand rewriting for no behaviour change.',
  'no-inline-comments':
    'Taste rule with no bug-finding value, and it fights the trailing eslint-disable and unit comments that explain a value.',
  'no-plusplus':
    'Taste rule with no bug-finding value: i++ is idiomatic and Prettier and unicorn do not object.',
  'max-classes-per-file':
    'Taste rule with no bug-finding value: small helper classes next to their user are fine.',
  'sort-vars':
    'Taste rule with no bug-finding value: alphabetical order of declarators.',
  complexity:
    'Duplicates sonarjs/cyclomatic-complexity, which is excluded for the same reason (large refactor, recorded in hardened.ts).',
  'id-denylist': 'Matches nothing without options, so it is only noise.',
  'id-match': 'Matches nothing without options, so it is only noise.',
  'no-restricted-exports':
    'Matches nothing without options, so it is only noise.',
  'no-restricted-imports':
    'Matches nothing without options, so it is only noise.',
  'no-restricted-syntax':
    'Matches nothing without options, so it is only noise. The preset uses it with options for package.json, which a plain error here would replace.',
  'import/no-extraneous-dependencies':
    'Recorded decision: n/no-extraneous-import is excluded because it cannot follow workspace and nested manifests, and knip checks unlisted dependencies; 926 findings in 6 repositories are mostly that.',
  'import/dynamic-import-chunkname':
    'Only meaningful for webpack bundles (472 findings of a magic comment nothing reads).',
  'import/no-restricted-paths':
    'Matches nothing without options, so it is only noise.',
  'react/function-component-definition':
    'Taste rule: it rewrites 747 component declarations to arrow functions, and Next.js pages and layouts are default-exported function declarations.',
  'react/jsx-uses-react':
    'Marks React as used, which hides an unused React import from unused-imports; not needed with the automatic JSX runtime.',
  'react/prop-types':
    'Recorded decision (index.ts): TypeScript types the props.',
  'react/forbid-dom-props':
    'Matches nothing without options, so it is only noise.',
  'react/forbid-elements':
    'Matches nothing without options, so it is only noise.',
  'react/boolean-prop-naming':
    'Taste rule: it would force is and has prefixes on props such as disabled and checked.',
  'react/destructuring-assignment':
    'Taste rule with no bug-finding value: it forces destructuring of props and state.',
  'react/sort-comp':
    'Taste rule: order of class component methods; class components are legacy.',
  'react/sort-default-props':
    'Taste rule: order of defaultProps, which are legacy.',
  'react/sort-prop-types':
    'Taste rule: order of propTypes, which TypeScript replaces.',
  'react/jsx-fragments': 'Taste rule: syntax or element form of a fragment.',
  'react/jsx-handler-names':
    'Taste rule: it forces on and handle prefixes on handler names.',
  'react/prefer-exact-props':
    'Flow and propTypes only; TypeScript objects are checked by the compiler.',
  'react/state-in-constructor': 'Taste rule: class component state style.',
  'react/static-property-placement':
    'Taste rule: where class component statics go.',
  'react/prefer-stateless-function':
    'Taste rule about class components, which are legacy.',
  'react/prefer-es6-class':
    'Taste rule about createReactClass, which no repository uses.',
  'react/require-optimization':
    'Forces shouldComponentUpdate on every class component; not a defect.',
  'react/no-adjacent-inline-elements':
    'Taste rule about spacing between inline elements.',
  'react/no-set-state':
    'Bans setState outright; taste rule about class components.',
  'react-hooks/todo':
    'Reports syntax the React Compiler does not support yet; not a defect in the code (20 findings).',
  'react-hooks/invariant':
    'Reports internal compiler failures, not defects in the code.',
  'react-hooks/syntax':
    'Reports compiler parse limitations, not defects in the code.',
  'react-hooks/fbt':
    'Only relevant to Meta fbt strings, which no repository uses.',
  '@typescript-eslint/no-unused-vars':
    'Recorded decision (index.ts): unused-imports/no-unused-vars replaces it so one rule reports unused variables and the other removes unused imports.',
} satisfies Reasons;

/** The ultracite rules the preset cannot run: the plugin is missing or too old. */
export const unavailableRules = {
  'import/no-rename-default':
    'Not applicable: eslint-plugin-import has no such rule (it is eslint-plugin-import-x only).',
  'import/prefer-namespace-import':
    'Not applicable: eslint-plugin-import has no such rule (it is eslint-plugin-import-x only).',
  'import/avoid-barrel-files':
    'Not applicable: eslint-plugin-import has no such rule (it is eslint-plugin-import-x only).',
  'import/avoid-importing-barrel-files':
    'Not applicable: eslint-plugin-import has no such rule (it is eslint-plugin-import-x only).',
  'import/avoid-namespace-import':
    'Not applicable: eslint-plugin-import has no such rule (it is eslint-plugin-import-x only).',
  'import/avoid-re-export-all':
    'Not applicable: eslint-plugin-import has no such rule (it is eslint-plugin-import-x only).',
  'compat/compat':
    'Not applicable: eslint-plugin-compat is not a preset dependency.',
  'unicorn/name-replacements':
    'Not applicable: the installed eslint-plugin-unicorn has no such rule (a rename of prevent-abbreviations in a newer unicorn; the preset configures prevent-abbreviations).',
  'unicorn/prefer-combined-guards':
    'Not applicable: the installed eslint-plugin-unicorn has no such rule (added in a newer unicorn).',
} satisfies Reasons;
