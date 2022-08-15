import { Command } from 'commander';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { load as yaml } from 'js-yaml';
import { join } from 'path';
import { error, warning } from '../console.js';
import { replaceLineEndings } from '../text.js';
import { wikiPath } from '../wiki.js';
import { getKey, NestedKeyFor, nestedProperty } from '../deep.js';

// TODO whole thing is so shit
// upgrade me

interface TranslateGroupsOptions {
    group?: string[];
}

type GroupYaml = {
    outdated_translation?: boolean;
    separator: string;
    alumni: {
        roles: Record<string, string>;
    };
    gmt: {
        all_mods: string;
        areas: Record<string, string>;
    };
    nat: {
        areas: Record<string, string>;
    };
    languages: Record<string, string>;
};

type GroupYamlGetString = (key: NestedKeyFor<GroupYaml, string>) => string;

type Translator = (
    enInfo: GroupYaml,
    en: string,
    getString: GroupYamlGetString,
    language: string,
    teamPath: string,
) => void;

function upperCaseFirst(string: string) {
    return string.startsWith('osu!')
        ? string
        : string.charAt(0).toUpperCase() + string.slice(1);
}

const frLowercaseVowels = new Set([
    'a', 'à', 'â',
    'e', 'é', 'è', 'ê', 'ë',
    'h', // *usually* acts like a vowel, for this purpose
    'i', 'î', 'ï',
    'o', 'ô',
    'u', 'ù', 'û', 'ü',
    'y', 'ÿ',
]);

function getPartialString(getString: GroupYamlGetString, language: string, spLanguage: string): string {
    return language === 'fr' && frLowercaseVowels.has(spLanguage.charAt(0).toLowerCase())
        ? getString('languages.partial_vowel_prefix') || getString('languages.partial')
        : getString('languages.partial');
}

function spLanguageReplacer(englishInfo: GroupYaml, getString: GroupYamlGetString, language: string) {
    if (Intl.DisplayNames.supportedLocalesOf(language).length === 0)
        error(`Missing Node.js language support for ${language}. Make sure you are using a recent version of Node.js`);

    const languageNames = new Intl.DisplayNames(language, { type: 'language' });

    return (spLanguagesString: string) => {
        const englishSpLanguages = spLanguagesString.split(englishInfo.separator);
        const spLanguages: string[] = [];

        for (const spLanguage of englishSpLanguages) {
            let key = getKey(englishInfo, spLanguage, 'languages');
            if (key != null) {
                spLanguages.push(getString(key) || languageNames.of(key.slice(10))!);
                continue;
            }

            const partialRegex = new RegExp(`^${nestedProperty(englishInfo, 'languages.partial').replace('<language>', '(.+)')}$`, 'i');
            const partialMatch = spLanguage.match(partialRegex);

            if (
                partialMatch == null ||
                (key = getKey(englishInfo, partialMatch[1], 'languages')) == null
            ) {
                // For VINXIS in https://github.com/ppy/osu-wiki/pull/5068
                if (spLanguage.toLowerCase() !== 'some english')
                    warning(`Language key not found for "${spLanguage}"`);

                continue;
            }

            spLanguages.push(
                getPartialString(getString, language, partialMatch[1])
                    .replace('<language>', getString(key) || languageNames.of(key.slice(10))!),
            );
        }

        return upperCaseFirst(spLanguages.join(getString('separator')));
    }
}

const updateBnTranslation: Translator = function (englishInfo, englishBn, getString, language, teamPath) {
    const bnFilename = join(teamPath, `Beatmap_Nominators/${language}.md`);

    if (!existsSync(bnFilename))
        return;

    const bn = replaceLineEndings(readFileSync(bnFilename, 'utf8'));
    const tableHeadersMatch = bn.content.match(/^\| :-- \| :-- \|$/gm);

    if (tableHeadersMatch == null || tableHeadersMatch.length !== 8) {
        warning(`${language} BN page formatting is too old, skipping`);
        return;
    }

    for (const tableMatch of englishBn.matchAll(/\| :-- \| :-- \|\n((?:\|.+\n)+)/g)) {
        let table = tableMatch[1];

        table = table.replace(/(?<=^\|.+?\| ).+(?= \|$)/gm, spLanguageReplacer(englishInfo, getString, language));

        // "REMOVE_ME" is a hacky way to step through tables in the
        // translation by breaking the match as it goes. After all the
        // replacements are done, we delete all instances of "REMOVE_ME"
        bn.content = bn.content.replace(/(?<=\| :-- \| :-- \|\n)(?:\|.+\n)+/, `REMOVE_ME${table}`);
    }

    bn.content = bn.content.replace(/REMOVE_ME/g, '');

    writeFileSync(bnFilename, replaceLineEndings(bn));
}

