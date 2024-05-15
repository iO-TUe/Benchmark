import { readFile, readdirSync } from "fs";

readdirSync('./tmp/load').filter(f => f.endsWith('.json')).forEach(file => {
    readFile(`./tmp/load/${file}`, (_, json) => JSON.parse(json.toString())
        .forEach((/** @type {import('lighthouse').FlowResult.Step} */ { lhr }) => {
            console.groupCollapsed(lhr.finalDisplayedUrl);
            [
                'first-contentful-paint',
                'largest-contentful-paint',
                'interactive',
                'interaction-to-next-paint',
                'total-blocking-time',
                'max-potential-fid',
                'mainthread-work-breakdown',
                'bootup-time',
            ].forEach(metric => {
                console.log(`${lhr.audits[metric]?.title}:`, lhr.audits[metric]?.numericValue, 'ms')
            })
            console.groupEnd();
        }));
});

