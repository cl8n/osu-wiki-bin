import { execFile } from 'child_process';
import { wikiPath } from './wiki';

export function git(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile('git', args, { cwd: wikiPath }, (error, stdout, stderr) => {
            if (error)
                return reject(error);

            if (stderr.trim() !== '')
                return reject(stderr);

            resolve(stdout);
        });
    });
}
