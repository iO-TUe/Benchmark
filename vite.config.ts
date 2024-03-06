import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        testTimeout: 0,
        maxConcurrency: 1,
        poolOptions: {
            threads: {
                singleThread: true
            }
        },
        silent: false,
        // disableConsoleIntercept: true,
        logHeapUsage: true
    },
})
