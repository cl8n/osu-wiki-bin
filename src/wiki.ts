import type { Dictionary, Empty } from '@cl8n/types';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { load as yaml } from 'js-yaml';
import { join } from 'path';
import { warning } from './console';

interface OsuWikiConfig {
    osuApiKey?: string;
    qatApiKey?: string;
}

const blankConfig: Required<Empty<OsuWikiConfig>> = {
    osuApiKey: '',
    qatApiKey: '',
};

// TODO: error checking... and has to be called after loadWikiPath
let _config: OsuWikiConfig;
export function loadConfig() {
    const configPath = join(wikiPath, '.osu-wiki-bin.json');

    if (existsSync(configPath)) {
        _config = JSON.parse(readFileSync(configPath, 'utf8')) as OsuWikiConfig;
    } else {
        _config = blankConfig;
        writeFileSync(configPath, JSON.stringify(blankConfig, undefined, 2) + '\n');
        warning(`No config options set. Some commands won't work without an API key.\nSee ${configPath}`);
    }
}

export function config(key: keyof OsuWikiConfig) {
    const value = _config[key];

    if (value != null && value !== blankConfig[key]) {
        return value;
    }

    throw new Error(`Config option "${key}" must be set`);
}

// TODO: error checking...
export let wikiPath: string;
export function loadWikiPath() {
    interface PackageInfo {
        repository?: string;
    }

    const expectedRepository = 'github:ppy/osu-wiki';
    const packageFilename = 'package.json';

    let path = '.';

    while (!existsSync(join(path, packageFilename))) {
        path = join(path, '..');
    }

    const packageInfo = JSON.parse(readFileSync(join(path, packageFilename), 'utf8')) as PackageInfo;

    if (packageInfo.repository === expectedRepository) {
        wikiPath = path;
        return true;
    } else {
        return false;
    }
}

export const groupMap = {
    'Beatmap_Nominators': [28, 32],
    'Developers': [11],
    'Global_Moderation_Team': [4],
    'Nomination_Assessment_Team': [7],
    'osu!_Alumni': [16],
    'Support_Team': [22],
};

export function loadGroup(group: string, locale: string = 'en'): string {
    const path = join(wikiPath, `wiki/People/The_Team/${group}/${locale}.md`);
    return readFileSync(path, 'utf8');
}

let redirects: Dictionary<string> | undefined;
export function getRedirects(): Dictionary<string> {
    if (redirects === undefined) {
        const contents = readFileSync(join(wikiPath, `wiki/redirect.yaml`), 'utf8');
        redirects = yaml(contents) as Dictionary<string>;
    }

    return redirects;
}
