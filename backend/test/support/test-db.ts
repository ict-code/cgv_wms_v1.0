import { fileURLToPath } from 'node:url';

export const TEST_DB_PORT = 15498;
export const TEST_DB_NAME = 'wms_test';
export const TEST_DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${TEST_DB_PORT}/${TEST_DB_NAME}`;
export const TEST_DB_DIR = fileURLToPath(new URL('../../.test-db-data', import.meta.url));

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-do-not-use-in-production';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-do-not-use-in-production';
