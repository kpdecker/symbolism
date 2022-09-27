# symbolism

Typescript symbol inspection/assertion tools.

```console
npm install -g @symbolism/cli
symbolism --help
```

## Function Call Coverage Report

Assert that the use of a function is tested in addition to the function itself. See [coverage](./docs/coverage.md).


## Static schema extraction

Document the schema of your typescript data types. Calculates the final schema for your data types, merged interfaces.


```console
symbolism dumpSchema ./packages/test/src/dump-symbol.ts Schema
```

Output:
```ts
{
  bar: "bar" | "bat";
  merged: number;
};
```

For a machine JSON Schema readable format, use the `--json` flag.


## Symbol lookup

Lookup the definition of a symbol in your project. This command is useful when setting up the configuration for our coverage and eslint tools.

```console
defineSymbol ./packages/test/src/dump-symbol.ts 9 20
```

Output:

```js
{
  type: 'string',
  symbol: [
    {
      kind: 'PropertySignature',
      name: 'search: string;',
      path: 'Location.search',
      location: 'node_modules/typescript/lib/lib.dom.d.ts:9069:5'
    }
  ]
}
```