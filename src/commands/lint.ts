import { Command } from 'commander';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import { error, info, success, warning } from '../console.js';
import { gitFileList } from '../git.js';
import { run } from '../process.js';
import { wikiPath } from '../wiki.js';
import { checkRedirects } from './check-redirects.js';
import { findBrokenRefs } from './find-broken-refs.js';

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
            ...(await gitFileList([
                'diff',
                '--diff-filter=d',
                '--name-only',
                '--no-renames',
                '-z',
                '--',
                '*.md',
            ])),
            ...(await gitFileList([
                'diff',
                '--cached',
                '--diff-filter=d',
                '--name-only',
                '--no-renames',
                '-z',
                '--',
                '*.md',
            ])),
            ...(await gitFileList([
                'diff',
                '--diff-filter=d',
                '--name-only',
                '--no-renames',
                '-z',
                'master...',
                '--',
                '*.md',
            ])),
            ...(await gitFileList([
                'ls-files',
                '--exclude-standard',
                '--others',
                '-z',
                '--',
                '*.md',
            ])),
        ])]
            .map((path) => relative('.', join(wikiPath, path)));

        if (paths.length === 0) {
            success('No changes since master', true);
        }

        info('check-redirects:');
        await sandbox(checkRedirects);
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
