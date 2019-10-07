## Example

```js
const Formula = require('@hapi/formula');


const functions = {
    x: (value) => value + 10
};

const constants = {
    Z: 100
};

const reference = function (name) {

    return (context) => context[name];
};


const formula = new Formula.Parser('1 + a.b.c.2.4.x + [b] + x([y + 4] + Z)', { functions, constants, reference });

formula.evaluate({ 'a.b.c.2.4.x': 2, b: 3, 'y + 4': 5 });       // 1 + 2 + 3 + 5 + 10 + 100
formula.evaluate({ 'a.b.c.2.4.x': '2', b: 3, 'y + 4': '5' });   // '123510010'
```

## Methods

### `new Formula.Parser(formula, [options])`

Creates a new formula parser object where:
- `formula` - the formula string to parse.
- `options` - optional settings:
    - `constants` - a hash of key-value pairs used to convert constants to values.
    - `tokenRx` - a regular expression used to validate token variables.
    - `reference` - a variable resolver factory function with signature `function(variable)` which returns a function with signature `function(context)` returning the resolved `variable`.
    - `functions` - a hash of key-value pairs used to resolve formula functions.

### `parser.evaluate([context])`

Evaluate the formula where:
- `context` - optional object with runtime formula context used to resolve variables.

Returns the string or number outcome of the resolved formula.
