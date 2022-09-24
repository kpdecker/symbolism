import { mockProgram } from "@symbolism/test";
import { findIdentifiers } from "@symbolism/ts-utils";
import { printSchema } from "../print/typescript";
import { evaluateSchema } from "../schema";
import { SchemaContext } from "../context";

function testType(source: string, name = "Type") {
  const program = mockProgram({
    "test.ts": source,
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile("test.ts")!;
  const node = findIdentifiers(sourceFile, name)[0];
  return {
    type: checker.getTypeAtLocation(node),
    declaration: node,
    program,
    sourceFile,
    checker,

    context: new SchemaContext(node, checker, {}),
  };
}

describe("type schema converter", () => {
  describe("unary expressions", () => {
    describe("prefix unary expressions", () => {
      it("should calculate unary expressions on literals", () => {
        const { checker, sourceFile } = testType(`
        type Source = {
          directUnion: "1" | "2" | "3";
        };
        declare const source: Source;

        const toNumber = +source.directUnion;
        const invert = -source.directUnion;
        const increment = ++source.directUnion;
        const decrement = --source.directUnion;
        const tilde = ~source.directUnion;
        const not = !source.directUnion;
      `);

        expect(testNode("toNumber")).toMatchInlineSnapshot(`
          "1 | 2 | 3;
          "
        `);
        expect(testNode("invert")).toMatchInlineSnapshot(`
          "-1 | -2 | -3;
          "
        `);
        expect(testNode("increment")).toMatchInlineSnapshot(`
          "2 | 3 | 4;
          "
        `);
        expect(testNode("decrement")).toMatchInlineSnapshot(`
          "-1 | -2 | 0;
          "
        `);
        expect(testNode("tilde")).toMatchInlineSnapshot(`
          "-2 | -3 | -4;
          "
        `);
        expect(testNode("not")).toMatchInlineSnapshot(`
          "false;
          "
        `);

        function testNode(name: string) {
          const nodes = findIdentifiers(sourceFile, name);
          return printSchema(evaluateSchema(nodes[0], checker));
        }
      });

      it("should calculate unary expressions on primitive types", () => {
        const { checker, sourceFile } = testType(`
        declare const numba: number;
        declare const booly: boolean;
        declare const stringy: string;
        declare const arrayy: number[];
        declare const objecty: {};
        declare const uniony: "1" | "2" | "3";
        declare const intersectiony: "1" & "2" & "3";

        const numberToNumber = +numba;
        const booleanToNumber = +booly;
        const stringToNumber = +stringy;
        const arrayToNumber = +arrayy;
        const objectToNumber = +objecty;
        const unionToNumber = +uniony;
        const intersectionToNumber = +intersectiony;

        const invertNumber = -numba;
        const invertBoolean = -booly;
        const invertString = -stringy;
        const invertArray = -arrayy;
        const invertObject = -objecty;
        const invertUnion = -uniony;
        const invertIntersection = -intersectiony;

        const incrementNumber = ++numba;
        const incrementBoolean = ++booly;
        const incrementString = ++stringy;
        const incrementArray = ++arrayy;
        const incrementObject = ++objecty;
        const incrementUnion = ++uniony;
        const incrementIntersection = ++intersectiony;

        const decrementNumber = --numba;
        const decrementBoolean = --booly;
        const decrementString = --stringy;
        const decrementArray = --arrayy;
        const decrementObject = --objecty;
        const decrementUnion = --uniony;
        const decrementIntersection = --intersectiony;

        const tildeNumber = ~numba;
        const tildeBoolean = ~booly;
        const tildeString = ~stringy;
        const tildeArray = ~arrayy;
        const tildeObject = ~objecty;
        const tildeUnion = ~uniony;
        const tildeIntersection = ~intersectiony;

        const notNumber = !numba;
        const notBoolean = !booly;
        const notString = !stringy;
        const notArray = !arrayy;
        const notObject = !objecty;
        const notUnion = !uniony;
        const notIntersection = !intersectiony;
      `);

        expect(testNode("numberToNumber")).toMatchInlineSnapshot(`
          "number;
          "
        `);
        expect(testNode("booleanToNumber")).toMatchInlineSnapshot(`
          "0 | 1;
          "
        `);
        expect(testNode("stringToNumber")).toMatchInlineSnapshot(`
          "number;
          "
        `);
        expect(testNode("arrayToNumber")).toMatchInlineSnapshot(`
          "NaN;
          "
        `);
        expect(testNode("objectToNumber")).toMatchInlineSnapshot(`
          "NaN;
          "
        `);
        expect(testNode("unionToNumber")).toMatchInlineSnapshot(`
          "1 | 2 | 3;
          "
        `);
        expect(testNode("intersectionToNumber")).toMatchInlineSnapshot(`
          "false;
          "
        `);

        expect(testNode("invertNumber")).toMatchInlineSnapshot(`
          "number;
          "
        `);
        expect(testNode("invertBoolean")).toMatchInlineSnapshot(`
          "-1 | 0;
          "
        `);
        expect(testNode("invertString")).toMatchInlineSnapshot(`
          "number;
          "
        `);
        expect(testNode("invertArray")).toMatchInlineSnapshot(`
          "NaN;
          "
        `);
        expect(testNode("invertObject")).toMatchInlineSnapshot(`
          "NaN;
          "
        `);
        expect(testNode("invertUnion")).toMatchInlineSnapshot(`
          "-1 | -2 | -3;
          "
        `);
        expect(testNode("invertIntersection")).toMatchInlineSnapshot(`
          "false;
          "
        `);

        expect(testNode("incrementNumber")).toMatchInlineSnapshot(`
          "number;
          "
        `);
        expect(testNode("incrementBoolean")).toMatchInlineSnapshot(`
          "NaN;
          "
        `);
        expect(testNode("incrementString")).toMatchInlineSnapshot(`
          "number;
          "
        `);
        expect(testNode("incrementArray")).toMatchInlineSnapshot(`
          "NaN;
          "
        `);
        expect(testNode("incrementObject")).toMatchInlineSnapshot(`
          "NaN;
          "
        `);
        expect(testNode("incrementUnion")).toMatchInlineSnapshot(`
          "2 | 3 | 4;
          "
        `);
        expect(testNode("incrementIntersection")).toMatchInlineSnapshot(`
          "false;
          "
        `);

        expect(testNode("decrementNumber")).toMatchInlineSnapshot(`
          "number;
          "
        `);
        expect(testNode("decrementBoolean")).toMatchInlineSnapshot(`
          "NaN;
          "
        `);
        expect(testNode("decrementString")).toMatchInlineSnapshot(`
          "number;
          "
        `);
        expect(testNode("decrementArray")).toMatchInlineSnapshot(`
          "NaN;
          "
        `);
        expect(testNode("decrementObject")).toMatchInlineSnapshot(`
          "NaN;
          "
        `);
        expect(testNode("decrementUnion")).toMatchInlineSnapshot(`
          "-1 | -2 | 0;
          "
        `);
        expect(testNode("decrementIntersection")).toMatchInlineSnapshot(`
          "false;
          "
        `);

        expect(testNode("tildeNumber")).toMatchInlineSnapshot(`
          "number;
          "
        `);
        expect(testNode("tildeBoolean")).toMatchInlineSnapshot(`
          "-1 | -2;
          "
        `);
        expect(testNode("tildeString")).toMatchInlineSnapshot(`
          "number;
          "
        `);
        expect(testNode("tildeArray")).toMatchInlineSnapshot(`
          "NaN;
          "
        `);
        expect(testNode("tildeObject")).toMatchInlineSnapshot(`
          "NaN;
          "
        `);
        expect(testNode("tildeUnion")).toMatchInlineSnapshot(`
          "-2 | -3 | -4;
          "
        `);
        expect(testNode("tildeIntersection")).toMatchInlineSnapshot(`
          "false;
          "
        `);

        expect(testNode("notNumber")).toMatchInlineSnapshot(`
          "false | true;
          "
        `);
        expect(testNode("notBoolean")).toMatchInlineSnapshot(`
          "false | true;
          "
        `);
        expect(testNode("notString")).toMatchInlineSnapshot(`
          "false | true;
          "
        `);
        expect(testNode("notArray")).toMatchInlineSnapshot(`
          "false | true;
          "
        `);
        expect(testNode("notObject")).toMatchInlineSnapshot(`
          "false | true;
          "
        `);
        expect(testNode("notUnion")).toMatchInlineSnapshot(`
          "false;
          "
        `);
        expect(testNode("notIntersection")).toMatchInlineSnapshot(`
          "false;
          "
        `);

        function testNode(name: string) {
          const nodes = findIdentifiers(sourceFile, name);
          return printSchema(evaluateSchema(nodes[0], checker));
        }
      });
    });
  });
  describe("postfix unary expressions", () => {
    it("should calculate unary expressions on primitive types", () => {
      const { checker, sourceFile } = testType(`
        declare const numba: number;
        declare const booly: boolean;
        declare const stringy: string;
        declare const arrayy: number[];
        declare const objecty: {};
        declare const uniony: "1" | "2" | "3";
        declare const intersectiony: "1" & "2" & "3";

        const incrementNumber = numba++;
        const incrementBoolean = booly++;
        const incrementString = stringy++;
        const incrementArray = arrayy++;
        const incrementObject = objecty++;
        const incrementUnion = uniony++;
        const incrementIntersection = intersectiony++;

        const decrementNumber = numba--;
        const decrementBoolean = booly--;
        const decrementString = stringy--;
        const decrementArray = arrayy--;
        const decrementObject = objecty--;
        const decrementUnion = uniony--;
        const decrementIntersection = intersectiony--;
      `);

      expect(testNode("incrementNumber")).toMatchInlineSnapshot(`
          "number;
          "
        `);
      expect(testNode("incrementBoolean")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("incrementString")).toMatchInlineSnapshot(`
        "string;
        "
      `);
      expect(testNode("incrementArray")).toMatchInlineSnapshot(`
        "number[];
        "
      `);
      expect(testNode("incrementObject")).toMatchInlineSnapshot(`
        "{};
        "
      `);
      expect(testNode("incrementUnion")).toMatchInlineSnapshot(`
        "\\"1\\" | \\"2\\" | \\"3\\";
        "
      `);
      expect(testNode("incrementIntersection")).toMatchInlineSnapshot(`
        "never;
        "
      `);

      expect(testNode("decrementNumber")).toMatchInlineSnapshot(`
          "number;
          "
        `);
      expect(testNode("decrementBoolean")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("decrementString")).toMatchInlineSnapshot(`
        "string;
        "
      `);
      expect(testNode("decrementArray")).toMatchInlineSnapshot(`
        "number[];
        "
      `);
      expect(testNode("decrementObject")).toMatchInlineSnapshot(`
        "{};
        "
      `);
      expect(testNode("decrementUnion")).toMatchInlineSnapshot(`
        "\\"1\\" | \\"2\\" | \\"3\\";
        "
      `);
      expect(testNode("decrementIntersection")).toMatchInlineSnapshot(`
        "never;
        "
      `);

      function testNode(name: string) {
        const nodes = findIdentifiers(sourceFile, name);
        return printSchema(evaluateSchema(nodes[0], checker));
      }
    });
  });
});
