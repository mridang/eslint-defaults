import maxBooleanConditions from './max-boolean-conditions.js';
import noArrayFilterMap from './no-array-filter-map.js';
import noBareNewMap from './no-bare-new-map.js';
import noCallOnlyAssertions from './no-call-only-assertions.js';
import noChainedTypeAssertions from './no-chained-type-assertions.js';
import noConditionalEmptyObjectSpread from './no-conditional-empty-object-spread.js';
import noDuplicateConsts from './no-duplicate-consts.js';
import noDuplicateTypes from './no-duplicate-types.js';
import noKnownValueWidening from './no-known-value-widening.js';
import noModuleMocking from './no-module-mocking.js';
import noObjectParameters from './no-object-parameters.js';
import noPassThroughSchema from './no-pass-through-schema.js';
import noPassThroughTypeAlias from './no-pass-through-type-alias.js';
import noPoorSubstringTests from './no-poor-substring-tests.js';
import noReduceAccumulatorCopy from './no-reduce-accumulator-copy.js';
import noReexportsOutsideEntrypoints from './no-reexports-outside-entrypoints.js';
import noReflectApply from './no-reflect-apply.js';
import noReflectGet from './no-reflect-get.js';
import noRenamedImports from './no-renamed-imports.js';
import noRepeatedExpectCall from './no-repeated-expect-call.js';
import noRuntimeTypeof from './no-runtime-typeof.js';
import noStructuralSymbolNames from './no-shape-in-symbol-names.js';
import noUnknownParameters from './no-unknown-parameters.js';
import noUnknownReturns from './no-unknown-returns.js';
import noUnknownTypeAliases from './no-unknown-type-aliases.js';
import noUnsafeDictionaryType from './no-unsafe-dictionary-type.js';
import noWidenThenAssert from './no-widen-then-assert.js';
import requireSafetyComment from './require-safety-comment-for-type-assertion.js';
import type { Rule } from 'eslint';

export const rules = {
  'max-boolean-conditions': maxBooleanConditions,
  'no-array-filter-map': noArrayFilterMap,
  'no-bare-new-map': noBareNewMap,
  'no-call-only-assertions': noCallOnlyAssertions,
  'no-chained-type-assertions': noChainedTypeAssertions,
  'no-conditional-empty-object-spread': noConditionalEmptyObjectSpread,
  'no-duplicate-consts': noDuplicateConsts,
  'no-duplicate-types': noDuplicateTypes,
  'no-known-value-widening': noKnownValueWidening,
  'no-module-mocking': noModuleMocking,
  'no-object-parameters': noObjectParameters,
  'no-pass-through-schema': noPassThroughSchema,
  'no-pass-through-type-alias': noPassThroughTypeAlias,
  'no-poor-substring-tests': noPoorSubstringTests,
  'no-reduce-accumulator-copy': noReduceAccumulatorCopy,
  'no-reexports-outside-entrypoints': noReexportsOutsideEntrypoints,
  'no-reflect-apply': noReflectApply,
  'no-reflect-get': noReflectGet,
  'no-renamed-imports': noRenamedImports,
  'no-repeated-expect-call': noRepeatedExpectCall,
  'no-runtime-typeof': noRuntimeTypeof,
  'no-shape-in-symbol-names': noStructuralSymbolNames,
  'no-unknown-parameters': noUnknownParameters,
  'no-unknown-returns': noUnknownReturns,
  'no-unknown-type-aliases': noUnknownTypeAliases,
  'no-unsafe-dictionary-type': noUnsafeDictionaryType,
  'no-widen-then-assert': noWidenThenAssert,
  'require-safety-comment-for-type-assertion': requireSafetyComment,
} satisfies Record<string, Rule.RuleModule>;

export default { meta: { name: 'tslop' }, rules };
