import { test } from "node:test";
import assert from "node:assert/strict";
import { detectFile } from "../scan.js";

async function rulesAt(file: string, src: string): Promise<string[]> {
  return (await detectFile(file, src)).map((c) => c.rule + "@" + c.line + ":" + c.column);
}

test("json-deep-clone reports the exact position", async () => {
  const src = "const a = 1;\n  const b = JSON.parse(JSON.stringify(a));\n";
  assert.deepEqual(await rulesAt("a.js", src), ["json-deep-clone@2:13"]);
});

test("json-deep-clone ignores a plain JSON.parse", async () => {
  assert.deepEqual(await rulesAt("a.js", "const x = JSON.parse(text);\nconst y = JSON.stringify(x);\n"), []);
});

test("xhr reports new XMLHttpRequest and ignores a lookalike", async () => {
  assert.deepEqual(await rulesAt("a.js", "const r = new XMLHttpRequest();\n"), ["xhr@1:11"]);
  assert.deepEqual(await rulesAt("a.js", "const r = new MyXMLHttpRequest();\nXMLHttpRequest;\n"), []);
});

test("hasown-call covers prototype and empty-object forms, not other receivers", async () => {
  const src = [
    "Object.prototype.hasOwnProperty.call(o, 'k');",
    "({}).hasOwnProperty.call(o, 'k');",
    "o.hasOwnProperty.call(o, 'k');",
    "Object.hasOwn(o, 'k');",
    "",
  ].join("\n");
  assert.deepEqual(await rulesAt("a.js", src), ["hasown-call@1:1", "hasown-call@2:1"]);
});

test("array-last-index needs the same simple object expression", async () => {
  const positive = "const l = items[items.length - 1];\nconst m = a.b.c[a.b.c.length - 1];\n";
  assert.deepEqual(await rulesAt("a.js", positive), ["array-last-index@1:11", "array-last-index@2:11"]);
  const negative = [
    "const x = a[b.length - 1];",
    "const y = a[a.length - 2];",
    "const z = get()[get().length - 1];",
    "a[a.length - 1] = 0;",
    "",
  ].join("\n");
  assert.deepEqual(await rulesAt("a.js", negative), []);
});

test("array-last-index skips array-like objects that have no .at()", async () => {
  const src = [
    "const a = el.children[el.children.length - 1];",
    "const b = this.root.childNodes[this.root.childNodes.length - 1];",
    "function f() { return arguments[arguments.length - 1]; }",
    "const items = document.querySelectorAll('li');",
    "const c = items[items.length - 1];",
    "const tags = (document.getElementsByTagName('p') as any);",
    "const d = tags[tags.length - 1];",
    "const n = document.getElementsByClassName('x')!;",
    "const n1 = n[n.length - 1];",
    "const m = (root.getElementsByName('q')! as any);",
    "const m1 = m[m.length - 1];",
    "",
  ].join("\n");
  assert.deepEqual(await rulesAt("a.ts", src), []);
  const still = "const arr = [1, 2];\nconst z = arr[arr.length - 1];\nconst l = a.b.c[a.b.c.length - 1];\n";
  assert.deepEqual(await rulesAt("a.ts", still), ["array-last-index@2:11", "array-last-index@3:11"]);
});

test("scroll-listener only matches the scroll event", async () => {
  assert.deepEqual(await rulesAt("a.js", "window.addEventListener('scroll', f);\n"), ["scroll-listener@1:1"]);
  assert.deepEqual(await rulesAt("a.js", "window.addEventListener('click', f);\nel.addEventListener(name, f);\n"), []);
});

test("TSX with type annotations parses and finds both JS and JSX rules", async () => {
  const src = [
    "type P = { items: string[] };",
    "export function M({ items }: P) {",
    "  const c: P = JSON.parse(JSON.stringify({ items }));",
    "  return <div role=\"dialog\">{c.items.length}</div>;",
    "}",
    "",
  ].join("\n");
  assert.deepEqual(await rulesAt("m.tsx", src), ["json-deep-clone@3:16", "div-dialog@4:10"]);
});

test("TS-only syntax (generics, as, non-null) parses in .ts", async () => {
  const src = "const v = (JSON.parse(JSON.stringify(x as Foo)) as Foo)!;\nfunction f<T>(a: T[]): T { return a[a.length - 1]!; }\n";
  const found = await rulesAt("a.ts", src);
  assert.ok(found.some((r) => r.startsWith("json-deep-clone")));
  assert.ok(found.some((r) => r.startsWith("array-last-index")));
});

test("markup rules on JSX: div role, img data-src, accordion", async () => {
  const src = [
    "export const A = () => (",
    "  <>",
    "    <div role=\"dialog\" />",
    "    <div role=\"alertdialog\" />",
    "    <div role=\"button\" />",
    "    <img data-src=\"a.png\" />",
    "    <img loading=\"lazy\" data-src=\"a.png\" />",
    "    <img {...props} data-src=\"a.png\" />",
    "    <div className=\"faq-accordion\" onClick={toggle} />",
    "    <div className=\"faq-accordion\" />",
    "    <Dialog role=\"dialog\" />",
    "  </>",
    ");",
    "",
  ].join("\n");
  assert.deepEqual(await rulesAt("a.jsx", src), [
    "div-dialog@3:5",
    "div-dialog@4:5",
    "img-data-src@6:5",
    "js-accordion@9:5",
  ]);
});

test("a syntax error rejects instead of crashing the process", async () => {
  await assert.rejects(detectFile("bad.js", "const = ;\n"));
});
