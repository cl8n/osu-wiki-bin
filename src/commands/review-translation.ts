import { Command } from 'commander';
import { error, info, success, warning } from '../console';
import { git, gitFileList } from '../git';
import { lint } from './lint';

function promiseResolved(promise: Promise<unknown>): Promise<boolean> {
  return promise
    .then(() => true)
    .catch(() => false);
}

export async function reviewTranslation() {
  const branch = (await git(['branch', '--show-current'])).stdout.trim();

  if (branch === 'master') {
    error('Must have a translation branch checked out', 1);
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

export function reviewTranslationCommandBuilder() {
  return new Command('review-translation')
    .description('Prepare a translation branch for review')
    .action(reviewTranslation);
}
