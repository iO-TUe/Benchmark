import { existsSync, mkdirSync, readFile, writeFile } from "fs"

const n = 5
const comp = 'counter'
const path = 'src/components'

/**
 * @param {string} name
 * @param {string} props
 * @param {string} component
 * @param {string[]} tags
 * @param {string} ext
 * @param {string[]} comment
 * @param {string} imports
 */
export function generate(name, ext, tags, comment, imports, component, props) {
    const fullpath = `../${name}/${path}/${comp}`
    const fullpathExt = `${fullpath}.${ext}`
    readFile(fullpathExt, (err, file) => {
        if (err) throw (err)

        if (!existsSync(fullpath)) mkdirSync(fullpath)

        let oc = file.toString()
        if (oc.startsWith(comment[0] + '#OC#')) oc = oc.split('#OC#')[1]
        let ec = oc.replaceAll('##', comment[1]).replaceAll('./', '../')

        for (let i = 0; i < n; i++) {
            writeFile(`${fullpath}/${comp}${i}.${ext}`, ec, writeCB)
        }

        writeFile(fullpathExt, `${comment[0]}#OC#${oc.replaceAll(comment[1], '##')}#OC#${comment[1]}${imports}
${duplicate((i) => `import ${comp.toUpperCase()}${i} from './${comp}/${comp}${i}.${ext}'`, '')}

${component} ${tags[0]}
  ${duplicate((i) => `<${comp.toUpperCase()}${i} ${props} />`, '\t')}
${tags[1]}`, writeCB)
    })
}

/** @type {import("fs").NoParamCallback} err */
function writeCB(err) {
    if (err) throw err
}

/**
 * @param {(i: number) => string} str
 * @param {string} indent
 */
function duplicate(str, indent) {
    return [...Array(n).keys()].reduce((p, c, i) => p + (i > 0 ? indent : '') + str(c) + (i < n - 1 ? '\n' : ''), '')
}
