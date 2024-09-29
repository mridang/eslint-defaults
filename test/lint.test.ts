import { loadESLint } from 'eslint';

describe('lint configuration test', () => {
  it('should load and print lint config', async () => {
    await loadESLint({ useFlatConfig: true });
  });
});
