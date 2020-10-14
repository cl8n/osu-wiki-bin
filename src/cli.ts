#!/usr/bin/env node

import { red } from 'chalk';
import { Command } from 'commander';
import { commandBuilders } from './commands';
import { packageInfo } from './package';
import { loadWikiPath } from './wiki';

// TODO: let user specify wiki dir too
if (!loadWikiPath()) {
    console.error(red('Error: Must be run inside osu-wiki'));
    process.exit(1);
}

const program = new Command()
    .description(packageInfo.description)
    .version(packageInfo.version);

commandBuilders.forEach((builder) => program.addCommand(builder()));

program.parse();
