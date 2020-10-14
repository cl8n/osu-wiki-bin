import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface OsuWikiConfig {
    osuApiKey?: string;
    qatApiKey?: string;
}

// TODO: error checking... and has to be called after loadWikiPath
let _config: OsuWikiConfig;
export function loadConfig() {
    const configPath = join(wikiPath, '.osu-wiki.json');

    if (existsSync(configPath)) {
        _config = JSON.parse(readFileSync(configPath, 'utf8')) as OsuWikiConfig;
    } else {
        _config = {};
        writeFileSync(configPath, '{\n\n}\n');
    }
}

export function config(key: keyof OsuWikiConfig) {
    const value = _config[key];

    if (value !== undefined) {
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
