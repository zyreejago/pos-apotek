const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['<rootDir>/server/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    '<rootDir>/src/app/**/*.tsx',
    '<rootDir>/src/components/**/*.tsx',
    '<rootDir>/src/hooks/**/*.ts',
    '<rootDir>/src/app/api/**/*.ts',
    '!<rootDir>/src/app/**/__tests__/**/*',
    '!<rootDir>/src/components/**/__tests__/**/*',
    '!<rootDir>/src/hooks/**/__tests__/**/*',
  ],
  coveragePathIgnorePatterns: [
    '<rootDir>/src/app/layout.tsx',
  ],
};

module.exports = createJestConfig(customJestConfig);
