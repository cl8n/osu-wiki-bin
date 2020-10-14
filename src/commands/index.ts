import { checkUserTitlesCommandBuilder } from './check-user-titles';
import { findBrokenRefsCommandBuilder } from './find-broken-refs';
import { findRedundantRedirectsCommandBuilder } from './find-redundant-redirects';
import { replaceCommandBuilder } from './replace';
import { sortListsCommandBuilder } from './sort-lists';
import { updateFlagsCommandBuilder } from './update-flags';

export const commandBuilders = [
    checkUserTitlesCommandBuilder,
    findBrokenRefsCommandBuilder,
    findRedundantRedirectsCommandBuilder,
    replaceCommandBuilder,
    sortListsCommandBuilder,
    updateFlagsCommandBuilder,
];
