import { Option, program } from "commander";
import { initCoverage } from "./actions/coverage";
import { initDumpFiles } from "./actions/dump-files";
import { initDumpSymbols } from "./actions/dump-symbols";

import { loadCliConfig, LogLevel, setLogLevel } from "@symbolism/utils";
import { initCallInputs } from "./actions/call-inputs";
import { initDumpSchema } from "./actions/dump-schema";
import { initDefineSymbol } from "./actions/define-symbol";

program.option("-c, --config <path>", "config file path", "./.symbolism.json");

program.addOption(
  new Option("--log-level <logLevel>", "Logging level")
    .choices(Object.keys(LogLevel).filter((key) => !/^\d+$/.test(key)))
    .default("info")
);
program.option("--verbose", "enable verbose logging");

program.hook("preAction", (command) => {
  const opts = command.opts();
  loadCliConfig(opts.config);

  setLogLevel(LogLevel[opts.logLevel] as unknown as LogLevel);
});

initCoverage(program);
initDumpFiles(program);
initDefineSymbol(program);
initDumpSymbols(program);

initCallInputs(program);
initDumpSchema(program);

program.parse();
