import type { CardDefinition, CardId, CardPatch, Catalog } from './types.ts';

function card(id: CardId, name: string, kind: CardDefinition['kind'], attack: number,
  health: number, cost: number, text = '', gender: CardDefinition['gender'] = 'none'): CardDefinition {
  return { id, name, kind, attack, health, cost, text, gender, abilityEnabled: true };
}

export const CARDS: readonly CardDefinition[] = [
  card('asterix', 'Asterix', 'unit', 3, 3, 4, 'Dwa uderzenia w tę samą kartę; ignoruje pierwsze obrażenia zwrotne.', 'male'),
  card('obelix', 'Obelix', 'unit', 5, 5, 5, '', 'male'),
  card('panoramix', 'Panoramix', 'unit', 1, 3, 3, 'Przy wejściu: +0/+2 swojej jednostce, która już leży na stole. Ten Panoramix jest chroniony, dopóki żyje wzmocniona jednostka i działa premia.', 'male'),
  card('falballa', 'Falballa', 'unit', 2, 2, 2, 'Atakując mężczyznę: +2 ataku. Atakowana przez mężczyznę: +2 warunkowego życia.', 'female'),
  card('dobromina', 'Dobromina', 'unit', 1, 3, 2, 'Jak Falballa; przeciw Asparanoixowi premia wynosi 4 zamiast 2.', 'female'),
  card('asparanoix', 'Asparanoix', 'unit', 2, 4, 3, 'Przy wejściu osłabia kartę rywala o -1/-1, -2/0 lub 0/-2, dopóki żyje.', 'male'),
  card('ahigienix', 'Ahigienix', 'unit', 1, 4, 3, 'Na początku tury rywala: 1 obrażenie każdej jego jednostce.', 'male'),
  card('automatix', 'Automatix', 'unit', 1, 5, 3, '', 'male'),
  card('geriatrix', 'Geriatrix', 'unit', 3, 1, 1, 'Ginę po rozliczeniu własnego ataku.', 'male'),
  card('kakofonix', 'Kakofonix', 'unit', 2, 1, 3, 'Przy wejściu blokuje atak obecnych wrogich jednostek do początku następnej własnej tury.', 'male'),
  card('miecz', 'Miecz', 'equipment', 0, 0, 2, 'Stałe +2 ataku swojej jednostce.'),
  card('tarcza', 'Tarcza', 'equipment', 0, 0, 1, 'Stałe +1 życia swojej jednostce.'),
  card('magiczny_napoj', 'Magiczny napój', 'spell', 0, 0, 2, '+3/+3 do końca własnej tury, potem stałe -1/-1.'),
  card('kociolek', 'Kociołek', 'building', 0, 3, 4, 'Aura +1/+1 wszystkim własnym jednostkom.'),
  card('palisada', 'Palisada', 'building', 0, 1, 0, 'Blokuje atak gracza, jak każda karta na polu.'),
  card('dzik', 'Dzik', 'unit', 2, 1, 1),
  card('pieczony_dzik', 'Pieczony dzik', 'spell', 0, 0, 1, 'Leczy własnego gracza lub jednostkę o 2, do maksimum.'),
  card('sierp', 'Sierp', 'equipment', 0, 0, 1, 'Stałe +1 ataku swojej jednostce.'),
  card('spadajace_niebo', 'Spadające niebo', 'spell', 0, 0, 3, 'Blokada jak u Kakofonixa; usuwa dodatnie wzmocnienia obu pól i wyłącza obecne aury kociołków.'),
  card('gesi', 'Gęsi', 'unit', 1, 2, 1),
];
export const CARD_IDS = CARDS.map(c => c.id);
export function createCatalog(overrides: Partial<Record<CardId, CardPatch>> = {}): Catalog {
  for (const [id, patch] of Object.entries(overrides)) {
    if (!CARD_IDS.includes(id as CardId)) throw new Error(`Nieznana karta: ${id}`);
    for (const key of Object.keys(patch)) {
      if (!['cost', 'attack', 'health', 'abilityEnabled'].includes(key)) throw new Error(`Nieznany parametr: ${key}`);
    }
  }
  return Object.fromEntries(CARDS.map(base => {
    const c = { ...base, ...overrides[base.id] };
    for (const key of ['cost', 'attack', 'health'] as const) {
      if (!Number.isSafeInteger(c[key]) || c[key] < 0) throw new Error(`Nieprawidłowe ${key}: ${base.id}`);
    }
    if (typeof c.abilityEnabled !== 'boolean') throw new Error('abilityEnabled musi być boolean');
    if ((c.kind === 'unit' || c.kind === 'building') && c.health < 1) throw new Error('Karta na polu musi mieć co najmniej 1 życia bazowego');
    return [c.id, c];
  })) as Catalog;
}
