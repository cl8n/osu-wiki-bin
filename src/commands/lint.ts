import { execFileSync } from 'child_process';
import { Command } from 'commander';
import { existsSync } from 'fs';
import { join } from 'path';
import { error, warning } from '../console';
import { git } from '../git';
import { wikiPath } from '../wiki';

// TODO: should call functions directly instead of running commands
export async function lint(paths: string[]): Promise<void> {
    if (paths.length === 0) {
        paths = [...new Set([
            ...(await git([
                'diff',
                '--diff-filter=d',
                '--name-only',
                '--no-renames',
                '-z',
                'master...',
                '*.md',
            ])).split('\0'),
            ...(await git([
                'ls-files',
                '--exclude-standard',
                '--others',
                '-z',
            ])).split('\0'),
        ])]
            .filter((path) => path.length > 0);

        if (paths.length === 0) {
            console.error('No changes since `master`');
            process.exit();
        }

        execFileSync(process.argv[0], [
            process.argv[1],
            'find-redundant-redirects',
        ]);
    }

    execFileSync(process.argv[0], [
        process.argv[1],
        'find-broken-refs',
        ...paths,
    ]);

    const remarkPath = join(wikiPath, 'node_modules/.bin/remark');

    if (existsSync(remarkPath)) {
        execFileSync(remarkPath, [
            '--frail',
            '--no-stdout',
            '--quiet',
            '--silently-ignore',
            ...paths,
        ], { cwd: wikiPath });
    } else {
        warning('Remark is not installed in osu-wiki. Run `npm install`.');
    }
}

export function lintCommandBuilder() {
    return new Command('lint')
        .arguments('[paths...]')
        .description('Run all linting checks. When no paths are given, run on files that changed from master.')
        //TODO: .option('-o, --online', 'Run extra checks using the osu! website.')
        .action(lint);
}
