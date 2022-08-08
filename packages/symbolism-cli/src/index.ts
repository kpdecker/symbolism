import { program } from "commander";
import { initCoverage } from "./actions/coverage";
import { initDumpFiles } from "./actions/dump-files";
import { initDumpSymbols } from "./actions/dump-symbols";

import { loadCliConfig } from "@symbolism/utils";
import { initCallInputs } from "./actions/call-inputs";
import { initDumpSchema } from "./actions/dump-schema";
import { initDefineSymbol } from "./actions/define-symbol";

program.option("-c, --config <path>", "config file path", "./.symbolism.json");

program.hook("preAction", (command) => {
  const opts = command.opts();
  loadCliConfig(opts.config);
});

initCoverage(program);
initDumpFiles(program);
initDefineSymbol(program);
initDumpSymbols(program);

initCallInputs(program);
initDumpSchema(program);

program.parse();
