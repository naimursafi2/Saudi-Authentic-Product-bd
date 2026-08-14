/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testMatch: ["**/tests/**/*.test.ts"],
  clearMocks: true,
  verbose: true,
  transform: {
    // The main tsconfig.json excludes `src/tests/**/*` (so test files never
    // end up in the compiled `dist/` build output) — use a separate config
    // for ts-jest that keeps everything else identical but doesn't exclude
    // tests, otherwise ts-jest can't type-check them.
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/../tsconfig.jest.json" }],
  },
};
