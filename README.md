A plugin for eslint that has an opinionated set of linting rules for all the
@mridang scoped packages.

> [!NOTE]
> This plugin targets ESLint 9 and the flat config format.

It ships a batteries-included lint setup for JS/TS, JSON/JSONC/JSON5, Markdown, YAML, TOML, HTML, and CSS. Bundled plugins include:

- [`@eslint/js`](https://www.npmjs.com/package/@eslint/js)
- [`@typescript-eslint/eslint-plugin`](https://www.npmjs.com/package/@typescript-eslint/eslint-plugin) with [`@typescript-eslint/parser`](https://www.npmjs.com/package/@typescript-eslint/parser)
- [`eslint-plugin-prettier`](https://www.npmjs.com/package/eslint-plugin-prettier)
- [`eslint-plugin-json`](https://www.npmjs.com/package/eslint-plugin-json) and [`eslint-plugin-jsonc`](https://www.npmjs.com/package/eslint-plugin-jsonc)
- [`eslint-plugin-markdown`](https://www.npmjs.com/package/eslint-plugin-markdown)
- [`eslint-plugin-tailwindcss`](https://www.npmjs.com/package/eslint-plugin-tailwindcss)
- [`eslint-plugin-testing-library`](https://www.npmjs.com/package/eslint-plugin-testing-library)
- [`eslint-plugin-react`](https://www.npmjs.com/package/eslint-plugin-react) and [`eslint-plugin-react-hooks`](https://www.npmjs.com/package/eslint-plugin-react-hooks)
- [`eslint-plugin-jsx-a11y`](https://www.npmjs.com/package/eslint-plugin-jsx-a11y)
- [`eslint-plugin-import`](https://www.npmjs.com/package/eslint-plugin-import)
- [`eslint-plugin-perfectionist`](https://www.npmjs.com/package/eslint-plugin-perfectionist)
- [`eslint-plugin-no-unsanitized`](https://www.npmjs.com/package/eslint-plugin-no-unsanitized)
- [`eslint-plugin-cypress`](https://www.npmjs.com/package/eslint-plugin-cypress)
- [`@html-eslint/eslint-plugin`](https://www.npmjs.com/package/@html-eslint/eslint-plugin)
- [`@eslint/css`](https://www.npmjs.com/package/@eslint/css)
- [`eslint-plugin-yml`](https://www.npmjs.com/package/eslint-plugin-yml)
- [`eslint-plugin-toml`](https://www.npmjs.com/package/eslint-plugin-toml)

## Installation

Install using NPM by using the following command

```sh
npm install --save-dev @mridang/eslint-defaults
```

And then add the plugin to your `eslint.config.js` file.

```js
// eslint.config.mjs
import mridangPlugin from '@mridang/eslint-defaults';

export default [...mridangPlugin.configs.recommended];
```

The example above uses the ESLint 9 flat configuration. Legacy config is not supported.

## Usage

Once installed, point your flat config at the recommended export and you’re good to go. Treat it like any other shareable config; add your own rules and overrides as needed.

### Adding support for a framework

You can layer framework presets on top of this config. Import the framework plugin’s flat config and spread it after `@mridang/eslint-defaults`.

Astro (via [`eslint-plugin-astro`](https://www.npmjs.com/package/eslint-plugin-astro))

```js
// eslint.config.mjs
import mridangPlugin from '@mridang/eslint-defaults';
import astro from 'eslint-plugin-astro';

export default [
  ...mridangPlugin.configs.recommended,
  ...astro.configs.recommended,
];
```

Svelte (via [`eslint-plugin-svelte`](https://www.npmjs.com/package/eslint-plugin-svelte))

```js
// eslint.config.mjs
import mridangPlugin from '@mridang/eslint-defaults';
import svelte from 'eslint-plugin-svelte';

export default [
  ...mridangPlugin.configs.recommended,
  ...svelte.configs['flat/recommended'],
];
```

Next.js (via [`@next/eslint-plugin-next`](https://www.npmjs.com/package/@next/eslint-plugin-next))

```js
// eslint.config.mjs
import mridangPlugin from '@mridang/eslint-defaults';
import next from '@next/eslint-plugin-next';

export default [
  ...mridangPlugin.configs.recommended,
  next.configs['core-web-vitals'],
];
```

Vue (via [`eslint-plugin-vue`](https://www.npmjs.com/package/eslint-plugin-vue))

```js
// eslint.config.mjs
import mridangPlugin from '@mridang/eslint-defaults';
import vue from 'eslint-plugin-vue';

export default [
  ...mridangPlugin.configs.recommended,
  ...vue.configs['flat/recommended'],
];
```

## Contributing

If you have suggestions for how this library could be improved, or
want to report a bug, open an issue - I'd love all and any
contributions.

## License

Apache License 2.0 © 2024 Mridang Agarwalla
