import ts from "typescript";
import { ParserServices } from "@typescript-eslint/typescript-estree";
import { ESLintUtils } from "@typescript-eslint/utils";
import invariant from "tiny-invariant";

import { defineSymbol } from "@symbolism/definitions";
import { getNodePath, pathMatchesTokenFilter } from "@symbolism/paths";
import { relative } from "path";
import { isNamedDeclaration } from "@symbolism/ts-utils";

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

type NoRestrictedSymbolOptions =
  | string
  | { symbolPath: string; fileName?: string; message?: string };

const definitionCache = new WeakMap<
  ts.Symbol,
  { path: string; message: string | undefined; allowed: boolean }
>();

const createRule = ESLintUtils.RuleCreator((name) => name);
const rule = createRule({
  name: "no-restricted-symbols",
  meta: {
    type: "problem",
    docs: {
      description: "Disallow access of specific symbol usage.",
      recommended: false,
      // url: undefined, // URL to the documentation page for this rule
    },
    schema: {
      type: "array",
      items: {
        anyOf: [
          { type: "string", description: "Symbol selector filter" },
          {
            type: "object",
            properties: {
              symbolPath: { type: "string" },
              fileName: { type: "string" },
              message: { type: "string" },
            },
            required: ["symbolPath"],
          },
        ],
      },
      uniqueItems: true,
    },
    messages: {
      noRestrictedSymbol: "Symbol usage is restricted: {{path}} {{message}}",
    },
  },

  defaultOptions: [],

  // Second parameter for type inference
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  create(context, _: readonly NoRestrictedSymbolOptions[]) {
    const parserServices: ParserServices | undefined = context.parserServices;
    invariant(parserServices, "parserServices is required");

    if (!parserServices.hasFullTypeInformation || !parserServices.program) {
      return {};
    }

    const checker = parserServices.program.getTypeChecker();

    return {
      // visitor functions for different types of nodes
      Identifier(esNode) {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(esNode);

        // Short circuit known non-references
        if (
          isNamedDeclaration(tsNode.parent) &&
          tsNode.parent.name === tsNode
        ) {
          return;
        }

        const symbol = checker.getSymbolAtLocation(tsNode);

        if (
          !symbol ||
          // Exclude declarations
          symbol.declarations?.includes(tsNode.parent as ts.Declaration)
        ) {
          return;
        }

        if (!definitionCache.has(symbol)) {
          // if (
          //   !ts.isJsxExpression(tsNode.parent) &&
          //   !ts.isCallExpression(tsNode.parent) &&
          //   !ts.isPropertyAccessExpression(tsNode.parent)
          // ) {
          //   console.log(
          //     "no-restricted-symbols",
          //     ts.SyntaxKind[tsNode.parent.kind],
          //     tsNode.getText()
          //   );
          // }

          const definition = defineSymbol(tsNode, checker) ?? undefined;
          const path =
            (definition?.declaration &&
              getNodePath(definition.declaration, checker)) ??
            "undefined";

          const failedRule = context.options.find((filter) => {
            if (typeof filter === "string") {
              return pathMatchesTokenFilter(path, filter);
            }

            if (!pathMatchesTokenFilter(path, filter.symbolPath)) {
              // If we don't match the symbol path, we're not restricted
              return false;
            }

            if (filter.fileName && definition?.declaration) {
              const fileName = relative(
                parserServices.program.getCurrentDirectory().toLowerCase(),
                definition.declaration.getSourceFile().fileName.toLowerCase()
              ).replace(/^(.*[\\/])?node_modules[\\/]/, "");

              return fileName === filter.fileName.toLowerCase();
            }

            return true;
          });

          definitionCache.set(symbol, {
            allowed: !failedRule,
            path,
            message:
              (typeof failedRule === "object" && failedRule?.message) || "",
          });
        }

        const symbolStatus = definitionCache.get(symbol);
        invariant(symbolStatus, "symbolStatus should be defined");

        if (!symbolStatus.allowed) {
          context.report({
            node: esNode,
            messageId: "noRestrictedSymbol",
            data: {
              path: symbolStatus.path,
              message: symbolStatus.message,
            },
          });
        }
      },
    };
  },
});

export default rule;
