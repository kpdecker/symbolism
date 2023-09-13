# eslint-plugin-symbolism

Symbol aware typescript linting rules. 

## Installation

You'll first need to install [ESLint](https://eslint.org/):

```sh
npm i eslint --save-dev
```

Next, install `@symbolism/eslint-plugin`:

```sh
npm install @symbolism/eslint-plugin --save-dev
```

## Usage

Add `@symbolism` to the plugins section of your `.eslintrc` configuration file:

```json
{
    "plugins": [
        "@noom-symbolism"
    ]
}
```


Then configure the rules you want to use under the rules section.

```json
{
    "rules": {
        "@noom/symbolism-no-restricted-symbols": [
            "error",
            {
                "symbolPath": "Location.search",
                "fileName": "typescript/lib/lib.dom.d.ts"
            }
        ]
    }
}
```

## Supported Rules

* [no-restricted-symbols](./docs/rules/no-restricted-symbols.md)
* [no-named-as-default](./docs/rules/no-named-as-default.md)


