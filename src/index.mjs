const operators = ['!', '^', '*', '/', '%', '+', '-', '<', '<=', '>', '>=', '==', '!=', '&&', '||', '??'];
const operatorCharacters = ['!', '^', '*', '/', '%', '+', '-', '<', '=', '>', '&', '|', '?'];
const operatorsOrder = [['^'], ['*', '/', '%'], ['+', '-'], ['<', '<=', '>', '>='], ['==', '!='], ['&&'], ['||', '??']];
const operatorsPrefix = ['!', 'n'];

const literals = {
    '"': '"',
    '`': '`',
    "'": "'",
    '[': ']',
};

const numberRx = /^(?:[0-9]*(\.[0-9]*)?){1}$/;
const tokenRx = /^[\w\$\#\.\@\:\{\}]+$/;

const symbol = Symbol('formula');
const settingsSymbol = Symbol('settings');

export class Parser {
    constructor(string, options = {}) {
        if (!options[settingsSymbol] && options.constants) {
            for (const constant in options.constants) {
                const value = options.constants[constant];
                if (value !== null && !['boolean', 'number', 'string'].includes(typeof value)) {
                    throw new Error(`Formula constant ${constant} contains invalid ${typeof value} value type`);
                }
            }
        }

        this.settings = options[settingsSymbol]
            ? options
            : Object.assign({ [settingsSymbol]: true, constants: {}, functions: {} }, options);
        this.single = null;

        this._parts = null;
        this._parse(string);
    }

    _parse(string) {
        let parts = [];
        let current = '';
        let parenthesis = 0;
        let literal = false;

        const flush = (inner) => {
            if (parenthesis) {
                throw new Error('Formula missing closing parenthesis');
            }

            const last = parts.length ? parts[parts.length - 1] : null;

            if (!literal && !current && !inner) {
                return;
            }

            if (last && last.type === 'reference' && inner === ')') {
                // Function

                last.type = 'function';
                last.value = this._subFormula(current, last.value);
                current = '';
                return;
            }

            if (inner === ')') {
                // Segment
                const sub = new Parser(current, this.settings);
                parts.push({ type: 'segment', value: sub });
            } else if (literal) {
                if (literal === ']') {
                    // Reference
                    parts.push({ type: 'reference', value: current });
                    current = '';
                    return;
                }

                parts.push({ type: 'literal', value: current }); // Literal
            } else if (operatorCharacters.includes(current)) {
                // Operator
                if (last && last.type === 'operator' && operators.includes(last.value + current)) {
                    // 2 characters operator

                    last.value += current;
                } else {
                    parts.push({ type: 'operator', value: current });
                }
            } else if (current.match(numberRx)) {
                // Number
                parts.push({ type: 'constant', value: parseFloat(current) });
            } else if (this.settings.constants[current] !== undefined) {
                // Constant
                parts.push({ type: 'constant', value: this.settings.constants[current] });
            } else {
                // Reference
                if (!current.match(tokenRx)) {
                    throw new Error(`Formula contains invalid token: ${current}`);
                }

                parts.push({ type: 'reference', value: current });
            }

            current = '';
        };

        for (const c of string) {
            if (literal) {
                if (c === literal) {
                    flush();
                    literal = false;
                } else {
                    current += c;
                }
            } else if (parenthesis) {
                if (c === '(') {
                    current += c;
                    ++parenthesis;
                } else if (c === ')') {
                    --parenthesis;
                    if (!parenthesis) {
                        flush(c);
                    } else {
                        current += c;
                    }
                } else {
                    current += c;
                }
            } else if (c in literals) {
                literal = literals[c];
            } else if (c === '(') {
                flush();
                ++parenthesis;
            } else if (operatorCharacters.includes(c)) {
                flush();
                current = c;
                flush();
            } else if (c !== ' ') {
                current += c;
            } else {
                flush();
            }
        }

        flush();

        // Replace prefix - to internal negative operator

        parts = parts.map((part, i) => {
            if (part.type !== 'operator' || part.value !== '-' || (i && parts[i - 1].type !== 'operator')) {
                return part;
            }

            return { type: 'operator', value: 'n' };
        });

        // Validate tokens order

        let operator = false;
        for (const part of parts) {
            if (part.type === 'operator') {
                if (operatorsPrefix.includes(part.value)) {
                    continue;
                }

                if (!operator) {
                    throw new Error('Formula contains an operator in invalid position');
                }

                if (!operators.includes(part.value)) {
                    throw new Error(`Formula contains an unknown operator ${part.value}`);
                }
            } else if (operator) {
                throw new Error('Formula missing expected operator');
            }

            operator = !operator;
        }

        if (!operator) {
            throw new Error('Formula contains invalid trailing operator');
        }

        // Identify single part

        if (parts.length === 1 && ['reference', 'literal', 'constant'].includes(parts[0].type)) {
            this.single = { type: parts[0].type === 'reference' ? 'reference' : 'value', value: parts[0].value };
        }

        // Process parts

        this._parts = parts.map((part) => {
            // Operators

            if (part.type === 'operator') {
                return operatorsPrefix.includes(part.value) ? part : part.value;
            }

            // Literals, constants, segments

            if (part.type !== 'reference') {
                return part.value;
            }

            // References

            if (this.settings.tokenRx && !this.settings.tokenRx.test(part.value)) {
                throw new Error(`Formula contains invalid reference ${part.value}`);
            }

            if (this.settings.reference) {
                return this.settings.reference(part.value);
            }

            return reference(part.value);
        });
    }

    _subFormula(string, name) {
        const method = this.settings.functions[name];
        if (typeof method !== 'function') {
            throw new Error(`Formula contains unknown function ${name}`);
        }

        let args = [];
        if (string) {
            let current = '';
            let parenthesis = 0;
            let literal = false;

            const flush = () => {
                if (!current) {
                    throw new Error(`Formula contains function ${name} with invalid arguments ${string}`);
                }

                args.push(current);
                current = '';
            };

            for (let i = 0; i < string.length; ++i) {
                const c = string[i];
                if (literal) {
                    current += c;
                    if (c === literal) {
                        literal = false;
                    }
                } else if (c in literals && !parenthesis) {
                    current += c;
                    literal = literals[c];
                } else if (c === ',' && !parenthesis) {
                    flush();
                } else {
                    current += c;
                    if (c === '(') {
                        ++parenthesis;
                    } else if (c === ')') {
                        --parenthesis;
                    }
                }
            }

            flush();
        }

        args = args.map((arg) => new Parser(arg, this.settings));

        return function (context) {
            const innerValues = [];
            for (const arg of args) {
                innerValues.push(arg.evaluate(context));
            }

            return method.call(context, ...innerValues);
        };
    }

    evaluate(context) {
        const parts = this._parts.slice();

        // Prefix operators

        for (let i = parts.length - 2; i >= 0; --i) {
            const part = parts[i];
            if (part && part.type === 'operator') {
                const current = parts[i + 1];
                parts.splice(i + 1, 1);
                const value = evaluate(current, context);
                parts[i] = single(part.value, value);
            }
        }

        // Left-right operators

        operatorsOrder.forEach((set) => {
            for (let i = 1; i < parts.length - 1; ) {
                if (set.includes(parts[i])) {
                    const operator = parts[i];
                    const left = evaluate(parts[i - 1], context);
                    const right = evaluate(parts[i + 1], context);

                    parts.splice(i, 2);
                    const result = calculate(operator, left, right);
                    parts[i - 1] = result === 0 ? 0 : result; // Convert -0
                } else {
                    i += 2;
                }
            }
        });

        return evaluate(parts[0], context);
    }
}

Parser.prototype[symbol] = true;

function reference(name) {
    return function (context) {
        return context && context[name] !== undefined ? context[name] : null;
    };
}

function evaluate(part, context) {
    if (part === null) {
        return null;
    }

    if (typeof part === 'function') {
        return part(context);
    }

    if (part[symbol]) {
        return part.evaluate(context);
    }

    return part;
}

function single(operator, value) {
    if (operator === '!') {
        return value ? false : true;
    }

    // operator === 'n'

    const negative = -value;
    if (negative === 0) {
        // Override -0
        return 0;
    }

    return negative;
}

function calculate(operator, left, right) {
    if (operator === '??') {
        return exists(left) ? left : right;
    }

    if (typeof left === 'string' || typeof right === 'string') {
        if (operator === '+') {
            left = exists(left) ? left : '';
            right = exists(right) ? right : '';
            return left + right;
        }
    } else {
        switch (operator) {
            case '^':
                return Math.pow(left, right);
            case '*':
                return left * right;
            case '/':
                return left / right;
            case '%':
                return left % right;
            case '+':
                return left + right;
            case '-':
                return left - right;
        }
    }

    switch (operator) {
        case '<':
            return left < right;
        case '<=':
            return left <= right;
        case '>':
            return left > right;
        case '>=':
            return left >= right;
        case '==':
            return left === right;
        case '!=':
            return left !== right;
        case '&&':
            return left && right;
        case '||':
            return left || right;
    }

    return null;
}

function exists(value) {
    return value !== null && value !== undefined;
}
