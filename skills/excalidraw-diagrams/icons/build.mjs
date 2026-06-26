#!/usr/bin/env node
// Maintenance tool (run by hand, NOT at skill runtime). Builds the bundled icon set:
//   - tech/stack logos from devicon (github devicons/devicon), full color, variant
//     auto-picked from devicon.json
//   - generic shapes from lucide-static (ISC), tinted neutral slate
//   - social sign-in marks from simple-icons (CC0), tinted brand color
// Writes <name>.svg + manifest.json + NOTICE.md + ../references/icons.md (the table).
//
//   node build.mjs               # rebuild the curated set
//   node build.mjs --add <name>  # also bundle one extra devicon tech by name
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REFS = join(HERE, "..", "references");
const GENERIC_COLOR = "#343a40";

// Curated popular tech (devicon slugs), grouped into clean categories for the lookup
// table. The long tail (578 total) can be added with `node build.mjs --add <slug>`.
const DEVICON_CATS = {
  Languages: ["javascript","typescript","python","java","kotlin","swift","go","rust","ruby","php","csharp","cplusplus","c","dart","scala","elixir","lua","bash"],
  Frontend: ["react","vuejs","angular","svelte","nextjs","nuxtjs","tailwindcss","bootstrap","html5","css3","redux","threejs"],
  Backend: ["nodejs","express","nestjs","django","flask","fastapi","spring","rails","laravel","dotnetcore","graphql"],
  Mobile: ["flutter","android"],
  Databases: ["postgresql","mysql","mongodb","redis","sqlite","mariadb","cassandra","elasticsearch","neo4j"],
  Messaging: ["rabbitmq","apachekafka"],
  Cloud: ["amazonwebservices","googlecloud","azure","digitalocean","heroku","vercel","cloudflare"],
  DevOps: ["docker","kubernetes","terraform","ansible","jenkins","nginx","apache","grafana","prometheus"],
  Tools: ["git","github","gitlab","bitbucket","figma","postman","vscode"],
  OS: ["linux","ubuntu","debian"],
};
const DEVICON = Object.values(DEVICON_CATS).flat();
const CATEGORY_OF = Object.fromEntries(Object.entries(DEVICON_CATS).flatMap(([cat, names]) => names.map((n) => [n, cat])));

// generic non-brand shapes (lucide slug)
const GENERIC = {
  server: "server", database: "database", mobile: "smartphone", web: "monitor",
  shield: "shield", key: "key", gateway: "network", queue: "list", cloud: "cloud",
  globe: "globe", user: "user", bell: "bell", cache: "zap", lock: "lock", api: "braces",
  map: "map", pin: "map-pin",
};

// social sign-in marks (simple-icons slug + brand hex) — better than devicon for auth UIs
const SOCIAL = {
  apple: { slug: "apple", color: "#000000" },
  google: { slug: "google", color: "#4285F4" },
  facebook: { slug: "facebook", color: "#1877F2" },
};

// common SaaS not in devicon (simple-icons slug + brand hex)
const SERVICES = {
  stripe: { slug: "stripe", color: "#635BFF" },
  paypal: { slug: "paypal", color: "#003087" },
  twilio: { slug: "twilio", color: "#F22F46" },
  sendgrid: { slug: "sendgrid", color: "#1A82E2" },
  openai: { slug: "openai", color: "#412991" },
};

// hand aliases -> canonical name
const ALIASES = {
  js: "javascript", ts: "typescript", py: "python", golang: "go", node: "nodejs",
  vue: "vuejs", next: "nextjs", nuxt: "nuxtjs", tailwind: "tailwindcss", postgres: "postgresql",
  mongo: "mongodb", k8s: "kubernetes", aws: "amazonwebservices", gcp: "googlecloud",
  kafka: "apachekafka", "dotnet": "dotnetcore", rn: "react", maps: "map", location: "pin",
};

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

function pickVariant(versions) {
  const svg = (versions && versions.svg) || [];
  const noWord = svg.filter((v) => !v.includes("wordmark"));
  for (const pref of ["original", "plain", "line"]) if (noWord.includes(pref)) return pref;
  return noWord[0] || svg[0] || "original";
}

const args = process.argv.slice(2);
const addIdx = args.indexOf("--add");
const extra = addIdx >= 0 ? args.slice(addIdx + 1) : [];
const devNames = [...new Set([...DEVICON, ...extra])];

mkdirSync(HERE, { recursive: true });
const manifest = {};

