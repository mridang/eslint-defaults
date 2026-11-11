import fs from 'node:fs/promises';
import { COVERAGE_DIRECTORY } from './utils/coverage-sources.ts';

// noinspection JSUnusedGlobalSymbols
export default async function teardown(): Promise<void> {
  await fs.rm(COVERAGE_DIRECTORY, { recursive: true, force: true });
}
