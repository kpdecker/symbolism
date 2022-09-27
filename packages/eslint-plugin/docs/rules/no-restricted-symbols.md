# Disallow access of specific symbol usage. (no-restricted-symbols)

Disallow access to specific code symbols.

This is a type-aware version of [no-restricted-properties](https://eslint.org/docs/latest/rules/no-restricted-properties), meaning it is able to account for different variable names and avoid false positives for common naming patterns.

This can be used to disallow use of deprecated APIs or to enforce that access to specific APIs is localized to wrapper layers.

This can be used to disallow `window.location.search` while still allowing the use of `location.search` defined.

## Rule Details

This rule identifies the 

Examples of **incorrect** code for this rule:

```ts
/* eslint @symbolism.no-restricted-symbols: [2, {
    symbolPath: "Location.search",
    fileName: "typescript/lib/lib.dom.d.ts",
  }] */

window.location.search;
locations.search;

const foo = window.location;
foo.search;

```

Examples of **correct** code for this rule:

```ts
/* eslint @symbolism.no-restricted-symbols: [2, {
    symbolPath: "Location.search",
    fileName: "typescript/lib/lib.dom.d.ts",
  }] */

const location = useLocation();
location.search;

```

### Options

Array of disallowed symbols. These can be specified as a string, `symbolPath`, or an object. If an object is specified, it must have a `symbolPath` property, and may have a `fileName` property.


`symbolPath` This path of the symbol that is disallowed. This is the value that is reported by the [defineSymbol](../../../cli/README.md#definesymbol) CLI command.

Since symbol paths are not unique, the `fileName` property is required to disambiguate symbols that share a path. This path is relative to the root of the project for local source and to node_modules for imported modules.

Some examples:

Disallow `window.location.search`:

```json
{
  "symbolPath": "Location.search",
  "fileName": "typescript/lib/lib.dom.d.ts"
}
```

Disallow `Math.floor`, for some reason:

```json
{ "symbolPath": "Math.floor" }
```

If there are any options, describe them here. Otherwise, delete this section.

## When Not To Use It

If you don't want to disallow access to specific symbols, you can disable this rule.
