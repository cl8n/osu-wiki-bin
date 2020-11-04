import type { Dictionary } from '@cl8n/types';
import { readFileSync } from 'fs';
import { safeLoad as yaml } from 'js-yaml';
import { join } from 'path';
import { wikiPath } from './wiki';

let redirects: Dictionary<string> | undefined;

export function getRedirects(): Dictionary<string> {
    if (redirects === undefined) {
        const contents = readFileSync(join(wikiPath, `wiki/redirect.yaml`), 'utf8');
        redirects = yaml(contents) as Dictionary<string>;
    }

    return redirects;
}
