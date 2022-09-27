import { testStatement } from "../../test/utils";

describe("infer intrinsic types", () => {
  it("should pull undefined", () => {
    expect(testStatement("undefined")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "keyword",
            "location": "intrinsic",
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
        "symbol": undefined,
        "type": "undefined",
      }
    `);
    expect(testStatement("void 0")).toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "undefined",
      }
    `);
  });
  it("should pull null", () => {
    expect(testStatement("null")).toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "null",
      }
    `);
  });
  it("should pull booleans", () => {
    expect(testStatement("true")).toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "true",
      }
    `);
    expect(testStatement("false")).toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "false",
      }
    `);
  });
  it("should pull strings", () => {
    expect(testStatement('"string"')).toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "\\"string\\"",
      }
    `);
  });
  it("should pull numbers", () => {
    expect(testStatement("1")).toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "1",
      }
    `);
    expect(testStatement("1.1")).toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
        "type": "1.1",
      }
    `);
    expect(testStatement("NaN")).toMatchInlineSnapshot(`
      Object {
        "symbol": Array [
          Object {
            "kind": "VariableDeclaration",
            "location": "node_modules/typescript/lib/lib.es5.d.ts:25:13",
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
            "kind": "VariableDeclaration",
            "location": "node_modules/typescript/lib/lib.es5.d.ts:26:13",
            "name": "Infinity: number",
            "path": "Infinity",
          },
        ],
        "type": "number",
      }
    `);
    expect(testStatement("-Infinity")).toMatchInlineSnapshot(`
      Object {
        "symbol": undefined,
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
            "kind": "InterfaceDeclaration",
            "location": "node_modules/typescript/lib/lib.es5.d.ts:945:1",
            "name": "interface RegExp {
      ",
            "path": "RegExp",
          },
          Object {
            "kind": "VariableDeclaration",
            "location": "node_modules/typescript/lib/lib.es5.d.ts:1025:13",
            "name": "RegExp: RegExpConstructor",
            "path": "RegExp",
          },
          Object {
            "kind": "InterfaceDeclaration",
            "location": "node_modules/typescript/lib/lib.es2015.core.d.ts:367:1",
            "name": "interface RegExp {
      ",
            "path": "RegExp",
          },
          Object {
            "kind": "InterfaceDeclaration",
            "location": "node_modules/typescript/lib/lib.es2015.symbol.wellknown.d.ts:181:1",
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
        "symbol": undefined,
        "type": "\\"bar\\"",
      }
    `);
  });
  it("should pull empty statement", () => {
    expect(testStatement("")).toMatchInlineSnapshot(`null`);
  });
});
