import { Command } from 'commander';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { load as yaml } from 'js-yaml';
import { join } from 'path';
import { error, warning } from '../console.js';
import { wikiPath } from '../wiki.js';
import { getKey, NestedKeyFor, nestedProperty, NestedScopesFor } from '../deep.js';

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
    subgroups: Record<string, string>;
  };
  languages: Record<string, string>;
};
type GroupYamlGetString = (key: NestedKeyFor<GroupYaml, string>) => string;

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

function getSpLanguageReplacer(enInfo: GroupYaml, getString: GroupYamlGetString, language: string) {
  if (Intl.DisplayNames.supportedLocalesOf(language).length === 0)
    error(`Missing Node.js language support for ${language}. Make sure you are using a recent version of Node.js`);

  const languageNames = new Intl.DisplayNames(language, { type: 'language' });

  return (spLanguagesString: string) => {
    if (spLanguagesString.length === 0) {
      return '';
    }

    const enSpLanguages = spLanguagesString.split(enInfo.separator);
    const spLanguages: string[] = [];

    for (const spLanguage of enSpLanguages) {
      let key = getKey(enInfo, spLanguage, 'languages');
      if (key != null) {
        spLanguages.push(getString(key) || languageNames.of(key.slice(10))!);
        continue;
      }

      const partialRegex = new RegExp(`^${nestedProperty(enInfo, 'languages.partial').replace('<language>', '(.+)')}$`, 'i');
      const partialMatch = spLanguage.match(partialRegex);

      if (
        partialMatch == null ||
        (key = getKey(enInfo, partialMatch[1], 'languages')) == null
      ) {
        warning(`Language key not found for "${spLanguage}". If intentional, please add it to en.yaml.`);
        continue;
      }

      spLanguages.push(
        (language === 'fr' && frLowercaseVowels.has(partialMatch[1].charAt(0).toLowerCase())
          ? getString('languages.partial_vowel_prefix') || getString('languages.partial')
          : getString('languages.partial')
        )
          .replace('<language>', getString(key) || languageNames.of(key.slice(10))!),
      );
    }

    return upperCaseFirst(spLanguages.join(getString('separator')));
  }
}

function getYamlValuesReplacer(enInfo: GroupYaml, getString: GroupYamlGetString, scope: NestedScopesFor<GroupYaml>, content: string, keepAcronyms?: boolean) {
  return (values: string) => values.length === 0 ? '' : upperCaseFirst(
    values
      .split(enInfo.separator)
      .map((value) => {
        const valueWithoutNotes = value.replaceAll(/(?:\[\^[^\]]+\])+$/g, '');
        let newValue = '';

        if (valueWithoutNotes.length > 0) {
          const key = getKey(enInfo, valueWithoutNotes, scope);

          if (key == null) {
            if (keepAcronyms && valueWithoutNotes === valueWithoutNotes.toUpperCase()) {
              newValue = valueWithoutNotes;
            } else {
              warning(`Language key not found for "${valueWithoutNotes}". If intentional, please add it to en.yaml.`);
            }
          } else {
            newValue = getString(key);
          }
        }

        const newNotes = value
          .slice(valueWithoutNotes.length)
          .match(/\[\^[^\]]+\]/g)
          ?.filter((note) => content.includes(note))
          .join('')
          ?? '';

        return newValue + newNotes;
      })
      .join(getString('separator')),
  );
}

const enum TranslateError {
  EnStructure,
  Structure,
}

interface Group {
  directory: string;
  optionRegex: RegExp;
  translate: (content: string, enContent: string, helpers: {
    enInfo: GroupYaml;
    getString: GroupYamlGetString;
    spLanguageReplacer: (spLanguagesString: string) => string;
  }) => string | TranslateError;
}

