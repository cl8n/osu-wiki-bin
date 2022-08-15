import chalk from 'chalk';

export function error(message: string): void;
export function error(message: string, exitCode: number): never;
export function error(message: string, exitCode?: number): never | void {
    errorX(`Error: ${message}`);

    if (exitCode != null)
        process.exit(exitCode);
}

export function errorX(message: string): void {
    console.error(chalk.red(message));
}

export function info(message: string): void {
    console.error(chalk.dim(message));
}

export function success(message: string): void;
export function success(message: string, exit: true): never;
export function success(message: string, exit?: true): never | void {
    console.error(chalk.green(message));

    if (exit != null)
        process.exit();
}

export function warning(message: string): void {
    warningX(`Warning: ${message}`);
}

export function warningX(message: string): void {
    console.error(chalk.yellow(message));
}
