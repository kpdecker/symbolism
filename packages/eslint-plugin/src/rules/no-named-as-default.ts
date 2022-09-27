import ts from "typescript";
import { ParserServices } from "@typescript-eslint/typescript-estree";
import { ESLintUtils } from "@typescript-eslint/utils";
import invariant from "tiny-invariant";

import { defineSymbol } from "@symbolism/definitions";
import { invariantNode } from "@symbolism/ts-utils";
import { dumpDefinition } from "@symbolism/ts-debug";
import { logDebug } from "@symbolism/utils";

const createRule = ESLintUtils.RuleCreator((name) => name);
const rule = createRule({
  name: "no-export-as-default",
  meta: {
    type: "problem",
    docs: {
      description: "TODO",
      recommended: false,
      // url: null, // URL to the documentation page for this rule
    },
    schema: [], // Add a schema if the rule has options
    messages: {
      nameConflict:
        "Using exported name '{{ name }}' as identifier for default export.",
    },
  },

  defaultOptions: [],

  create(context) {
    const parserServices: ParserServices | undefined = context.parserServices;
    invariant(parserServices, "parserServices is required");

    if (!parserServices.hasFullTypeInformation || !parserServices.program) {
      return {};
    }

    const checker = parserServices.program.getTypeChecker();

    return {
      ImportDefaultSpecifier(esNode) {
        const tsNode = parserServices.esTreeNodeToTSNodeMap.get(esNode);
        invariantNode(tsNode, checker, ts.isImportClause);

        if (!tsNode.name) {
          return;
        }

        const exportDefinition = defineSymbol(tsNode.name, checker);
        const importedFile = exportDefinition?.declaration?.getSourceFile();
        if (!importedFile) {
          logDebug("import not found", () =>
            dumpDefinition(exportDefinition, checker)
          );
          return;
        }

        const moduleSymbol = checker.getSymbolAtLocation(importedFile);
        const moduleType =
          moduleSymbol &&
          checker.getTypeOfSymbolAtLocation(moduleSymbol, importedFile);
        const namedExport = moduleType?.getProperty(tsNode.name.text);

        if (namedExport) {
          context.report({
            node: esNode,
            messageId: "nameConflict",
            data: {
              name: tsNode.name.text,
            },
          });
        }
      },
    };
  },
});

export default rule;