const updateGmtTranslation: Translator = function (englishInfo, englishGmt, getString, language, teamPath) {
    const gmtFilename = join(teamPath, `Global_Moderation_Team/${language}.md`);

    if (!existsSync(gmtFilename))
        return;

    const gmt = replaceLineEndings(readFileSync(gmtFilename, 'utf8'));
    const tableHeadersMatch = gmt.content.match(/^\| :-- \| :-- \| :-- \|$/gm);

    if (tableHeadersMatch == null || tableHeadersMatch.length !== 2) {
        warning(`${language} GMT page formatting is too old, skipping`);
        return;
    }

    const table = englishGmt.match(/\| :-- \| :-- \| :-- \|\n((?:\|.+\n)+)/)![1]
        .replace(/(?<=^\|.+?\| ).+(?= \|.+?\|$)/gm, spLanguageReplacer(englishInfo, getString, language))
        .replace(/(?<=^\|.+?\|.+?\| ).+(?= \|$)/gm, areasString =>
            upperCaseFirst(
                areasString
                    .split(englishInfo.separator)
                    .map((area) => {
                        const key = getKey(englishInfo, area, 'gmt.areas');

                        if (key == null)
                            throw `Key not found for ${area}`;

                        return getString(key);
                    })
                    .join(getString('separator'))
            )
        );

    // "REMOVE_ME" is a hacky way to step through tables in the
    // translation by breaking the match as it goes. After all the
    // replacements are done, we delete all instances of "REMOVE_ME"
    gmt.content = gmt.content.replace(/(?<=\| :-- \| :-- \| :-- \|\n)(?:\|.+\n)+/, `REMOVE_ME${table}`);

    const table2 = englishGmt.match(/\| :-- \| :-- \| :-- \|\n(?:.|\n)+?\| :-- \| :-- \| :-- \|\n((?:\|.+\n)+)/)![1]
        .replace(`| *${upperCaseFirst(englishInfo.gmt.all_mods)}* |`, `| *${upperCaseFirst(getString('gmt.all_mods'))}* |`);

    gmt.content = gmt.content.replace(/(?<=\| :-- \| :-- \| :-- \|\n)(?:\|.+\n)+/, table2);
    gmt.content = gmt.content.replace(/REMOVE_ME/g, '');

    writeFileSync(gmtFilename, replaceLineEndings(gmt));
}

const updateNatTranslation: Translator = function (englishInfo, englishNat, getString, language, teamPath) {
    const natFilename = join(teamPath, `Nomination_Assessment_Team/${language}.md`);

    if (!existsSync(natFilename))
        return;

    const nat = replaceLineEndings(readFileSync(natFilename, 'utf8'));
    const tableHeadersMatch = nat.content.match(/^\| :-- \| :-- \| :-- \|$/gm);

    if (tableHeadersMatch == null || tableHeadersMatch.length !== 4) {
        warning(`${language} NAT page formatting is too old, skipping`);
        return;
    }

    for (const tableMatch of englishNat.matchAll(/\| :-- \| :-- \| :-- \|\n((?:\|.+\n)+)/g)) {
        let table = tableMatch[1];

        table = table.replace(/(?<=^\|.+?\| ).+(?= \|.+?\|$)/gm, spLanguageReplacer(englishInfo, getString, language));
        table = table.replace(/(?<=^\|.+?\|.+?\| ).+(?= \|$)/gm, areasString =>
            upperCaseFirst(
                areasString
                    .split(englishInfo.separator)
                    .map(area => {
                        const key = getKey(englishInfo, area, 'nat.areas');

                        if (key == null)
                            throw `Key not found for ${area}`;

                        return getString(key);
                    })
                    .join(getString('separator'))
            )
        );

        // "REMOVE_ME" is a hacky way to step through tables in the
        // translation by breaking the match as it goes. After all the
        // replacements are done, we delete all instances of "REMOVE_ME"
        nat.content = nat.content.replace(/(?<=\| :-- \| :-- \| :-- \|\n)(?:\|.+\n)+/, `REMOVE_ME${table}`);
    }

    nat.content = nat.content.replace(/REMOVE_ME/g, '');

    writeFileSync(natFilename, replaceLineEndings(nat));
}

