import invariant from "tiny-invariant";
import ts from "typescript";

export type PathHandler = (context: {
  node: ts.Node;
  checker: ts.TypeChecker;
  getPath: (node: ts.Node) => string;
  getParentPath: () => string;
}) => string;

export function pathHandler<T extends { [kind: number]: PathHandler }>(cfg: T) {
  return cfg;
}

export const nopPath: PathHandler = () => "";
export const skipNode: PathHandler = ({ getParentPath }) => getParentPath();

export const literalText: PathHandler = ({ node }) => {
  return node.getText();
};

export const nameWithParent: PathHandler = ({ node, getParentPath }) => {
  invariant(
    "name" in node,
    "node must have a name: " + ts.SyntaxKind[node.kind]
  );
  return (
    getParentPath() + "." + (node as ts.VariableDeclaration).name.getText()
  );
};
