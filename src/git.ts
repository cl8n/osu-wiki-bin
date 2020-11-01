import { execFile } from 'child_process';
import { wikiPath } from './wiki';

function git(...args: string[]) {
    return new Promise((resolve: (value: string) => void, reject) => {
        execFile('git', args, { cwd: wikiPath }, (error, stdout, stderr) => {
            if (error)
                return reject(error);

            if (stderr.trim() !== '')
                return reject(stderr);

            resolve(stdout);
        });
    });
}
