/**
 * # Safe arithmetic evaluator
 *
 * Evaluates a math expression WITHOUT `eval`/`Function` — a hand-written
 * tokenizer + shunting-yard + RPN evaluator over a fixed whitelist of
 * operators, functions, and constants. No identifiers outside the
 * whitelist are reachable, so arbitrary code can never run.
 */

type Token =
  | { type: "num"; value: number }
  | { type: "op"; value: string }
  | { type: "func"; value: string }
  | { type: "const"; value: string }
  | { type: "paren"; value: "(" | ")" }
  | { type: "comma" };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: Math.log10,
  ln: Math.log,
  pow: Math.pow,
  min: Math.min,
  max: Math.max,
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3 };
const RIGHT_ASSOCIATIVE = new Set(["^"]);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const src = input.trim();

  while (i < src.length) {
    const char = src[i];
    if (char === " ") {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let num = "";
      while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
      const value = Number(num);
      if (!Number.isFinite(value)) throw new Error(`Invalid number "${num}".`);
      tokens.push({ type: "num", value });
      continue;
    }
    if (/[a-zA-Z]/.test(char)) {
      let name = "";
      while (i < src.length && /[a-zA-Z]/.test(src[i])) name += src[i++];
      const lower = name.toLowerCase();
      if (lower in FUNCTIONS) tokens.push({ type: "func", value: lower });
      else if (lower in CONSTANTS) tokens.push({ type: "const", value: lower });
      else throw new Error(`Unknown name "${name}".`);
      continue;
    }
    if ("+-*/%^".includes(char)) {
      tokens.push({ type: "op", value: char });
      i += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      i += 1;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma" });
      i += 1;
      continue;
    }
    throw new Error(`Unexpected character "${char}".`);
  }
  return tokens;
}

/** Shunting-yard → RPN, honoring unary minus. */
function toRpn(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const stack: Token[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const prev = tokens[i - 1];

    if (token.type === "num" || token.type === "const") {
      output.push(token);
    } else if (token.type === "func") {
      stack.push(token);
    } else if (token.type === "comma") {
      while (stack.length && stack[stack.length - 1].type !== "paren") output.push(stack.pop()!);
    } else if (token.type === "op") {
      // Unary minus/plus: at start, or after an operator or "(".
      const isUnary =
        !prev || prev.type === "op" || (prev.type === "paren" && prev.value === "(") || prev.type === "comma";
      if (isUnary && (token.value === "-" || token.value === "+")) {
        output.push({ type: "num", value: 0 });
      }
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type !== "op") break;
        const higher = PRECEDENCE[top.value] > PRECEDENCE[token.value];
        const equal =
          PRECEDENCE[top.value] === PRECEDENCE[token.value] && !RIGHT_ASSOCIATIVE.has(token.value);
        if (higher || equal) output.push(stack.pop()!);
        else break;
      }
      stack.push(token);
    } else if (token.value === "(") {
      stack.push(token);
    } else {
      // ")"
      while (stack.length && !(stack[stack.length - 1].type === "paren")) output.push(stack.pop()!);
      if (!stack.length) throw new Error("Mismatched parentheses.");
      stack.pop(); // discard "("
      if (stack.length && stack[stack.length - 1].type === "func") output.push(stack.pop()!);
    }
  }
  while (stack.length) {
    const token = stack.pop()!;
    if (token.type === "paren") throw new Error("Mismatched parentheses.");
    output.push(token);
  }
  return output;
}

function evalRpn(rpn: Token[]): number {
  const stack: number[] = [];
  for (const token of rpn) {
    if (token.type === "num") stack.push(token.value);
    else if (token.type === "const") stack.push(CONSTANTS[token.value]);
    else if (token.type === "func") {
      const fn = FUNCTIONS[token.value];
      const arity = fn.length || 1;
      const args = stack.splice(-arity);
      if (args.length < arity) throw new Error(`"${token.value}" needs ${arity} argument(s).`);
      stack.push(fn(...args));
    } else if (token.type === "op") {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error("Malformed expression.");
      stack.push(applyOp(token.value, a, b));
    }
  }
  if (stack.length !== 1) throw new Error("Malformed expression.");
  return stack[0];
}

function applyOp(op: string, a: number, b: number): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/":
      if (b === 0) throw new Error("Division by zero.");
      return a / b;
    case "%": return a % b;
    case "^": return a ** b;
    default: throw new Error(`Unknown operator "${op}".`);
  }
}

export function evaluateExpression(expression: string): number {
  if (!expression.trim()) throw new Error("Empty expression.");
  const result = evalRpn(toRpn(tokenize(expression)));
  if (!Number.isFinite(result)) throw new Error("Result is not a finite number.");
  return result;
}

/** Trims floating-point noise and adds thousands separators. */
export function formatResult(value: number): string {
  const rounded = Math.round(value * 1e10) / 1e10;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 10 });
}
