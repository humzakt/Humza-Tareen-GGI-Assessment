import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jose|uuid)/)',
  ],
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/**/*.types.ts',
    '!src/**/*.constants.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  clearMocks: true,
  restoreMocks: true,
};

export default config;
