import { execFile } from 'child_process';
import { wikiPath } from './wiki.js';

export function git(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        execFile('git', args, { cwd: wikiPath }, (error, stdout, stderr) => {
            if (error)
                return reject(error);

            resolve({ stdout, stderr });
        });
    });
}

export async function gitFileList(args: string[]): Promise<string[]> {
    return (await git(args))
        .stdout
        .split('\0')
        .map((path) => path.trim())
        .filter((path) => path.length > 0);
}
