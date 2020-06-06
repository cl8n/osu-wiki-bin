const { existsSync, readdirSync, readFileSync, writeFile } = require('fs');
const { safeLoad: yaml } = require('js-yaml');
const { join } = require('path');
const { nestedProperty, replaceLineEndings } = require('./include');

function lowerCaseFirst(string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
}

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

function getKey(object, value, scope) {
    const keySearch = Object.entries(flattenObject(object))
        .find(([k, v]) => (scope === undefined || k.startsWith(scope)) && v.toLowerCase() === value.toLowerCase());

    return keySearch && keySearch[0];
}

function spLanguageReplacer(englishInfo, getString) {
    return spLanguagesString => {
        const englishSpLanguages = spLanguagesString.split(englishInfo.separator);
        const spLanguages = [];

        for (const spLanguage of englishSpLanguages) {
            let key = getKey(englishInfo, spLanguage, 'languages');
            if (key !== undefined) {
                spLanguages.push(getString(key));
                continue;
            }

            const partialRegex = new RegExp(`^${nestedProperty(englishInfo, 'languages.partial').replace('<language>', '(.+)')}$`, 'i');
            const partialMatch = spLanguage.match(partialRegex);
            if (partialMatch === null)
                throw `Key not found for ${spLanguage}`;

            let newLanguage = getString(getKey(englishInfo, partialMatch[1], 'languages'));
            newLanguage = (spLanguages.length > 0 ? lowerCaseFirst(getString('languages.partial')) : getString('languages.partial'))
                .replace('<language>', newLanguage);
            spLanguages.push(newLanguage);
        }

        return spLanguages.join(getString('separator'));
    }
}

function updateBnTranslation(englishInfo, englishBn, getString, language, teamPath) {
    const bnFilename = join(teamPath, `Beatmap_Nominators/${language}.md`);

    if (!existsSync(bnFilename))
        return;

    const bn = replaceLineEndings(readFileSync(bnFilename, 'utf8'));
    const tableHeadersMatch = bn.content.match(/^\| :-- \| :-- \|$/gm);

    if (tableHeadersMatch === null || tableHeadersMatch.length !== 8) {
        console.error(`${language} BN page formatting is too old`);
        return;
    }

    for (const tableMatch of englishBn.matchAll(/\| :-- \| :-- \|\n((?:\|.+\n)+)/g)) {
        let table = tableMatch[1];

        table = table.replace(/(?<=^\|.+?\| ).+(?= \|$)/gm, spLanguageReplacer(englishInfo, getString));

        // "REMOVE_ME" is a hacky way to step through tables in the
        // translation by breaking the match as it goes. After all the
        // replacements are done, we delete all instances of "REMOVE_ME"
        bn.content = bn.content.replace(/(?<=\| :-- \| :-- \|\n)(?:\|.+\n)+/, `REMOVE_ME${table}`);
    }

    bn.content = bn.content.replace(/REMOVE_ME/g, '');

    writeFile(bnFilename, replaceLineEndings(bn.content, bn.originalEnding).content, () => {});
}

