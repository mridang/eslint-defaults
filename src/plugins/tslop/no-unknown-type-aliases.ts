import { AST_NODE_TYPES } from '@typescript-eslint/types';
import {
  createTypeAliasEnvironment,
  resolvedTypeMatches,
} from './shared/type-alias-resolution.js';
import { defineRule, programOf, report, visitorKeys } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';

/**
 * `tslop/no-unknown-type-aliases`: no `type X = unknown`.
 *
 * What it flags: a type alias whose resolved type is `unknown`, or a union that
 * holds `unknown` (`type Json = unknown | string`), also through other local
 * aliases.
 *
 * Why: an alias hides `unknown` behind a name, so the places that use it look
 * typed and nobody sees that the value is unparsed.
 *
 * How to fix: write `unknown` where the value enters the program (the parsing
 * boundary), and use the parsed domain type everywhere else.
 */
export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow type aliases whose resolved type is unknown; unknown must remain visible at an allowed boundary.',
    },
    schema: [],
    messages: {
      unknownAlias:
        'Type alias `{{alias}}` hides `unknown`. Keep `unknown` explicit at the parsing boundary or on an allowed `cause` field; otherwise use the parsed owner type.',
    },
  },
  create(context) {
    const resolvesToUnknown = (type: TSESTree.TypeNode): boolean =>
      resolvedTypeMatches(
        type,
        createTypeAliasEnvironment(programOf(context), visitorKeys(context)),
        (resolved, matches) => {
          if (resolved.type === AST_NODE_TYPES.TSUnknownKeyword) {
            return true;
          }
          return (
            resolved.type === AST_NODE_TYPES.TSUnionType &&
            resolved.types.some((member) => matches(member))
          );
        },
      );

    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      TSTypeAliasDeclaration(node: TSESTree.TSTypeAliasDeclaration) {
        if (resolvesToUnknown(node.typeAnnotation)) {
          report(context, node.id, 'unknownAlias', { alias: node.id.name });
        }
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
