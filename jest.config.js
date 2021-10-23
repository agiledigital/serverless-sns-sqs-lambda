module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  coverageThreshold: {
    global: {
      branches: 87,
      functions: 66,
      lines: 78,
      statements: 76
    }
  }
};
