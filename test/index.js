import { describe, expect, it } from 'vitest';

import * as Formula from '../lib/index.js';

describe('Formula', () => {
    it('evaluates a formula', () => {
        const functions = {
            x: (value) => value + 10,
        };

        const constants = {
            Z: 100,
        };

        const formula = new Formula.Parser('1 + a.b.c.2.4.x + [b] + x([y + 4] + Z)', { functions, constants });
        expect(formula.evaluate({ 'a.b.c.2.4.x': 2, b: 3, 'y + 4': 5 })).toEqual(1 + 2 + 3 + 5 + 10 + 100);
        expect(formula.evaluate({ 'a.b.c.2.4.x': '2', b: 3, 'y + 4': '5' })).toEqual('123510010');
    });

    it('evaluates a formula (custom reference handler)', () => {
        const functions = {
            x: (value) => value + 10,
        };

        const constants = {
            Z: 100,
        };

        const reference = function (name) {
            return (context) => context[name];
        };

        const formula = new Formula.Parser('1 + a.b.c.2.4.x + [b] + x([y + 4] + Z)', {
            functions,
            constants,
            reference,
        });
        expect(formula.evaluate({ 'a.b.c.2.4.x': 2, b: 3, 'y + 4': 5 })).toEqual(1 + 2 + 3 + 5 + 10 + 100);
        expect(formula.evaluate({ 'a.b.c.2.4.x': '2', b: 3, 'y + 4': '5' })).toEqual('123510010');
    });

    describe('constructor()', () => {
        it('allows valid constant', () => {
            expect(() => new Formula.Parser('1 + x', { constants: { x: true } })).not.toThrow();
            expect(() => new Formula.Parser('1 + x', { constants: { x: 1 } })).not.toThrow();
            expect(() => new Formula.Parser('1 + x', { constants: { x: 'x' } })).not.toThrow();
            expect(() => new Formula.Parser('1 + x', { constants: { x: null } })).not.toThrow();
        });

        it('errors on invalid constant', () => {
            expect(() => new Formula.Parser('1 + x', { constants: { x: {} } })).toThrow(
                'Formula constant x contains invalid object value type',
            );
            expect(() => new Formula.Parser('1 + x', { constants: { x: () => null } })).toThrow(
                'Formula constant x contains invalid function value type',
            );
            expect(() => new Formula.Parser('1 + x', { constants: { x: undefined } })).toThrow(
                'Formula constant x contains invalid undefined value type',
            );
        });
    });

    describe('single', () => {
        it('identifies single literal (string)', () => {
            const formula = new Formula.Parser('"x"');
            expect(formula.single).toEqual({ type: 'value', value: 'x' });
        });

        it('identifies single literal (number)', () => {
            const formula = new Formula.Parser('123');
            expect(formula.single).toEqual({ type: 'value', value: 123 });
        });

        it('identifies single literal (constant)', () => {
            const formula = new Formula.Parser('x', { constants: { x: 'y' } });
            expect(formula.single).toEqual({ type: 'value', value: 'y' });
        });

        it('identifies single reference', () => {
            const formula = new Formula.Parser('x');
            expect(formula.single).toEqual({ type: 'reference', value: 'x' });
        });

        it('identifies non-single reference', () => {
            const formula = new Formula.Parser('-x');
            expect(formula.single).toBeNull();
        });
    });

    describe('_parse()', () => {
        it('parses multiple nested functions', () => {
            const functions = {
                x: (value) => value + 1,
                y: (value) => value + 2,
                z: (value) => value + 3,
                a: () => 9,
            };

            const formula = new Formula.Parser('x(10) + y(z(30)) + z(x(40)) + a()', { functions });
            expect(formula.evaluate()).toEqual(11 + 33 + 2 + 41 + 3 + 9);
        });

        it('passes context as this to functions', () => {
            const functions = {
                x: function () {
                    return this.X;
                },
            };

            const formula = new Formula.Parser('x()', { functions });
            expect(formula.evaluate({ X: 1 })).toEqual(1);
        });

        it('parses parenthesis', () => {
            const formula = new Formula.Parser('(x + 4) * (x - 5) / (x ^ 2)');
            expect(formula.evaluate({ x: 10 })).toEqual(((10 + 4) * (10 - 5)) / Math.pow(10, 2));
        });

        it('parses string literals', () => {
            const formula = new Formula.Parser('"x+3" + `y()` + \'-z\'');
            expect(formula.evaluate()).toEqual('x+3y()-z');
        });

        it('validates token', () => {
            expect(() => new Formula.Parser('[xy]', { tokenRx: /^\w+$/ })).not.toThrow();
            expect(() => new Formula.Parser('[x y]', { tokenRx: /^\w+$/ })).toThrow(
                'Formula contains invalid reference x y',
            );
        });

        it('errors on missing closing parenthesis', () => {
            expect(() => new Formula.Parser('(a + 2(')).toThrow('Formula missing closing parenthesis');
        });

        it('errors on invalid character', () => {
            expect(() => new Formula.Parser('x\u0000')).toThrow('Formula contains invalid token: x\u0000');
        });

        it('errors on invalid operator position', () => {
            expect(() => new Formula.Parser('x + + y')).toThrow('Formula contains an operator in invalid position');
            expect(() => new Formula.Parser('x + y +')).toThrow('Formula contains invalid trailing operator');
        });

        it('errors on invalid operator', () => {
            expect(() => new Formula.Parser('x | y')).toThrow('Formula contains an unknown operator |');
        });

        it('errors on invalid missing operator', () => {
            expect(() => new Formula.Parser('x y')).toThrow('Formula missing expected operator');
        });
    });

    describe('_subFormula', () => {
        it('parses multiple nested functions with arguments (numbers)', () => {
            const functions = {
                x: (a, b, c) => a + b + c,
                y: (a, b) => a * b,
                z: (value) => value + 3,
                a: () => 9,
            };

            const formula = new Formula.Parser('x(10, (y((1 + 2), z(30)) + a()), z(x(4, 5, 6)))', { functions });
            expect(formula.evaluate()).toEqual(10 + ((1 + 2) * (30 + 3) + 9) + (4 + 5 + 6) + 3);
        });

        it('parses multiple nested functions with arguments (strings)', () => {
            const functions = {
                x: (a, b, c) => a + b + c,
                y: (a, b) => a + b,
                z: (value) => value + 3,
                a: () => 9,
            };

            const formula = new Formula.Parser('x("10", (y(("1" + "2"), z("30")) + a()), z(x("4", "5", "6")))', {
                functions,
            });
            expect(formula.evaluate()).toEqual('101230394563');
        });

        it('errors on unknown function', () => {
            expect(() => new Formula.Parser('x()')).toThrow('Formula contains unknown function x');
        });

        it('errors on invalid function arguments', () => {
            expect(() => new Formula.Parser('x(y,)', { functions: { x: () => null } })).toThrow(
                'Formula contains function x with invalid arguments y,',
            );
        });
    });

    describe('evaluate()', () => {
        it('handles null constant', () => {
            const formula = new Formula.Parser('0 + null', { constants: { null: null } });

            expect(formula.evaluate()).toEqual(0);
        });
    });

    describe('single()', () => {
        it('calculates -', () => {
            const formula = new Formula.Parser('-x');

            expect(formula.evaluate({ x: 1 })).toEqual(-1);
            expect(formula.evaluate({ x: -1 })).toEqual(1);
            expect(formula.evaluate({ x: 0 })).toEqual(0);
        });

        it('handles --', () => {
            const formula = new Formula.Parser('10--x');

            expect(formula.evaluate({ x: 1 })).toEqual(11);
            expect(formula.evaluate({ x: -1 })).toEqual(9);
            expect(formula.evaluate({ x: 0 })).toEqual(10);
        });

        it('calculates !', () => {
            const formula = new Formula.Parser('!x');

            expect(formula.evaluate({ x: 1 })).toEqual(false);
            expect(formula.evaluate({ x: -1 })).toEqual(false);
            expect(formula.evaluate({ x: 0 })).toEqual(true);
        });
    });

    describe('calculate()', () => {
        it('calculates +', () => {
            const formula = new Formula.Parser('x+y');

            expect(formula.evaluate({ x: 1, y: 2 })).toEqual(3);
            expect(formula.evaluate({ y: 2 })).toEqual(2);
            expect(formula.evaluate({ x: 1 })).toEqual(1);
            expect(formula.evaluate({ x: null, y: 2 })).toEqual(2);
            expect(formula.evaluate({ x: 1, y: null })).toEqual(1);

            expect(formula.evaluate({ x: '1', y: '2' })).toEqual('12');
            expect(formula.evaluate({ y: '2' })).toEqual('2');
            expect(formula.evaluate({ x: '1' })).toEqual('1');
            expect(formula.evaluate({ x: null, y: '2' })).toEqual('2');
            expect(formula.evaluate({ x: '1', y: null })).toEqual('1');

            expect(formula.evaluate({ x: 1, y: '2' })).toEqual('12');
            expect(formula.evaluate({ x: '1', y: 2 })).toEqual('12');
        });

        it('calculates -', () => {
            const formula = new Formula.Parser('x-y');

            expect(formula.evaluate({ x: 1, y: 2 })).toEqual(-1);
            expect(formula.evaluate({ y: 2 })).toEqual(-2);
            expect(formula.evaluate({ x: 1 })).toEqual(1);
            expect(formula.evaluate({ x: null, y: 2 })).toEqual(-2);
            expect(formula.evaluate({ x: 1, y: null })).toEqual(1);

            expect(formula.evaluate({ x: '1', y: '2' })).toEqual(null);
            expect(formula.evaluate({ y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1' })).toEqual(null);
            expect(formula.evaluate({ x: null, y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1', y: null })).toEqual(null);

            expect(formula.evaluate({ x: 1, y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1', y: 2 })).toEqual(null);
        });

        it('calculates *', () => {
            const formula = new Formula.Parser('x*y');

            expect(formula.evaluate({ x: 20, y: 10 })).toEqual(200);
            expect(formula.evaluate({ y: 2 })).toEqual(0);
            expect(formula.evaluate({ x: 1 })).toEqual(0);
            expect(formula.evaluate({ x: null, y: 2 })).toEqual(0);
            expect(formula.evaluate({ x: 1, y: null })).toEqual(0);

            expect(formula.evaluate({ x: '1', y: '2' })).toEqual(null);
            expect(formula.evaluate({ y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1' })).toEqual(null);
            expect(formula.evaluate({ x: null, y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1', y: null })).toEqual(null);

            expect(formula.evaluate({ x: 1, y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1', y: 2 })).toEqual(null);
        });

        it('calculates /', () => {
            const formula = new Formula.Parser('x/y');

            expect(formula.evaluate({ x: 20, y: 10 })).toEqual(2);
            expect(formula.evaluate({ y: 2 })).toEqual(0);
            expect(formula.evaluate({ x: 1 })).toEqual(Infinity);
            expect(formula.evaluate({ x: null, y: 2 })).toEqual(0);
            expect(formula.evaluate({ x: 1, y: null })).toEqual(Infinity);

            expect(formula.evaluate({ x: '1', y: '2' })).toEqual(null);
            expect(formula.evaluate({ y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1' })).toEqual(null);
            expect(formula.evaluate({ x: null, y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1', y: null })).toEqual(null);

            expect(formula.evaluate({ x: 1, y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1', y: 2 })).toEqual(null);
        });

        it('calculates ^', () => {
            const formula = new Formula.Parser('x^y');

            expect(formula.evaluate({ x: 2, y: 3 })).toEqual(8);
            expect(formula.evaluate({ y: 2 })).toEqual(0);
            expect(formula.evaluate({ x: 1 })).toEqual(1);
            expect(formula.evaluate({ x: null, y: 2 })).toEqual(0);
            expect(formula.evaluate({ x: 1, y: null })).toEqual(1);

            expect(formula.evaluate({ x: '1', y: '2' })).toEqual(null);
            expect(formula.evaluate({ y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1' })).toEqual(null);
            expect(formula.evaluate({ x: null, y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1', y: null })).toEqual(null);

            expect(formula.evaluate({ x: 1, y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1', y: 2 })).toEqual(null);
        });

        it('calculates %', () => {
            const formula = new Formula.Parser('x%y');

            expect(formula.evaluate({ x: 10, y: 3 })).toEqual(1);
            expect(formula.evaluate({ y: 2 })).toEqual(0);
            expect(formula.evaluate({ x: 1 })).toEqual(NaN);
            expect(formula.evaluate({ x: null, y: 2 })).toEqual(0);
            expect(formula.evaluate({ x: 1, y: null })).toEqual(NaN);

            expect(formula.evaluate({ x: '1', y: '2' })).toEqual(null);
            expect(formula.evaluate({ y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1' })).toEqual(null);
            expect(formula.evaluate({ x: null, y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1', y: null })).toEqual(null);

            expect(formula.evaluate({ x: 1, y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1', y: 2 })).toEqual(null);
        });

        it('compares <', () => {
            const formula = new Formula.Parser('x<y');

            expect(formula.evaluate({ x: 10, y: 3 })).toEqual(false);
            expect(formula.evaluate({ x: 10, y: 10 })).toEqual(false);
            expect(formula.evaluate({ y: 2 })).toEqual(true);
            expect(formula.evaluate({ x: 1 })).toEqual(false);
            expect(formula.evaluate({ x: null, y: 2 })).toEqual(true);
            expect(formula.evaluate({ x: 1, y: null })).toEqual(false);

            expect(formula.evaluate({ x: '1', y: '2' })).toEqual(true);
            expect(formula.evaluate({ x: '1', y: '1' })).toEqual(false);
            expect(formula.evaluate({ y: '2' })).toEqual(true);
            expect(formula.evaluate({ x: '1' })).toEqual(false);
            expect(formula.evaluate({ x: null, y: '2' })).toEqual(true);
            expect(formula.evaluate({ x: '1', y: null })).toEqual(false);

            expect(formula.evaluate({ x: 1, y: '2' })).toEqual(true);
            expect(formula.evaluate({ x: '1', y: 2 })).toEqual(true);
            expect(formula.evaluate({ x: 1, y: '1' })).toEqual(false);
            expect(formula.evaluate({ x: '1', y: 1 })).toEqual(false);

            expect(formula.evaluate({ x: null, y: null })).toEqual(false);
            expect(formula.evaluate({ y: null })).toEqual(false);
            expect(formula.evaluate({ x: null })).toEqual(false);
            expect(formula.evaluate()).toEqual(false);
        });

        it('compares >', () => {
            const formula = new Formula.Parser('x>y');

            expect(formula.evaluate({ x: 10, y: 3 })).toEqual(true);
            expect(formula.evaluate({ x: 10, y: 10 })).toEqual(false);
            expect(formula.evaluate({ y: 2 })).toEqual(false);
            expect(formula.evaluate({ x: 1 })).toEqual(true);
            expect(formula.evaluate({ x: null, y: 2 })).toEqual(false);
            expect(formula.evaluate({ x: 1, y: null })).toEqual(true);

            expect(formula.evaluate({ x: '1', y: '2' })).toEqual(false);
            expect(formula.evaluate({ x: '1', y: '1' })).toEqual(false);
            expect(formula.evaluate({ y: '2' })).toEqual(false);
            expect(formula.evaluate({ x: '1' })).toEqual(true);
            expect(formula.evaluate({ x: null, y: '2' })).toEqual(false);
            expect(formula.evaluate({ x: '1', y: null })).toEqual(true);

            expect(formula.evaluate({ x: 1, y: '2' })).toEqual(false);
            expect(formula.evaluate({ x: '1', y: 2 })).toEqual(false);
            expect(formula.evaluate({ x: 1, y: '1' })).toEqual(false);
            expect(formula.evaluate({ x: '1', y: 1 })).toEqual(false);

            expect(formula.evaluate({ x: null, y: null })).toEqual(false);
            expect(formula.evaluate({ y: null })).toEqual(false);
            expect(formula.evaluate({ x: null })).toEqual(false);
            expect(formula.evaluate()).toEqual(false);
        });

        it('compares <=', () => {
            const formula = new Formula.Parser('x<=y');

            expect(formula.evaluate({ x: 10, y: 3 })).toEqual(false);
            expect(formula.evaluate({ x: 10, y: 10 })).toEqual(true);
            expect(formula.evaluate({ y: 2 })).toEqual(true);
            expect(formula.evaluate({ x: 1 })).toEqual(false);
            expect(formula.evaluate({ x: null, y: 2 })).toEqual(true);
            expect(formula.evaluate({ x: 1, y: null })).toEqual(false);

            expect(formula.evaluate({ x: '1', y: '2' })).toEqual(true);
            expect(formula.evaluate({ x: '1', y: '1' })).toEqual(true);
            expect(formula.evaluate({ y: '2' })).toEqual(true);
            expect(formula.evaluate({ x: '1' })).toEqual(false);
            expect(formula.evaluate({ x: null, y: '2' })).toEqual(true);
            expect(formula.evaluate({ x: '1', y: null })).toEqual(false);

            expect(formula.evaluate({ x: 1, y: '2' })).toEqual(true);
            expect(formula.evaluate({ x: '1', y: 2 })).toEqual(true);
            expect(formula.evaluate({ x: 1, y: '1' })).toEqual(true);
            expect(formula.evaluate({ x: '1', y: 1 })).toEqual(true);

            expect(formula.evaluate({ x: null, y: null })).toEqual(true);
            expect(formula.evaluate({ y: null })).toEqual(true);
            expect(formula.evaluate({ x: null })).toEqual(true);
            expect(formula.evaluate()).toEqual(true);
        });

        it('compares >=', () => {
            const formula = new Formula.Parser('x>=y');

            expect(formula.evaluate({ x: 10, y: 3 })).toEqual(true);
            expect(formula.evaluate({ x: 10, y: 10 })).toEqual(true);
            expect(formula.evaluate({ y: 2 })).toEqual(false);
            expect(formula.evaluate({ x: 1 })).toEqual(true);
            expect(formula.evaluate({ x: null, y: 2 })).toEqual(false);
            expect(formula.evaluate({ x: 1, y: null })).toEqual(true);

            expect(formula.evaluate({ x: '1', y: '2' })).toEqual(false);
            expect(formula.evaluate({ x: '1', y: '1' })).toEqual(true);
            expect(formula.evaluate({ y: '2' })).toEqual(false);
            expect(formula.evaluate({ x: '1' })).toEqual(true);
            expect(formula.evaluate({ x: null, y: '2' })).toEqual(false);
            expect(formula.evaluate({ x: '1', y: null })).toEqual(true);

            expect(formula.evaluate({ x: 1, y: '2' })).toEqual(false);
            expect(formula.evaluate({ x: '1', y: 2 })).toEqual(false);
            expect(formula.evaluate({ x: 1, y: '1' })).toEqual(true);
            expect(formula.evaluate({ x: '1', y: 1 })).toEqual(true);

            expect(formula.evaluate({ x: null, y: null })).toEqual(true);
            expect(formula.evaluate({ y: null })).toEqual(true);
            expect(formula.evaluate({ x: null })).toEqual(true);
            expect(formula.evaluate()).toEqual(true);
        });

        it('compares ==', () => {
            const formula = new Formula.Parser('x==y');

            expect(formula.evaluate({ x: 10, y: 3 })).toEqual(false);
            expect(formula.evaluate({ x: 10, y: 10 })).toEqual(true);
            expect(formula.evaluate({ y: 2 })).toEqual(false);
            expect(formula.evaluate({ x: 1 })).toEqual(false);
            expect(formula.evaluate({ x: null, y: 2 })).toEqual(false);
            expect(formula.evaluate({ x: 1, y: null })).toEqual(false);

            expect(formula.evaluate({ x: '1', y: '2' })).toEqual(false);
            expect(formula.evaluate({ x: '1', y: '1' })).toEqual(true);
            expect(formula.evaluate({ y: '2' })).toEqual(false);
            expect(formula.evaluate({ x: '1' })).toEqual(false);
            expect(formula.evaluate({ x: null, y: '2' })).toEqual(false);
            expect(formula.evaluate({ x: '1', y: null })).toEqual(false);

            expect(formula.evaluate({ x: 1, y: '2' })).toEqual(false);
            expect(formula.evaluate({ x: '1', y: 2 })).toEqual(false);
            expect(formula.evaluate({ x: 1, y: '1' })).toEqual(false);
            expect(formula.evaluate({ x: '1', y: 1 })).toEqual(false);

            expect(formula.evaluate({ x: null, y: null })).toEqual(true);
            expect(formula.evaluate({ y: null })).toEqual(true);
            expect(formula.evaluate({ x: null })).toEqual(true);
            expect(formula.evaluate()).toEqual(true);
        });

        it('compares !=', () => {
            const formula = new Formula.Parser('x!=y');

            expect(formula.evaluate({ x: 10, y: 3 })).toEqual(true);
            expect(formula.evaluate({ x: 10, y: 10 })).toEqual(false);
            expect(formula.evaluate({ y: 2 })).toEqual(true);
            expect(formula.evaluate({ x: 1 })).toEqual(true);
            expect(formula.evaluate({ x: null, y: 2 })).toEqual(true);
            expect(formula.evaluate({ x: 1, y: null })).toEqual(true);

            expect(formula.evaluate({ x: '1', y: '2' })).toEqual(true);
            expect(formula.evaluate({ x: '1', y: '1' })).toEqual(false);
            expect(formula.evaluate({ y: '2' })).toEqual(true);
            expect(formula.evaluate({ x: '1' })).toEqual(true);
            expect(formula.evaluate({ x: null, y: '2' })).toEqual(true);
            expect(formula.evaluate({ x: '1', y: null })).toEqual(true);

            expect(formula.evaluate({ x: 1, y: '2' })).toEqual(true);
            expect(formula.evaluate({ x: '1', y: 2 })).toEqual(true);
            expect(formula.evaluate({ x: 1, y: '1' })).toEqual(true);
            expect(formula.evaluate({ x: '1', y: 1 })).toEqual(true);

            expect(formula.evaluate({ x: null, y: null })).toEqual(false);
            expect(formula.evaluate({ y: null })).toEqual(false);
            expect(formula.evaluate({ x: null })).toEqual(false);
            expect(formula.evaluate()).toEqual(false);
        });

        it('applies logical ||', () => {
            const formula = new Formula.Parser('x || y');

            expect(formula.evaluate({ x: 10, y: 3 })).toEqual(10);
            expect(formula.evaluate({ x: 10, y: 10 })).toEqual(10);
            expect(formula.evaluate({ x: 0, y: 10 })).toEqual(10);
            expect(formula.evaluate({ x: 0, y: 0 })).toEqual(0);
            expect(formula.evaluate({ y: 2 })).toEqual(2);
            expect(formula.evaluate({ x: 1 })).toEqual(1);
            expect(formula.evaluate({ x: null, y: 2 })).toEqual(2);
            expect(formula.evaluate({ x: 1, y: null })).toEqual(1);

            expect(formula.evaluate({ x: '1', y: '2' })).toEqual('1');
            expect(formula.evaluate({ x: '1', y: '1' })).toEqual('1');
            expect(formula.evaluate({ x: '', y: '1' })).toEqual('1');
            expect(formula.evaluate({ x: '', y: '' })).toEqual('');
            expect(formula.evaluate({ y: '2' })).toEqual('2');
            expect(formula.evaluate({ x: '1' })).toEqual('1');
            expect(formula.evaluate({ x: null, y: '2' })).toEqual('2');
            expect(formula.evaluate({ x: '1', y: null })).toEqual('1');

            expect(formula.evaluate({ x: 1, y: '2' })).toEqual(1);
            expect(formula.evaluate({ x: '1', y: 2 })).toEqual('1');
            expect(formula.evaluate({ x: 1, y: '1' })).toEqual(1);
            expect(formula.evaluate({ x: '1', y: 1 })).toEqual('1');

            expect(formula.evaluate({ x: null, y: null })).toEqual(null);
            expect(formula.evaluate({ y: null })).toEqual(null);
            expect(formula.evaluate({ x: null })).toEqual(null);
            expect(formula.evaluate()).toEqual(null);
        });

        it('applies logical &&', () => {
            const formula = new Formula.Parser('x && y');

            expect(formula.evaluate({ x: 10, y: 3 })).toEqual(3);
            expect(formula.evaluate({ x: 10, y: 10 })).toEqual(10);
            expect(formula.evaluate({ x: 0, y: 10 })).toEqual(0);
            expect(formula.evaluate({ x: 0, y: 0 })).toEqual(0);
            expect(formula.evaluate({ y: 2 })).toEqual(null);
            expect(formula.evaluate({ x: 1 })).toEqual(null);
            expect(formula.evaluate({ x: null, y: 2 })).toEqual(null);
            expect(formula.evaluate({ x: 1, y: null })).toEqual(null);

            expect(formula.evaluate({ x: '1', y: '2' })).toEqual('2');
            expect(formula.evaluate({ x: '1', y: '1' })).toEqual('1');
            expect(formula.evaluate({ x: '', y: '1' })).toEqual('');
            expect(formula.evaluate({ x: '', y: '' })).toEqual('');
            expect(formula.evaluate({ y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1' })).toEqual(null);
            expect(formula.evaluate({ x: null, y: '2' })).toEqual(null);
            expect(formula.evaluate({ x: '1', y: null })).toEqual(null);

            expect(formula.evaluate({ x: 1, y: '2' })).toEqual('2');
            expect(formula.evaluate({ x: '1', y: 2 })).toEqual(2);
            expect(formula.evaluate({ x: 1, y: '1' })).toEqual('1');
            expect(formula.evaluate({ x: '1', y: 1 })).toEqual(1);

            expect(formula.evaluate({ x: null, y: null })).toEqual(null);
            expect(formula.evaluate({ y: null })).toEqual(null);
            expect(formula.evaluate({ x: null })).toEqual(null);
            expect(formula.evaluate()).toEqual(null);
        });

        it('applies logical ??', () => {
            const formula = new Formula.Parser('x ?? y');

            expect(formula.evaluate({ x: 10, y: 3 })).toEqual(10);
            expect(formula.evaluate({ x: 10, y: 10 })).toEqual(10);
            expect(formula.evaluate({ x: 0, y: 10 })).toEqual(0);
            expect(formula.evaluate({ x: 0, y: 0 })).toEqual(0);
            expect(formula.evaluate({ y: 2 })).toEqual(2);
            expect(formula.evaluate({ x: 1 })).toEqual(1);
            expect(formula.evaluate({ x: null, y: 2 })).toEqual(2);
            expect(formula.evaluate({ x: 1, y: null })).toEqual(1);

            expect(formula.evaluate({ x: '1', y: '2' })).toEqual('1');
            expect(formula.evaluate({ x: '1', y: '1' })).toEqual('1');
            expect(formula.evaluate({ x: '', y: '1' })).toEqual('');
            expect(formula.evaluate({ x: '', y: '' })).toEqual('');
            expect(formula.evaluate({ y: '2' })).toEqual('2');
            expect(formula.evaluate({ x: '1' })).toEqual('1');
            expect(formula.evaluate({ x: null, y: '2' })).toEqual('2');
            expect(formula.evaluate({ x: '1', y: null })).toEqual('1');

            expect(formula.evaluate({ x: 1, y: '2' })).toEqual(1);
            expect(formula.evaluate({ x: '1', y: 2 })).toEqual('1');
            expect(formula.evaluate({ x: 1, y: '1' })).toEqual(1);
            expect(formula.evaluate({ x: '1', y: 1 })).toEqual('1');

            expect(formula.evaluate({ x: null, y: null })).toEqual(null);
            expect(formula.evaluate({ y: null })).toEqual(null);
            expect(formula.evaluate({ x: null })).toEqual(null);
            expect(formula.evaluate()).toEqual(null);
        });
    });
});
