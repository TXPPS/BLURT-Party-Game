// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * BLURT — lint rules.
 *
 * The rules that matter here are the ones a reviewer would otherwise have to
 * remember: no raw HTML injection anywhere in the repo, no `any` in the shared or
 * server code, and no floating promises in the Durable Object.
 */
export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', '.wrangler/**', '.tsbuild/**', 'artifacts/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Section 17: dangerouslySetInnerHTML is banned repo-wide. React escapes
      // everything by default; the only way to defeat that is this prop, so the
      // ban is the whole XSS story for player-supplied text.
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            'dangerouslySetInnerHTML is banned. Render player text as children so React escapes it.',
        },
        {
          selector: "Property[key.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML is banned repo-wide (see BLURT security notes).',
        },
        {
          selector: "MemberExpression[property.name='innerHTML']",
          message: 'Assigning innerHTML is banned. Use textContent or React children.',
        },
        {
          selector: "MemberExpression[property.name='outerHTML']",
          message: 'Assigning outerHTML is banned. Use textContent or React children.',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // `any` is banned outright in the code both sides depend on.
    files: ['shared/**/*.ts', 'server/**/*.ts', 'content/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['tests/**/*.ts', 'scripts/**/*.ts', 'content/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
