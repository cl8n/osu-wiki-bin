import { Command } from 'commander';
import { existsSync } from 'fs';
import { join } from 'path';
import { error, info, success, warning } from '../console';
import { git } from '../git';
import { run } from '../process';
import { wikiPath } from '../wiki';
import { findBrokenRefs } from './find-broken-refs';
import { findRedundantRedirects } from './find-redundant-redirects';

async function sandbox(action: () => Promise<void> | void): Promise<void> {
    try {
        const result = action();

        if (result != null)
            await result;
    } catch (e: any) {
        error(e.message);
    }
}

export async function lint(paths: string[]): Promise<void> {
    if (paths.length === 0) {
        paths = [...new Set([
            ...(await git([
                'diff',
                '--diff-filter=d',
                '--name-only',
                '--no-renames',
                '-z',
                '--',
                '*.md',
            ])).stdout.split('\0'),
            ...(await git([
                'diff',
                '--cached',
                '--diff-filter=d',
                '--name-only',
                '--no-renames',
                '-z',
                '--',
                '*.md',
            ])).stdout.split('\0'),
            ...(await git([
                'diff',
                '--diff-filter=d',
                '--name-only',
                '--no-renames',
                '-z',
                'master...',
                '--',
                '*.md',
            ])).stdout.split('\0'),
            ...(await git([
                'ls-files',
                '--exclude-standard',
                '--others',
                '-z',
                '--',
                '*.md',
            ])).stdout.split('\0'),
        ])]
            .filter((path) => path.length > 0);

        if (paths.length === 0) {
            success('No changes since `master`', true);
        }

        info('find-redundant-redirects:');
        await sandbox(findRedundantRedirects);
        info('');
    }

    info('find-broken-refs:');
    await sandbox(() => findBrokenRefs(paths, {
        aggregate: false,
        allowRedirects: false,
        excludeOutdated: false,
    }));

    const remarkPath = join(wikiPath, 'node_modules/.bin/remark');

    info('\nRemark:');

    if (existsSync(remarkPath)) {
        await sandbox(() => run(remarkPath, [
            '--frail',
            '--no-stdout',
            '--quiet',
            '--silently-ignore',
            '--',
            ...paths,
        ]));
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
