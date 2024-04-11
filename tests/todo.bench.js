import { startFlow } from 'lighthouse';
import { launch } from 'puppeteer';
import { flowConfig, saveResults, setup } from './utils';

setup(flows, __filename)

/** @type {import('./utils').Flows} */
async function flows(base, name, url, options) {
    const browser = await launch(options)
    const page = await browser.newPage()
    const flow = await startFlow(page, flowConfig)

    await flow.navigate(url + '/todo')

    await flow.startTimespan({ name: 'add' })
    for (let i = 0; i < 5; i++) {
        const txt = 'Item ' + i
        await page.type('#input', txt, { delay: 300 })
        await page.keyboard.press('Enter')
        await page.waitForSelector(`li[data-id="${txt}"]`)
        await page.$eval(`li[data-id="${txt}"]`, (el, txt) =>
            el.childNodes[0].textContent == txt, txt)
    }
    await flow.endTimespan()

    await flow.startTimespan({ name: 'remove' })
    while (await page.$eval('.list', (el) => el.childElementCount > 0)) {
        await page.click(`li[data-id] button`)
    }
    await flow.endTimespan()

    saveResults(base, name, flow, 2)

    await browser.close()
}

