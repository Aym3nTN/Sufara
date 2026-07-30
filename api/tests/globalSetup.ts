import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { rmSync } from 'node:fs';
import path from 'node:path';

/**
 * Each test run starts from a freshly migrated and seeded SQLite database, so
 * suites never inherit state from a previous run or from the dev database.
 *
 * The seeded password is generated here and handed to the seed and the suites
 * through the environment. No password literal exists in the repository — one
 * would be a live credential for every deployment that runs the seed.
 */
export default function setup() {
  const cwd = path.resolve(import.meta.dirname, '..');
  const seedPassword = `${randomBytes(12).toString('base64url')}aA1!`;

  // Forked test workers inherit this, which is how tests/helpers.ts reads it.
  process.env.SEED_PASSWORD = seedPassword;

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: 'file:./test.db',
    SEED_PASSWORD: seedPassword,
  };

  for (const file of ['test.db', 'test.db-journal']) {
    rmSync(path.join(cwd, 'prisma', file), { force: true });
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { cwd, env, stdio: 'ignore' });
  execFileSync('npx', ['tsx', 'prisma/seed.ts'], { cwd, env, stdio: 'ignore' });
}
