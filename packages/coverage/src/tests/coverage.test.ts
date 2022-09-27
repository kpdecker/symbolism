import { readFileSync } from "fs";
import { parseExecutedCoverage } from "../coverage";

jest.mock("fs");

jest.mocked(readFileSync).mockImplementation(() =>
  JSON.stringify({
    "packages/symbolism-paths/src/index.ts": {
      path: "packages/symbolism-paths/src/index.ts",
      all: false,
      statementMap: {
        "0": {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 28 },
        },
        "1": {
          start: { line: 2, column: 0 },
          end: { line: 2, column: 8 },
        },
        "2": {
          start: { line: 3, column: 0 },
          end: { line: 3, column: 14 },
        },
        "3": {
          start: { line: 4, column: 0 },
          end: { line: 4, column: 17 },
        },
        "4": {
          start: { line: 5, column: 0 },
          end: { line: 5, column: 10 },
        },
        "5": {
          start: { line: 6, column: 0 },
          end: { line: 6, column: 14 },
        },
        "6": {
          start: { line: 7, column: 0 },
          end: { line: 7, column: 23 },
        },
        "7": {
          start: { line: 8, column: 0 },
          end: { line: 8, column: 11 },
        },
        "8": {
          start: { line: 9, column: 0 },
          end: { line: 9, column: 20 },
        },
        "9": {
          start: { line: 10, column: 0 },
          end: { line: 10, column: 41 },
        },
        "10": {
          start: { line: 11, column: 0 },
          end: { line: 11, column: 47 },
        },
        "11": {
          start: { line: 12, column: 0 },
          end: { line: 12, column: 40 },
        },
        "12": {
          start: { line: 13, column: 0 },
          end: { line: 13, column: 40 },
        },
        "13": {
          start: { line: 14, column: 0 },
          end: { line: 14, column: 42 },
        },
        "14": {
          start: { line: 15, column: 0 },
          end: { line: 15, column: 45 },
        },
        "15": {
          start: { line: 16, column: 0 },
          end: { line: 16, column: 72 },
        },
        "16": {
          start: { line: 17, column: 0 },
          end: { line: 17, column: 47 },
        },
        "17": {
          start: { line: 18, column: 0 },
          end: { line: 18, column: 0 },
        },
        "18": {
          start: { line: 19, column: 0 },
          end: { line: 19, column: 72 },
        },
        "19": {
          start: { line: 20, column: 0 },
          end: { line: 20, column: 16 },
        },
        "20": {
          start: { line: 21, column: 0 },
          end: { line: 21, column: 9 },
        },
        "21": {
          start: { line: 22, column: 0 },
          end: { line: 22, column: 79 },
        },
        "22": {
          start: { line: 23, column: 0 },
          end: { line: 23, column: 79 },
        },
        "23": {
          start: { line: 24, column: 0 },
          end: { line: 24, column: 4 },
        },
        "24": {
          start: { line: 25, column: 0 },
          end: { line: 25, column: 0 },
        },
        "25": {
          start: { line: 26, column: 0 },
          end: { line: 26, column: 65 },
        },
        "26": {
          start: { line: 27, column: 0 },
          end: { line: 27, column: 32 },
        },
        "27": {
          start: { line: 28, column: 0 },
          end: { line: 28, column: 28 },
        },
        "28": {
          start: { line: 29, column: 0 },
          end: { line: 29, column: 53 },
        },
        "29": {
          start: { line: 30, column: 0 },
          end: { line: 30, column: 14 },
        },
        "30": {
          start: { line: 31, column: 0 },
          end: { line: 31, column: 56 },
        },
        "31": {
          start: { line: 32, column: 0 },
          end: { line: 32, column: 13 },
        },
        "32": {
          start: { line: 33, column: 0 },
          end: { line: 33, column: 27 },
        },
        "33": {
          start: { line: 34, column: 0 },
          end: { line: 34, column: 8 },
        },
        "34": {
          start: { line: 35, column: 0 },
          end: { line: 35, column: 52 },
        },
        "35": {
          start: { line: 36, column: 0 },
          end: { line: 36, column: 14 },
        },
        "36": {
          start: { line: 37, column: 0 },
          end: { line: 37, column: 56 },
        },
        "37": {
          start: { line: 38, column: 0 },
          end: { line: 38, column: 13 },
        },
        "38": {
          start: { line: 39, column: 0 },
          end: { line: 39, column: 41 },
        },
        "39": {
          start: { line: 40, column: 0 },
          end: { line: 40, column: 8 },
        },
        "40": {
          start: { line: 41, column: 0 },
          end: { line: 41, column: 52 },
        },
        "41": {
          start: { line: 42, column: 0 },
          end: { line: 42, column: 60 },
        },
        "42": {
          start: { line: 43, column: 0 },
          end: { line: 43, column: 41 },
        },
        "43": {
          start: { line: 44, column: 0 },
          end: { line: 44, column: 60 },
        },
      },
      s: {
        "0": 1,
        "1": 1,
        "2": 1,
        "3": 1,
        "4": 1,
        "5": 1,
        "6": 1,
        "7": 1,
        "8": 1,
        "9": 1,
        "10": 1,
        "11": 1,
        "12": 1,
        "13": 1,
        "14": 1,
        "15": 1,
        "16": 1,
        "17": 1,
        "18": 1,
        "19": 20,
        "20": 20,
        "21": 20,
        "22": 20,
        "23": 20,
        "24": 20,
        "25": 20,
        "26": 71,
        "27": 19,
        "28": 71,
        "29": 23,
        "30": 23,
        "31": 23,
        "32": 23,
        "33": 23,
        "34": 52,
        "35": 0,
        "36": 0,
        "37": 0,
        "38": 0,
        "39": 0,
        "40": 29,
        "41": 14,
        "42": 29,
      },
      branchMap: {
        "0": {
          type: "branch",
          line: 19,
          loc: {
            start: { line: 19, column: 42 },
            end: { line: 54, column: 2 },
          },
          locations: [
            {
              start: { line: 19, column: 42 },
              end: { line: 54, column: 2 },
            },
          ],
        },
        "1": {
          type: "branch",
          line: 22,
          loc: {
            start: { line: 22, column: 4 },
            end: { line: 23, column: 79 },
          },
          locations: [
            {
              start: { line: 22, column: 4 },
              end: { line: 23, column: 79 },
            },
          ],
        },
        "2": {
          type: "branch",
          line: 23,
          loc: {
            start: { line: 23, column: 41 },
            end: { line: 23, column: 79 },
          },
          locations: [
            {
              start: { line: 23, column: 41 },
              end: { line: 23, column: 79 },
            },
          ],
        },
        "3": {
          type: "branch",
          line: 26,
          loc: {
            start: { line: 26, column: 2 },
            end: { line: 51, column: 3 },
          },
          locations: [
            {
              start: { line: 26, column: 2 },
              end: { line: 51, column: 3 },
            },
          ],
        },
        "4": {
          type: "branch",
          line: 27,
          loc: {
            start: { line: 27, column: 31 },
            end: { line: 29, column: 11 },
          },
          locations: [
            {
              start: { line: 27, column: 31 },
              end: { line: 29, column: 11 },
            },
          ],
        },
        "5": {
          type: "branch",
          line: 29,
          loc: {
            start: { line: 29, column: 5 },
            end: { line: 50, column: 5 },
          },
          locations: [
            {
              start: { line: 29, column: 5 },
              end: { line: 50, column: 5 },
            },
          ],
        },
        "6": {
          type: "branch",
          line: 29,
          loc: {
            start: { line: 29, column: 52 },
            end: { line: 35, column: 11 },
          },
          locations: [
            {
              start: { line: 29, column: 52 },
              end: { line: 35, column: 11 },
            },
          ],
        },
        "7": {
          type: "branch",
          line: 35,
          loc: {
            start: { line: 35, column: 5 },
            end: { line: 50, column: 5 },
          },
          locations: [
            {
              start: { line: 35, column: 5 },
              end: { line: 50, column: 5 },
            },
          ],
        },
        "8": {
          type: "branch",
          line: 35,
          loc: {
            start: { line: 35, column: 51 },
            end: { line: 41, column: 11 },
          },
          locations: [
            {
              start: { line: 35, column: 51 },
              end: { line: 41, column: 11 },
            },
          ],
        },
        "9": {
          type: "branch",
          line: 41,
          loc: {
            start: { line: 41, column: 51 },
            end: { line: 43, column: 11 },
          },
          locations: [
            {
              start: { line: 41, column: 51 },
              end: { line: 43, column: 11 },
            },
          ],
        },
      },
      b: {
        "0": [20],
        "1": [20],
        "2": [0],
        "3": [71],
        "4": [19],
        "5": [52],
        "6": [23],
        "7": [29],
        "8": [0],
        "9": [14],
      },
      fnMap: {
        "0": {
          name: "handlePropertyAccess",
          decl: {
            start: { line: 19, column: 42 },
            end: { line: 54, column: 2 },
          },
          loc: {
            start: { line: 19, column: 42 },
            end: { line: 54, column: 2 },
          },
          line: 19,
        },
        "1": {
          name: "resolvePropertyAccessDownward",
          decl: {
            start: { line: 26, column: 2 },
            end: { line: 51, column: 3 },
          },
          loc: {
            start: { line: 26, column: 2 },
            end: { line: 51, column: 3 },
          },
          line: 26,
        },
      },
      f: {
        "0": 20,
        "1": 71,
      },
    },
  })
);

