import { checkGroupsCommandBuilder } from './check-groups.js';
import { checkUserTitlesCommandBuilder } from './check-user-titles.js';
import { findBrokenRefsCommandBuilder } from './find-broken-refs.js';
import { findRedundantRedirectsCommandBuilder } from './find-redundant-redirects.js';
import { lintCommandBuilder } from './lint.js';
import { replaceCommandBuilder } from './replace.js';
import { reviewCommandBuilder } from './review.js';
import { sortListsCommandBuilder } from './sort-lists.js';
import { translateGroupsCommandBuilder } from './translate-groups.js';

export const commandBuilders = [
    checkGroupsCommandBuilder,
    checkUserTitlesCommandBuilder,
    findBrokenRefsCommandBuilder,
    findRedundantRedirectsCommandBuilder,
    lintCommandBuilder,
    replaceCommandBuilder,
    reviewCommandBuilder,
    sortListsCommandBuilder,
    translateGroupsCommandBuilder,
];
