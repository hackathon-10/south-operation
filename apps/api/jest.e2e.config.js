/**
 * בדיקות אינטגרציה מקצה לקצה מול API אמיתי ומסד PostgreSQL בתוך התהליך (PGlite).
 * אין צורך ב-Docker או בשרת מסד חיצוני.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/.*\.e2e-spec\.ts$',
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  transformIgnorePatterns: ['/node_modules/', 'packages[\\/]shared[\\/]dist'],
  testEnvironment: 'node',
  testTimeout: 180000,
  globalSetup: '<rootDir>/test/global-setup.ts',
  maxWorkers: 1,
};
