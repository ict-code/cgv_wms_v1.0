import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import EmbeddedPostgres from 'embedded-postgres';
import { TEST_DATABASE_URL, TEST_DB_DIR, TEST_DB_NAME, TEST_DB_PORT } from './test-db.js';

export default async function setup() {
  rmSync(TEST_DB_DIR, { recursive: true, force: true });

  const pg = new EmbeddedPostgres({
    databaseDir: TEST_DB_DIR,
    port: TEST_DB_PORT,
    user: 'postgres',
    password: 'postgres',
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase(TEST_DB_NAME);

  execSync('npx prisma migrate deploy', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });

  return async () => {
    await pg.stop();
    rmSync(TEST_DB_DIR, { recursive: true, force: true });
  };
}
