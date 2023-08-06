import { checkGroupsCommandBuilder } from './check-groups.js';
import { checkRedirectsCommandBuilder } from './check-redirects.js';
import { checkUserTitlesCommandBuilder } from './check-user-titles.js';
import { findBrokenRefsCommandBuilder } from './find-broken-refs.js';
import { lintCommandBuilder } from './lint.js';
import { replaceCommandBuilder } from './replace.js';
import { reviewCommandBuilder } from './review.js';
import { sortListsCommandBuilder } from './sort-lists.js';
import { translateGroupsCommandBuilder } from './translate-groups.js';

export const commandBuilders = [
    checkGroupsCommandBuilder,
    checkRedirectsCommandBuilder,
    checkUserTitlesCommandBuilder,
    findBrokenRefsCommandBuilder,
    lintCommandBuilder,
    replaceCommandBuilder,
    reviewCommandBuilder,
    sortListsCommandBuilder,
    translateGroupsCommandBuilder,
];
