# Third-party licences

The rules of this plugin are ESLint rewrites of rules from two MIT-licensed
Oxlint projects. The logic, the messages and the options follow the originals.

- anti-slop (https://github.com/dmmulroy/anti-slop), Copyright (c) 2026 Dillon Mulroy.
  Source of: no-array-filter-map, no-chained-type-assertions,
  no-conditional-empty-object-spread, no-known-value-widening, no-module-mocking,
  no-object-parameters, no-reduce-accumulator-copy, no-reflect-apply,
  no-reflect-get, no-runtime-typeof, no-shape-in-symbol-names,
  no-unknown-parameters (narrowed), no-unknown-returns, no-unknown-type-aliases,
  no-unsafe-dictionary-type, no-widen-then-assert,
  require-safety-comment-for-type-assertion.
- ai-deslop 0.6.0 (https://github.com/maharshi365/deslop), MIT.
  Source of: max-boolean-conditions, no-bare-new-map (from its no-restricted-syntax
  entry), no-call-only-assertions, no-duplicate-consts, no-duplicate-types
  (type declarations only), no-pass-through-schema, no-pass-through-type-alias,
  no-poor-substring-tests, no-reexports-outside-entrypoints, no-renamed-imports,
  no-repeated-expect-call.

## MIT License (anti-slop)

MIT License

Copyright (c) 2026 Dillon Mulroy

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## MIT License (ai-deslop)

ai-deslop 0.6.0 ships no licence file; its package.json declares the MIT licence, and its README credits anti-slop (MIT, Dillon Mulroy) for the generic rules.
