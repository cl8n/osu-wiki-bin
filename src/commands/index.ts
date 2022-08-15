import { checkUserTitlesCommandBuilder } from './check-user-titles';
import { findBrokenRefsCommandBuilder } from './find-broken-refs';
import { findRedundantRedirectsCommandBuilder } from './find-redundant-redirects';
import { lintCommandBuilder } from './lint';
import { replaceCommandBuilder } from './replace';
import { reviewCommandBuilder } from './review';
import { sortListsCommandBuilder } from './sort-lists';
import { translateGroupsCommandBuilder } from './translate-groups';

export const commandBuilders = [
    checkUserTitlesCommandBuilder,
    findBrokenRefsCommandBuilder,
    findRedundantRedirectsCommandBuilder,
    lintCommandBuilder,
    replaceCommandBuilder,
    reviewCommandBuilder,
    sortListsCommandBuilder,
    translateGroupsCommandBuilder,
];
