# Working in this repository

`@mridang/eslint-defaults` is the shared ESLint flat config for every Node repository of this owner. A change to it reaches about 33 repositories, so a rule change is a release plus a rollout. This file says how to do both.

## Where the rule decisions live

- `src/hardened.ts` holds every decision, each with its reason next to it.
  - `LIBRARIES`: plugins whose every rule is an error unless it is listed in `excluded` with a reason.
  - `unicornExclusions` and `unicornRuleSettings`: unicorn is enabled through its own `all` config, minus the exclusions, plus rules that need options.
  - `typescriptRuleSettings` and `typescriptExclusions`: typescript-eslint rules beyond its `recommended` set, with options, and the rules left off.
- `test/hardened.test.ts` enforces that every live rule of a plugin is either on or listed with a reason, and holds small lint tests for rules that must agree with each other.
- Never switch a rule off without writing why. Never loosen a rule to avoid fixing code. Use an option only when the reason is written next to it.
- Review history of each plugin is in the GitHub issues of this repository (unicorn #107, typescript-eslint #139, e18e #140).

## Changing the rule set

1. Measure first. `etc/rule-impact.ts` lints every repository that depends on the preset with every rule of a plugin switched on and writes one HTML report (see its header for the flags). Run the type-aware pass one repository at a time (`--pass typed --repos <name> --state <file>`) with `NODE_OPTIONS=--max-old-space-size=6144`, never two lint processes at once. Measure with each repository's real `tsconfig.json`: the preset prefers `tsconfig.jest.json`, whose `NodeNext` resolution cannot resolve `@/` or extensionless imports in the Next apps, which makes the `no-unsafe-*` rules report about 100,000 false findings. The `typescript` the tool resolves must be the version the repositories use.
2. Decide rule by rule, with real examples from the repositories and a count of what is auto-fixable. Prefer enabling a rule and fixing the code over an option. Prefer a library the repository already depends on over a new helper function.
3. Run a conflict check before releasing: lint every repository with the new rules, with and without `--fix`, and compare the findings by rule. A rule whose count rises after `--fix` is a fix that breaks another rule; resolve it in the rule set (examples: `e18e/prefer-charcode-at-in-loop` and `unicorn/prefer-code-point` agree on `codePointAt`; `unicorn/no-useless-undefined` and `sonarjs/no-inconsistent-returns` agree when the function has an explicit return type; `no-unnecessary-type-assertion` removes a cast from an untyped import and then `no-unsafe-*` reports it, so type the import once).
4. Add the rules in `src/hardened.ts`, fix this repository's own code under them (it is linted with its own build), add tests, and run `npm test` and `npx eslint .`.

## Releasing

1. Branch `feat/<description>` from an up-to-date `master`, work in a worktree under `.claude/worktrees/`. Install with `devbox run -- npm ci`, then `npm run build`.
2. A `feat:` commit releases a minor version, a `fix:` a patch. `chore:` and `docs:` do not release.
3. The lock file must pass `npm ci` under the Node of `devbox.json`. If npm drops the nested `@emnapi/core` and `@emnapi/runtime` entries, `npm ci` fails in CI; restore them. Regenerate the lock with the devbox npm, not another one.
4. Follow `.github/pull_request_template.md`. Link the issue with `Closes #N`. Merge only when every check is green; releases publish from `master` through semantic-release.
5. `git checkout devbox.lock` before committing here, because devbox rewrites it. In the other repositories a generated `devbox.lock` change is committed with the rollout.

## Rolling a change out to the repositories

Do the release first, then fix each repository against the published version. Testing against a symlink to an unpublished build hides real problems: the symlink resolves the preset's own `typescript` instead of the repository's, and it makes CI red until a bump.

1. List the repositories: the folders under `~/Code/mridang` whose `package.json` depends on `@mridang/eslint-defaults`.
2. For each repository, in a temporary clone (never in `~/Code`, never in the owner's checkout):
   - `git clone`, switch to a branch `chore/<description>` from the default branch (`master`).
   - `devbox run -- npm install @mridang/eslint-defaults@^<new version>` (plain `npm` when there is no `devbox.json`). Check the lock file still has its `@emnapi` entries.
   - `npx eslint . --fix`, then fix the rest by hand. Behaviour and public API must not change: no renamed exports, no changed action inputs. Where a fix would change either, add `// eslint-disable-next-line <rule> -- <specific reason>` and list it in the PR.
   - Run what CI runs: lint, `prettier --check .`, the typecheck, the tests. For GitHub Actions that commit a bundle, rebuild it with the repository's script.
   - Commit `chore: <what changed>` with explicit paths and no trailer. Include a changed `devbox.lock`. Push without force and open the PR from the repository's template.
   - Wait for the checks, then squash-merge. After merging, check the checks on the default branch.
3. `jest.config.mjs` is identical in every repository: change it once and apply the same change everywhere.
4. Large repositories need the lint run alone, with a 6 GB heap, in directory chunks if it still runs out of memory. A typed lint that fails on every file is a TypeScript version mismatch, not memory.
5. Never use `pkill`, `killall` or any pattern-based kill; other work on the machine is linting too. Stop only a process you started, by its PID.

## Things that went wrong before

- A brief that says "do not bump the preset" and later asks for the bump leaves the sessions stuck. Another session's message is not the owner's approval, so a session started by `start_session` will not act on it; give the instruction in its own task, or do the work from the parent session in temporary clones. Sessions cannot be started while the owner is connected over Remote Control.
- A cleanup script can prune worktrees. Keep build copies outside `.claude/worktrees/`.
- `sonarjs/void-use` does not report `void promise()`; do not invent a conflict without testing it.
- `.catch(() => undefined)` is fine, `.forEach` is not (`unicorn/no-array-for-each`), a string spread is not (`@typescript-eslint/no-misused-spread`): count characters with `Intl.Segmenter` or a `for...of` loop.
- Use the repository's own library (for example zod for form fields) instead of adding a helper function to each repository.
- Archive sessions when their work is merged, and remove temporary clones and worktrees at the end.
