import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        bail: 1,
        outputFile: "./tmp/bench.json",
        testTimeout: 0,
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
