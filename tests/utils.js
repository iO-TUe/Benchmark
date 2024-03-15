import { mkdirSync, readFileSync, readdirSync, rmSync } from "fs";
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
 * @param {Function} fn The benchmark function.
 * @param {boolean} dry Use results of the last benchmark instead of running a new one.
 */
function setup(fn, dry = false) {
    implementations.forEach(([name, url]) =>
        bench(name, async () => dry || await fn(name, url), { iterations, warmupIterations }))

    if (dry) { // Load results of previous test run
        beforeAll(() => readdirSync('./tmp/lighthouse').forEach(file => {
            let d = file.search(/\d/);
            runs[file.slice(0, d)][file.slice(d, file.search(/\./))] =
                (JSON.parse(readFileSync(`./tmp/lighthouse/${file}`)));
        }))
    } else { // Perform new benchmark run
        beforeAll(() => {
            rmSync('./tmp', { recursive: true, force: true })
            mkdirSync('./tmp')
            mkdirSync('./tmp/lighthouse')
            spawnSync('taskkill', ['/fi', 'ImageName eq chrome.exe', '/F']);
        })
    }
}

export { iterations, runs, setup, warmupIterations };

