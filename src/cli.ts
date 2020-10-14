#!/usr/bin/env node

import { red } from 'chalk';
import { Command } from 'commander';
import { commandBuilders } from './commands';
import { packageInfo } from './package';
import { loadConfig, loadWikiPath } from './wiki';

// TODO: let user specify wiki dir too
if (!loadWikiPath()) {
    console.error(red('Error: Program must be run inside an osu-wiki repository'));
    process.exit(1);
}

loadConfig();

const program = new Command()
    .description(packageInfo.description)
    .version(packageInfo.version);

commandBuilders.forEach((builder) => program.addCommand(builder()));

program.parse();
