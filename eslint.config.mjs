import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Static assets are never linted — includes the vendored, minified Draco
    // decoder under public/draco/ (self-hosted to avoid the gstatic CDN).
    "public/**",
  ]),
  // Treat a leading underscore as "intentionally unused" (params, locals, and
  // caught errors) and ignore rest-siblings — the `const { id: _id, ...rest }`
  // omit pattern is deliberate, not dead code.
  {
    rules: {
      // Promote unused-vars to a CI-failing error (the codebase is already clean),
      // so dead locals/imports can't quietly accumulate.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // Type-aware safety net for the server entry points (API routes, cron, webhooks,
  // server actions): an unhandled promise here can silently drop a DB write or a
  // notification. Scoped to keep the rest of lint fast and non-type-aware.
  {
    files: ["app/api/**/*.ts", "lib/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
]);

export default eslintConfig;
