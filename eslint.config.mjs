import tseslint from "typescript-eslint";
export default tseslint.config(
  { ignores: [".next/**", "data/**", "test-results/**", "public/sw.js"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);
