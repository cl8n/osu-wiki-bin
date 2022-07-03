import { execFile } from 'child_process';

export function git(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        execFile('git', args, (error, stdout, stderr) => {
            if (error)
                return reject(error);

            resolve({ stdout, stderr });
        });
    });
}
