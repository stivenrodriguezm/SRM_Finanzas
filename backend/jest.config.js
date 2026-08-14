/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/jestEnv.ts'],
  testMatch: ['**/tests/**/*.test.ts'],
  testTimeout: 30000,
};
