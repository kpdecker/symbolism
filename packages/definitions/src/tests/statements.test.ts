import { testStatement } from "../../test/utils";

describe("infer statements", () => {
  it("should handle var statements", () => {
    expect(testStatement("var foo: number;")).toMatchInlineSnapshot(`null`);
  });
  it("should handle if statements", () => {
    expect(testStatement("if (true) {}")).toMatchInlineSnapshot(`null`);
  });
  it("should handle do statements", () => {
    expect(testStatement("do {} while (false)")).toMatchInlineSnapshot(`null`);
  });
  it("should handle while statements", () => {
    expect(testStatement("while (false) {}")).toMatchInlineSnapshot(`null`);
  });
  it("should handle throw statements", () => {
    expect(testStatement("throw new Error()")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "InterfaceDeclaration",
            "location": "node_modules/typescript/lib/lib.es5.d.ts:1027:1",
            "name": "interface Error {
      ",
            "path": "Error",
          },
          Object {
            "kind": "VariableDeclaration",
            "location": "node_modules/typescript/lib/lib.es5.d.ts:1039:13",
            "name": "Error: ErrorConstructor",
            "path": "Error",
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
  it("should handle for statements", () => {
    expect(
      testStatement("for (let i = 0; i < 10; i++) {}")
    ).toMatchInlineSnapshot(`null`);
  });
  it("should handle for-in statements", () => {
    expect(testStatement("for (let i in {}) {}")).toMatchInlineSnapshot(`null`);
  });
  it("should handle for-of statements", () => {
    expect(testStatement("for (let i of {}) {}")).toMatchInlineSnapshot(`null`);
  });
});
