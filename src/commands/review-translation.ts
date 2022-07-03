import { Command } from 'commander';
import { error } from '../console';
import { git } from '../git';
import { lint } from './lint';

function promiseResolved(promise: Promise<unknown>): Promise<boolean> {
  return promise
    .then(() => true)
    .catch(() => false);
}

const pathRegex = /(?<=^|\/)[a-z]{2}(?:-[a-z]{2})?\.md$/i;

export async function reviewTranslation() {
  const branch = (await git(['branch', '--show-current'])).stdout.trim();

  if (branch === 'master') {
    error('Must have a translation branch checked out', 1);
  }

  if (!await promiseResolved(git(['diff', '--quiet'])) || !await promiseResolved(git(['diff', '--cached', '--quiet']))) {
    error('Index and working tree must be clean', 1);
  }

  await git(['pull'])
    .then(() => git(['switch', 'master']))
    .then(() => git(['pull']))
    .then(() => git(['switch', branch]));

  const changedFiles = (await git(['diff', '--name-only', '-z', 'master...'])).stdout.split('\0');
  const englishFiles = changedFiles
    .filter((path) => pathRegex.test(path))
    .map((path) => path.replace(pathRegex, 'en.md'));

  if (!await promiseResolved(git(['diff', '--quiet', '...master', '--', ...new Set(englishFiles)]))) {
    await git(['merge', 'master']);
  }

  await lint([]);
}

export function reviewTranslationCommandBuilder() {
  return new Command('review-translation')
    .description('Prepare a translation branch for review')
    .action(reviewTranslation);
}
