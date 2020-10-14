import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'fs';
import { getFiles } from '../../include';

function sortListsInPath(path: string) {
    const file = readFileSync(path, 'utf8');
    let lines = file.split('\n');

    let currentList = [];
    let currentListStart = null;
    for (let i = 0; i < lines.length; ++i) {
        const match = lines[i].match(/^[-|] !\[\]\[flag_..\] \[(.+?)\]\(https.+$/);
        if (match !== null) {
            if (currentListStart === null)
                currentListStart = i;

            currentList.push([match[1], match[0]]);
        } else if (currentListStart !== null) {
            lines = lines.slice(0, currentListStart)
                .concat(currentList
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(l => l[1]))
                .concat(lines.slice(i));

            currentList = [];
            currentListStart = null;
        }
    }

    writeFileSync(path, lines.join('\n'));
}

async function sortLists(paths: string[]) {
    if (paths.length === 0)
        paths.push('.');

    for (const path of await getFiles(...paths))
        if (path.endsWith('.md'))
            sortListsInPath(path);
}

export function sortListsCommandBuilder() {
    return new Command('sort-lists')
        .arguments('[paths...]')
        .description('Sort lists of users') // TODO: more than users!
        .action(sortLists);
}
