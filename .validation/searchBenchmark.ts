import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { searchCatalog } from "./packages/registry-api/src/search.js";
import type { CatalogEntry } from "./packages/catalog-builder/src/types.js";

const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8")) as CatalogEntry[];
const digest = createHash("sha256");
const results = [];
for (const query of ["", "mcp", "search", "postgres", "search mcp"]) {
  for (const limit of [1, 5, 25, 100]) {
    const filters = { query, limit };
    const expected = searchCatalog(catalog, filters);
    digest.update(JSON.stringify(expected));
    for (let warm = 0; warm < 5; warm += 1) searchCatalog(catalog, filters);
    const milliseconds = [];
    for (let sample = 0; sample < 5; sample += 1) {
      const start = performance.now();
      for (let iteration = 0; iteration < 10; iteration += 1) searchCatalog(catalog, filters);
      milliseconds.push((performance.now() - start) / 10);
    }
    milliseconds.sort((left, right) => left - right);
    results.push({ query, limit, medianMilliseconds: milliseconds[2], returned: expected.length });
  }
}
const result = { phase: process.argv[2], entries: catalog.length, resultSha256: digest.digest("hex"), results };
writeFileSync(`search-benchmark-${result.phase}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
