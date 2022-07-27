import { testStatement } from "../../test/utils";

describe("infer intrinsic types", () => {
  it("should pull undefined", () => {
    expect(testStatement("undefined")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 1,
            "fileName": "intrinsic",
            "kind": "keyword",
            "line": 1,
            "name": "undefined",
            "path": "undefined",
          },
        ],
        "type": "undefined",
      }
    `);
  });
  it("should pull void", () => {
    expect(testStatement("void")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "undefined",
      }
    `);
    expect(testStatement("void 0")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "undefined",
      }
    `);
  });
  it("should pull null", () => {
    expect(testStatement("null")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "null",
      }
    `);
  });
  it("should pull booleans", () => {
    expect(testStatement("true")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "true",
      }
    `);
    expect(testStatement("false")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "false",
      }
    `);
  });
  it("should pull strings", () => {
    expect(testStatement('"string"')).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "\\"string\\"",
      }
    `);
  });
  it("should pull numbers", () => {
    expect(testStatement("1")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "1",
      }
    `);
    expect(testStatement("1.1")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "1.1",
      }
    `);
    expect(testStatement("NaN")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 13,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "VariableDeclaration",
            "line": 25,
            "name": "NaN: number",
            "path": "NaN",
          },
        ],
        "type": "number",
      }
    `);
    expect(testStatement("Infinity")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 13,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "VariableDeclaration",
            "line": 26,
            "name": "Infinity: number",
            "path": "Infinity",
          },
        ],
        "type": "number",
      }
    `);
    expect(testStatement("-Infinity")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "number",
      }
    `);
  });
  it.skip("should pull symbols", () => {
    // TODO: Is this what we want?
    expect(testStatement('Symbol("foo")')).toMatchInlineSnapshot();
  });
  it("should pull regexp literal", () => {
    expect(testStatement("/foo/")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "column": 1,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 945,
            "name": "interface RegExp {
      ",
            "path": "RegExp",
          },
          Object {
            "column": 13,
            "fileName": "typescript/lib/lib.es5.d.ts",
            "kind": "VariableDeclaration",
            "line": 1025,
            "name": "RegExp: RegExpConstructor",
            "path": "RegExp",
          },
          Object {
            "column": 1,
            "fileName": "typescript/lib/lib.es2015.core.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 367,
            "name": "interface RegExp {
      ",
            "path": "RegExp",
          },
          Object {
            "column": 1,
            "fileName": "typescript/lib/lib.es2015.symbol.wellknown.d.ts",
            "kind": "InterfaceDeclaration",
            "line": 181,
            "name": "interface RegExp {
      ",
            "path": "RegExp",
          },
        ],
        "type": "RegExp",
      }
    `);
  });
  it("should pull template literal", () => {
    expect(testStatement("`bar`")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [],
        "type": "\\"bar\\"",
      }
    `);
  });
  it("should pull empty statement", () => {
    expect(testStatement("")).toMatchInlineSnapshot(`null`);
  });
});
