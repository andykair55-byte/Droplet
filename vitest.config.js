import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.js'],
    environment: 'node',
    globals: true,
    testTimeout: 10000,
  },
});
