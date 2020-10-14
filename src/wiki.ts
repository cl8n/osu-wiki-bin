import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

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
