import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CARD_IDS, createCatalog } from './cards.ts';
import { DEFAULT_RULES, validateRules } from './engine.ts';
import { runExperiment } from './experiments.ts';
import { ENGINE_VERSION, percentage, saveReport } from './report.ts';
import { runGame, runSimulation } from './simulate.ts';
import type { BotKind, CardId, CardPatch, Catalog, GameOptions, Rules } from './types.ts';

const help = `Karcianix — symulacje i eksperymenty

npm run simulate -- --games 1000 --seed 42
npm run experiment -- --games 10000 --seed 42 --card obelix --field cost --value 5
npm run experiment -- --games 10000 --card ahigienix --field abilityEnabled --value false
npm run replay -- --seed 42
npm run replay -- --from reports/experiment-obelix-42.json --index 0

--games N            Dokładna liczba gier; w eksperymencie parzysta.
--seed N             Seed serii (uint32). Replay bez --from: seed pojedynczej gry.
--bots control,control  Opcjonalnie stałe boty. Domyślnie 4 zestawienia aggressive/control.
--card ID --field cost|attack|health|abilityEnabled --value N|true|false
--rules plik.json    Nadpisanie jawnych założeń z DEFAULT_RULES.
--max-turns N        Limit pojedynczych tur gracza; przerwanie nie jest remisem.
--out katalog        Katalog raportów, domyślnie reports.
--first 0|1          Rozpoczynający, tylko replay bez --from.
--from raport.json --index N  Odtwórz grę (indeksy od 0) z pełnymi zdarzeniami.
`;
function integer(raw: string, label: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!/^\d+$/.test(raw)) throw new Error(`${label}: oczekiwano liczby całkowitej`);
  const number = Number(raw);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) throw new Error(`Nieprawidłowe ${label}`);
  return number;
}
function parseBots(raw: string | undefined): [BotKind, BotKind] | undefined {
  if (!raw) return undefined;
  const list = raw.split(',');
  if (list.length !== 2 || list.some(x => !['random', 'aggressive', 'control'].includes(x))) throw new Error('Podaj dwa boty: random, aggressive lub control');
  return list as [BotKind, BotKind];
}
export async function main(args = process.argv.slice(2)): Promise<void> {
  const mode = args[0];
  if (!mode || mode === '--help') { console.log(help); return; }
  if (!['simulate', 'experiment', 'replay'].includes(mode)) throw new Error(`Nieznane polecenie: ${mode}`);
  const { values } = parseArgs({ args: args.slice(1), strict: true, allowPositionals: false, options: {
    games: { type: 'string' }, seed: { type: 'string' }, bots: { type: 'string' },
    card: { type: 'string' }, field: { type: 'string' }, value: { type: 'string' },
    rules: { type: 'string' }, 'max-turns': { type: 'string' }, out: { type: 'string' },
    first: { type: 'string' }, from: { type: 'string' }, index: { type: 'string' }, help: { type: 'boolean' },
  } });
  if (values.help) { console.log(help); return; }
  const allowed = mode === 'simulate' ? ['games', 'seed', 'bots', 'rules', 'max-turns', 'out'] :
    mode === 'experiment' ? ['games', 'seed', 'bots', 'rules', 'max-turns', 'out', 'card', 'field', 'value'] :
    values.from ? ['from', 'index', 'out'] : ['seed', 'bots', 'rules', 'max-turns', 'out', 'first'];
  for (const key of Object.keys(values)) if (!allowed.includes(key)) throw new Error(`Opcja --${key} nie działa w tym trybie`);
  const seed = integer(values.seed ?? '42', 'seed', 0, 0xFFFFFFFF);
  const games = integer(values.games ?? '1000', 'games', 1);
  const bots = parseBots(values.bots);
  let ruleOverrides: Partial<Rules> = {};
  if (values.rules) {
    const input: unknown = JSON.parse(await readFile(resolve(values.rules), 'utf8'));
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Plik zasad musi zawierać obiekt JSON');
    ruleOverrides = input as Partial<Rules>;
  }
  const rules = { ...DEFAULT_RULES, ...ruleOverrides,
    ...(values['max-turns'] ? { maxTurns: integer(values['max-turns'], 'max-turns', 1) } : {}) };
  validateRules(rules);
  const out = values.out ?? 'reports';
  const onProgress = (done: number) => { if (done % 1000 === 0) console.error(`Ukończono ${done}/${games} gier`); };
  if (mode === 'replay') {
    let options: GameOptions = { seed, bots, rules, firstPlayer: integer(values.first ?? '0', 'first', 0, 1) as 0 | 1, trace: true };
    let expected: { outcome: unknown; turns: number; actions: number } | undefined;
    let replayIndex: number | undefined;
    if (values.from) {
      const report = JSON.parse(await readFile(resolve(values.from), 'utf8'));
      if (report.metadata?.engineVersion !== ENGINE_VERSION) throw new Error('Wersja raportu różni się od wersji silnika');
      const index = integer(values.index ?? '0', 'index');
      replayIndex = index;
      const game = report.games?.[index];
      if (!game) throw new Error('Nie ma gry o tym indeksie');
      const catalogInfo = report.metadata.catalogs;
      const catalogs: [Catalog, Catalog] = [catalogInfo.baseline, catalogInfo.baseline];
      if (game.variantSeat !== undefined) catalogs[game.variantSeat as 0 | 1] = catalogInfo.variant;
      options = { seed: game.seed, firstPlayer: game.firstPlayer, bots: game.bots, botSeeds: game.botSeeds,
        deckSeeds: game.deckSeeds, rules: report.metadata.rules, catalogs, trace: true };
      expected = { outcome: game.outcome, turns: game.turns, actions: game.actions };
    }
    const result = runGame({ ...options, verify: true });
    if (expected && (JSON.stringify(expected.outcome) !== JSON.stringify(result.outcome) ||
      expected.turns !== result.turns || expected.actions !== result.actions)) throw new Error('Replay nie zgadza się z raportem');
    const dir = resolve(out);
    await mkdir(dir, { recursive: true });
    const path = join(dir, `replay-${result.seed}${replayIndex === undefined ? '' : `-game${replayIndex}`}.json`);
    await writeFile(path, JSON.stringify({ engineVersion: ENGINE_VERSION, options, ...result }, null, 2) + '\n');
    console.log(`Wynik: ${JSON.stringify(result.outcome)}; ${result.turns} tur; ${result.actions} akcji.\nReplay: ${path}`);
    return;
  }
  const metadata = { mode: mode as 'simulate' | 'experiment', games, seed, bots, rules };
  if (mode === 'simulate') {
    const result = runSimulation({ games, seed, bots, rules, onProgress });
    const files = await saveReport(out, metadata, result.results, result.summary);
    console.log(`Gry: ${games}; zakończone: ${result.summary.completed}; przerwane: ${result.summary.truncated}.\nWynik rozpoczynającego: ${percentage(result.summary.firstPlayerScore)}.\nRaport: ${files.markdown}\nDane: ${files.json}\nKarty: ${files.csv}`);
  } else {
    const card = (values.card ?? 'obelix') as CardId;
    if (!CARD_IDS.includes(card)) throw new Error(`Nieznana karta: ${card}`);
    const field = values.field ?? 'cost';
    if (!['cost', 'attack', 'health', 'abilityEnabled'].includes(field)) throw new Error('Nieznany parametr karty');
    const raw = values.value ?? (field === 'cost' && card === 'obelix' ? '5' : undefined);
    if (raw === undefined) throw new Error('Podaj --value');
    if (field === 'abilityEnabled' && raw !== 'true' && raw !== 'false') throw new Error('abilityEnabled wymaga true lub false');
    const patch: CardPatch = { [field]: field === 'abilityEnabled' ? raw === 'true' : integer(raw, field) };
    const baseline = createCatalog()[card];
    if ((field === 'attack' || field === 'health') && !['unit', 'building'].includes(baseline.kind)) throw new Error('Atak/życie dotyczy jednostek i budowli');
    const result = runExperiment({ games, seed, card, patch, bots, rules, onProgress });
    const files = await saveReport(out, { ...metadata, card, patch }, result.results, result.summary, result);
    console.log(`Wariant ${card} ${JSON.stringify(patch)}: ${percentage(result.comparison.variantScore)}.\nPrzedział 95%: ${result.comparison.ci95?.map(percentage).join(' – ') ?? 'brak danych'}.\nKompletne pary: ${result.comparison.completePairs}/${result.comparison.pairs}.\nRaport: ${files.markdown}\nDane: ${files.json}\nKarty: ${files.csv}`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`Błąd: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
}
