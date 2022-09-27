
## Code use test coverage

Ensure that critical code in your project has test coverage based on what is is rather than where it is. Test all of your analytics calls, critical API usage, etc. without resorting to requiring 100% coverage.

```console
symbolism coverage
```

Output for [`defineSymbol`](https://github.com/kpdecker/symbolism/blob/cdaca7281de99bd64ab66ee96cbde632695a1263/packages/symbolism-definitions/src/index.ts#L239).

```shell
defineSymbol: 85.19% covered (23/27)
  Missing:
    defineSymbol: ./packages/symbolism-definitions/src/class.ts:33:14
    defineSymbol: ./packages/symbolism-definitions/src/index.ts:166:12
    defineSymbol: ./packages/symbolism-definitions/src/jsx.ts:17:12
    defineSymbol: ./packages/symbolism-definitions/src/jsx.ts:23:12
```

Showing that my tests do not cover those 4 calls to `defineSymbol`.

See config section below for setup details.


## Config

WIP

```json
{
  "tokens": [
    "function-call",
    "function-call-with-args",
    { "name": "myOtherFunction", "min": 0.9 }
  ],
  "min": 1
}
```

- `tokens`: A list of tokens to assert coverage for. Objects may be used to override the default config for those tokens. Any top-level config value may be set here.
- `min`: \[0-1\] The minimum percentage of token references required for the assertion to pass.
