export default {
  ignore: ['knip.config.ts'],
  ignoreDependencies: [
    /^@semantic-release\//,
    'astro-eslint-parser',
    'prettier-plugin-astro',
    'prettier-plugin-svelte',
    'svelte-eslint-parser',
  ],
};
