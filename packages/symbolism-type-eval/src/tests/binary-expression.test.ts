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
  describe("binary expressions", () => {
    it("should narrow string binary operations", () => {
      const { type, declaration, checker, sourceFile } = testType(`
        type Source = {
          directUnion: 1 | 2 | 3;
        };
        declare const source: Source;

        const add = source.directUnion + "foo";
        const addNumber = source.directUnion + 1;
        const subtract = source.directUnion - "foo";
        const subtractNumber = source.directUnion - 1;
        const multiply = source.directUnion * 2;
        const divide = source.directUnion / 2;
        const modulo = source.directUnion % 2;
        const exponent = source.directUnion ** 2;
        const equals = source.directUnion === "foo";
        const notEquals = source.directUnion !== "foo";
        const lessThan = source.directUnion < "foo";
        const lessThanOrEqual = source.directUnion <= "foo";
        const greaterThan = source.directUnion > "foo";
        const greaterThanOrEqual = source.directUnion >= "foo";
        const inOperator = "foo" in source.directUnion;
        const instanceOf = source.directUnion instanceof String;

        const combined = addNumber + subtractNumber + add + subtract
            + (equals && notEquals)
            + (lessThan && lessThanOrEqual && greaterThan && greaterThanOrEqual)
            + (inOperator && instanceOf);
        // const combined = (lessThan && lessThanOrEqual && greaterThan && greaterThanOrEqual)
        //     + (inOperator && instanceOf);
        const combinedNumber = addNumber + subtractNumber + multiply + divide + modulo + exponent;
      `);

      expect(testNode("add")).toMatchInlineSnapshot(`
        "\\"1foo\\" | \\"2foo\\" | \\"3foo\\";
        "
      `);
      expect(testNode("addNumber")).toMatchInlineSnapshot(`
        "2 | 3 | 4;
        "
      `);
      expect(testNode("subtract")).toMatchInlineSnapshot(`
        "NaN | NaN | NaN;
        "
      `);
      expect(testNode("subtractNumber")).toMatchInlineSnapshot(`
        "0 | 1 | 2;
        "
      `);

      expect(testNode("multiply")).toMatchInlineSnapshot(`
        "2 | 4 | 6;
        "
      `);
      expect(testNode("divide")).toMatchInlineSnapshot(`
        "0.5 | 1 | 1.5;
        "
      `);
      expect(testNode("modulo")).toMatchInlineSnapshot(`
        "0 | 1;
        "
      `);
      expect(testNode("exponent")).toMatchInlineSnapshot(`
        "1 | 4 | 9;
        "
      `);

      expect(testNode("combined")).toMatchInlineSnapshot(`
        " \\"21fooNaNfalsefalsefalse\\"
          | \\"21fooNaNfalsefalsetrue\\"
          | \\"22fooNaNfalsefalsefalse\\"
          | \\"22fooNaNfalsefalsetrue\\"
          | \\"23fooNaNfalsefalsefalse\\"
          | \\"23fooNaNfalsefalsetrue\\"
          | \\"31fooNaNfalsefalsefalse\\"
          | \\"31fooNaNfalsefalsetrue\\"
          | \\"32fooNaNfalsefalsefalse\\"
          | \\"32fooNaNfalsefalsetrue\\"
          | \\"33fooNaNfalsefalsefalse\\"
          | \\"33fooNaNfalsefalsetrue\\"
          | \\"41fooNaNfalsefalsefalse\\"
          | \\"41fooNaNfalsefalsetrue\\"
          | \\"42fooNaNfalsefalsefalse\\"
          | \\"42fooNaNfalsefalsetrue\\"
          | \\"43fooNaNfalsefalsefalse\\"
          | \\"43fooNaNfalsefalsetrue\\"
          | \\"51fooNaNfalsefalsefalse\\"
          | \\"51fooNaNfalsefalsetrue\\"
          | \\"52fooNaNfalsefalsefalse\\"
          | \\"52fooNaNfalsefalsetrue\\"
          | \\"53fooNaNfalsefalsefalse\\"
          | \\"53fooNaNfalsefalsetrue\\"
          | \\"61fooNaNfalsefalsefalse\\"
          | \\"61fooNaNfalsefalsetrue\\"
          | \\"62fooNaNfalsefalsefalse\\"
          | \\"62fooNaNfalsefalsetrue\\"
          | \\"63fooNaNfalsefalsefalse\\"
          | \\"63fooNaNfalsefalsetrue\\";
        "
      `);

      expect(testNode("combinedNumber")).toMatchInlineSnapshot(`
        " 10
          | 10.5
          | 11
          | 11.5
          | 12
          | 12.5
          | 13
          | 13.5
          | 14
          | 14.5
          | 15
          | 15.5
          | 16
          | 16.5
          | 17
          | 17.5
          | 18
          | 18.5
          | 19
          | 19.5
          | 20
          | 20.5
          | 21
          | 21.5
          | 22
          | 22.5
          | 23
          | 23.5
          | 5.5
          | 6
          | 6.5
          | 7
          | 7.5
          | 8
          | 8.5
          | 9
          | 9.5;
        "
      `);

      function testNode(name: string) {
        const nodes = findIdentifiers(sourceFile, name);
        const type = checker.getTypeAtLocation(nodes[0]);
        return printSchema(evaluateSchema(nodes[0], checker));
      }
    });

    it("should narrow boolean comparisons", () => {
      const { checker, sourceFile } = testType(`
        type Source = {
          directUnion: 1 | 2 | 3;
        };
        declare const source: Source;

        const equalsString = source.directUnion === "foo";
        const equalsNumber = source.directUnion === 3;
        const equalsNumberFalse = source.directUnion === 4;

        const notEquals = source.directUnion !== "foo";
        const notEqualsNumber = source.directUnion !== 3;
        const notEqualsNumberTrue = source.directUnion !== 4;

        const lessThan = source.directUnion < "foo";
        const lessThanNumber = source.directUnion < 3;
        const lessThanNumberTrue = source.directUnion < 4;
        const lessThanNumberFalse = source.directUnion < 0;

        const lessThanOrEqual = source.directUnion <= "foo";
        const lessThanOrEqualNumber = source.directUnion <= 2;
        const lessThanOrEqualNumberTrue = source.directUnion <= 3;
        const lessThanOrEqualNumberFalse = source.directUnion <= 0;

        const greaterThanString = source.directUnion > "foo";
        const greaterThanNumber = source.directUnion > 2;
        const greaterThanNumberTrue = source.directUnion > 0;
        const greaterThanNumberFalse = source.directUnion > 3;
        const greaterThanOrEqualString = source.directUnion >= "foo";
        const greaterThanOrEqualNumber = source.directUnion >= 2;
        const greaterThanOrEqualNumberTrue = source.directUnion >= 1;
        const greaterThanOrEqualNumberFalse = source.directUnion >= 4;

        const inOperator = "foo" in source.directUnion;
        const instanceOf = source.directUnion instanceof String;
      `);

      expect(testNode("equalsString")).toMatchInlineSnapshot(`
        "false;
        "
      `);
      expect(testNode("equalsNumber")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("equalsNumberFalse")).toMatchInlineSnapshot(`
        "false;
        "
      `);

      expect(testNode("notEquals")).toMatchInlineSnapshot(`
        "true;
        "
      `);
      expect(testNode("notEqualsNumber")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("notEqualsNumberTrue")).toMatchInlineSnapshot(`
        "true;
        "
      `);

      expect(testNode("lessThan")).toMatchInlineSnapshot(`
        "false;
        "
      `);
      expect(testNode("lessThanNumber")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("lessThanNumberTrue")).toMatchInlineSnapshot(`
        "true;
        "
      `);
      expect(testNode("lessThanNumberFalse")).toMatchInlineSnapshot(`
        "false;
        "
      `);
      expect(testNode("lessThanOrEqual")).toMatchInlineSnapshot(`
        "false;
        "
      `);
      expect(testNode("lessThanOrEqualNumber")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("lessThanOrEqualNumberTrue")).toMatchInlineSnapshot(`
        "true;
        "
      `);
      expect(testNode("lessThanOrEqualNumberFalse")).toMatchInlineSnapshot(`
        "false;
        "
      `);
      expect(testNode("greaterThanString")).toMatchInlineSnapshot(`
        "false;
        "
      `);
      expect(testNode("greaterThanNumber")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("greaterThanNumberTrue")).toMatchInlineSnapshot(`
        "true;
        "
      `);
      expect(testNode("greaterThanNumberFalse")).toMatchInlineSnapshot(`
        "false;
        "
      `);
      expect(testNode("greaterThanOrEqualString")).toMatchInlineSnapshot(`
        "false;
        "
      `);
      expect(testNode("greaterThanOrEqualNumber")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("greaterThanOrEqualNumberTrue")).toMatchInlineSnapshot(`
        "true;
        "
      `);
      expect(testNode("greaterThanOrEqualNumberFalse")).toMatchInlineSnapshot(`
        "false;
        "
      `);

      expect(testNode("inOperator")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("instanceOf")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);

      function testNode(name: string) {
        const nodes = findIdentifiers(sourceFile, name);
        return printSchema(evaluateSchema(nodes[0], checker));
      }
    });
    it("should narrow boolean operators", () => {
      const { checker, sourceFile } = testType(`
        type Source = {
          directUnion: 1 | 2 | 3;
        };
        declare const source: Source;

        const andAndTrue = source.directUnion <= 3 && source.directUnion > 0;
        const andAndAbstract = source.directUnion < 3 && source.directUnion > 0;
        const andAndLeftFalse = source.directUnion <= 0 && source.directUnion > 1;
        const andAndRightFalse = source.directUnion > 1 && source.directUnion <= 0;

        const andAndTyped = source.directUnion && "yay";

        const orOrTrue = source.directUnion <= 3 || source.directUnion > 0;
        const orOrFalse = source.directUnion > 3 || source.directUnion < 0;
        const orOrAbstract = source.directUnion < 3 || source.directUnion > 1;
        const orOrLeftFalse = source.directUnion <= 0 || source.directUnion > 1;
        const orOrRightFalse = source.directUnion > 1 || source.directUnion <= 0;

        const questionQuestionLeft = source.directUnion ?? "foo"
        const questionQuestionRight = undefined ?? 1
        const questionQuestionNull = null ?? "foo"
        const questionQuestionVoid = void 0 ?? "foo"
      `);

      expect(testNode("andAndTrue")).toMatchInlineSnapshot(`
        "true;
        "
      `);
      expect(testNode("andAndAbstract")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("andAndLeftFalse")).toMatchInlineSnapshot(`
        "false;
        "
      `);
      expect(testNode("andAndRightFalse")).toMatchInlineSnapshot(`
        "false;
        "
      `);

      // "" is artifact for not using strict null checks
      expect(testNode("andAndTyped")).toMatchInlineSnapshot(`
        "\\"yay\\";
        "
      `);

      expect(testNode("orOrTrue")).toMatchInlineSnapshot(`
        "true;
        "
      `);
      expect(testNode("orOrFalse")).toMatchInlineSnapshot(`
        "false;
        "
      `);
      expect(testNode("orOrAbstract")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("orOrLeftFalse")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);
      expect(testNode("orOrRightFalse")).toMatchInlineSnapshot(`
        "false | true;
        "
      `);

      expect(testNode("questionQuestionLeft")).toMatchInlineSnapshot(`
        "1 | 2 | 3;
        "
      `);
      expect(testNode("questionQuestionRight")).toMatchInlineSnapshot(`
        "1;
        "
      `);
      expect(testNode("questionQuestionNull")).toMatchInlineSnapshot(`
        "\\"foo\\";
        "
      `);
      expect(testNode("questionQuestionVoid")).toMatchInlineSnapshot(`
        "\\"foo\\";
        "
      `);

      function testNode(name: string) {
        const nodes = findIdentifiers(sourceFile, name);
        return printSchema(evaluateSchema(nodes[0], checker)!);
      }
    });
    it("should narrow comma operators", () => {
      const { checker, sourceFile } = testType(`
        type Source = {
          directUnion: 1 | 2 | 3;
        };
        declare const source: Source;

        const comma = (source.directUnion, false, source.directUnion > 0);
      `);

      expect(testNode("comma")).toMatchInlineSnapshot(`
        "true;
        "
      `);

      function testNode(name: string) {
        const nodes = findIdentifiers(sourceFile, name);
        return printSchema(evaluateSchema(nodes[0], checker));
      }
    });
  });
});
