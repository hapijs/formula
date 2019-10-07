import * as Formula from '..';
import * as Lab from '@hapi/lab';


const { expect } = Lab.types;


// new Formula.Parser()

const options = {

    functions: {
        x: (value: number): number => value + 10
    },

    constants: {
        Z: 100
    },

    reference: ((name) => (context) => context[name]) as Formula.Options.Reference,

    tokenRx: /^[\w \+\.]+$/
};

const parser = new Formula.Parser('1 + a.b.c.2.4.x + [b] + x([y + 4] + Z)', options);

expect.error(new Formula.Parser());
expect.error(new Formula.Parser(123));
expect.error(new Formula.Parser('a', 123));
expect.error(new Formula.Parser('a', { unknown: true }));


// parser.evaluate()

parser.evaluate({ 'a.b.c.2.4.x': 2, b: 3, 'y + 4': 5 });
