import { program } from "commander";
import { initAssert } from "./actions/assert";
import { initDumpFiles } from "./actions/dump-files";
import { initDumpSymbols } from "./actions/dump-symbols";

import { loadCliConfig } from "@symbolism/utils";

program.option("-c, --config <path>", "config file path", "./.token-cov.json");

program.hook("preAction", (command) => {
  const opts = command.opts();
  loadCliConfig(opts.config);
});

initAssert(program);
initDumpFiles(program);
initDumpSymbols(program);

program.parse();
