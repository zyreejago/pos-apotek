const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: [
    '<rootDir>/server/',
    '<rootDir>/src/app/substitutions/',
    '<rootDir>/src/app/recommendations-openrouter/',
    '<rootDir>/src/app/recommendations-debug/',
    '<rootDir>/src/app/api/substitutions/',
    '<rootDir>/src/app/api/knowledge/',


    '<rootDir>/src/components/__tests__/(?!AuthProvider.module.test.tsx).*',
    '<rootDir>/src/context/__tests__/',
    '<rootDir>/src/components/ui/__tests__/',
    '<rootDir>/src/app/api/__tests__/substitutions.route.module.test.ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    '<rootDir>/src/app/**/*.tsx',
    '<rootDir>/src/app/api/**/*.ts',
    '!<rootDir>/src/app/**/__tests__/**/*',
    '!<rootDir>/src/components/**/*',
    '<rootDir>/src/components/AuthProvider.tsx',
    '!<rootDir>/src/app/api/substitutions/**/*',
  ],
  coveragePathIgnorePatterns: [
    '<rootDir>/src/app/layout.tsx',
    '<rootDir>/src/app/substitutions/',
    '<rootDir>/src/app/recommendations-openrouter/',
    '<rootDir>/src/app/recommendations-debug/',
    '<rootDir>/src/app/api/substitutions/',
    '<rootDir>/src/app/api/knowledge/',
    '<rootDir>/src/context/',
    '<rootDir>/src/components/ui/',
  ],
};

module.exports = createJestConfig(customJestConfig);