describe("coverage report loader", () => {
  it("should load coverage report", async () => {
    expect(parseExecutedCoverage("coverage.json")).toMatchInlineSnapshot(`
      Object {
        "packages/symbolism-paths/src/index.ts": Object {
          "branches": Array [
            Object {
              "count": 14,
              "end": Object {
                "column": 11,
                "line": 43,
              },
              "start": Object {
                "column": 51,
                "line": 41,
              },
            },
            Object {
              "count": 0,
              "end": Object {
                "column": 11,
                "line": 41,
              },
              "start": Object {
                "column": 51,
                "line": 35,
              },
            },
            Object {
              "count": 29,
              "end": Object {
                "column": 5,
                "line": 50,
              },
              "start": Object {
                "column": 5,
                "line": 35,
              },
            },
            Object {
              "count": 23,
              "end": Object {
                "column": 11,
                "line": 35,
              },
              "start": Object {
                "column": 52,
                "line": 29,
              },
            },
            Object {
              "count": 52,
              "end": Object {
                "column": 5,
                "line": 50,
              },
              "start": Object {
                "column": 5,
                "line": 29,
              },
            },
            Object {
              "count": 19,
              "end": Object {
                "column": 11,
                "line": 29,
              },
              "start": Object {
                "column": 31,
                "line": 27,
              },
            },
            Object {
              "count": 71,
              "end": Object {
                "column": 3,
                "line": 51,
              },
              "start": Object {
                "column": 2,
                "line": 26,
              },
            },
            Object {
              "count": 0,
              "end": Object {
                "column": 79,
                "line": 23,
              },
              "start": Object {
                "column": 41,
                "line": 23,
              },
            },
            Object {
              "count": 20,
              "end": Object {
                "column": 79,
                "line": 23,
              },
              "start": Object {
                "column": 4,
                "line": 22,
              },
            },
            Object {
              "count": 20,
              "end": Object {
                "column": 2,
                "line": 54,
              },
              "start": Object {
                "column": 42,
                "line": 19,
              },
            },
          ],
          "statements": Array [
            Object {
              "count": 0,
              "end": Object {
                "column": 60,
                "line": 44,
              },
              "start": Object {
                "column": 0,
                "line": 44,
              },
            },
            Object {
              "count": 29,
              "end": Object {
                "column": 41,
                "line": 43,
              },
              "start": Object {
                "column": 0,
                "line": 43,
              },
            },
            Object {
              "count": 14,
              "end": Object {
                "column": 60,
                "line": 42,
              },
              "start": Object {
                "column": 0,
                "line": 42,
              },
            },
            Object {
              "count": 29,
              "end": Object {
                "column": 52,
                "line": 41,
              },
              "start": Object {
                "column": 0,
                "line": 41,
              },
            },
            Object {
              "count": 0,
              "end": Object {
                "column": 8,
                "line": 40,
              },
              "start": Object {
                "column": 0,
                "line": 40,
              },
            },
            Object {
              "count": 0,
              "end": Object {
                "column": 41,
                "line": 39,
              },
              "start": Object {
                "column": 0,
                "line": 39,
              },
            },
            Object {
              "count": 0,
              "end": Object {
                "column": 13,
                "line": 38,
              },
              "start": Object {
                "column": 0,
                "line": 38,
              },
            },
            Object {
              "count": 0,
              "end": Object {
                "column": 56,
                "line": 37,
              },
              "start": Object {
                "column": 0,
                "line": 37,
              },
            },
            Object {
              "count": 0,
              "end": Object {
                "column": 14,
                "line": 36,
              },
              "start": Object {
                "column": 0,
                "line": 36,
              },
            },
            Object {
              "count": 52,
              "end": Object {
                "column": 52,
                "line": 35,
              },
              "start": Object {
                "column": 0,
                "line": 35,
              },
            },
            Object {
              "count": 23,
              "end": Object {
                "column": 8,
                "line": 34,
              },
              "start": Object {
                "column": 0,
                "line": 34,
              },
            },
            Object {
              "count": 23,
              "end": Object {
                "column": 27,
                "line": 33,
              },
              "start": Object {
                "column": 0,
                "line": 33,
              },
            },
            Object {
              "count": 23,
              "end": Object {
                "column": 13,
                "line": 32,
              },
              "start": Object {
                "column": 0,
                "line": 32,
              },
            },
            Object {
              "count": 23,
              "end": Object {
                "column": 56,
                "line": 31,
              },
              "start": Object {
                "column": 0,
                "line": 31,
              },
            },
            Object {
              "count": 23,
              "end": Object {
                "column": 14,
                "line": 30,
              },
              "start": Object {
                "column": 0,
                "line": 30,
              },
            },
            Object {
              "count": 71,
              "end": Object {
                "column": 53,
                "line": 29,
              },
              "start": Object {
                "column": 0,
                "line": 29,
              },
            },
            Object {
              "count": 19,
              "end": Object {
                "column": 28,
                "line": 28,
              },
              "start": Object {
                "column": 0,
                "line": 28,
              },
            },
            Object {
              "count": 71,
              "end": Object {
                "column": 32,
                "line": 27,
              },
              "start": Object {
                "column": 0,
                "line": 27,
              },
            },
            Object {
              "count": 20,
              "end": Object {
                "column": 65,
                "line": 26,
              },
              "start": Object {
                "column": 0,
                "line": 26,
              },
            },
            Object {
              "count": 20,
              "end": Object {
                "column": Infinity,
                "line": 25,
              },
              "start": Object {
                "column": 0,
                "line": 25,
              },
            },
            Object {
              "count": 20,
              "end": Object {
                "column": 4,
                "line": 24,
              },
              "start": Object {
                "column": 0,
                "line": 24,
              },
            },
            Object {
              "count": 20,
              "end": Object {
                "column": 79,
                "line": 23,
              },
              "start": Object {
                "column": 0,
                "line": 23,
              },
            },
            Object {
              "count": 20,
              "end": Object {
                "column": 79,
                "line": 22,
              },
              "start": Object {
                "column": 0,
                "line": 22,
              },
            },
            Object {
              "count": 20,
              "end": Object {
                "column": 9,
                "line": 21,
              },
              "start": Object {
                "column": 0,
                "line": 21,
              },
            },
            Object {
              "count": 20,
              "end": Object {
                "column": 16,
                "line": 20,
              },
              "start": Object {
                "column": 0,
                "line": 20,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 72,
                "line": 19,
              },
              "start": Object {
                "column": 0,
                "line": 19,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": Infinity,
                "line": 18,
              },
              "start": Object {
                "column": 0,
                "line": 18,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 47,
                "line": 17,
              },
              "start": Object {
                "column": 0,
                "line": 17,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 72,
                "line": 16,
              },
              "start": Object {
                "column": 0,
                "line": 16,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 45,
                "line": 15,
              },
              "start": Object {
                "column": 0,
                "line": 15,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 42,
                "line": 14,
              },
              "start": Object {
                "column": 0,
                "line": 14,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 40,
                "line": 13,
              },
              "start": Object {
                "column": 0,
                "line": 13,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 40,
                "line": 12,
              },
              "start": Object {
                "column": 0,
                "line": 12,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 47,
                "line": 11,
              },
              "start": Object {
                "column": 0,
                "line": 11,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 41,
                "line": 10,
              },
              "start": Object {
                "column": 0,
                "line": 10,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 20,
                "line": 9,
              },
              "start": Object {
                "column": 0,
                "line": 9,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 11,
                "line": 8,
              },
              "start": Object {
                "column": 0,
                "line": 8,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 23,
                "line": 7,
              },
              "start": Object {
                "column": 0,
                "line": 7,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 14,
                "line": 6,
              },
              "start": Object {
                "column": 0,
                "line": 6,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 10,
                "line": 5,
              },
              "start": Object {
                "column": 0,
                "line": 5,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 17,
                "line": 4,
              },
              "start": Object {
                "column": 0,
                "line": 4,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 14,
                "line": 3,
              },
              "start": Object {
                "column": 0,
                "line": 3,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 8,
                "line": 2,
              },
              "start": Object {
                "column": 0,
                "line": 2,
              },
            },
            Object {
              "count": 1,
              "end": Object {
                "column": 28,
                "line": 1,
              },
              "start": Object {
                "column": 0,
                "line": 1,
              },
            },
          ],
        },
      }
    `);
  });
});
