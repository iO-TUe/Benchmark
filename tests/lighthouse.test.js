import { writeFileSync } from "fs";
import { generateReport, startFlow } from 'lighthouse';
import { afterEach, describe, test } from "mocha";
import { cpus } from "os";
import { launch } from 'puppeteer';


describe(import.meta.url.split("/").pop(), () => {
    afterEach(done => setTimeout(done, 5000))
    test("Qwik", async function () { await flows(this.test.title, 'https://qwiiik.web.app/') })
    test("React", async function () { await flows(this.test.title, 'https://io-2imc05.web.app/') })
    after(() => { console.log(`[${time(new Date())}] Finished`) })
})

async function flows(name, url) {
    let cpu = usage()
    console.log(`[${time(new Date())}]`, name)
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

    console.log('CPU load:', usage(cpu))
    // console.log('Generating report')
    let json = await flow.createFlowResult()
    writeFileSync(`./tmp/${name}.json`, JSON.stringify(json.steps
        .reduce((acc, { lhr: { audits }, name }) => ({ ...acc, [name]: { ...audits } }), {}), null, '\t'))
    writeFileSync(`./tmp/${name}.html`, generateReport(json, 'html'))

    await browser.close()
}

function usage(cpu) {
    if (cpu) {
        let avg = ['------------------ AVERAGES ------------------', { user: 0, sys: 0, idle: 0, irq: 0 }]
        return Object.entries(calcTotal(cpus())).map(([i, e]) => {
            const diff = e.total - cpu[i].total
            delete e.total
            return Object.fromEntries(Object.entries(e).map(([j, t]) => {
                let p = (((t - cpu[i][j]) / diff) * 100).toFixed(0)
                avg[1][j] += p / 8
                return [j, p + '%'];
            }))
        }).concat(avg)
    } else {
        return calcTotal(cpus())
    }

    function calcTotal(cpus) {
        return cpus.map(({ times }) => {
            delete times.nice
            times.total = Object.values(times).reduce((v, s) => s + v);
            return times
        })
    }
}

function time(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

