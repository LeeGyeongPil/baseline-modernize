import type { Candidate } from "../types.js";
import { walk, type AstNode, type ParsedJs } from "../parsers/js.js";
import { normalizeSnippet } from "../parsers/lines.js";

// --- small AST helpers -------------------------------------------------------

const asNode = (v: unknown): AstNode | undefined =>
  typeof v === "object" && v !== null && typeof (v as AstNode).type === "string" ? (v as AstNode) : undefined;

/** Name of a non-computed member property (`a.b` -> "b"), or of `a["b"]`. */
function propName(member: AstNode): string | undefined {
  const prop = asNode(member.property);
  if (!prop) return undefined;
  if (!member.computed && prop.type === "Identifier") return prop.name as string;
  if (member.computed && prop.type === "Literal" && typeof prop.value === "string") return prop.value;
  return undefined;
}

const isIdent = (n: AstNode | undefined, name: string): boolean => n?.type === "Identifier" && n.name === name;

/** True for `obj.prop` where obj is the identifier `objName`. */
function isMemberOf(n: AstNode | undefined, objName: string, prop: string): boolean {
  return n?.type === "MemberExpression" && isIdent(asNode(n.object), objName) && propName(n) === prop;
}

/** Strip `(x)`, `x!`, `x as T` wrappers that do not change runtime behaviour. */
function unwrap(n: AstNode | undefined): AstNode | undefined {
  let cur = n;
  while (cur && (cur.type === "TSNonNullExpression" || cur.type === "TSAsExpression" || cur.type === "ParenthesizedExpression")) {
    cur = asNode(cur.expression);
  }
  return cur;
}

/** Only plain identifier/member chains are safe to compare textually (no calls). */
function isSimpleChain(n: AstNode | undefined): boolean {
  const cur = unwrap(n);
  if (!cur) return false;
  if (cur.type === "Identifier" || cur.type === "ThisExpression") return true;
  if (cur.type === "MemberExpression") {
    const prop = asNode(cur.property);
    const keyOk = !cur.computed || prop?.type === "Literal";
    return keyOk && isSimpleChain(asNode(cur.object));
  }
  return false;
}

// --- detection ---------------------------------------------------------------

export function detectJs(parsed: ParsedJs, file: string): Candidate[] {
  const { program, src, lines } = parsed;
  const out: Candidate[] = [];
  const add = (rule: string, node: AstNode): void => {
    const pos = lines.position(node.start);
    out.push({ rule, file, line: pos.line, column: pos.column, snippet: normalizeSnippet(src.slice(node.start, node.end)) });
  };
  const text = (n: AstNode): string => src.slice(n.start, n.end);

  walk(program, (node, parent) => {
    if (node.type === "CallExpression") {
      const callee = unwrap(asNode(node.callee));
      const args = (node.arguments as unknown[]).map(asNode);

      // JSON.parse(JSON.stringify(x))
      if (callee && isMemberOf(callee, "JSON", "parse") && args.length === 1) {
        const inner = unwrap(args[0]);
        const innerCallee = unwrap(asNode(inner?.callee));
        if (inner?.type === "CallExpression" && innerCallee && isMemberOf(innerCallee, "JSON", "stringify")) {
          add("json-deep-clone", node);
        }
      }

      // Object.prototype.hasOwnProperty.call(o, k) and {}.hasOwnProperty.call(o, k)
      if (callee?.type === "MemberExpression" && propName(callee) === "call") {
        const target = unwrap(asNode(callee.object));
        if (target?.type === "MemberExpression" && propName(target) === "hasOwnProperty") {
          const holder = unwrap(asNode(target.object));
          const isProto = holder?.type === "MemberExpression" && isIdent(asNode(holder.object), "Object") && propName(holder) === "prototype";
          const isEmptyObject = holder?.type === "ObjectExpression" && (holder.properties as unknown[]).length === 0;
          if (isProto || isEmptyObject) add("hasown-call", node);
        }
      }

      // addEventListener("scroll", ...)
      if (callee?.type === "MemberExpression" && propName(callee) === "addEventListener") {
        const first = args[0];
        if (first?.type === "Literal" && first.value === "scroll") add("scroll-listener", node);
      }
    }

    if (node.type === "NewExpression") {
      const callee = unwrap(asNode(node.callee));
      if (isIdent(callee, "XMLHttpRequest")) add("xhr", node);
    }

    // a[a.length - 1]
    if (node.type === "MemberExpression" && node.computed) {
      const prop = unwrap(asNode(node.property));
      if (prop?.type === "BinaryExpression" && prop.operator === "-") {
        const right = asNode(prop.right);
        const left = unwrap(asNode(prop.left));
        if (right?.type === "Literal" && right.value === 1 && left?.type === "MemberExpression" && propName(left) === "length") {
          const obj = asNode(node.object);
          const lenObj = asNode(left.object);
          if (obj && lenObj && isSimpleChain(obj) && text(obj) === text(lenObj) && !isWriteTarget(node, parent)) {
            add("array-last-index", node);
          }
        }
      }
    }
  });
  return out;
}

/** `a[a.length - 1] = x`, `a[...]++`, `delete a[...]` cannot be rewritten with .at(). */
function isWriteTarget(node: AstNode, parent: AstNode | null): boolean {
  if (!parent) return false;
  if (parent.type === "AssignmentExpression" && parent.left === node) return true;
  if (parent.type === "UpdateExpression") return true;
  if (parent.type === "UnaryExpression" && parent.operator === "delete") return true;
  return false;
}
