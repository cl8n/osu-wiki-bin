#!/usr/bin/env node

import { Command } from 'commander';
import updateNotifier from 'update-notifier';
import { commandBuilders } from './commands';
import { error } from './console';
import { packageInfo } from './package';
import { loadConfig, loadWikiPath } from './wiki';

updateNotifier({ pkg: packageInfo }).notify();

// TODO: let user specify wiki dir too
if (!loadWikiPath()) {
    error('Program must be run inside an osu-wiki repository', 1);
}

loadConfig();

const program = new Command()
    .description(packageInfo.description)
    .version(packageInfo.version);

commandBuilders.forEach((builder) => program.addCommand(builder()));

program.parse();
