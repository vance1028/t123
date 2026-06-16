import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 6692,
    open: false
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true
  }
});
