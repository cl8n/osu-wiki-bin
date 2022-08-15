import type { Dictionary, Empty } from '@cl8n/types';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { load as yaml } from 'js-yaml';
import { join, resolve } from 'path';
import { warning } from './console.js';

interface OsuWikiConfig {
    osuApiKey?: string;
    qatApiKey?: string;
}

const blankConfig: Required<Empty<OsuWikiConfig>> = {
    osuApiKey: '',
    qatApiKey: '',
};

// TODO: error checking... and has to be called after loadWikiPath
let _config: (OsuWikiConfig & { basePath: string }) | undefined;
export function loadConfig() {
    if (_config != null) {
        throw new Error('Config must not be loaded');
    }

    const basePath = join(wikiPath, '.osu-wiki-bin');
    const configPath = join(basePath, 'config.json');
    const oldConfigPath = join(wikiPath, '.osu-wiki-bin.json');

    mkdirSync(basePath, { mode: 0o700, recursive: true });

    if (existsSync(oldConfigPath)) {
        renameSync(oldConfigPath, configPath);
    }

    if (existsSync(configPath)) {
        _config = { basePath, ...JSON.parse(readFileSync(configPath, 'utf8')) };
    } else {
        _config = { basePath, ...blankConfig };
        writeFileSync(configPath, JSON.stringify(blankConfig, null, 2) + '\n');
        warning(`No config options set. Some commands won't work without an API key.\nSee ${configPath}`);
    }
}

export function config(key: keyof OsuWikiConfig) {
    const value = _config?.[key];

    if (value != null && value !== blankConfig[key]) {
        return value;
    }

    throw new Error(`Config option "${key}" must be set`);
}

export function configPath(relativePath?: string): string {
    if (_config?.basePath == null) {
        throw new Error('Config must be loaded');
    }

    return relativePath == null
        ? _config.basePath
        : join(_config.basePath, relativePath);
}

// TODO: error checking...
export let wikiPath: string;
export function loadWikiPath() {
    interface PackageInfo {
        repository?: string;
    }

    const expectedRepository = 'github:ppy/osu-wiki';
    const packageFilename = 'package.json';

    let path = resolve('.');

    while (!existsSync(join(path, packageFilename))) {
        const parentPath = resolve(join(path, '..'));

        if (path === parentPath) {
            return false;
        }

        path = parentPath;
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
    if (redirects == null) {
        const contents = readFileSync(join(wikiPath, `wiki/redirect.yaml`), 'utf8');
        redirects = yaml(contents) as Dictionary<string>;
    }

    return redirects;
}
