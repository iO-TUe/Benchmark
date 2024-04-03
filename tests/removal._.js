import { appendFileSync, writeFileSync } from 'fs';
import { generateReport, startFlow } from 'lighthouse';
import { basename } from 'path';
import { launch } from 'puppeteer';
import { runs, setup, usage } from './utils';

const base = `./tmp/${basename(__filename).split('.')[0]}`
setup(flows, base)

async function flows(name, url) {
    const browser = await launch({ args: ['--js-flags=--expose-gc'] })
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
                    'cumulative-layout-shift',
                    'uses-long-cache-ttl'
                ],
                disableFullPageScreenshot: true,
                skipAboutBlank: true,
                usePassiveGathering: true
            }
        }
    })

    await flow.navigate(url)

    // console.log("Recurse")
    await flow.startTimespan({ name: 'Recurse' })
    await page.click('[role=feed]')
    await page.waitForFunction('document.querySelectorAll("[role=feed]").length === 861')
    await flow.endTimespan()

    // console.log("AfterRecurse")
    await flow.startTimespan({ name: 'AfterRecurseAdd' })
    await page.$('button[aria-label="+"').then(el => el && el.click({ count: 20 }), { timeout: 0 })
    await page.waitForFunction('document.querySelector("[class*=value]").textContent === "100"', { timeout: 0 })
    await flow.endTimespan()

    const iter = runs[name].length

    // console.log("Get CPU usages")
    if (iter === 0) writeFileSync(`${base}/${name}CPU.csv`, 'PID;Memory;CPU;i\n')
    usage().forEach(([pid, mem, cpu]) => appendFileSync(`${base}/${name}CPU.csv`, `${pid};${mem};${cpu};${iter}\n`))

    // console.log("Generating reports")
    const json = await flow.createFlowResult()
    writeFileSync(`${base}/lighthouse/${name + iter}.json`, JSON.stringify(json.steps, null, '\t'))
    writeFileSync(`${base}/lighthouse/${name + iter}.html`, generateReport(json, 'html'))
    runs[name].push(json.steps)

    await browser.close()
}

