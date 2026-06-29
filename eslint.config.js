const { defineConfig, globalIgnores } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
const globals = require('globals');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  globalIgnores(['dist/*']),
  ...expo,
  eslintPluginPrettierRecommended,
  {
    settings: {
      'import/resolver': {
        alias: {
          map: [['@', './src']],
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      },
    },
  },
  {
    files: ['babel.config.js', 'metro.config.js', 'jest.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // React Compiler lint (react-hooks v7) — enable incrementally; repo not migrated yet.
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/error-boundaries': 'off',
      'react/no-unescaped-entities': 'off',
      'react/display-name': 'off',
      'import/no-unresolved': [
        'error',
        {
          ignore: ['^@/atproto/oauthClient$'],
        },
      ],
    },
  },
]);
