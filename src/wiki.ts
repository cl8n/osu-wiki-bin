import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// TODO: error checking...
export let wikiPath: string;
export function loadWikiPath() {
    interface PackageInfo {
        repository?: string;
    }

    let path = '.';

    while (!readdirSync(path).includes('package.json')) {
        path = join(path, '..');
    }

    const packageInfo = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8')) as PackageInfo;

    if (packageInfo.repository === 'github:ppy/osu-wiki') {
        wikiPath = path;
        return true;
    } else {
        return false;
    }
}
