const mridangPlugin = require('./src/index');

module.exports = [
  {
    ignores: ['test/fixtures'],
  },
  ...mridangPlugin.configs.recommended,
];
