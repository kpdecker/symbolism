import { Command, OptionValues } from "commander";
import ts from "typescript";
import {
  createJsonSchema,
  evaluateSchema,
  printSchema,
} from "@noom/symbolism-type-eval";
import { getCliConfig, initTypescript, logVerbose } from "@noom/symbolism-utils";
import { nodeFromCLI } from "../arg-parser";
import { dumpNode } from "@noom/symbolism-ts-debug";

export function initDumpSchema(program: Command) {
  program
    .command("dumpSchema")
    .argument(
      "<symbolPath>",
      "Name of the symbol to analyze. " +
        "These can be found via the dump-symbols command. " +
        "When the file option is passed, this value may also " +
        "be a string in the form of ':line:column' "
    )
    .option("-f, --file <file>", "Filter to symbols defined in file")
    .option("--json <namespace>", "Output json schema to std out")
    .option("--comment <namespace>", "Comment to include in json schema")
    .action(dumpSchema);
}

function dumpSchema(symbolPath: string, options: OptionValues) {
  const config = getCliConfig();
  const services = initTypescript(config, options.file);
  const program = services.getProgram();
  if (!program) {
    throw new Error("Failed to create program");
  }

  const checker = program.getTypeChecker();

  let node = nodeFromCLI(program, symbolPath, options);
  if (!node) {
    throw new Error(`Unable to find symbol ${symbolPath}`);
  }

  if (
    ts.isTemplateHead(node) ||
    ts.isTemplateSpan(node) ||
    ts.isTemplateSpan(node.parent)
  ) {
    node = node.parent;
  }

  logVerbose(`Scanning node`, () => dumpNode(node, checker));

  const schema = evaluateSchema(node, checker);

  console.log(
    options.json
      ? JSON.stringify(
          createJsonSchema({
            $id: options.json,
            $comment: options.comment,
            schema,
          }),
          undefined,
          2
        )
      : printSchema(schema)
  );
}
