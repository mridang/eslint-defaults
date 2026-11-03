import { loadESLint } from 'eslint';

describe('lint configuration test', () => {
  it('should load and print lint config', async () => {
    await expect(loadESLint({ useFlatConfig: true })).resolves.toBeDefined();
  });
});
