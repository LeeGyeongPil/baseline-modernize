// Extract the fields we need from the pinned web-features devDependency
// into data/baseline.json. Run: npm run gen:data
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { features } from "web-features";

const pkgPath = new URL("../node_modules/web-features/package.json", import.meta.url);
const version = JSON.parse(readFileSync(pkgPath, "utf8")).version;

const out = {};
for (const id of Object.keys(features).sort()) {
  const f = features[id];
  const entry = { kind: f.kind };
  if (f.kind === "feature") {
    entry.name = f.name;
    entry.baseline = f.status?.baseline ?? false;
    if (f.status?.baseline_low_date) entry.low = f.status.baseline_low_date;
    if (f.status?.baseline_high_date) entry.high = f.status.baseline_high_date;
    if (f.discouraged?.alternatives?.length) entry.alternatives = [...f.discouraged.alternatives];
  } else if (f.kind === "moved") {
    entry.redirects = [f.redirect_target];
  } else if (f.kind === "split") {
    entry.redirects = [...f.redirect_targets];
  }
  out[id] = entry;
}

mkdirSync(new URL("../data/", import.meta.url), { recursive: true });
writeFileSync(
  new URL("../data/baseline.json", import.meta.url),
  JSON.stringify({ webFeaturesVersion: version, features: out }, null, 1) + "\n",
);
console.log(`wrote data/baseline.json (web-features ${version}, ${Object.keys(out).length} ids)`);
