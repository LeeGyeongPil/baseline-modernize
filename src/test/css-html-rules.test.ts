import { test } from "node:test";
import assert from "node:assert/strict";
import { loadData, resolveFeatureIds } from "../baseline/data.js";
import { PREFIX_WHITELIST } from "../rules/css.js";
import { detectFile } from "../scan.js";

async function rulesAt(file: string, src: string): Promise<string[]> {
  return (await detectFile(file, src)).map((c) => c.rule + "@" + c.line + ":" + c.column);
}

test("unneeded-prefix flags whitelisted prefixes only", async () => {
  const css = ".a {\n  -webkit-appearance: none;\n  -webkit-line-clamp: 3;\n  -webkit-text-size-adjust: 100%;\n  -moz-box-shadow: 0 0 1px red;\n}\n";
  assert.deepEqual(await rulesAt("a.css", css), ["unneeded-prefix@2:3", "unneeded-prefix@5:3"]);
});

test("every prefix whitelist entry maps to a feature id present in data", () => {
  const data = loadData();
  for (const [prop, entry] of Object.entries(PREFIX_WHITELIST)) {
    assert.ok(prop.startsWith("-"), prop);
    assert.ok(resolveFeatureIds(entry.featureId, data).length > 0, prop + " -> " + entry.featureId);
  }
});

test("padding-hack-ratio matches 16:9 and 4:3 and nothing else", async () => {
  const css = ".a { padding-top: 56.25%; }\n.b { padding-bottom: 75%; }\n.c { padding-top: 50%; }\n.d { margin-top: 56.25%; }\n";
  assert.deepEqual(await rulesAt("a.css", css), ["padding-hack-ratio@1:6", "padding-hack-ratio@2:6"]);
});

test("owl-spacing needs a margin inside a '* + *' rule", async () => {
  const positive = ".stack > * + * { margin-top: 1rem; }\n* + * { margin-left: 4px; }\n";
  assert.deepEqual(await rulesAt("a.css", positive), ["owl-spacing@1:1", "owl-spacing@2:1"]);
  const negative = ".stack > * + * { padding-top: 1rem; }\n.a + .b { margin-top: 1rem; }\n";
  assert.deepEqual(await rulesAt("a.css", negative), []);
});

test("discouraged clip and color-adjust take their replacements from the data", async () => {
  const css = ".sr { clip: rect(0 0 0 0); }\n.p { color-adjust: exact; print-color-adjust: exact; }\n";
  assert.deepEqual(await rulesAt("a.css", css), ["discouraged-clip@1:7", "discouraged-color-adjust@2:6"]);
  assert.deepEqual(loadData().features["clip"]?.alternatives, ["clip-path"]);
  assert.deepEqual(loadData().features["color-adjust"]?.alternatives, ["print-color-adjust"]);
});

test("a CSS syntax error is rejected", async () => {
  await assert.rejects(detectFile("bad.css", ".a { color: red;\n.b {"));
});

test("HTML: div-dialog, img-data-src and js-accordion with negatives", async () => {
  const html = [
    "<!doctype html>",
    "<html><body>",
    "<div role=\"dialog\">x</div>",
    "<div role=\"button\">x</div>",
    "<img data-src=\"a.png\">",
    "<img data-src=\"a.png\" loading=\"lazy\">",
    "<img src=\"a.png\">",
    "<div class=\"accordion\" onclick=\"t()\">q</div>",
    "<div class=\"accordion\">q</div>",
    "<template><div role=\"dialog\"></div></template>",
    "</body></html>",
    "",
  ].join("\n");
  assert.deepEqual(await rulesAt("a.html", html), [
    "div-dialog@3:1",
    "img-data-src@5:1",
    "js-accordion@8:1",
    "div-dialog@10:11",
  ]);
});

test("HTML: inline <script> and <style> are checked at their original line and column", async () => {
  const html = [
    "<!doctype html>",
    "<html><head>",
    "<style>.a{-webkit-border-radius:4px}",
    ".b {",
    "  -webkit-appearance: none;",
    "}</style>",
    "</head><body>",
    "  <script>new XMLHttpRequest();",
    "    const x = JSON.parse(JSON.stringify(y));</script>",
    "</body></html>",
    "",
  ].join("\n");
  const got = await rulesAt("a.html", html);
  assert.ok(got.includes("unneeded-prefix@3:11"), got.join());
  assert.ok(got.includes("unneeded-prefix@5:3"), got.join());
  assert.ok(got.includes("xhr@8:11"), got.join());
  assert.ok(got.includes("json-deep-clone@9:15"), got.join());
});

test("HTML: scripts with src or a non-JS type are skipped", async () => {
  const html = [
    "<script src=\"a.js\">new XMLHttpRequest()</script>",
    "<script type=\"application/json\">{\"a\": 1}</script>",
    "<script type=\"text/template\">new XMLHttpRequest()</script>",
    "<script type=\"module\">new XMLHttpRequest()</script>",
    "",
  ].join("\n");
  assert.deepEqual(await rulesAt("a.html", html), ["xhr@4:23"]);
});

test("HTML: a broken inline block is skipped without dropping the rest of the file", async () => {
  const html = [
    "<div role=\"dialog\">x</div>",
    "<script>function (</script>",
    "<style>.a { color: red;\n.b {</style>",
    "<script>new XMLHttpRequest()</script>",
    "",
  ].join("\n");
  assert.deepEqual(await rulesAt("a.html", html), ["div-dialog@1:1", "xhr@5:9"]);
});
