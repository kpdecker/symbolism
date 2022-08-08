import { Command, OptionValues } from "commander";
import { resolve } from "path";
import invariant from "tiny-invariant";
import { getCliConfig, initTypescript } from "@symbolism/utils";
import { getNodeAtPosition } from "@symbolism/ts-utils";
import { defineSymbol } from "@symbolism/definitions";
import { dumpDefinition } from "@symbolism/ts-debug";

export function initDefineSymbol(program: Command) {
  program.command("defineSymbol <file> <line> <column>").action(dumpSymbol);
}

function dumpSymbol(
  file: string,
  line: string,
  column: string,
  opts: OptionValues
) {
  const config = getCliConfig();
  const services = initTypescript(config, file);
  const program = services.getProgram();
  const checker = program?.getTypeChecker();
  if (!program || !checker) {
    throw new Error("Failed to create program");
  }

  const sourceFile = program.getSourceFile(resolve(file));
  invariant(sourceFile, "Unable to find file");

  const position = sourceFile?.getPositionOfLineAndCharacter(
    parseInt(line) - 1,
    parseInt(column) - 1
  );
  const node = getNodeAtPosition(sourceFile, position);

  const definition = defineSymbol(node, checker);
  console.log(dumpDefinition(definition, checker));
}
