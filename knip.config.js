module.exports = {
  entry: ['src/index.js'],
  ignore: ['test/fixtures/**'],
  ignoreDependencies: [
    'eslint-import-resolver-typescript',
    '@semantic-release/*',
  ],
};