function updateGmtTranslation(englishInfo, englishGmt, getString, language, teamPath) {
    const gmtFilename = join(teamPath, `Global_Moderation_Team/${language}.md`);

    if (!existsSync(gmtFilename))
        return;

    const gmt = replaceLineEndings(readFileSync(gmtFilename, 'utf8'));
    const tableHeadersMatch = gmt.content.match(/^\| :-- \| :-- \| :-- \|$/gm);

    if (tableHeadersMatch === null || tableHeadersMatch.length !== 2) {
        console.error(`${language} GMT page formatting is too old`);
        return;
    }

    const table = englishGmt.match(/\| :-- \| :-- \| :-- \|\n((?:\|.+\n)+)/)[1]
        .replace(/(?<=^\|.+?\| ).+(?= \|.+?\|$)/gm, spLanguageReplacer(englishInfo, getString))
        .replace(/(?<=^\|.+?\|.+?\| ).+(?= \|$)/gm, areasString =>
            areasString
                .split(englishInfo.separator)
                .map((area, idx) => {
                    const key = getKey(englishInfo, area, 'gmt.areas');

                    if (key === undefined)
                        throw `Key not found for ${area}`;

                    return idx > 0 ? lowerCaseFirst(getString(key)) : getString(key);
                })
                .join(getString('separator'))
        );

    // "REMOVE_ME" is a hacky way to step through tables in the
    // translation by breaking the match as it goes. After all the
    // replacements are done, we delete all instances of "REMOVE_ME"
    gmt.content = gmt.content.replace(/(?<=\| :-- \| :-- \| :-- \|\n)(?:\|.+\n)+/, `REMOVE_ME${table}`);

    const table2 = englishGmt.match(/\| :-- \| :-- \| :-- \|\n(?:.|\n)+?\| :-- \| :-- \| :-- \|\n((?:\|.+\n)+)/)[1]
        .replace(`| *${englishInfo.gmt.all_mods}* |`, `| *${getString('gmt.all_mods')}* |`);

    gmt.content = gmt.content.replace(/(?<=\| :-- \| :-- \| :-- \|\n)(?:\|.+\n)+/, table2);
    gmt.content = gmt.content.replace(/REMOVE_ME/g, '');

    writeFile(gmtFilename, replaceLineEndings(gmt.content, gmt.originalEnding).content, () => {});
}

function updateNatTranslation(englishInfo, englishNat, getString, language, teamPath) {
    const natFilename = join(teamPath, `Nomination_Assessment_Team/${language}.md`);

    if (!existsSync(natFilename))
        return;

    const nat = replaceLineEndings(readFileSync(natFilename, 'utf8'));
    const tableHeadersMatch = nat.content.match(/^\| :-- \| :-- \| :-- \|$/gm);

    if (tableHeadersMatch === null || tableHeadersMatch.length !== 4) {
        console.error(`${language} NAT page formatting is too old`);
        return;
    }

    for (const tableMatch of englishNat.matchAll(/\| :-- \| :-- \| :-- \|\n((?:\|.+\n)+)/g)) {
        let table = tableMatch[1];

        table = table.replace(/(?<=^\|.+?\| ).+(?= \|.+?\|$)/gm, spLanguageReplacer(englishInfo, getString));
        table = table.replace(/(?<=^\|.+?\|.+?\| ).+(?= \|$)/gm, areasString =>
            areasString
                .split(englishInfo.separator)
                .map(area => {
                    const key = getKey(englishInfo, area, 'nat.areas');

                    if (key === undefined)
                        throw `Key not found for ${area}`;

                    return getString(key);
                })
                .join(getString('separator'))
        );

        // "REMOVE_ME" is a hacky way to step through tables in the
        // translation by breaking the match as it goes. After all the
        // replacements are done, we delete all instances of "REMOVE_ME"
        nat.content = nat.content.replace(/(?<=\| :-- \| :-- \| :-- \|\n)(?:\|.+\n)+/, `REMOVE_ME${table}`);
    }

    nat.content = nat.content.replace(/REMOVE_ME/g, '');

    writeFile(natFilename, replaceLineEndings(nat.content, nat.originalEnding).content, () => {});
}

function updateAluTranslation(englishInfo, englishAlu, getString, language, teamPath) {
    const aluFilename = join(teamPath, `osu!_Alumni/${language}.md`);

    if (!existsSync(aluFilename))
        return;

    const alu = replaceLineEndings(readFileSync(aluFilename, 'utf8'));
    const tableHeadersMatch = alu.content.match(/^\| :-- \| :-- \|$/gm);

    if (tableHeadersMatch === null || tableHeadersMatch.length !== 1) {
        console.error(`${language} osu! Alumni page formatting is too old`);
        return;
    }

    const table = englishAlu.match(/\| :-- \| :-- \|\n((?:\|.+\n)+)/)[1]
        .replace(/(?<=^\|.+?\| ).+(?= \|$)/gm, rolesString =>
            rolesString
                .split(englishInfo.separator)
                .map(role => {
                    const key = getKey(englishInfo, role, 'alumni.roles');
                    return key === undefined ? role : getString(key);
                })
                .join(getString('separator'))
        );

    alu.content = alu.content.replace(/(?<=\| :-- \| :-- \|\n)(?:\|.+\n)+/, table);

    writeFile(aluFilename, replaceLineEndings(alu.content, alu.originalEnding).content, () => {});
}

