require('colors');
const { existsSync, readFileSync } = require('fs');
const { basename, dirname, join } = require('path');
const { getFiles, getRedirects } = require('./include');

const redirects = getRedirects();

function findBrokenRefs(path, allowRedirects, excludeOutdated) {
    const file = readFileSync(path, 'utf8');
    let trailingSlashCount = 0;
    const brokenRefs = new Set();
    const aTagSlugs = file.match(/(?<=<a.+?id=").+?(?=".*?>.*?<\/a>)/g) || [];

    if (excludeOutdated && path.endsWith('.md') && !path.endsWith('en.md') && file.match(/^outdated: true$/m) !== null)
        return [trailingSlashCount, brokenRefs];

    for (const match of file.matchAll(/\[.*?\]\((.+?(?:#.+?)?)(?: ".+?")?\)|^\[.*?\]: (.+?(?:#.+?)?)(?: ".+?")?$/gm)) {
        const [ref, section] = (match[1] || match[2]).split('#');

        if (ref.match(/^[a-z]+:\/\/|^mailto:/) !== null)
            continue;

        if (ref.endsWith('/'))
            ++trailingSlashCount;

        let refExists = true;
        const realRef = ref.startsWith('/')
            ? join(__dirname, '..', ref)
            : join(dirname(path), ref);

        if (ref !== '' && !existsSync(realRef)) {
            if (!allowRedirects ||
                !ref.startsWith('/wiki/') ||
                redirects[ref.replace('/wiki/', '').toLowerCase()] === undefined
            )
                brokenRefs.add(ref);

            refExists = false;
        }

        if (section !== undefined) {
            if (!refExists) {
                brokenRefs.add(`${ref}#${section}`);
                continue;
            }

            let refMdPath = join(realRef, basename(path));
            if (!existsSync(refMdPath)) {
                refMdPath = join(realRef, 'en.md');

                if (!existsSync(refMdPath)) {
                    brokenRefs.add(`${ref}#${section}`);
                    continue;
                }
            }

            const refFile = readFileSync(refMdPath, 'utf8');
            const sectionSlugs = [];
            const sectionSlugLevels = {};

            for (const headerMatch of refFile.matchAll(/^#{2,3} (.+)$/gm)) {
                let slug = headerMatch[1].toLowerCase()
                    .replace(/!\[.*?\]\(.+?\)/g, '')
                    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
                    .replace(/ /g, '-');

                if (sectionSlugLevels[slug] === undefined)
                    sectionSlugLevels[slug] = 0;
                else
                    slug += `.${++sectionSlugLevels[slug]}`;

                sectionSlugs.push(slug);
            }

            if (!sectionSlugs.includes(section) && !aTagSlugs.includes(section))
                brokenRefs.add(`${ref}#${section}`);
        }
    }

    return [trailingSlashCount, brokenRefs];
}

function printWarnings(trailingSlashCount, brokenRefs, prefix = '') {
    if (trailingSlashCount !== 0)
        console.log(`${prefix}${trailingSlashCount} references have a trailing slash.`.yellow);

    if (brokenRefs.size !== 0)
        for (const ref of brokenRefs)
            console.log(`${prefix}${ref}`.red);
}

async function run(options) {
    if (options._.length === 0)
        options._.push('.');

    const brokenRefInfos = {};

    for (const path of await getFiles(...options._))
        if (path.endsWith('.md'))
            brokenRefInfos[path] = findBrokenRefs(path, options['allow-redirects'], options['exclude-outdated']);

    if (options.aggregate) {
        const [trailingSlashCount, brokenRefs] = Object.values(brokenRefInfos)
            .reduce(([accTSC, accBR], [currTSC, currBR]) => [accTSC + currTSC, new Set([...accBR, ...currBR])], [0, new Set()]);

        printWarnings(trailingSlashCount, brokenRefs);
    } else
        for (const [path, [trailingSlashCount, brokenRefs]] of Object.entries(brokenRefInfos)) {
            if (trailingSlashCount === 0 && brokenRefs.size === 0)
                continue;

            console.log(`${path}:`);
            printWarnings(trailingSlashCount, brokenRefs, '  ');
            console.log();
        }
}

module.exports = {
    options: {
        a: '=aggregate', aggregate: 'boolean',
        r: '=allow-redirects', 'allow-redirects': 'boolean',
        x: '=exclude-outdated', 'exclude-outdated': 'boolean'
    },
    run
};
