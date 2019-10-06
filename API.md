## Methods

### `new Formula(formula, [options])`

Creates a new formula parser object where:
- `formula` - the formula string to parse.
- `options` - optional settings:
    - `constants` - a hash of key-value pairs used to convert constants to values.
    - `tokenRx` - a regular expression used to validate token variables.
    - `reference` - a variable resolver factory function with signature `function(variable)` which returns a function with signature `function(context)` returning the resolved `variable`.
    - `functions` - a hash of key-vaue pairs used to resolve formula functions.

### `formula.evaluate([context])`

Evaluate the formula where:
- `context` - optional object with runtime formula context used to resolve variables.

Returns the string or number outcome of the resolved formula.
