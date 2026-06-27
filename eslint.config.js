// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/fixtures/**",
      "**/*.cjs",
      "**/*.mjs",
    ],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // src files resolve via tsconfig.json; test files via tsconfig.test.json
        // (tsconfig.json deliberately excludes tests, so both are listed).
        project: ["./packages/*/tsconfig.json", "./packages/*/tsconfig.test.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  {
    // Build/test config files live outside the TS project graph — lint them
    // without type information so the project service doesn't reject them.
    files: ["**/*.config.{ts,js,mts,mjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  {
    // Quarantine: these loaders navigate dynamically-shaped third-party schema
    // internals (zod/valibot/arktype) that are not publicly typed. (The oxc AST
    // walker in scan-source.ts is now fully typed and no longer quarantined.)
    files: ["**/src/loaders/zod.ts", "**/src/loaders/valibot.ts", "**/src/loaders/arktype.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
    },
  },

  {
    // Tests legitimately parse loosely-typed CLI/JSON output and fixture objects;
    // the unsafe-any family + require-await add noise without catching product
    // bugs. no-explicit-any, no-floating-promises and only-throw-error stay on.
    files: ["**/tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/require-await": "off",
    },
  },

  prettier,
);
