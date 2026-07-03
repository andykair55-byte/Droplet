import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const RULES_DIR = join(__dirname, '..', 'rules');
const OUTPUT_FILE = join(RULES_DIR, 'merged-patterns.json');

// 构建时只合并指定语言，其余语言文件保留在 rules/ 但不打入 dist
// 后续社区扩展时修改此数组即可
const MERGE_LANGS = ['zh', 'en'];

async function main() {
  const entries = await readdir(RULES_DIR);
  const allPatternFiles = entries.filter(f => f.endsWith('-patterns.json')).sort();
  const patternFiles = allPatternFiles.filter(f =>
    MERGE_LANGS.some(lang => f === `${lang}-patterns.json`)
  );

  if (patternFiles.length === 0) {
    console.error('No *-patterns.json files found in rules/');
    process.exit(1);
  }

  console.log(`Found ${patternFiles.length}/${allPatternFiles.length} pattern files to merge (langs: ${MERGE_LANGS.join(', ')}):\n  ${patternFiles.join('\n  ')}\n`);

  // Accumulators
  const hardSet = new Set();
  const softMap = new Map();       // key: lowercase word, value: original entry
  const regexSet = new Set();
  const variantMap = new Map();    // key: from field, value: entry
  const pinyinMap = new Map();     // key: pinyin, value: entry (last wins)

  for (const file of patternFiles) {
    const raw = await readFile(join(RULES_DIR, file), 'utf-8');
    const data = JSON.parse(raw);

    // hard_keywords: string[]
    if (Array.isArray(data.hard_keywords)) {
      for (const kw of data.hard_keywords) {
        hardSet.add(kw.toLowerCase());
      }
    }

    // soft_keywords: string[] | object[]
    if (Array.isArray(data.soft_keywords)) {
      for (const entry of data.soft_keywords) {
        if (typeof entry === 'string') {
          softMap.set(entry.toLowerCase(), entry);
        } else if (entry && typeof entry === 'object') {
          const key = (entry.word || entry.keyword || entry.key || JSON.stringify(entry)).toLowerCase();
          softMap.set(key, entry);
        }
      }
    }

    // regex_patterns: string[]
    if (Array.isArray(data.regex_patterns)) {
      for (const pat of data.regex_patterns) {
        regexSet.add(pat);
      }
    }

    // variant_map: object[]
    if (Array.isArray(data.variant_map)) {
      for (const entry of data.variant_map) {
        if (entry && entry.from != null) {
          variantMap.set(String(entry.from), entry);
        }
      }
    }

    // pinyin_map: object[]
    if (Array.isArray(data.pinyin_map)) {
      for (const entry of data.pinyin_map) {
        if (entry && entry.pinyin != null) {
          pinyinMap.set(String(entry.pinyin), entry);
        }
      }
    }
  }

  const merged = {
    hard_keywords: [...hardSet],
    soft_keywords: [...softMap.values()],
    regex_patterns: [...regexSet],
    variant_map: [...variantMap.values()],
    pinyin_map: [...pinyinMap.values()],
  };

  // Delete existing output file if present
  try {
    await unlink(OUTPUT_FILE);
  } catch {
    // File doesn't exist, fine
  }

  await writeFile(OUTPUT_FILE, JSON.stringify(merged, null, 2) + '\n', 'utf-8');

  console.log('Merge complete! Statistics:');
  console.log(`  hard_keywords:  ${merged.hard_keywords.length}`);
  console.log(`  soft_keywords:  ${merged.soft_keywords.length}`);
  console.log(`  regex_patterns: ${merged.regex_patterns.length}`);
  console.log(`  variant_map:    ${merged.variant_map.length}`);
  console.log(`  pinyin_map:     ${merged.pinyin_map.length}`);
  console.log(`\nOutput: ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Merge failed:', err);
  process.exit(1);
});
