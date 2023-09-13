import { Command } from "commander";
import { resolve } from "path";
import invariant from "tiny-invariant";
import { getCliConfig, initTypescript } from "@noom/symbolism-utils";
import { getNodeAtPosition } from "@noom/symbolism-ts-utils";
import { defineSymbol } from "@noom/symbolism-definitions";
import { dumpDefinition } from "@noom/symbolism-ts-debug";

export function initDefineSymbol(program: Command) {
  program.command("defineSymbol <file> <line> <column>").action(dumpSymbol);
}

function dumpSymbol(file: string, line: string, column: string) {
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

  const definition = defineSymbol(node, checker, { chooseLocal: false });
  console.log(dumpDefinition(definition, checker));
}
