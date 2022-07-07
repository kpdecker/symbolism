import invariant from 'tiny-invariant';
import { getTokenAtPosition } from 'tsutils';
import ts from 'typescript';

export function getSymbolFromLanguageServices(
  node: ts.Node,
  services: ts.LanguageService
) {
  const program = services.getProgram();
  invariant(program);

  const checker = program.getTypeChecker();

  const sourceFile = node.getSourceFile();
  const definitionAndBound = services.getDefinitionAndBoundSpan(
    sourceFile.fileName,
    node.pos
  );

  if (definitionAndBound) {
    // TODO: Iterate over all definitions, pick the one that is in our sources
    const definition = definitionAndBound.definitions?.[0];
    if (definition) {
      const hostFile = program.getSourceFile(definition.fileName)!;
      const token = getTokenAtPosition(hostFile, definition.textSpan.start);
      invariant(token);

      return checker.getSymbolAtLocation(token);
    }
  }
}
