const foo = "bar";

declare const value: "bat" | typeof foo;

export interface Schema {
  [foo]: typeof value;
}
