/* eslint-disable no-duplicate-imports -- each ambient module declares its own import of the ESLint types */
declare module 'eslint-plugin-json';
declare module 'eslint-plugin-markdown';
declare module 'eslint-plugin-tailwindcss' {
  import type { ESLint } from 'eslint';

  const plugin: ESLint.Plugin;
  export default plugin;
}
declare module 'eslint-plugin-tailwindcss-v3' {
  import type { ESLint } from 'eslint';

  const plugin: ESLint.Plugin;
  export default plugin;
}
declare module 'eslint-plugin-jsx-a11y' {
  import type { ESLint, Linter } from 'eslint';

  const plugin: Omit<ESLint.Plugin, 'configs'> & {
    configs: Record<string, { rules: Linter.RulesRecord }>;
  };
  export default plugin;
}
declare module 'eslint-plugin-import' {
  import type { ESLint, Linter } from 'eslint';

  const plugin: Omit<ESLint.Plugin, 'configs'> & {
    configs: Record<string, { rules: Linter.RulesRecord }>;
  };
  export default plugin;
}
declare module 'eslint-plugin-no-unsanitized';
declare module 'eslint-plugin-cypress';
declare module 'eslint-plugin-promise';
declare module 'eslint-plugin-github';
/* eslint-enable no-duplicate-imports -- end of the ambient modules */
