import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { replaceLineEndings } from '../text';
import { wikiPath } from '../wiki';
import { getFiles } from '../files';

function fixFlagRefs(content: string, flagNames: { [key: string]: string }) {
    if (content.match(/!\[[A-Z_]*\]\[flag_([A-Z_]+)\]/) === null)
        return content;

    const normalizedEndings = replaceLineEndings(content);

    content = normalizedEndings.content
        .replace(/\n*$/, '\n')
        .replace(/^\[flag_[A-Z_]+\]: \/wiki\/shared\/flag\/.+\n/gm, '')
        .replace(/\n*$/, '\n\n');

    const flags: Set<string> = new Set();

    for (const flagMatch of content.matchAll(/!\[[A-Z_]*\]\[flag_([A-Z_]+)\]/g))
        flags.add(flagMatch[1]);

    for (const flag of [...flags].sort()) {
        content += `[flag_${flag}]: /wiki/shared/flag/${flag}.gif`;

        if (flagNames[flag] !== undefined)
            content += ` "${flagNames[flag]}"`;

        content += '\n';
    }

    return replaceLineEndings(content, normalizedEndings.originalEnding).content;
}

export async function updateFlags(paths: string[]) {
    if (paths.length === 0)
        paths.push('.');

    const flagNamesByLocale: { [key: string]: { [key: string]: string } } = {};

    for (const path of await getFiles(paths, 'md')) {
        const localeMatch = path.match(/[a-z-]+\.md$/);
        const locale = localeMatch === null ? 'en.md' : localeMatch[0];
        let flagNames = flagNamesByLocale[locale];

        if (flagNames === undefined) {
            flagNames = {};

            try {
                const flagNamesFile = join(wikiPath, 'meta/flag-references', locale);
                const flagNamesMd = readFileSync(flagNamesFile, 'utf8');

                for (const flagMatch of flagNamesMd.matchAll(/\[flag_([A-Z_]+)\].+\1\.gif "(.+)"/g))
                    flagNames[flagMatch[1]] = flagMatch[2];
            } catch {}

            flagNamesByLocale[locale] = flagNames;
        }

        writeFileSync(path, fixFlagRefs(readFileSync(path, 'utf8'), flagNames));
    }
}

export function updateFlagsCommandBuilder() {
    return new Command('update-flags')
        .arguments('[paths...]')
        .description('Update flag reference definitions')
        .action(updateFlags);
}
