#!/usr/bin/env node

import { Command } from 'commander';
import { commandBuilders } from './commands';
import { packageInfo } from './package';

const program = new Command()
    .description(packageInfo.description)
    .version(packageInfo.version);

commandBuilders.forEach((builder) => program.addCommand(builder()));

program.parse();