const updateAluTranslation: Translator = function (englishInfo, englishAlu, getString, language, teamPath) {
    const aluFilename = join(teamPath, `osu!_Alumni/${language}.md`);

    if (!existsSync(aluFilename))
        return;

    const alu = replaceLineEndings(readFileSync(aluFilename, 'utf8'));
    const tableHeadersMatch = alu.content.match(/^\| :-- \| :-- \|$/gm);

    if (tableHeadersMatch == null || tableHeadersMatch.length !== 1) {
        warning(`${language} osu! Alumni page formatting is too old, skipping`);
        return;
    }

    const table = englishAlu.match(/\| :-- \| :-- \|\n((?:\|.+\n)+)/)![1]
        .replace(/(?<=^\|.+?\| ).+(?= \|$)/gm, rolesString =>
            upperCaseFirst(
                rolesString
                    .split(englishInfo.separator)
                    .map((role) => {
                        const key = getKey(englishInfo, role, 'alumni.roles');

                        if (key == null) {
                            if (role === role.toUpperCase())
                                return role;

                            throw `Key not found for ${role}`;
                        }

                        return getString(key);
                    })
                    .join(getString('separator'))
            )
        );

    alu.content = alu.content.replace(/(?<=\| :-- \| :-- \|\n)(?:\|.+\n)+/, table);

    writeFileSync(aluFilename, replaceLineEndings(alu));
}

const updateSupTranslation: Translator = function (englishInfo, englishSup, getString, language, teamPath) {
    const supFilename = join(teamPath, `Support_Team/${language}.md`);

    if (!existsSync(supFilename))
        return;

    const sup = replaceLineEndings(readFileSync(supFilename, 'utf8'));
    const tableHeadersMatch = sup.content.match(/^\| :-- \| :-- \|$/gm);

    if (tableHeadersMatch == null || tableHeadersMatch.length !== 1) {
        warning(`${language} Support Team page formatting is too old, skipping`);
        return;
    }

    const table = englishSup.match(/\| :-- \| :-- \|\n((?:\|.+\n)+)/)![1]
        .replace(/(?<=^\|.+?\| ).+(?= \|$)/gm, spLanguageReplacer(englishInfo, getString, language));

    sup.content = sup.content
        .replace(/(?<=\| :-- \| :-- \|\n)(?:\|.+\n)+/, table);

    writeFileSync(supFilename, replaceLineEndings(sup));
}

export function translateGroups(options: TranslateGroupsOptions) {
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
        gmt: checkAllGroups || options.group!.some(g => g.match(/gmt|mod/i)),
        nat: checkAllGroups || options.group!.some(g => g.match(/nat|nomination assessment/i)),
        sup: checkAllGroups || options.group!.some(g => g.match(/sup/i)),
    };

    for (const groupInfoFilename of readdirSync(metaPath)) {
        if (groupInfoFilename === 'en.yaml')
            continue;

        const groupInfoFilenameMatch = groupInfoFilename.match(/^([a-z-]{1,5})\.yaml$/);

        if (groupInfoFilenameMatch == null)
            continue;

        const groupInfo = yaml(readFileSync(join(metaPath, groupInfoFilename), 'utf8')) as Partial<GroupYaml>;

        // if (groupInfo.outdated_translation)
        //     continue;

        const language = groupInfoFilenameMatch[1];
        const getString: GroupYamlGetString =
            (key) => nestedProperty(groupInfo, key) ||
                (key.startsWith('languages.') && key !== 'languages.partial' ? '' : nestedProperty(englishInfo, key));

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
