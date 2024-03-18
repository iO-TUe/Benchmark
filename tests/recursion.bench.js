import { appendFileSync, readFileSync, writeFileSync } from 'fs';
import { generateReport, startFlow } from 'lighthouse';
import { computeMedianRun } from 'lighthouse/core/lib/median-run';
import { spawnSync } from 'node:child_process';
import { launch } from 'puppeteer';
import { afterAll } from "vitest";
import { runs, setup, warmupIterations as wi } from './utils';

setup(flows, true)

afterAll(() => Object.entries(runs).forEach(([name, results]) => {
    const lhr = results.slice(wi).map(flow => flow[0].lhr)
    const medianRun = computeMedianRun(lhr)
    const index = lhr.indexOf(medianRun)
    console.log('Median run:', name, index + wi)

    const cpu = readFileSync(`./tmp/${name}CPU.csv`,
        { encoding: 'utf-8' }).split('\n').slice(1 + wi, -1)
    const medianCpu = computeMedianCPU(cpu)
    console.log('Median CPU:', name, medianCpu)

    writeFileSync(`./tmp/${name}LHR.json`, JSON.stringify(results[index + wi], null, '\t'))
}))

async function flows(name, url) {
    const browser = await launch({ headless: 'new' })
    const page = await browser.newPage()

    const flow = await startFlow(page, {
        config: {
            extends: 'lighthouse:default',
            settings: {
                onlyCategories: ['performance'],
                skipAudits: [
                    'screenshot-thumbnails',
                    'final-screenshot',
                    'non-composited-animations',
                    'cumulative-layout-shift'
                ],
                disableFullPageScreenshot: true,
                skipAboutBlank: true,
                usePassiveGathering: true
            }
        }
    })

    await flow.navigate(url)

    // console.log("BeforeRecurse")
    await flow.startTimespan({ name: 'BeforeRecurse' })
    await page.$('button[aria-label=add').then(el => el && el.click())
    await page.waitForFunction('document.querySelector(".value").textContent === "96"')
    await flow.endTimespan()

    // console.log("Recurse")
    await flow.startTimespan({ name: 'Recurse' })
    await page.click('[role=insertion]')
    await page.waitForTimeout(3000)
    await flow.endTimespan()

    // console.log("AfterRecurse")
    await flow.startTimespan({ name: 'AfterRecurse' })
    await page.$('button[aria-label=sub').then(el => el && el.click(), { timeout: 0 })
    await page.waitForFunction('document.querySelector(".value").textContent === "95"', { timeout: 0 })
    await flow.endTimespan()

    const iter = runs[name].length

    // console.log("Get CPU usages")
    if (iter === 0) writeFileSync(`./tmp/${name}CPU.csv`, 'PID;Mem Usage;CPU Time;i\n')
    usage().forEach(([pid, mem, cpu]) => appendFileSync(`./tmp/${name}CPU.csv`, `${pid};${mem};${cpu};${iter}\n`))

    // console.log("Generating reports")
    const json = await flow.createFlowResult()
    writeFileSync(`./tmp/lighthouse/${name + iter}.json`, JSON.stringify(json.steps, null, '\t'))
    writeFileSync(`./tmp/lighthouse/${name + iter}.html`, generateReport(json, 'html'))
    runs[name].push(json.steps)

    await browser.close()
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
        '/fi', 'CPUTime gt 00:00:10',
        '/fi', 'Status eq unknown'
    ], { encoding: 'utf-8' }).stdout.split('\n').slice(1, -1)
        .map(s => s.replaceAll('"', '').split(',')).map(a => [a[1], a[4], a[7]])
}


/**
 * Calculate the run closest to the median of CPU Time and Memory Usage. 
 * The calculation is made using the Euclidean distance.
 * 
 * @param {Array<string>} usage CSV output of {@link usage()}
 * @returns {[number, number]} The median CPU and memory usage pair
 */
function computeMedianCPU(usage) {
    const cpuMem = usage.map(s => [
        s.split(';')[2].split(':').reduce((t, s, i, a) =>
            t += i + 1 < a.length ? s * 60 : +s, 0),
        +s.split(';')[1].replace(' K', '')
    ])
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
 * @returns {number} Distance to the median
 */
function computeMedianDistance(cpu, medianCpu, medianMem) {
    const distanceCpu = medianCpu - cpu[0]
    const distanceMem = medianMem - cpu[1]

    return distanceCpu ** 2 + distanceMem ** 2
}