// devicon.json drives variant selection + tags (categories) for the table
const index = JSON.parse(await fetchText("https://cdn.jsdelivr.net/gh/devicons/devicon/devicon.json"));
const byName = new Map(index.map((e) => [e.name, e]));

for (const name of devNames) {
  const entry = byName.get(name);
  if (!entry) { console.error(`skip devicon "${name}" — not in index`); continue; }
  const variant = pickVariant(entry.versions);
  const svg = await fetchText(`https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${name}/${name}-${variant}.svg`);
  writeFileSync(`${HERE}/${name}.svg`, svg.trim() + "\n");
  manifest[name] = { file: `${name}.svg`, source: "devicon", license: "MIT", tags: [CATEGORY_OF[name] || "Tools"] };
  console.log("devicon", name, variant);
}

for (const [name, slug] of Object.entries(GENERIC)) {
  let svg = await fetchText(`https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${slug}.svg`);
  svg = svg.replace(/stroke="currentColor"/g, `stroke="${GENERIC_COLOR}"`);
  writeFileSync(`${HERE}/${name}.svg`, svg.trim() + "\n");
  manifest[name] = { file: `${name}.svg`, source: "lucide", license: "ISC", tags: ["Generic"] };
  console.log("lucide", name);
}

for (const [name, { slug, color }] of Object.entries(SOCIAL)) {
  let svg = await fetchText(`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`);
  svg = svg.replace(/<svg /, `<svg fill="${color}" `);
  writeFileSync(`${HERE}/${name}.svg`, svg.trim() + "\n");
  manifest[name] = { file: `${name}.svg`, source: "simple-icons", license: "CC0-1.0", tags: ["Social"] };
  console.log("simple-icons", name);
}

for (const [name, { slug, color }] of Object.entries(SERVICES)) {
  let svg = await fetchText(`https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${slug}.svg`);
  svg = svg.replace(/<svg /, `<svg fill="${color}" `);
  writeFileSync(`${HERE}/${name}.svg`, svg.trim() + "\n");
  manifest[name] = { file: `${name}.svg`, source: "simple-icons", license: "CC0-1.0", tags: ["Services"] };
  console.log("simple-icons", name);
}

// aliases reference existing files
for (const [alias, target] of Object.entries(ALIASES)) {
  if (manifest[target]) manifest[alias] = { file: manifest[target].file, alias: target };
}

writeFileSync(`${HERE}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
console.log("manifest.json:", Object.keys(manifest).length, "names");

// NOTICE
writeFileSync(`${HERE}/NOTICE.md`, `# Bundled icons — sources & licenses

Regenerate with \`node build.mjs\`; add one tech with \`node build.mjs --add <name>\`.

- **Tech/stack logos** — [Devicon](https://devicon.dev) (github.com/devicons/devicon), **MIT**.
  Full-color logos for languages, frameworks, databases, clouds, and tools; the variant is
  auto-picked from \`devicon.json\`. 578 techs are available; this bundle ships a popular subset.
- **Generic shapes** — [Lucide](https://lucide.dev), **ISC** (MIT-equivalent), tinted slate.
- **Social sign-in marks** — [Simple Icons](https://simpleicons.org), **CC0-1.0**, tinted brand color.

Brand logos remain trademarks of their owners; they are used nominatively to label the
corresponding service in a diagram. Respect each brand's guidelines when sharing publicly.
`);

// references/icons.md — the lookup table, grouped by devicon tags
mkdirSync(REFS, { recursive: true });
const groups = {};
for (const [name, m] of Object.entries(manifest)) {
  if (m.alias) continue;
  const tag = (m.tags && m.tags[0]) || "Tools";
  (groups[tag] ||= []).push(name);
}
const ORDER = [...Object.keys(DEVICON_CATS), "Services", "Generic", "Social"];
const aliasLines = Object.entries(manifest).filter(([, m]) => m.alias).map(([a, m]) => `\`${a}\`→\`${m.alias}\``);
let md = `# Icon names (use as \`"icon": "<name>"\`)

Bundled, offline. Add any other devicon tech with \`node icons/build.mjs --add <slug>\`
(full list: https://devicon.dev). Generic shapes and social marks below are not brand logos.

`;
for (const tag of ORDER) {
  const names = groups[tag];
  if (!names) continue;
  md += `**${tag}** — ${names.sort().map((n) => `\`${n}\``).join(", ")}\n\n`;
}
md += `**Aliases** — ${aliasLines.sort().join(", ")}\n`;
writeFileSync(`${REFS}/icons.md`, md);
console.log("wrote references/icons.md");
