/**
 * merge-patterns.mjs — 合并所有语言规则文件为一个 merged-patterns.json
 *
 * 用法: node scripts/merge-patterns.mjs
 * 构建前自动运行，合并 rules/*-patterns.json 到 rules/merged-patterns.json
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES_DIR = join(__dirname, '..', 'rules');
const OUTPUT = join(RULES_DIR, 'merged-patterns.json');

const files = readdirSync(RULES_DIR)
  .filter(f => f.endsWith('-patterns.json') && f !== 'merged-patterns.json')
  .sort();

const merged = {
  hard_keywords: [],
  soft_keywords: [],
  regex_patterns: [],
  variant_map: [],
  pinyin_map: {},
};

let totalFiles = 0;
let totalHard = 0;
let totalSoft = 0;

for (const file of files) {
  try {
    const data = JSON.parse(readFileSync(join(RULES_DIR, file), 'utf8'));
    const lang = file.replace('-patterns.json', '');

    if (data.hard_keywords?.length) {
      merged.hard_keywords.push(...data.hard_keywords);
      totalHard += data.hard_keywords.length;
    }
    if (data.soft_keywords?.length) {
      merged.soft_keywords.push(...data.soft_keywords);
      totalSoft += data.soft_keywords.length;
    }
    if (data.regex_patterns?.length) {
      merged.regex_patterns.push(...data.regex_patterns);
    }
    if (data.variant_map?.length) {
      merged.variant_map.push(...data.variant_map);
    }
    if (data.pinyin_map && Object.keys(data.pinyin_map).length > 0) {
      Object.assign(merged.pinyin_map, data.pinyin_map);
    }

    totalFiles++;
  } catch (e) {
    console.warn(`  ⚠ Failed to parse ${file}: ${e.message}`);
  }
}

// 去重
merged.hard_keywords = [...new Set(merged.hard_keywords)];
merged.soft_keywords = [...new Set(merged.soft_keywords)];
merged.regex_patterns = [...new Set(merged.regex_patterns)];

writeFileSync(OUTPUT, JSON.stringify(merged, null, 2) + '\n');

console.log(`✓ Merged ${totalFiles} language files → ${OUTPUT}`);
console.log(`  hard_keywords: ${merged.hard_keywords.length} (deduplicated from ${totalHard})`);
console.log(`  soft_keywords: ${merged.soft_keywords.length} (deduplicated from ${totalSoft})`);
console.log(`  regex_patterns: ${merged.regex_patterns.length}`);
console.log(`  variant_map: ${merged.variant_map.length}`);
console.log(`  pinyin_map: ${Object.keys(merged.pinyin_map).length} keys`);
