import { startFlow } from 'lighthouse';
import { launch } from 'puppeteer';
import { flowConfig, saveResults, setup } from './utils';

setup(flows, __filename)

/** @type {import('./utils').Flows} */
async function flows(base, name, url, options) {
    const browser = await launch(options)
    const page = await browser.newPage()
    const flow = await startFlow(page, flowConfig)

    await flow.startTimespan({ name: 'Interact' })
    await page.goto(url + '/load', { waitUntil: 'domcontentloaded' })

    let value
    while ((value = await page.$eval("[class*=value]", el => +el.textContent)) < 60) {
        await page.click('button[aria-label="+"')
        await page.waitForFunction((value) => +document.querySelector("[class*=value]").textContent == ++value, {}, value)
    }
    await flow.endTimespan()

    saveResults(base, name, flow)

    await browser.close()
}

