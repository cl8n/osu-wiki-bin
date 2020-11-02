import { DeepDictionary, Dictionary } from '@cl8n/types';
import { exec } from 'child_process';
import { Command } from 'commander';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { safeLoad as yaml } from 'js-yaml';
import { join } from 'path';
import { wikiPath } from '../wiki';
import { nestedProperty, replaceLineEndings } from '../../include';

// whole thing is so shit
// upgrade me

interface TranslateGroupsOptions {
    group?: string[];
}

type GroupYaml = DeepDictionary<string> & {
    outdated: boolean;
    separator: string;

    gmt: DeepDictionary<string> & {
        all_mods: string;
    };
};

type Translator = (
    enInfo: GroupYaml,
    en: string,
    getString: (key: string) => string | undefined,
    language: string,
    teamPath: string,
) => void;

function lowerCaseFirst(string: string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
}

function upperCaseFirst(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function flattenObject<T>(object: DeepDictionary<T>, prefix = '') {
    function isDictionary(object: T | DeepDictionary<T> | undefined): object is DeepDictionary<T> {
        return typeof object === 'object' && object != null;
    }

    const flattened: Dictionary<T> = {};

    if (prefix !== '')
        prefix += '.';

    for (const key of Object.keys(object)) {
        const value = object[key];

        if (isDictionary(value))
            Object.assign(flattened, flattenObject(value, prefix + key));
        else
            flattened[prefix + key] = value;
    }

    return flattened;
}

function getKey(object: DeepDictionary<string>, value: string, scope: string) {
    const keySearch = (Object.entries(flattenObject(object)) as [string, string][])
        .find(([k, v]) =>
            (scope === undefined || k.startsWith(scope)) &&
            v.toLowerCase() === value.toLowerCase()
        );

    return keySearch && keySearch[0];
}

function spLanguageReplacer(englishInfo: GroupYaml, getString: (key: string) => string | undefined) {
    return (spLanguagesString: string) => {
        const englishSpLanguages = spLanguagesString.split(englishInfo.separator);
        const spLanguages: string[] = [];
        const pushLanguage = (language: string) => {
            spLanguages.push(spLanguages.length > 0 ? language : upperCaseFirst(language));
        };

        for (const spLanguage of englishSpLanguages) {
            let key = getKey(englishInfo, spLanguage, 'languages');
            if (key !== undefined) {
                pushLanguage(getString(key)!);
                continue;
            }

            const partialRegex = new RegExp(`^${nestedProperty(englishInfo, 'languages.partial').replace('<language>', '(.+)')}$`, 'i');
            const partialMatch = spLanguage.match(partialRegex);
            if (partialMatch === null)
                throw `Key not found for ${spLanguage}`;

            let newLanguage = getString(getKey(englishInfo, partialMatch[1], 'languages')!)!;
            newLanguage = getString('languages.partial')!.replace('<language>', newLanguage);
            pushLanguage(newLanguage);
        }

        return spLanguages.join(getString('separator'));
    }
}

const updateBnTranslation: Translator = function (englishInfo, englishBn, getString, language, teamPath) {
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

    writeFileSync(bnFilename, replaceLineEndings(bn.content, bn.originalEnding).content);
    exec('node ' + join(__dirname, 'update_flags') + ' ' + bnFilename);
}

const updateGmtTranslation: Translator = function (englishInfo, englishGmt, getString, language, teamPath) {
    const gmtFilename = join(teamPath, `Global_Moderation_Team/${language}.md`);

    if (!existsSync(gmtFilename))
        return;

    const gmt = replaceLineEndings(readFileSync(gmtFilename, 'utf8'));
    const tableHeadersMatch = gmt.content.match(/^\| :-- \| :-- \| :-- \|$/gm);

    if (tableHeadersMatch === null || tableHeadersMatch.length !== 2) {
        console.error(`${language} GMT page formatting is too old`);
        return;
    }

    const table = englishGmt.match(/\| :-- \| :-- \| :-- \|\n((?:\|.+\n)+)/)![1]
        .replace(/(?<=^\|.+?\| ).+(?= \|.+?\|$)/gm, spLanguageReplacer(englishInfo, getString))
        .replace(/(?<=^\|.+?\|.+?\| ).+(?= \|$)/gm, areasString =>
            areasString
                .split(englishInfo.separator)
                .map((area, idx) => {
                    const key = getKey(englishInfo, area, 'gmt.areas');

                    if (key === undefined)
                        throw `Key not found for ${area}`;

                    return idx > 0 ? lowerCaseFirst(getString(key)!) : getString(key);
                })
                .join(getString('separator'))
        );

    // "REMOVE_ME" is a hacky way to step through tables in the
    // translation by breaking the match as it goes. After all the
    // replacements are done, we delete all instances of "REMOVE_ME"
    gmt.content = gmt.content.replace(/(?<=\| :-- \| :-- \| :-- \|\n)(?:\|.+\n)+/, `REMOVE_ME${table}`);

    const table2 = englishGmt.match(/\| :-- \| :-- \| :-- \|\n(?:.|\n)+?\| :-- \| :-- \| :-- \|\n((?:\|.+\n)+)/)![1]
        .replace(`| *${englishInfo.gmt.all_mods}* |`, `| *${getString('gmt.all_mods')}* |`);

    gmt.content = gmt.content.replace(/(?<=\| :-- \| :-- \| :-- \|\n)(?:\|.+\n)+/, table2);
    gmt.content = gmt.content.replace(/REMOVE_ME/g, '');

    writeFileSync(gmtFilename, replaceLineEndings(gmt.content, gmt.originalEnding).content);
    exec('node ' + join(__dirname, 'update_flags') + ' ' + gmtFilename);
}

const updateNatTranslation: Translator = function (englishInfo, englishNat, getString, language, teamPath) {
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

    writeFileSync(natFilename, replaceLineEndings(nat.content, nat.originalEnding).content);
    exec('node ' + join(__dirname, 'update_flags') + ' ' + natFilename);
}

const updateAluTranslation: Translator = function (englishInfo, englishAlu, getString, language, teamPath) {
    const aluFilename = join(teamPath, `osu!_Alumni/${language}.md`);

    if (!existsSync(aluFilename))
        return;

    const alu = replaceLineEndings(readFileSync(aluFilename, 'utf8'));
    const tableHeadersMatch = alu.content.match(/^\| :-- \| :-- \|$/gm);

    if (tableHeadersMatch === null || tableHeadersMatch.length !== 1) {
        console.error(`${language} osu! Alumni page formatting is too old`);
        return;
    }

    const table = englishAlu.match(/\| :-- \| :-- \|\n((?:\|.+\n)+)/)![1]
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

    writeFileSync(aluFilename, replaceLineEndings(alu.content, alu.originalEnding).content);
    exec('node ' + join(__dirname, 'update_flags') + ' ' + aluFilename);
}

const updateSupTranslation: Translator = function (englishInfo, englishSup, getString, language, teamPath) {
    const supFilename = join(teamPath, `Support_Team/${language}.md`);

    if (!existsSync(supFilename))
        return;

    const sup = replaceLineEndings(readFileSync(supFilename, 'utf8'));
    const tableHeadersMatch = sup.content.match(/^\| :-- \| :-- \|$/gm);

    if (tableHeadersMatch === null || tableHeadersMatch.length !== 1) {
        console.error(`${language} Support Team page formatting is too old`);
        return;
    }

    const table = englishSup.match(/\| :-- \| :-- \|\n((?:\|.+\n)+)/)![1]
        .replace(/(?<=^\|.+?\| ).+(?= \|$)/gm, spLanguageReplacer(englishInfo, getString));

    sup.content = sup.content
        .replace(/(?<=\| :-- \| :-- \|\n)(?:\|.+\n)+/, table);

    writeFileSync(supFilename, replaceLineEndings(sup.content, sup.originalEnding).content);
    exec('node ' + join(__dirname, 'update_flags') + ' ' + supFilename);
}

function translateGroups(options: TranslateGroupsOptions) {
    const metaPath = join(wikiPath, 'meta/group-info');
    const teamPath = join(wikiPath, 'wiki/People/The_Team');
    const englishInfo = yaml(readFileSync(join(metaPath, 'en.yaml'), 'utf8')) as GroupYaml;

    const englishBn = replaceLineEndings(readFileSync(join(teamPath, 'Beatmap_Nominators/en.md'), 'utf8')).content.replace(/<!-- TODO -->/g, '');
    const englishGmt = replaceLineEndings(readFileSync(join(teamPath, 'Global_Moderation_Team/en.md'), 'utf8')).content.replace(/<!-- TODO -->/g, '');
    const englishNat = replaceLineEndings(readFileSync(join(teamPath, 'Nomination_Assessment_Team/en.md'), 'utf8')).content.replace(/<!-- TODO -->/g, '');
    const englishAlu = replaceLineEndings(readFileSync(join(teamPath, 'osu!_Alumni/en.md'), 'utf8')).content.replace(/<!-- TODO -->/g, '');
    const englishSup = replaceLineEndings(readFileSync(join(teamPath, 'Support_Team/en.md'), 'utf8')).content.replace(/<!-- TODO -->/g, '');

    // TODO lol
    const checkAllGroups = options.group == null;
    const checkGroups = {
        alu: checkAllGroups || options.group!.some(g => g.match(/alu|alm/i)),
        bng: checkAllGroups || options.group!.some(g => g.match(/bng?|nominator/i)),
        gmt: checkAllGroups || options.group!.some(g => g.match(/gmt|mod|global moderat/i)),
        nat: checkAllGroups || options.group!.some(g => g.match(/nat|nomination assessment/i)),
        sup: checkAllGroups || options.group!.some(g => g.match(/sup/i)),
    };

    for (const groupInfoFilename of readdirSync(metaPath)) {
        if (groupInfoFilename === 'en.yaml')
            continue;

        const groupInfo = yaml(readFileSync(join(metaPath, groupInfoFilename), 'utf8')) as GroupYaml;

        if (groupInfo.outdated)
            continue;

        const language = groupInfoFilename.replace(/\.yaml$/, '');
        const getString: (key: string) => string | undefined =
            (key) => nestedProperty(groupInfo, key) || nestedProperty(englishInfo, key);

        if (checkGroups.alu)
            updateAluTranslation(englishInfo, englishAlu, getString, language, teamPath);

        if (checkGroups.bng)
            updateBnTranslation(englishInfo, englishBn, getString, language, teamPath);

        if (checkGroups.gmt)
            updateGmtTranslation(englishInfo, englishGmt, getString, language, teamPath);

        if (checkGroups.nat)
            updateNatTranslation(englishInfo, englishNat, getString, language, teamPath);

        if (checkGroups.sup)
            updateSupTranslation(englishInfo, englishSup, getString, language, teamPath);
    }
}

export function translateGroupsCommandBuilder() {
    return new Command('translate-groups')
        .description('Update translations of user lists in group articles')
        .option('-g, --group <groups...>', 'Restrict to specific groups')
        .action(translateGroups);
}
