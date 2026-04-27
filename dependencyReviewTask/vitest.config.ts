import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    // Prefer TypeScript source over compiled JS so vi.mock applies correctly to ESM imports
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/__tests__/**', 'node_modules/**'],
    },
  },
})
