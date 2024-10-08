import { Command } from 'commander';
import { existsSync } from 'fs';
import { load as yaml } from 'js-yaml';
import { basename, dirname, join } from 'path';
import { getFiles } from '../files.js';
import { getRedirects, wikiPath } from '../wiki.js';
import { error, errorX, warningX } from '../console.js';
import { getMdAst } from '../remark.js';
import { memoize } from '../memoize.js';
import { EXIT, visit } from 'unist-util-visit';
import { InclusiveDescendant } from 'unist-util-visit-parents';
import { Root } from 'mdast';

interface FindBrokenRefsOptions {
    aggregate: boolean;
    allowRedirects: boolean;
    excludeOutdated: boolean;
}

function urlsFromNode(node: InclusiveDescendant<Root>): string[] | void {
    switch (node.type) {
        case 'definition':
        case 'image':
        case 'link':
            if (node.url.length === 0) {
                return;
            }

            return [node.url];
        case 'html':
            if (node.value.length === 0) {
                return;
            }

            const matches = node.value.matchAll(/<a[^>]*\s+href=(['"])([^\1]*)\1[^>]*>/gi);
            const urls = [];

            for (const match of matches)
                urls.push(match[2]);

            return urls;
    }
}

const getMdAstMemoized = memoize(getMdAst);

function getSlugs(mdAst: Root): string[] {
    const sectionSlugLevels: Record<string, number> = {};
    const slugs: string[] = [];

    visit(mdAst, ['heading', 'html'], (node) => {
        if (node.type === 'html') {
            // TODO: Use rehype to parse this (and other HTML)
            const anchors = node.value.match(/(?<=<a(?=\s)[^>]*?\sid=")[^"]+(?="[^>]*>)/g);

            if (anchors != null) {
                slugs.push(...anchors);
            }

            return;
        }

        if (node.type !== 'heading' || node.depth === 1) {
            return;
        }

        let headingText = '';

        visit(node, 'text', (node) => {
            headingText += node.value;
        });

        // TODO: When the attributes syntax is supported by the parser,
        // use (e.g.) `node.id` for `slug` if it exists. For now, we try
        // to parse the attribute syntax ourselves here.
        const attributeMatch = headingText.match(/\{#([^\s}]+)\}\s*$/);
        let slug = attributeMatch != null
            ? attributeMatch[1]
            : headingText.trim().toLowerCase().replace(/ /g, '-');

        if (sectionSlugLevels[slug] == null) {
            sectionSlugLevels[slug] = 0;
        } else {
            slug += `.${++sectionSlugLevels[slug]}`;
        }

        slugs.push(slug);
    });

    return slugs;
}

async function findBrokenRefsForPath(path: string, allowRedirects: boolean, excludeOutdated: boolean): Promise<[number, Set<string>]> {
    const mdAst = await getMdAstMemoized(path);

    if (mdAst == null) {
        throw `Failed to get mdast for ${path}`;
    }

    if (excludeOutdated && !path.endsWith('en.md')) {
        let skip = false;

        visit(mdAst, 'yaml', (node) => {
            if ((yaml(node.value) as Record<string, unknown>).outdated_translation) {
                skip = true;
                return EXIT;
            }
        });

        if (skip) {
            return [0, new Set()];
        }
    }

    const urls: string[] = [];

    visit(mdAst, ['definition', 'html', 'image', 'link'], (node) => {
        const nodeUrls = urlsFromNode(node);

        if (nodeUrls != null) {
            urls.push(...nodeUrls);
        }
    });

    const brokenRefs = new Set<string>();
    const defaultLocaleBasename = basename(path);
    let trailingSlashCount = 0;

    for (const url of urls) {
        if (url.match(/^[a-z]+:\/\/|^mailto:/) != null) {
            continue;
        }

        if (url.match(/#[^#]*#/) != null) {
            error(`Invalid URL: ${url}`);
            continue;
        }

        let [ref, fragment] = url.split('#');
        let localeBasename = defaultLocaleBasename;

        if (ref.includes('?')) {
            const localeMatch = ref.match(/\?locale=([a-z-]{2,5})/);
            if (localeMatch != null) {
                localeBasename = `${localeMatch[1]}.md`;
            }

            ref = ref.substring(0, ref.indexOf('?'));
        }

        if (ref.endsWith('/')) {
            trailingSlashCount++;
        }

        let refPath = ref.startsWith('/')
            ? join(wikiPath, ref)
            : join(dirname(path), ref);
        let refExists = existsSync(refPath);

        if (!refExists) {
            if (!ref.startsWith('/wiki/')) {
                brokenRefs.add(ref);
            } else if (getRedirects()[ref.substring(6).toLowerCase()] == null) {
                const pathMatch = ref.match(/^\/wiki\/([a-z-]{2,5})\/(.+)/);
                if (pathMatch != null) {
                    const newRefPath = join(wikiPath, 'wiki', pathMatch[2]);
                    if (existsSync(newRefPath)) {
                        localeBasename = `${pathMatch[1]}.md`;
                        refExists = true;
                        refPath = newRefPath;
                    } else {
                        brokenRefs.add(ref);
                    }
                } else {
                    brokenRefs.add(ref);
                }
            } else if (!allowRedirects) {
                brokenRefs.add(ref);
            }
        }

        if (fragment) {
            // TODO: Gives up when the ref has a redirect. This could be changed to
            // check redirected refs too (if `allowRedirects`)
            if (!refExists) {
                brokenRefs.add(url);
                continue;
            }

            let refMdPath = join(refPath, localeBasename);
            if (!existsSync(refMdPath)) {
                refMdPath = join(refPath, 'en.md');

                if (!existsSync(refMdPath)) {
                    brokenRefs.add(url);
                    continue;
                }
            }

            const refMdAst = await getMdAstMemoized(refMdPath);

            if (refMdAst == null || !getSlugs(refMdAst).includes(fragment)) {
                brokenRefs.add(url);
                continue;
            }
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

export async function findBrokenRefs(paths: string[], options: FindBrokenRefsOptions) {
    if (paths.length === 0)
        paths.push('.');

    const brokenRefInfos: Record<string, [number, Set<string>]> = {};

    for (const path of await getFiles(paths, 'md'))
        brokenRefInfos[path] = await findBrokenRefsForPath(path, options.allowRedirects, options.excludeOutdated);

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
        .option('-o, --exclude-outdated', "Don't search in outdated translations")
        .action(findBrokenRefs);
}
