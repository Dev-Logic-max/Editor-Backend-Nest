// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist', 'node_modules'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
      import: importPlugin,
    },
  },
  {
    rules: {
      // --- Useful rules ---
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',

      // --- Disable noisy rules (good for real-world NestJS projects) ---
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',

      // Import sorting
      'simple-import-sort/imports': [
        'error',
        {
          "groups": [
            // 1. Node.js builtins (fs, path, crypto)
            ["^node:", "^fs$", "^path$", "^crypto$", "^[a-z]+$"],

            // 2. Packages from node_modules (react, nestjs, express)
            ["^@?\\w"],

            // 3. NestJS internal packages
            ["^@nestjs/"],

            // 4. Absolute imports with @ alias (your project structure)
            ["^@/"],

            // 5. Relative imports
            ["^\\./"],
            ["^\\.\\./"],

            // 6. Styles, JSON files, assets
            ["\\.css$", "\\.scss$", "\\.json$"]
          ]
        }
      ],
      'simple-import-sort/exports': 'error',

      // Prettier formatting
      'prettier/prettier': 'error',
    },
  },
);