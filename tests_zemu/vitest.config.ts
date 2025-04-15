import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./globalsetup.js'],
    include: [
      'tests/**/*.test.ts',
    ],
    testTimeout: 600000, // 10 minutes
    poolOptions: {
      threads: {
        singleThread: false,
      },
      forks: {
        maxForks: 2,
      },
    },
    maxWorkers: 2,
    minWorkers: 1,
    isolate: true,
    sequence: {
      concurrent: true
    },
    pool: 'forks',
    fileParallelism: true
  },
})

