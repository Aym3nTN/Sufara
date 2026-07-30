#!/usr/bin/env node
/**
 * Derives the production (PostgreSQL/Neon) Prisma schema from the canonical one.
 *
 * `api/prisma/schema.prisma` is the single source of truth for the data model
 * and uses SQLite, so local development and the test suite need no database
 * server. Production runs on Neon, and Prisma cannot take its `provider` from an
 * environment variable — so the production schema is generated here, differing
 * only in its `datasource` block.
 *
 *   node prisma/generate-production-schema.mjs           # write it
 *   node prisma/generate-production-schema.mjs --check    # verify it is current
 *
 * The --check mode is asserted by a test, so the two schemas cannot drift apart
 * unnoticed.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(here, 'schema.prisma');
const TARGET = path.join(here, 'production', 'schema.prisma');

const BANNER = `// ---------------------------------------------------------------------------
// GENERATED FILE — do not edit.
//
// Produced from prisma/schema.prisma by prisma/generate-production-schema.mjs.
// Edit the canonical schema, then run:
//     npm run prisma:prod:sync
// ---------------------------------------------------------------------------
`;

const PRODUCTION_DATASOURCE = `datasource db {
  provider = "postgresql"
  // Neon's pooled connection string, used by the running application.
  url      = env("DATABASE_URL")
  // Neon's direct (unpooled) connection string. Migrations must not run over a
  // connection pooler, which cannot hold the advisory locks Prisma relies on.
  directUrl = env("DIRECT_URL")
}`;

function build() {
  const source = readFileSync(SOURCE, 'utf8');

  const datasourceBlock = /datasource\s+db\s*\{[^}]*\}/;
  if (!datasourceBlock.test(source)) {
    throw new Error('Could not find the datasource block in prisma/schema.prisma');
  }

  // The generated client is written to a separate location so a production
  // generate cannot clobber the SQLite client used by dev and tests.
  const generatorBlock = /generator\s+client\s*\{[^}]*\}/;
  const withGenerator = source.replace(
    generatorBlock,
    `generator client {
  provider = "prisma-client-js"
}`,
  );

  return BANNER + withGenerator.replace(datasourceBlock, PRODUCTION_DATASOURCE);
}

const expected = build();

if (process.argv.includes('--check')) {
  const actual = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : '';
  if (actual !== expected) {
    console.error(
      'prisma/production/schema.prisma is out of date with prisma/schema.prisma.\nRun: npm run prisma:prod:sync',
    );
    process.exit(1);
  }
  console.log('production schema is up to date');
} else {
  mkdirSync(path.dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, expected);
  console.log(`wrote ${path.relative(process.cwd(), TARGET)}`);
}
