import { Command } from 'commander';
import { existsSync } from 'fs';
import { load as yaml } from 'js-yaml';
import { basename, dirname, join } from 'path';
import { getFiles } from '../files';
import { getRedirects, wikiPath } from '../wiki';
import { error, errorX, warningX } from '../console';
import { getImports, getMdAst } from '../remark';

interface FindBrokenRefsOptions {
    aggregate: boolean;
    allowRedirects: boolean;
    excludeOutdated: boolean;
}

function urlsFromNode(node: any): string[] | undefined {
    switch (node.type) {
        case 'definition':
        case 'image':
        case 'link':
            if (!node.url)
                return;

            return [node.url];
        case 'html':
            if (!node.value)
                return;

            const matches = node.value.matchAll(/<a[^>]*\s+href=(['"])([^\1]*)\1[^>]*>/gi);
            const urls = [];

            for (const match of matches)
                urls.push(match[2]);

            return urls;
    }
}

const pathExistences: Record<string, boolean> = {};
function cachedExistsSync(path: string): boolean {
    if (pathExistences[path] != null) {
        return pathExistences[path];
    }

    return pathExistences[path] = existsSync(path);
}

const slugsByMdPath: Record<string, string[]> = {};
async function getSlugs(mdPath: string): Promise<string[]> {
    if (slugsByMdPath[mdPath] != null) {
        return slugsByMdPath[mdPath];
    }

    const visit = (await getImports())['unist-util-visit'].default;

    const mdAst = await getMdAst(mdPath);
    const sectionSlugLevels: Record<string, number> = {};
    const slugs: string[] = [];

    visit(mdAst, ['heading', 'html'], (node: any) => {
        if (node.type === 'html') {
            // TODO: Use rehype to parse this (and other HTML)
            const anchors = node.value.match(/(?<=<a(?=\s)[^>]*?\sid=")[^"]+(?="[^>]*>)/g);

            if (anchors != null) {
                slugs.push(...anchors);
            }

            return;
        }

        let headingText = '';

        visit(node, ['text'], (node: any) => {
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

    return slugsByMdPath[mdPath] = slugs;
}

async function findBrokenRefsForPath(path: string, allowRedirects: boolean, excludeOutdated: boolean): Promise<[number, Set<string>]> {
    const mdAst = await getMdAst(path);
    const visit = (await getImports())['unist-util-visit'].default;

    if (excludeOutdated && !path.endsWith('en.md')) {
        let skip = false;

        visit(mdAst, ['yaml'], (node: { value: string; }) => {
            if ((yaml(node.value) as Record<string, unknown>).outdated) {
                skip = true;
                return false;
            }
        });

        if (skip) {
            return [0, new Set()];
        }
    }

    const urls: string[] = [];

    visit(mdAst, ['definition', 'html', 'image', 'link'], (node: any) => {
        const nodeUrls = urlsFromNode(node);

        if (nodeUrls) {
            urls.push(...nodeUrls);
        }
    });

    const brokenRefs: Set<string> = new Set();
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
            const localeMatch = ref.match(/\?locale=([a-z-]{1,5})/);
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
        let refExists = cachedExistsSync(refPath);

        if (!refExists) {
            if (!ref.startsWith('/wiki/')) {
                brokenRefs.add(ref);
            } else if (getRedirects()[ref.substring(6).toLowerCase()] == null) {
                const pathMatch = ref.match(/^\/wiki\/([a-z-]{1,5})\/(.+)/);
                if (pathMatch != null) {
                    const newRefPath = join(wikiPath, 'wiki', pathMatch[2]);
                    if (cachedExistsSync(newRefPath)) {
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
            if (!cachedExistsSync(refMdPath)) {
                refMdPath = join(refPath, 'en.md');

                if (!cachedExistsSync(refMdPath)) {
                    brokenRefs.add(url);
                    continue;
                }
            }

            if (!(await getSlugs(refMdPath)).includes(fragment)) {
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

    const brokenRefInfos: { [key: string]: [number, Set<string>] } = {};

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
        .option('-o, --exclude-outdated', "Don't search in outdated articles")
        .action(findBrokenRefs);
}
