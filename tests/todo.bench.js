import { startFlow } from 'lighthouse';
import { launch } from 'puppeteer';
import { flowConfig, saveResults, setup } from './utils';

setup(flows, __filename)

/** @type {import('./utils').Flows} */
async function flows(base, name, url, options) {
    const browser = await launch(options)
    const page = await browser.newPage()
    const flow = await startFlow(page, flowConfig)

    await flow.startTimespan({ name: 'LoadInteract' })
    await page.goto(url + '/todo', { waitUntil: 'domcontentloaded' })
    // await flow.navigate(url + '/todo')

    await page.waitForSelector('#input:enabled')
    for (let i = 0; i < 5; i++) {
        await page.type('#input', "Item " + i, { delay: 100 })
        await page.keyboard.press('Enter', { delay: 300 })
        await page.waitForSelector(`li[data-id="Item ${i}"]`)
        await page.$eval(`li[data-id="Item ${i}"]`, (el, i) =>
            el.childNodes[0].textContent == `Item ${i}`, i)
    }

    while (await page.$eval('.list', (el) => el.childElementCount > 0)) {
        await page.click(`li[data-id] button`)
    }
    await flow.endTimespan()

    saveResults(base, name, flow, 2)

    await browser.close()
}

