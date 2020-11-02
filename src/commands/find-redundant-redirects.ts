import { red } from 'chalk';
import { Command } from 'commander';
import { readdirSync } from 'fs';
import { join } from 'path';
import { wikiPath } from '../wiki';
import { getRedirects } from '../../include';

// TODO: can save a lot of filesystem lookups here

function wikiDirectoryExists(path: string) {
    const pathParts = path.split('/');
    let currentDir = join(wikiPath, 'wiki');

    for (const pathPart of pathParts) {
        const dirEnts = readdirSync(currentDir, { withFileTypes: true });
        const dirEnt = dirEnts.find(d => d.isDirectory && d.name.toLowerCase() === pathPart.toLowerCase());

        if (dirEnt === undefined)
            return false;
        else
            currentDir = join(currentDir, dirEnt.name);
    }

    return true;
}

function isRedirect(path: string) {
    return getRedirects()[path.toLowerCase()] !== undefined;
}

function findRedundantRedirects() {
    for (const [source, target] of (Object.entries(getRedirects()) as [string, string][])) {
        if (wikiDirectoryExists(source) || isRedirect(target)) {
            console.log(red(source));
        }
    }
}

export function findRedundantRedirectsCommandBuilder() {
    return new Command('find-redundant-redirects')
        .description('Find redirects shadowing real articles and redirect loops')
        .action(findRedundantRedirects);
}