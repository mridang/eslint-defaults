A plugin for eslint that has an opinionated set of linting rules for all the
@mridang scoped packages.

> [!NOTE]
> This plugin has only been tested with the ESlint 8 and the new flat
> configuration approach.

## Installation

Install using NPM by using the following command

```sh
npm install --save-dev @mridang/eslint-defaults
```

And then add the plugin to your `eslint.config.js` file.

```js
const mridangPlugin = require('@mridang/eslint-defaults');

module.exports = [...mridangPlugin.configs.recommended];
```

The example above shows this plugin can be used when the new flat configuration
approach is used. This plugin has not been tested with the legacy configuration.

## Usage

There isn't anything specific to be done once the plugin is installed. Simply
use if like any other eslint configuration.

## Contributing

If you have suggestions for how this library could be improved, or
want to report a bug, open an issue - I'd love all and any
contributions.

## License

Apache License 2.0 © 2024 Mridang Agarwalla
