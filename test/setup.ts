import fs from 'node:fs/promises';
import path from 'node:path';
import {
  COVERAGE_DIRECTORY,
  COVERAGE_SOURCES,
} from './utils/coverage-sources.ts';

// Written before any test runs so typescript-eslint sees them in the project.
// noinspection JSUnusedGlobalSymbols
export default async function setup(): Promise<void> {
  await fs.mkdir(COVERAGE_DIRECTORY, { recursive: true });
  for (const [filePath, text] of COVERAGE_SOURCES) {
    await fs.writeFile(path.join(process.cwd(), filePath), text);
  }
}
