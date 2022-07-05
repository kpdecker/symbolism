import { program } from 'commander';

import { parseConfig } from './config';

program.option('-c, --config <path>', 'config file path', './.token-cov.json');

program.parse();

const opts = program.opts();

const config = parseConfig(opts.config);
