import { mkdirSync, readFileSync, readdirSync, rmSync } from "fs";
import { spawnSync } from 'node:child_process';
import { beforeAll, bench } from "vitest";

const iterations = 30
const warmupIterations = 5
const implementations = [
    ['React', 'https://io-2imc05.web.app/'],
    ['Qwik', 'https://qwiiik.web.app/'],
], runs = Object.fromEntries(implementations.map(([$]) => [$, []]))

/**
 * Runs a benchmark of {@link fn} for all {@link implementations} provided. 
 * 
 * Sample size is set by {@link iterations} after {@link warmupIterations} warmup runs.
 * 
 * Before the benchmark, the tmp dir is cleared and all chrome processes are closed.
 * 
 * @param {Function} fn The benchmark function.
 * @param {boolean} [dry] Use results of the last benchmark instead of running a new one.
 */
function setup(fn, dry = false) {
    implementations.forEach(([name, url]) =>
        bench(name, async () => dry || await fn(name, url), { iterations, warmupIterations }))

    if (dry) { // Load results of previous test run
        beforeAll(() => readdirSync('./tmp/lighthouse').forEach(file => {
            if (file.endsWith('.json')) {
                let d = file.search(/\d/);
                runs[file.slice(0, d)][file.slice(d, file.search(/\./))] =
                    (JSON.parse(readFileSync(`./tmp/lighthouse/${file}`)));
            }
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


/**
 * Use Tasklist to retrieve all chrome.exe processes that have used at least 10s of CPU time.
 * The process Status=unknown is used to filter out visible UI threads.
 * 
 * @returns {string[][]} Tuples of PID, Mem. usage and CPU time.
 */
function usage() {
    return spawnSync('tasklist', ['/fo', 'csv', '/v',
        '/fi', 'ImageName eq chrome.exe',
        '/fi', 'Status eq unknown'
    ], { encoding: 'utf-8' }).stdout.split('\n').slice(1, -1)
        .map(s => s.replaceAll('"', '').split(','))
        .map(a => [a[1], a[4], a[7].split(':')
            .reduce((t, s, i, a) => t += i + 1 < a.length ? s * 60 : +s, 0)])
        .filter(a => a[2] > 10)
}

/**
 * Calculate the run closest to the median of CPU Time and Memory Usage. 
 * The calculation is made using the Euclidean distance.
 * 
 * @param {Array<string>} usage CSV output of {@link usage()}
 * @returns {[number, number]} The median CPU and memory usage pair
 */
function computeMedianUsage(usage) {
    const cpuMem = usage.map(s => [s.split(';')[2], +s.split(';')[1].replace(' K', '')])
    const medianCpu = median(cpuMem.map(t => t[0]))
    const medianMem = median(cpuMem.map(t => t[1]))
    return cpuMem.sort((a, b) => computeMedianDistance(a, medianCpu, medianMem) -
        computeMedianDistance(b, medianCpu, medianMem))[0]
}

/**
 * Compute the median value of the provided array.
 * 
 * @param {Array<number>} array 
 * @returns {number} Median value
 */
function median(array) {
    const sorted = array.sort((a, b) => a - b)
    const half = Math.floor(sorted.length / 2)

    return sorted.length % 2 ? sorted[half]
        : (sorted[half - 1] + sorted[half]) / 2
}

/**
 * Calculate the distance of the CPU and memory pair to the median.
 * 
 * @param {[number, number]} cpu
 * @param {number} medianCpu
 * @param {number} medianMem 
 * @returns {number} Distance to the median CPU and Mem
 */
function computeMedianDistance(cpu, medianCpu, medianMem) {
    const distanceCpu = medianCpu - cpu[0]
    const distanceMem = medianMem - cpu[1]

    return distanceCpu ** 2 + distanceMem ** 2
}


export { computeMedianUsage, iterations, runs, setup, usage, warmupIterations };

