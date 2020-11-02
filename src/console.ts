import { red, yellow } from 'chalk';

export function error(message: string): void;
export function error(message: string, exitCode: number): never;
export function error(message: string, exitCode?: number): never | void {
    errorX(`Error: ${message}`);

    if (exitCode != null)
        process.exit(exitCode);
}

export function errorX(message: string): void {
    console.error(red(message));
}

export function warning(message: string): void {
    warningX(`Warning: ${message}`);
}

export function warningX(message: string): void {
    console.error(yellow(message));
}
