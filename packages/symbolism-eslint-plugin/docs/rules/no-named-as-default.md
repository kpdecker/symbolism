# symbolism/no-export-as-default

Implements a typescript-optimized version of [import/no-export-as-default](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-named-as-default.md).


Reports use of an exported name as the locally imported name of a default export.

Rationale: using an exported name as the name of the default export is likely...

- *misleading*: others familiar with `foo.js` probably expect the name to be `foo`
- *a mistake*: only needed to import `bar` and forgot the brackets (the case that is prompting this)

## Rule Details

Given:
```js
// foo.js
export default 'foo';
export const bar = 'baz';
```

...this would be valid:
```js
import foo from './foo.js';
```

...and this would be reported:
```js
// message: Using exported name 'bar' as identifier for default export.
import bar from './foo.js';
```
