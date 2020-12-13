import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { getFiles } from '../files';
import { getRedirects, wikiPath } from '../wiki';
import { errorX, warningX } from '../console';

interface FindBrokenRefsOptions {
    aggregate: boolean;
    allowRedirects: boolean;
    excludeOutdated: boolean;
}

function findBrokenRefsForPath(path: string, allowRedirects: boolean, excludeOutdated: boolean): [number, Set<string>] {
    const file = readFileSync(path, 'utf8');
    let trailingSlashCount = 0;
    const brokenRefs: Set<string> = new Set();
    const aTagSlugs = file.match(/(?<=<a.+?id=").+?(?=".*?>.*?<\/a>)/g) || [];

    if (excludeOutdated && path.endsWith('.md') && !path.endsWith('en.md') && file.match(/^outdated: true$/m) !== null)
        return [trailingSlashCount, brokenRefs];

    for (const match of file.matchAll(/\[.*?\]\((\S+(?:#\S*)?)(?: ".+?")?\)|^\[.*?\]: (\S+(?:#\S*)?)(?: ".+?")?$/gm)) {
        const [ref, section] = (match[1] || match[2]).split('#');

        if (ref.match(/^[a-z]+:\/\/|^mailto:/) !== null)
            continue;

        if (ref.endsWith('/'))
            ++trailingSlashCount;

        let refExists = true;
        const realRef = ref.startsWith('/')
            ? join(wikiPath, ref)
            : join(dirname(path), ref);

        if (ref !== '' && !existsSync(realRef)) {
            if (!allowRedirects ||
                !ref.startsWith('/wiki/') ||
                getRedirects()[ref.replace('/wiki/', '').toLowerCase()] === undefined
            )
                brokenRefs.add(ref);

            refExists = false;
        }

        if (section) {
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
            const sectionSlugs: string[] = [];
            const sectionSlugLevels: { [key: string]: number; } = {};

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

function printWarnings(trailingSlashCount: number, brokenRefs: Set<string>, prefix = '') {
    if (trailingSlashCount !== 0)
        warningX(`${prefix}${trailingSlashCount} references have a trailing slash.`);

    if (brokenRefs.size !== 0)
        for (const ref of brokenRefs)
            errorX(`${prefix}${ref}`);
}

async function findBrokenRefs(paths: string[], options: FindBrokenRefsOptions) {
    if (paths.length === 0)
        paths.push('.');

    const brokenRefInfos: { [key: string]: [number, Set<string> ]} = {};

    for (const path of await getFiles(paths, 'md'))
        brokenRefInfos[path] = findBrokenRefsForPath(path, options.allowRedirects, options.excludeOutdated);

    if (options.aggregate) {
        const [trailingSlashCount, brokenRefs] = Object.values(brokenRefInfos)
            .reduce(([accTSC, accBR], [currTSC, currBR]) => [accTSC + currTSC, new Set([...accBR, ...currBR])], [0, new Set()]);

        printWarnings(trailingSlashCount, brokenRefs);
    } else
        for (const [path, [trailingSlashCount, brokenRefs]] of Object.entries(brokenRefInfos)) {
            if (trailingSlashCount === 0 && brokenRefs.size === 0)
                continue;

            console.error(`${path}:`);
            printWarnings(trailingSlashCount, brokenRefs, '  ');
            console.error();
        }
}

export function findBrokenRefsCommandBuilder() {
    return new Command('find-broken-refs')
        .arguments('[paths...]')
        .description('Find broken link and image references')
        .option('-a, --aggregate', 'Aggregate output')
        .option('-r, --allow-redirects', "Don't count redirects as broken references")
        .option('-o, --exclude-outdated', "Don't search in outdated articles")
        .action(findBrokenRefs);
}
