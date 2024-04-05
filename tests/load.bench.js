import { startFlow } from 'lighthouse';
import { basename } from 'path';
import { launch } from 'puppeteer';
import { flowConfig, saveResults, setup } from './utils';

const base = `./tmp/${basename(__filename).split('.')[0]}`
setup(flows, base)

async function flows(name, url, config) {
    const browser = await launch(config)
    const page = await browser.newPage()
    const flow = await startFlow(page, flowConfig)

    await flow.navigate(url + '/load')

    saveResults(base, name, flow)

    await browser.close()
}

