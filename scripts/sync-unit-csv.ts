import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAUL_CARDS, ROMAN_CARDS } from '../src/cards.ts';
import type { CardDefinition } from '../src/types.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const dataDir = join(root, 'data');
const check = process.argv.includes('--check');

function csv(cards: readonly CardDefinition[]): string {
  const rows = [
    ['id', 'nazwa', 'atak', 'zycie', 'koszt', 'opis'],
    ...cards.filter(card => card.kind === 'unit').map(card => [
      card.id, card.name, card.attack, card.health, card.cost, card.text,
    ]),
  ];
  return rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n') + '\n';
}

let stale = false;
for (const [filename, cards] of [
  ['galowie-jednostki.csv', GAUL_CARDS],
  ['rzymianie-jednostki.csv', ROMAN_CARDS],
] as const) {
  const path = join(dataDir, filename);
  const expected = csv(cards);
  if (check) {
    const actual = await readFile(path, 'utf8').catch(() => '');
    if (actual !== expected) {
      console.error(`Nieaktualny plik ${filename}. Uruchom: npm run cards:csv`);
      stale = true;
    }
  } else {
    await mkdir(dataDir, { recursive: true });
    await writeFile(path, expected);
    console.log(`Zaktualizowano ${filename}`);
  }
}
if (stale) process.exitCode = 1;
