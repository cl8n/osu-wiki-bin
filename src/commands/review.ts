import { Command } from 'commander';
import { error, info, success, warning } from '../console.js';
import { git, gitFileList } from '../git.js';
import { lint } from './lint.js';

function promiseResolved(promise: Promise<unknown>): Promise<boolean> {
  return promise
    .then(() => true)
    .catch(() => false);
}

export async function review() {
  const branch = (await git(['branch', '--show-current'])).stdout.trim();

  if (branch === 'master') {
    error('Must have a branch other than master checked out', 1);
  }

  if (!await promiseResolved(git(['diff', '--quiet'])) || !await promiseResolved(git(['diff', '--cached', '--quiet']))) {
    error('Index and working tree must be clean', 1);
  }

  info(`Pulling from upstream of ${branch}`);
  await git(['pull']);

  try {
    info('Switching to master');
    await git(['switch', 'master']);

    info('Pulling from upstream of master');
    await git(['pull']);
  } finally {
    info(`Switching to ${branch}`);
    await git(['switch', branch]);
  }

  const changedFiles = await gitFileList(['diff', '--name-only', '-z', 'master...']);

  if (!await promiseResolved(git(['diff', '--quiet', '...master', '--', ...changedFiles]))) {
    error(`Found unmerged changes in master to files changed in ${branch}. Merge master into ${branch}`, 1);
  }

  if (!await promiseResolved(git(['diff', '--quiet', '...master']))) {
    warning(`Found unmerged changes in master. Merging master into ${branch}`);
    await git(['merge', 'master']);
  }

  await lint([]);

  success(`Ready to review. Files changed in ${branch}:\n${changedFiles.map((path) => `  ${path}`).join('\n')}`);
}

export function reviewCommandBuilder() {
  return new Command('review')
    .description('Prepare a branch for review')
    .action(review);
}
