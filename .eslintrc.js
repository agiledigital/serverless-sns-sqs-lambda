module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  env: {
    commonjs: true,
    browser: true,
    jest: true,
    es2020: true
  },
  parserOptions: {
    ecmaVersion: 11
  }
};