const groups: Group[] = [
  {
    directory: 'Beatmap_Nominators',
    optionRegex: /bng?|nominator/i,
    translate: (content, enContent, { spLanguageReplacer }) => {
      const enHeaderMatches = [...enContent.matchAll(/^###? .+/gm)];

      if (enHeaderMatches.length !== 9) {
        return TranslateError.EnStructure;
      }

      const headerMatches = [...content.matchAll(/^###? .+/gm)];
      const tableHeaderMatch = content.match(/^\|.+\n\| :-- \| :-- \|$/m);

      if (headerMatches.length !== enHeaderMatches.length || tableHeaderMatch == null) {
        return TranslateError.Structure;
      }

      const tables = [5, 6].map(
        (headerIndex) => enContent
          .slice(
            enHeaderMatches[headerIndex].index! + enHeaderMatches[headerIndex][0].length,
            enHeaderMatches[headerIndex + 1].index!,
          )
          .replaceAll(/^\|.+\n\| :-- \| :-- \|$/gm, tableHeaderMatch[0])
          .replaceAll(/(?<=^\| ::\{[^\|]+\| ).+(?= \|$)/gm, spLanguageReplacer),
      );

      return (
        content.slice(0, headerMatches[5].index! + headerMatches[5][0].length) +
        tables[0] +
        content.slice(headerMatches[6].index!, headerMatches[6].index! + headerMatches[6][0].length) +
        tables[1] +
        content.slice(headerMatches[7].index!)
      );
    }
  },
  {
    directory: 'Global_Moderation_Team',
    optionRegex: /gmt|mod/i,
    translate: (content, enContent, { enInfo, getString, spLanguageReplacer }) => {
      const enTableMatches = [...enContent.matchAll(/(?<=^\| :-- \| :-- \| :-- \|\n)(?:\|.+\n)+/gm)];

      if (enTableMatches.length !== 2) {
        return TranslateError.EnStructure;
      }

      const tableMatches = [...content.matchAll(/(?<=^\| :-- \| :-- \| :-- \|\n)(?:\|.+\n)+/gm)];

      if (tableMatches.length !== enTableMatches.length) {
        return TranslateError.Structure;
      }

      const table1 = enTableMatches[0][0].replaceAll(
        /(?<=^\|[^\|]+\| )((?:(?! \|).)*) \| ((?:(?! \|).)*)/gm,
        (_, spLanguages: string, areas: string) =>
          spLanguageReplacer(spLanguages) +
          ' | ' +
          getYamlValuesReplacer(enInfo, getString, 'gmt.areas', content)(areas),
      );
      const table2 = enTableMatches[1][0].replace(
        `| *${upperCaseFirst(enInfo.gmt.all_mods)}* |`,
        `| *${upperCaseFirst(getString('gmt.all_mods'))}* |`,
      );

      return (
        content.slice(0, tableMatches[0].index!) +
        table1 +
        content.slice(tableMatches[0].index! + tableMatches[0][0].length, tableMatches[1].index!) +
        table2 +
        content.slice(tableMatches[1].index! + tableMatches[1][0].length)
      );
    },
  },
  {
    directory: 'Nomination_Assessment_Team',
    optionRegex: /nat|nomination assess/i,
    translate: (content, enContent, { enInfo, getString, spLanguageReplacer }) => {
      const enTableMatches = [...enContent.matchAll(/(?<=^\| :-- \| :-- \|\n)(?:\|.+\n)+/gm)];

      if (enTableMatches.length !== 6) {
        return TranslateError.EnStructure;
      }

      const tableMatches = [...content.matchAll(/(?<=^\| :-- \| :-- \|\n)(?:\|.+\n)+/gm)];

      if (tableMatches.length !== enTableMatches.length) {
        return TranslateError.Structure;
      }

      const tables = enTableMatches.map(([enTable]) => enTable.replaceAll(
        /(?<=^\|[^\|]+\| )((?:(?! \|).)*) \| ((?:(?! \|).)*)/gm,
        (_, spLanguages: string, subgroup: string) =>
          spLanguageReplacer(spLanguages) +
          ' | ' +
          getYamlValuesReplacer(enInfo, getString, 'nat.subgroups', content)(subgroup),
      ));

      let translation = content.slice(0, tableMatches[0].index!);
      tables.forEach((table, i) => {
        translation += table
          + content.slice(tableMatches[i].index! + tableMatches[i][0].length, tableMatches[i + 1]?.index);
      });
      return translation;
    },
  },
  {
    directory: 'osu!_Alumni',
    optionRegex: /alu|alm/i,
    translate: (content, enContent, { enInfo, getString }) => {
      const enTableMatch = enContent.match(/(?<=^\| :-- \| :-- \|\n)(?:\|.+\n)+/m);

      if (enTableMatch == null) {
        return TranslateError.EnStructure;
      }

      const tableMatch = content.match(/(?<=^\| :-- \| :-- \|\n)(?:\|.+\n)+/m);

      if (tableMatch == null) {
        return TranslateError.Structure;
      }

      return (
        content.slice(0, tableMatch.index!) +
        enTableMatch[0].replaceAll(
          /(?<=^\|[^\|]+\| ).+(?= \|$)/gm,
          getYamlValuesReplacer(enInfo, getString, 'alumni.roles', content, true),
        ) +
        content.slice(tableMatch.index! + tableMatch[0].length)
      );
    },
  },
  {
    directory: 'Technical_Support_Team',
    optionRegex: /sup/i,
    translate: (content, enContent, { spLanguageReplacer }) => {
      const enTableMatch = enContent.match(/(?<=^\| :-- \| :-- \|\n)(?:\|.+\n)+/m);

      if (enTableMatch == null) {
        return TranslateError.EnStructure;
      }

      const tableMatch = content.match(/(?<=^\| :-- \| :-- \|\n)(?:\|.+\n)+/m);

      if (tableMatch == null) {
        return TranslateError.Structure;
      }

      return (
        content.slice(0, tableMatch.index!) +
        enTableMatch[0].replaceAll(/(?<=^\|[^\|]+\| ).+(?= \|$)/gm, spLanguageReplacer) +
        content.slice(tableMatch.index! + tableMatch[0].length)
      );
    },
  },
];

export function translateGroups(options: TranslateGroupsOptions) {
  const metaPath = join(wikiPath, 'meta/group-info');
  const peoplePath = join(wikiPath, 'wiki/People');
  const enInfo = yaml(readFileSync(join(metaPath, 'en.yaml'), 'utf8')) as GroupYaml;
  const checkGroups = groups
    .filter((group) => options.group?.some((g) => group.optionRegex.test(g)) ?? true)
    .map((group) => ({
      ...group,
      enContent: readFileSync(join(peoplePath, group.directory, 'en.md'), 'utf8')
        .replaceAll(/\r\n|\r|\n/g, '\n')
        .replaceAll('<!-- TODO -->', ''),
      skip: false,
    }));

  for (const groupInfoFilename of readdirSync(metaPath)) {
    if (groupInfoFilename === 'en.yaml') {
      continue;
    }

    const groupInfoFilenameMatch = groupInfoFilename.match(/^([a-z-]{2,5})\.yaml$/);

    if (groupInfoFilenameMatch == null) {
      continue;
    }

    const groupInfo = yaml(readFileSync(join(metaPath, groupInfoFilename), 'utf8')) as Partial<GroupYaml>;
    const language = groupInfoFilenameMatch[1];
    const getString: GroupYamlGetString =
      (key) => nestedProperty(groupInfo, key) ||
        (key.startsWith('languages.') && key !== 'languages.partial' ? '' : nestedProperty(enInfo, key));
    const spLanguageReplacer = getSpLanguageReplacer(enInfo, getString, language);

    for (const group of checkGroups) {
      if (group.skip) {
        continue;
      }

      const path = join(peoplePath, group.directory, `${language}.md`);

      if (!existsSync(path)) {
        continue;
      }

      const content = readFileSync(path, 'utf8');
      const translateResult = group.translate(content.replaceAll(/\r\n|\r|\n/g, '\n'), group.enContent, {
        enInfo,
        getString,
        spLanguageReplacer,
      });

      if (translateResult === TranslateError.EnStructure) {
        error(`The structure of the EN ${group.directory} article has changed since this command was last updated. Ask clayton to update it`);
        group.skip = true;
        continue;
      }

      if (translateResult === TranslateError.Structure) {
        warning(`The structure of the ${language.toUpperCase()} ${group.directory} article does not match EN, skipping`);
        continue;
      }

      writeFileSync(path, translateResult.replaceAll('\n', content.match(/\r\n|\r|\n/)?.[0] ?? '\n'));
    }
  }
}

export function translateGroupsCommandBuilder() {
  return new Command('translate-groups')
    .description('Update translations of user lists in group articles')
    .option('-g, --group <groups...>', 'Restrict to specific groups')
    .action(translateGroups);
}
