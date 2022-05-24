module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  coverageThreshold: {
    global: {
      branches: 74.5,
      functions: 66,
      lines: 78,
      statements: 76
    }
  }
};
