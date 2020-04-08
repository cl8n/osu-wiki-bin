const { readdir, readFile, writeFile } = require('fs').promises;
const { safeLoad: yaml } = require('js-yaml');
const { join } = require('path');
const { nestedProperty, replaceLineEndings } = require('./include');

async function run(options) {
    const metaPath = join(__dirname, '../meta/group-info');
    const teamPath = join(__dirname, '../wiki/People/The_Team');
    const englishInfo = await readFile(join(metaPath, 'en.yaml'), 'utf8');
    const englishBn = replaceLineEndings(await readFile(join(teamPath, 'Beatmap_Nominators/en.md'), 'utf8')).content;
    const englishGmt = replaceLineEndings(await readFile(join(teamPath, 'Global_Moderation_Team/en.md'), 'utf8')).content;
    const englishNat = replaceLineEndings(await readFile(join(teamPath, 'Nomination_Assessment_Team/en.md'), 'utf8')).content;

    for (const groupInfoFilename of await readdir(metaPath)) {
        if (groupInfoFilename === 'en.yaml')
            continue;

        readFile(join(metaPath, groupInfoFilename), 'utf8').then(groupInfoFile => {
            const groupInfo = yaml(groupInfoFile);
            const language = groupInfoFilename.replace(/\.yaml$/, '');
            const getString = key => nestedProperty(groupInfo, key) || nestedProperty(englishInfo, key);

            // Beatmap Nominators
            if (options.group === undefined || options.group.match(/bng?/i)) {
                const bnFilename = join(teamPath, `Beatmap_Nominators/${language}.md`);
                const bn = replaceLineEndings(await readFile(bnFilename, 'utf8'));

                if (bn.content.match(/^\| :-- \| :-- \|$/gm).length !== 8) {
                    console.error(`${language} BN page formatting is too old`);
                    return;
                }

                // "REMOVE_ME" is a hacky way to step through tables in the
                // translation by breaking the match as it goes. After all the
                // replacements are done, we delete all instances of "REMOVE_ME"
                for (const tableMatch of englishBn.matchAll(/^\| :-- \| :-- \|\n((?:\|.+\n)+)/gm))
                    bn.content = bn.content.replace(/(?<=^\| :-- \| :-- \|\n)(?:\|.+\n)+/m, `REMOVE_ME${tableMatch[1]}`);
                bn.content = bn.content.replace(/REMOVE_ME/g, '');

                // TODO: Replace languages

                writeFile(bnFilename, replaceLineEndings(bn.content, bn.originalEnding).content);
            }

            // Global Moderation Team
            if (options.group === undefined || options.group.match(/gmt/i)) {
                const gmtFilename = join(teamPath, `Global_Moderation_Team/${language}.md`);
                const gmt = replaceLineEndings(await readFile(bnFilename, 'utf8'));

                // TODO
            }
        });
    }
}

module.exports = {
    options: {
        g: '=group',
        group: 'string'
    },
    run
};
