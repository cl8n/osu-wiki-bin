import { Command } from 'commander';
import { promises as fsPromises } from 'fs';
const { readFile } = fsPromises;
import { join } from 'path';
import { wikiPath } from '../wiki';
import { scrapeUser } from '../web';
import { errorX } from '../console';

// TODO: would be nice to also check titles missing from the article, but this isn't possible with web api yet
async function checkUserTitles() {
    const file = join(wikiPath, 'wiki/People/Users_with_unique_titles/en.md');
    const content = (await readFile(file, 'utf8')).split('## By name')[1];

    for (const match of content.matchAll(/users\/(?<id>\d+)\) \| (?<title>.+?) \|$/gm)) {
        const matchGroups = match.groups as { id: string; title: string; };
        const user = await scrapeUser(matchGroups.id);

        if (user.title !== matchGroups.title)
            errorX(user.username);
    }
}

export function checkUserTitlesCommandBuilder() {
    return new Command('check-user-titles')
        .description('Report differences between Users_with_unique_titles and titles on web')
        .action(checkUserTitles);
}
