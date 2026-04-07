module.exports = {
  testEnvironment: 'jsdom',
  collectCoverage: true,
  transform: {
    '^.+\\.(t|j)sx?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '\\.(css|less|scss)$': '<rootDir>/jest/styleMock.js',
    '^@\\/(.*)$': '<rootDir>/src/$1',
    '^isomorphic-dompurify$': '<rootDir>/node_modules/isomorphic-dompurify/dist/browser.js',
  },
  // Ignore built/distribution files to avoid haste name collisions
  modulePathIgnorePatterns: ['<rootDir>/dist-lib/'],
  testPathIgnorePatterns: ['/tests/e2e/'],
  setupFilesAfterEnv: ['<rootDir>/jest/setupTests.js'],
}
