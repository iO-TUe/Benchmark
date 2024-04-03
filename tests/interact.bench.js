import { startFlow } from 'lighthouse';
import { basename } from 'path';
import { launch } from 'puppeteer';
import { flowConfig, saveResults, setup } from './utils';

const base = `./tmp/${basename(__filename).split('.')[0]}`
setup(flows, base)

async function flows(name, url) {
    const browser = await launch({ devtools: true })
    const page = await browser.newPage()
    const flow = await startFlow(page, flowConfig)

    await flow.navigate(url + '/load')

    await flow.startTimespan({ name: 'Increase' })
    let value
    while ((value = await page.$eval("[class*=value]", el => el.textContent)) < 55) {
        await page.click('button[aria-label="+"')
        await page.waitForFunction((value) => document.querySelector("[class*=value]").textContent == ++value, {}, value)
    }
    await flow.endTimespan()

    saveResults(base, name, flow)

    await browser.close()
}

