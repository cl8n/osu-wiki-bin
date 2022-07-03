import { spawn } from 'child_process';

export function run(command: string, args: string[], cwd?: string): Promise<void> {
    const child = spawn(command, args, {
        cwd,
        stdio: 'inherit',
    });

    return new Promise((resolve) => {
        child.on('exit', resolve);
    });
}
