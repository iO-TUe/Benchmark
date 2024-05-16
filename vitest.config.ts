import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        benchmark: {
            outputJson: "./tmp/bench.json"
        },
        bail: 1,
        testTimeout: 0,
        poolOptions: {
            threads: {
                singleThread: true
            }
        },
        silent: false,
        logHeapUsage: true
    }
})
