import { mockProgram } from "@noom-symbolism/test";
import { findIdentifiers } from "@noom-symbolism/ts-utils";
import { NodeError } from "../error";

describe("NodeError", () => {
  it("should reuse NodeErrors", () => {
    const program = mockProgram({
      "test.ts": `
      const x = 1;
    `,
    });
    const checker = program.getTypeChecker();
    const sourceFile = program.getSourceFile("test.ts")!;

    const xNodes = findIdentifiers(sourceFile, "x");

    const error = new NodeError("test", xNodes[0], checker, new Error("test"));
    expect(new NodeError("test", xNodes[0], checker, error)).toBe(error);
  });
});
