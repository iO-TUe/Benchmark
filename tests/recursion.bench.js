import { appendFileSync, writeFileSync } from 'fs';
import { generateReport, startFlow } from 'lighthouse';
import { computeMedianRun } from 'lighthouse/core/lib/median-run';
import { spawnSync } from 'node:child_process';
import { launch } from 'puppeteer';
import { afterAll } from "vitest";
import { runs, setup, warmupIterations as wi } from './utils';

setup(flows)

afterAll(() => Object.entries(runs).forEach(([name, results]) => {
    const lhr = results.slice(wi).map(flow => flow[0].lhr)
    const median = computeMedianRun(lhr)
    const index = lhr.indexOf(median)

    console.log('Median run:', name, index + wi)

    writeFileSync(`./tmp/${name}LHR.json`, JSON.stringify(results[index + wi], null, '\t'))

    // const cpu = readFileSync(`./tmp/${name}.csv`)

    // cpu.split('\n').forEach(line => line.split(';'))
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
 * 
 * @returns {string[][]} Tuples of PID, Mem. usage and CPU time.
 */
function usage() {
    let usage = spawnSync('tasklist', ['/fi', 'ImageName eq chrome.exe', '/fi', 'CPUTime gt 00:00:10', '/fo', 'csv', '/v'], { encoding: 'utf-8' }).stdout
    console.log(usage)
    return usage.split('\n').map(s => s.replaceAll('"', '').split(',')).map(a => [a[1], a[4], a[7]])
}
