import { testStatement } from "../../../test/utils";

describe("infer statements", () => {
  it("should handle if statements", () => {
    expect(testStatement("if (true) {}")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "any",
      }
    `);
  });
  it("should handle do statements", () => {
    expect(testStatement("do {} while (false)")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "any",
      }
    `);
  });
  it("should handle while statements", () => {
    expect(testStatement("while (false) {}")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "any",
      }
    `);
  });
  it("should handle throw statements", () => {
    expect(testStatement("throw new Error()")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 0,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 1027,
            "name": "interface Error {
      ",
            "path": ".Error",
          },
          Object {
            "column": 12,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "VariableDeclaration",
            "line": 1039,
            "name": "Error: ErrorConstructor",
            "path": ".Error",
          },
        ],
        "type": "Error",
      }
    `);
  });
  it("should handle continue statements", () => {
    expect(testStatement("continue")).toMatchInlineSnapshot(`null`);
  });
  it("should handle break statements", () => {
    expect(testStatement("break")).toMatchInlineSnapshot(`null`);
  });
  it("should handle with statements", () => {
    expect(testStatement("with (Date) {}")).toMatchInlineSnapshot(`null`);
  });
  it("should handle debugger statements", () => {
    expect(testStatement("debugger")).toMatchInlineSnapshot(`null`);
  });
  it("should handle try statements", () => {
    expect(testStatement("try {}")).toMatchInlineSnapshot(`null`);
  });
});
