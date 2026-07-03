import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // Tampermonkey / Greasemonkey APIs
        GM_info: 'readonly',
        GM_getValue: 'readonly',
        GM_setValue: 'readonly',
        GM_deleteValue: 'readonly',
        GM_listValues: 'readonly',
        GM_addStyle: 'readonly',
        GM_xmlhttpRequest: 'readonly',
        GM_registerMenuCommand: 'readonly',
        GM_unregisterMenuCommand: 'readonly',
        GM_setClipboard: 'readonly',
        GM_openInTab: 'readonly',
        GM_notification: 'readonly',
        GM_download: 'readonly',
        unsafeWindow: 'readonly',
        // Build-time constants (replaced by Rollup)
        __CS_DEV_MODE_BUILDFLAG__: 'readonly',
      },
    },
    rules: {
      // ── Style ──────────────────────────────────────────────
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'indent': ['error', 2, { SwitchCase: 1 }],

      // ── Best practices ─────────────────────────────────────
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-constant-condition': ['error', { checkLoops: false }],

      // ── Relaxations for userscript codebase ────────────────
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-control-regex': 'off',
      'no-useless-escape': 'warn',
    },
  },
  {
    // Test files can use describe/it/expect globals
    files: ['**/__tests__/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        test: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
      },
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'packages/user/ai/ai-agent-engine/**',
      'rules/merged-patterns.json',
    ],
  },
];
