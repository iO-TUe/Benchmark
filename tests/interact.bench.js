import { startFlow } from 'lighthouse';
import { launch } from 'puppeteer';
import { flowConfig, saveResults, setup } from './utils';

setup(flows, __filename)

/** @type {import('./utils').Flows} */
async function flows(base, name, url, options) {
    const browser = await launch(options)
    const page = await browser.newPage()
    const cdp = await page.createCDPSession()
    const flow = await startFlow(page, flowConfig)

    await flow.startTimespan({ name: 'Interact' })
    await page.goto(url + '/load', { waitUntil: 'domcontentloaded' })
    const { result } = await cdp.send('Runtime.evaluate', { expression: 'document.querySelector("button")' })
    while ((await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId })).listeners.length == 0) { }

    let value
    while ((value = await page.$eval("[class*=value]", el => +el.textContent)) < 60) {
        await page.click('button[aria-label="+"')
        await page.waitForFunction((value) => +document.querySelector("[class*=value]").textContent == ++value, {}, value)
    }
    await flow.endTimespan()

    saveResults(base, name, flow)

    await browser.close()
}

