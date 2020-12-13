import { Command } from 'commander';
import { promises as fsPromises } from 'fs';
const { readFile, writeFile } = fsPromises;
import { beatmapLink, beatmapsetLink, userLink } from '../api';
import { errorX } from '../console';
import { getFiles } from '../files';

interface ReplaceOptions {
    flags: boolean;
}

async function replaceInFile(path: string, flag: boolean) {
    let content = await readFile(path, 'utf8');
    const originalContent = content;

    for (const match of content.matchAll(/b#(\d+)/g))
        try {
            content = content.replace(match[0], await beatmapLink(match[1]));
        } catch (e) {
            errorX(`Failed to replace beatmap #${match[1]} in ${path}: ${e.message}`);
        }

    for (const match of content.matchAll(/s#(\d+)/g))
        try {
            content = content.replace(match[0], await beatmapsetLink(match[1]));
        } catch (e) {
            errorX(`Failed to replace beatmapset #${match[1]} in ${path}: ${e.message}`);
        }

    for (const match of content.matchAll(/u#(\d+)|u!(.+?)!u/g)) {
        const byName = match[1] === undefined;
        const id = match[byName ? 2 : 1];

        try {
            content = content.replace(
                match[0],
                await userLink(id, { byName, flag }),
            );
        } catch (e) {
            errorX(`Failed to replace user ${byName ? '' : '#'}${id} in ${path}: ${e.message}`);
        }
    }

    if (content !== originalContent)
        await writeFile(path, content);
}

async function replace(paths: string[], options: ReplaceOptions) {
    if (paths.length === 0)
        paths.push('.');

    await Promise.all(
        (await getFiles(paths, 'md'))
            .map(file => replaceInFile(file, options.flags))
    );
}

export function replaceCommandBuilder() {
    return new Command('replace')
        .arguments('[paths...]')
        .description('Replace osu! object patterns with links')
        .option('-f, --no-flags', "Don't include flags before user links")
        .action(replace);
}
