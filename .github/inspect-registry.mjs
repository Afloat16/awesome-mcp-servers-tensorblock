import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { generateClientConfig } from '../packages/config-generator/src/generateConfig.ts';

const catalog = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
const group = new Map();
const fallback = [];
for (const entry of catalog) {
  const config = generateClientConfig(entry, 'cursor').config.mcpServers[entry.id];
  for (const command of entry.install.commands) {
    const binary = command.trim().split(/\s+/)[0];
    const row = group.get(binary) ?? { binary, count: 0, placeholders: 0, examples: [] };
    row.count += 1;
    if (config.command === '<command>') {
      row.placeholders += 1;
      if (row.examples.length < 3) row.examples.push({ id: entry.id, command });
    }
    group.set(binary, row);
  }
  if (config.command === '<command>' && entry.install.commands.some(command => /^(uv\s+run|deno\s+run|bunx?\s|\/.*(?:node|python))/.test(command))) {
    fallback.push({ id: entry.id, commands: entry.install.commands, description: entry.description });
  }
}
const lostLaunchers = catalog.filter(entry => /`(?:uv run|deno run|bunx? )/.test(entry.description)
  && !entry.install.commands.some(command => /^(?:uv run|deno run|bunx? )/.test(command)));
const codeHostEndpoints = catalog.filter(entry => entry.links.endpoint && /^https?:\/\/(?:www\.)?(?:github\.com|gitlab\.com|bitbucket\.org)\//.test(entry.links.endpoint));
const punctuatedToolCounts = catalog.filter(entry => /\b\d{1,3}(?:,\d{3})+\s+(?:MCP\s+)?tools?\b/i.test(entry.description));
const licenseSuffixes = catalog.filter(entry => /\b(?:A?GPL|LGPL)-\d\.\d-(?:or-later|only)\b/i.test(entry.description));
const ids = new Map();
const duplicateMetadataIds = [];
for (const file of readdirSync('data/server-metadata').filter(x => x.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(`data/server-metadata/${file}`, 'utf8'));
  const id = data.id ?? file.slice(0, -5);
  if (ids.has(id)) duplicateMetadataIds.push({ id, first: ids.get(id), second: file });
  ids.set(id, file);
}
const report = {
  entries: catalog.length,
  commandGroups: [...group.values()].sort((a, b) => b.count - a.count),
  fallback,
  lostLaunchers: lostLaunchers.map(entry => ({ id: entry.id, description: entry.description, commands: entry.install.commands })),
  codeHostEndpoints: codeHostEndpoints.map(entry => ({ id: entry.id, endpoint: entry.links.endpoint, commands: entry.install.commands })),
  punctuatedToolCounts: punctuatedToolCounts.map(entry => ({ id: entry.id, description: entry.description, count: entry.tools.count })),
  licenseSuffixes: licenseSuffixes.map(entry => ({ id: entry.id, description: entry.description, license: entry.license })),
  duplicateMetadataIds,
};
writeFileSync('inspection.json', JSON.stringify(report, null, 2));
for (const [key, values] of Object.entries(report)) {
  console.log(JSON.stringify({ key, count: Array.isArray(values) ? values.length : values, sample: Array.isArray(values) ? values.slice(0, key === 'commandGroups' ? 35 : 12) : undefined }));
}
