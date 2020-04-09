const { readdir, readFile, stat, writeFile } = require('fs').promises;
const { safeLoad: yaml } = require('js-yaml');
const { join } = require('path');
const { nestedProperty, replaceLineEndings } = require('./include');

function flattenObject(object, prefix = '') {
    const flattened = {};
    if (prefix !== '')
        prefix += '.';

    for (const property in object) {
        if (!object.hasOwnProperty(property))
            continue;

        if (typeof object[property] === 'object' && object[property] !== null)
            Object.assign(flattened, flattenObject(object[property], prefix + property));
        else
            flattened[prefix + property] = object[property];
    }

    return flattened;
}

function getKey(object, value) {
    const keySearch = Object.entries(flattenObject(object))
        .find(([, v]) => v === value);

    return keySearch && keySearch[0];
}

async function run(options) {
    const metaPath = join(__dirname, '../meta/group-info');
    const teamPath = join(__dirname, '../wiki/People/The_Team');
    const englishInfo = yaml(await readFile(join(metaPath, 'en.yaml'), 'utf8'));
    const englishBn = replaceLineEndings(await readFile(join(teamPath, 'Beatmap_Nominators/en.md'), 'utf8')).content;
    const englishGmt = replaceLineEndings(await readFile(join(teamPath, 'Global_Moderation_Team/en.md'), 'utf8')).content;
    const englishNat = replaceLineEndings(await readFile(join(teamPath, 'Nomination_Assessment_Team/en.md'), 'utf8')).content;

    for (const groupInfoFilename of await readdir(metaPath)) {
        if (groupInfoFilename === 'en.yaml')
            continue;

        readFile(join(metaPath, groupInfoFilename), 'utf8').then(async groupInfoFile => {
            const groupInfo = yaml(groupInfoFile);
            const language = groupInfoFilename.replace(/\.yaml$/, '');
            const getString = key => nestedProperty(groupInfo, key) || nestedProperty(englishInfo, key);

            // Beatmap Nominators
            if (options.group === undefined || options.group.match(/bng?/i)) {
                const bnFilename = join(teamPath, `Beatmap_Nominators/${language}.md`);

                try { await stat(bnFilename); }
                catch (error) {
                    if (error.code !== 'ENOENT')
                        throw error;

                    return;
                }

                const bn = replaceLineEndings(await readFile(bnFilename, 'utf8'));
                const tableHeadersMatch = bn.content.match(/^\| :-- \| :-- \|$/gm);

                if (tableHeadersMatch === null || tableHeadersMatch.length !== 8) {
                    console.error(`${language} BN page formatting is too old`);
                    return;
                }

                for (const tableMatch of englishBn.matchAll(/\| :-- \| :-- \|\n((?:\|.+\n)+)/g)) {
                    let table = tableMatch[1];

                    table = table.replace(/(?<=^\|.+?\| ).+(?= \|$)/gm, spLanguagesString => {
                        const englishSpLanguages = spLanguagesString.split(', ');
                        const spLanguages = [];

                        for (const spLanguage of englishSpLanguages) {
                            let key = getKey(englishInfo, spLanguage);
                            if (key !== undefined) {
                                spLanguages.push(getString(key));
                                continue;
                            }

                            const partialMatch = spLanguage.match(/^some (.+)$/);
                            if (partialMatch === null)
                                throw `Key not found for ${spLanguage}`;

                            let newLanguage = getString(getKey(englishInfo, partialMatch[1]));
                            newLanguage = getString('languages.partial').replace('<language>', newLanguage);
                            spLanguages.push(newLanguage);
                        }

                        return spLanguages.join(getString('separator'));
                    });

                    // "REMOVE_ME" is a hacky way to step through tables in the
                    // translation by breaking the match as it goes. After all the
                    // replacements are done, we delete all instances of "REMOVE_ME"
                    bn.content = bn.content.replace(/(?<=\| :-- \| :-- \|\n)(?:\|.+\n)+/, `REMOVE_ME${table}`);
                }

                bn.content = bn.content.replace(/REMOVE_ME|<!-- TODO -->/g, '');
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
