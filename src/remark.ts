import { execFile } from 'child_process';
import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { Root } from 'mdast';
import { join } from 'path';
import { warning } from './console.js';
import { configPath, wikiPath } from './wiki.js';

let remarkPath: string | null;

// TODO: Cache should be cleared when the processor changes
export async function getMdAst(filename: string): Promise<Root | null> {
  const md5 = createHash('md5').update(await readFile(filename)).digest('hex');
  const cacheDirname = configPath(`md-ast-cache/${md5.slice(0, 2)}`);
  const cachePath = join(cacheDirname, md5);

  if (existsSync(cachePath)) {
    return JSON.parse(await readFile(cachePath, 'utf8'));
  }

  const remarkPath = getRemarkPath();

  if (remarkPath == null) {
    return null;
  }

  const mdAst = await new Promise<Root>((resolve, reject) => {
    execFile(remarkPath, ['--quiet', '--tree-out', filename], (error, stdout) => {
      if (error) {
        return reject(error);
      }

      resolve(JSON.parse(stdout));
    });
  });

  await mkdir(cacheDirname, { recursive: true });
  await writeFile(cachePath, JSON.stringify(mdAst));

  return mdAst;
}

export function getRemarkPath(): string | null {
  if (remarkPath === undefined) {
    remarkPath = join(wikiPath, 'node_modules/.bin/remark');

    if (!existsSync(remarkPath)) {
      warning('Remark is not installed in osu-wiki. Run `npm install`.');
      remarkPath = null;
    }
  }

  return remarkPath;
}
