import { getNodePath } from "@symbolism/paths";
import { initTypescript, parseConfig } from "@symbolism/utils";
import { dumpSymbolTable, parseSymbolTable } from "../index";

describe("symbol table", () => {
  it("should parse this project", () => {
    const config = parseConfig("./.token-cov.json");
    const services = initTypescript(config);
    const program = services.getProgram()!;
    const checker = program.getTypeChecker();

    const symbolTable = parseSymbolTable(program, config);

    expect(symbolTable.size).toBeGreaterThan(100);

    const artifact = Array.from(symbolTable).find(([symbol, references]) => {
      return symbol.getName() === "parseSymbolTable";
    });

    expect(
      getNodePath(artifact![0].declarations![0], checker)
    ).toMatchInlineSnapshot(`"parseSymbolTable"`);

    const dump = Array.from(dumpSymbolTable(symbolTable, checker));
    const dumpArtifact = dump.find(
      ([declaration]) => declaration.name === "parseSymbolTable"
    )!;

    expect(dumpArtifact.length).toBeGreaterThan(1);
  });
});