function updateSupTranslation(englishInfo, englishSup, getString, language, teamPath) {
    const supFilename = join(teamPath, `Support_Team/${language}.md`);

    if (!existsSync(supFilename))
        return;

    const sup = replaceLineEndings(readFileSync(supFilename, 'utf8'));
    const tableHeadersMatch = sup.content.match(/^\| :-- \| :-- \|$/gm);

    if (tableHeadersMatch === null || tableHeadersMatch.length !== 1) {
        console.error(`${language} Support Team page formatting is too old`);
        return;
    }

    const table = englishSup.match(/\| :-- \| :-- \|\n((?:\|.+\n)+)/)[1]
        .replace(/(?<=^\|.+?\| ).+(?= \|$)/gm, spLanguageReplacer(englishInfo, getString));

    sup.content = sup.content
        .replace(/(?<=\| :-- \| :-- \|\n)(?:\|.+\n)+/, table);

    writeFile(supFilename, replaceLineEndings(sup.content, sup.originalEnding).content, () => {});
}

function run(options) {
    const metaPath = join(__dirname, '../meta/group-info');
    const teamPath = join(__dirname, '../wiki/People/The_Team');
    const englishInfo = yaml(readFileSync(join(metaPath, 'en.yaml'), 'utf8'));

    const englishBn = replaceLineEndings(readFileSync(join(teamPath, 'Beatmap_Nominators/en.md'), 'utf8')).content.replace(/<!-- TODO -->/g, '');
    const englishGmt = replaceLineEndings(readFileSync(join(teamPath, 'Global_Moderation_Team/en.md'), 'utf8')).content.replace(/<!-- TODO -->/g, '');
    const englishNat = replaceLineEndings(readFileSync(join(teamPath, 'Nomination_Assessment_Team/en.md'), 'utf8')).content.replace(/<!-- TODO -->/g, '');
    const englishAlu = replaceLineEndings(readFileSync(join(teamPath, 'osu!_Alumni/en.md'), 'utf8')).content.replace(/<!-- TODO -->/g, '');
    const englishSup = replaceLineEndings(readFileSync(join(teamPath, 'Support_Team/en.md'), 'utf8')).content.replace(/<!-- TODO -->/g, '');

    for (const groupInfoFilename of readdirSync(metaPath)) {
        if (groupInfoFilename === 'en.yaml')
            continue;

        const groupInfo = yaml(readFileSync(join(metaPath, groupInfoFilename), 'utf8'));

        if (groupInfo.outdated)
            continue;

        const language = groupInfoFilename.replace(/\.yaml$/, '');
        const getString = key => nestedProperty(groupInfo, key) || nestedProperty(englishInfo, key);

        if (options.group === undefined || options.group.match(/bng?/i))
            updateBnTranslation(englishInfo, englishBn, getString, language, teamPath);

        if (options.group === undefined || options.group.match(/gmt/i))
            updateGmtTranslation(englishInfo, englishGmt, getString, language, teamPath);

        if (options.group === undefined || options.group.match(/nat/i))
            updateNatTranslation(englishInfo, englishNat, getString, language, teamPath);

        if (options.group === undefined || options.group.match(/alu|alm/i))
            updateAluTranslation(englishInfo, englishAlu, getString, language, teamPath);

        if (options.group === undefined || options.group.match(/sup/i))
            updateSupTranslation(englishInfo, englishSup, getString, language, teamPath);
    }
}

module.exports = {
    options: {
        g: '=group', group: 'string'
    },
    run
};
