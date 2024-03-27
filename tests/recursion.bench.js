import { appendFileSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { generateReport, startFlow } from 'lighthouse';
import { computeMedianRun } from 'lighthouse/core/lib/median-run';
import { launch } from 'puppeteer';
import { afterAll } from "vitest";
import { computeMedianUsage, runs, setup, usage, warmupIterations as wi } from './utils';

setup(flows, true)

afterAll(() => Object.entries(runs).forEach(([name, results]) => {
    let lhr = results.slice(wi).map(flow => flow[0].lhr)
    lhr = wi + lhr.indexOf(computeMedianRun(lhr))
    // console.log('Median run:', name, iLHR + wi)

    let usage = readFileSync(`./tmp/${name}CPU.csv`,
        { encoding: 'utf-8' }).split('\n').slice(1 + wi, -1)
    const [mCpu, mMem] = computeMedianUsage(usage)
    usage = wi + usage.findIndex(s =>
        +s.split(';')[2] === mCpu && +s.split(';')[1].replace(' K', '') === mMem
    )
    // console.log('Median usage:', name, iUSE)
    renameSync(`./tmp/${name}CPU.csv`, `./tmp/${name}CPU - [${usage}].csv`)
    writeFileSync(`./tmp/${name}LHR - [${lhr}].json`, JSON.stringify(results[lhr], null, '\t'))
}))

async function flows(name, url) {
    const browser = await launch({ headless: 'new' })
    const page = await browser.newPage()
    // await page.emulateCPUThrottling(5)
    // await page.emulateNetworkConditions(PredefinedNetworkConditions['Fast 3G'])

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
    await page.waitForFunction('document.querySelector("[class*=value]").textContent === "96"')
    await flow.endTimespan()

    // console.log("Recurse")
    await flow.startTimespan({ name: 'Recurse' })
    await page.click('[role=feed]')
    await page.waitForTimeout(1000)
    await flow.endTimespan()

    // console.log("AfterRecurse")
    await flow.startTimespan({ name: 'AfterRecurse' })
    await page.$('button[aria-label=sub').then(el => el && el.click(), { timeout: 0 })
    await page.waitForFunction('document.querySelector("[class*=value]").textContent === "95"', { timeout: 0 })
    await flow.endTimespan()

    const iter = runs[name].length

    // console.log("Get CPU usages")
    if (iter === 0) writeFileSync(`./tmp/${name}CPU.csv`, 'PID;Memory;CPU;i\n')
    usage().forEach(([pid, mem, cpu]) => appendFileSync(`./tmp/${name}CPU.csv`, `${pid};${mem};${cpu};${iter}\n`))

    // console.log("Generating reports")
    const json = await flow.createFlowResult()
    writeFileSync(`./tmp/lighthouse/${name + iter}.json`, JSON.stringify(json.steps, null, '\t'))
    writeFileSync(`./tmp/lighthouse/${name + iter}.html`, generateReport(json, 'html'))
    runs[name].push(json.steps)

    await browser.close()
}

