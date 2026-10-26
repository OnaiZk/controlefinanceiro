import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';
export default [
  {
    ignores: [
      '**/.next/**',
      '**/node_modules/**',
      '**/.expo/**',
      '**/dist/**',
      'convex/_generated/**',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { '@typescript-eslint': plugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-debugger': 'error',
    },
  },
];
