import { checkUserTitlesCommandBuilder } from './check-user-titles';
import { findBrokenRefsCommandBuilder } from './find-broken-refs';
import { replaceCommandBuilder } from './replace';
import { sortListsCommandBuilder } from './sort-lists';
import { updateFlagsCommandBuilder } from './update-flags';

export const commandBuilders = [
    checkUserTitlesCommandBuilder,
    findBrokenRefsCommandBuilder,
    replaceCommandBuilder,
    sortListsCommandBuilder,
    updateFlagsCommandBuilder,
];
