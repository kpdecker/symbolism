# symbolism

Typescript symbol inspection/assertion tools.

- Code coverage assertions by symbol name.

  Allows for code coverage assertions to be made for specific function calls, etc. Ensure that your critical functionality is covered by the assertions without arbitrary line counts.

## Usage

```shell
$ symbolism --help
```

## Config

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
