import { loadCliConfig } from "@symbolism/utils";
import { Command } from "commander";
import { initDumpSchema } from "../dump-schema";

describe("dumpSchema", () => {
  beforeAll(() => {
    loadCliConfig("./.symbolism.json");
  });
  it("should log ts schema", () => {
    const program = new Command();
    initDumpSchema(program);

    const spy = jest.spyOn(console, "log");
    program.parse([
      "foo",
      "foo",
      "dumpSchema",
      require.resolve("../../../../symbolism-test/src/dump-symbol.ts"),
      "Schema",
    ]);

    expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(`
      "{
        bar: \\"bar\\" | \\"bat\\";
        merged: number;
      };
      "
    `);
  });
  it("should log json schema", () => {
    const program = new Command();
    initDumpSchema(program);

    const spy = jest.spyOn(console, "log");
    program.parse([
      "foo",
      "foo",
      "dumpSchema",
      "--json",
      "foo",
      require.resolve("../../../../symbolism-test/src/dump-symbol.ts"),
      "Schema",
    ]);

    expect(spy.mock.calls[0][0]).toMatchInlineSnapshot(`
      "{
        \\"$schema\\": \\"https://json-schema.org/draft/2020-12/schema\\",
        \\"$id\\": \\"foo\\",
        \\"type\\": \\"object\\",
        \\"properties\\": {
          \\"bar\\": {
            \\"type\\": \\"string\\",
            \\"enum\\": [
              \\"bar\\",
              \\"bat\\"
            ]
          },
          \\"merged\\": {
            \\"type\\": \\"number\\"
          }
        }
      }"
    `);
  });
});
