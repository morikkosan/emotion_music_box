// eslint.config.cjs
module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: {
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        /** これを追加: catch(e) の e を "_" なら無視 */
        caughtErrorsIgnorePattern: "^_"
      }],
      "no-console": "off",
      "no-constant-condition": "warn",
    },
    linterOptions: { reportUnusedDisableDirectives: true },
  },
];
