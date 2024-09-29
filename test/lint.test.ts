import { loadESLint } from 'eslint';

describe('lint configuration test', () => {
  it('should load and print lint config', async () => {
    const Linter = await loadESLint({ useFlatConfig: true });
  });
});
