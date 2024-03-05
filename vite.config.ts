import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        testTimeout: 0,
        maxConcurrency: 1,
    },
})
