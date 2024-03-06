import { writeFileSync } from "fs";
import { generateReport, startFlow } from 'lighthouse';
import { spawnSync } from 'node:child_process';
import { launch } from 'puppeteer';
import { beforeAll, bench } from "vitest";

bench("Qwik", async () => { await flows("Qwik", 'https://qwiiik.web.app/') }, { iterations: 3, warmupIterations: 0 })
bench("React", async ({ task: { name } }) => { await flows("React", 'https://io-2imc05.web.app/') }, { iterations: 3, warmupIterations: 0 })

beforeAll(() => spawnSync('taskkill', ['/fi', 'ImageName eq chrome.exe', '/F']))

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

    let cpu = usage()

    // console.log('Generating report')
    let json = await flow.createFlowResult()
    writeFileSync(`./tmp/${name}.json`, JSON.stringify(json.steps
        .reduce((acc, { lhr: { audits }, name }) => ({ ...acc, [name]: { ...audits } }), {}), null, '\t'))
    writeFileSync(`./tmp/${name}.html`, generateReport(json, 'html'))

    await browser.close()

    return cpu
}

function usage() {
    let usage = spawnSync('tasklist', ['/fi', 'ImageName eq chrome.exe', '/fo', 'csv', '/v'], { encoding: 'utf-8' }).stdout
    return usage.split('\n').map(s => s.split(',')).map(a => [a[1], a[4], a[7]]).filter(([_, __, cpu]) => {
        const split = cpu?.slice(1, -1).split(':')
        return split && (split[0] > 0 || split[1] > 0 || split[2] > 10)
    })
}
