import { mkdirSync, rmSync } from "fs";
import { spawnSync } from 'node:child_process';
import { beforeAll, bench } from "vitest";

const iterations = 10,
    warmupIterations = 5,
    implementations = [
        ['React', 'https://io-2imc05.web.app/'],
        ['Qwik', 'https://qwiiik.web.app/'],
    ],
    runs = Object.fromEntries(implementations.map(([name]) => [name, []]))

/**
 * Runs a benchmark of {@link fn} for all implementations provided. 
 * 
 * Before the benchmark, the tmp dir is cleared and all chrome processes are closed.
 * 
 * @param {*} fn The benchmark function
 */
function setup(fn) {
    implementations.forEach(([name, url]) =>
        bench(name, async () => await fn(name, url), { iterations, warmupIterations }))

    beforeAll(() => {
        rmSync('./tmp', { recursive: true, force: true })
        mkdirSync('./tmp')
        mkdirSync('./tmp/lighthouse')
        spawnSync('taskkill', ['/fi', 'ImageName eq chrome.exe', '/F']);
    })
}

export { iterations, runs, setup, warmupIterations };

