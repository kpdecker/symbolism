import { program } from 'commander';

import { parseConfig } from './config';
import { isLocationCovered, parseCoverage } from './coverage';

program.option('-c, --config <path>', 'config file path', './.token-cov.json');
program.argument('<coverage json path>', 'Coverage json file');

program.parse();

const opts = program.opts();

const config = parseConfig(opts.config);
const coverageJson = parseCoverage(program.args[0]);
