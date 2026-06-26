import { describe, expectTypeOf, it } from 'vitest';

import * as Formula from '../lib/index.js';

describe('typings', () => {
    describe('Parser', () => {
        it('constructor + evaluate compile', () => {
            const options = {
                functions: {
                    x: (value: number): number => value + 10,
                },
                constants: {
                    Z: 100,
                },
                reference: (name: string) => {
                    return (context: Record<string, unknown>) => context[name];
                },
                tokenRx: /^[\w +.]+$/,
            };

            const parser = new Formula.Parser('1 + a.b.c.2.4.x + [b] + x([y + 4] + Z)', options);
            expectTypeOf(parser).toHaveProperty('evaluate');
            expectTypeOf(parser.evaluate).toBeFunction();

            // evaluate accepts a runtime context
            parser.evaluate({ 'a.b.c.2.4.x': 2, b: 3, 'y + 4': 5 });
        });

        it('reference factory satisfies Options.Reference', () => {
            expectTypeOf<Formula.Options.Reference>().toBeFunction();
            const reference: Formula.Options.Reference = (name) => {
                return (context) => context[name];
            };
            new Formula.Parser('x', { reference });
        });

        it('invalid calls rejected', () => {
            // The @ts-expect-error directives are the assertion; the calls still run, so
            // wrap them — invalid args throw at runtime (the type errors are what we test).
            try {
                // @ts-expect-error formula string is required
                new Formula.Parser();
                // @ts-expect-error formula must be a string
                new Formula.Parser(123);
                // @ts-expect-error options must be an object
                new Formula.Parser('a', 123);
                // @ts-expect-error unknown option key
                new Formula.Parser('a', { unknown: true });
            } catch {}
        });
    });
});
