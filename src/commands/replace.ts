import { Command } from 'commander';
import { readFile, writeFile } from 'fs/promises';
import { beatmapLink, beatmapsetLink, userLink } from '../../include';

interface ReplaceOptions {
    flags: boolean;
}

async function replaceInFile(path: string, flag: boolean) {
    let content = await readFile(path, 'utf8');

    for (const match of content.matchAll(/b#(\d+)/g))
        content = content.replace(match[0], await beatmapLink(match[1]));

    for (const match of content.matchAll(/s#(\d+)/g))
        content = content.replace(match[0], await beatmapsetLink(match[1]));

    for (const match of content.matchAll(/u#(\d+)|u!(.+?)!u/g)) {
        const byName = match[1] === undefined;
        content = content.replace(
            match[0],
            await userLink(match[byName ? 2 : 1], { byName, flag })
        );
    }

    await writeFile(path, content);
}

async function replace(paths: string[], options: ReplaceOptions) {
    if (paths.length === 0)
        paths.push('.');

    await Promise.all(paths.map(file => replaceInFile(file, options.flags)));
}

export function replaceCommandBuilder() {
    return new Command('replace [paths...]')
        .description('Replace osu! object patterns with links')
        .option('-f|--no-flags', "Don't include flags before user links")
        .action(replace);
}
