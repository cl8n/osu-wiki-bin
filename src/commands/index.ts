import { checkUserTitlesCommandBuilder } from './check-user-titles';
import { findBrokenRefsCommandBuilder } from './find-broken-refs';
import { findRedundantRedirectsCommandBuilder } from './find-redundant-redirects';
import { lintCommandBuilder } from './lint';
import { replaceCommandBuilder } from './replace';
import { sortListsCommandBuilder } from './sort-lists';
import { translateGroupsCommandBuilder } from './translate-groups';
import { updateFlagsCommandBuilder } from './update-flags';

export const commandBuilders = [
    checkUserTitlesCommandBuilder,
    findBrokenRefsCommandBuilder,
    findRedundantRedirectsCommandBuilder,
    lintCommandBuilder,
    replaceCommandBuilder,
    sortListsCommandBuilder,
    translateGroupsCommandBuilder,
    updateFlagsCommandBuilder,
];
