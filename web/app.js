const app = document.querySelector('#app');
const errorBox = document.querySelector('#error');
let view;
let busy = false;
const deckNames = { galowie: 'Galowie', rzymianie: 'Rzymianie' };

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(label, handler, primary = false) {
  const node = el('button', label, primary ? 'primary' : '');
  node.type = 'button'; node.addEventListener('click', handler); return node;
}
function showError(message) { errorBox.textContent = message; errorBox.hidden = !message; }
async function request(path, data) {
  if (busy) return;
  busy = true; app.setAttribute('aria-busy', 'true');
  app.querySelectorAll('button, select').forEach(node => { node.disabled = true; });
  showError('');
  try {
    const response = await fetch(path, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Nie udało się wykonać ruchu.');
    view = result; render();
  } catch (error) {
    // A lost response may still have committed the move: refresh instead of retrying it.
    try {
      const response = await fetch('/api/view');
      if (response.ok) { view = await response.json(); render(); }
    } catch { /* Keep the last view and allow an explicit refresh. */ }
    showError(error.message);
    if (!view) app.replaceChildren(el('p', 'Nie można połączyć się z grą. Sprawdź, czy serwer jest uruchomiony.'), button('Spróbuj ponownie', () => request('/api/view')));
  } finally {
    busy = false; app.setAttribute('aria-busy', 'false');
    app.querySelectorAll('button, select').forEach(node => { node.disabled = false; });
  }
}
const act = id => request('/api/action', { id, revision: view.revision });

function setup() {
  const panel = el('section'); panel.append(el('h2', 'Nowa gra'));
  panel.append(el('p', 'Każdy gracz wybiera talię 60 kart. Przy zmianie tury przekaż urządzenie drugiej osobie.'));
  const grid = el('div', undefined, 'form-grid');
  function select(label, options) {
    const wrapper = el('label', label); const input = el('select');
    for (const [value, text] of options) { const option = el('option', text); option.value = value; input.append(option); }
    wrapper.append(input); grid.append(wrapper); return input;
  }
  const firstDeck = select('Talia gracza 1', Object.entries(deckNames));
  const secondDeck = select('Talia gracza 2', Object.entries(deckNames)); secondDeck.value = 'rzymianie';
  const starter = select('Rozpoczyna', [['random', 'Losowo'], ['0', 'Gracz 1'], ['1', 'Gracz 2']]);
  panel.append(grid, button('Rozpocznij grę', () => request('/api/new', {
    decks: [firstDeck.value, secondDeck.value], firstPlayer: starter.value === 'random' ? 'random' : Number(starter.value), revision: view.revision,
  }), true));
  if (view.phase !== 'setup') panel.append(button('Wróć do partii', render));
  app.replaceChildren(panel); rules(panel);
}

function rules(parent) {
  const details = el('details'); details.append(el('summary', 'Jak grać?'));
  const list = el('ul');
  for (const line of [
    'Start: 15 HP, 6 kart. Drugi gracz dobiera dodatkowo 1 kartę w pierwszej turze. Później każdy dobiera 1.',
    'Raz na turę możesz zamienić kartę z ręki na energię. Zwiększa to maksimum i dostępną energię o 1, do limitu 10. Energia odnawia się co turę.',
    'Na karcie w ręce wybierz „Zagraj…” i cel albo zamianę na energię. Zapłacisz podany koszt. Widać tylko legalne ruchy.',
    'Na własnej jednostce wybierz cel ataku lub zdolność. Przeciwnika można zaatakować dopiero po opróżnieniu jego pola.',
    'W pierwszej własnej turze żaden gracz nie atakuje. Lew i Ceplus czekają również w turze swojego wystawienia.',
    'Zakończ turę, przekaż urządzenie i dopiero wtedy odsłoń rękę następnego gracza.',
    'Wygrywasz, gdy przeciwnik straci HP lub nie może dobrać wymaganej karty. Zamknięcie karty przeglądarki nie kasuje gry, jeśli serwer nadal działa.',
  ]) list.append(el('li', line));
  details.append(list); parent.append(details);
}

function actionButtons(parent, entries) {
  if (!entries.length) return;
  const list = el('div', undefined, 'actions');
  for (const entry of entries) list.append(button(entry.label, () => act(entry.id)));
  parent.append(list);
}
function cardTitle(card, i, catalog) { return `${i + 1}. ${catalog[card.cardId].name}`; }
function board(parent, player, own, o) {
  const section = el('section'); section.append(el('h2', own ? 'Twoje pole' : 'Pole przeciwnika'));
  if (!player.board.length) section.append(el('p', 'Pole jest puste.'));
  const grid = el('div', undefined, 'cards');
  const catalog = o.catalogs[own ? o.player : 1 - o.player];
  for (const [index, card] of player.board.entries()) {
    const def = catalog[card.cardId];
    const stats = view.boardStats[card.uid];
    const article = el('article'); article.append(el('h3', cardTitle(card, index, catalog)),
      el('p', `Atak: ${stats.attack} · Życie: ${stats.health}/${stats.maxHealth} · Koszt: ${def.cost}`, 'status'));
    if (def.text) article.append(el('p', def.text));
    const status = [];
    if (def.kind === 'building') status.push('Budowla — nie atakuje');
    if (card.stuns.length) status.push('Zablokowana — nie atakuje ani nie oddaje obrażeń');
    if (card.attacksUsed) status.push('Atak wykorzystany');
    if (card.hiddenBy) status.push('Schowana w Koloseum');
    if (stats.protected) status.push('Chroniona przed atakami');
    if (card.borrowedFrom !== undefined) status.push('Przejęta do końca tury');
    if (def.abilityEnabled && ['ceplus', 'lew'].includes(card.cardId) && card.enteredTurn === o.turn) status.push('Czeka z atakiem do następnej własnej tury');
    if (def.abilityEnabled && ['falballa', 'dobromina'].includes(card.cardId)) status.push(`Zużyte warunkowe HP przeciw mężczyznom: ${card.maleDefenseDamage}`);
    if (card.temporaryDamage?.some(d => d.amount)) status.push(`Obrażenia z oszczepu: ${card.temporaryDamage.reduce((sum, d) => sum + d.amount, 0)}`);
    if (status.length) article.append(el('p', status.join(' · '), 'muted'));
    if (own) actionButtons(article, view.actions.filter(({ action: a }) => a.attackerUid === card.uid || a.sourceUid === card.uid || (a.type === 'unhide' && a.targetUid === card.uid)));
    grid.append(article);
  }
  section.append(grid); parent.append(section);
}

function render() {
  app.replaceChildren();
  if (view.phase === 'setup') { setup(); return; }
  if (view.phase === 'handoff') {
    const panel = el('section', undefined, 'handoff');
    panel.append(el('h2', `Przekaż urządzenie graczowi ${view.player + 1}`),
      el('p', `Tura ${view.turn} · ${deckNames[view.decks[view.player]]}. Ręce są zasłonięte.`),
      button(`Jestem graczem ${view.player + 1} — odsłoń moją turę`, () => request('/api/reveal', { revision: view.revision }), true));
    app.append(panel); return;
  }
  if (view.phase === 'finished') {
    const outcome = view.outcome;
    const text = outcome.kind === 'win' ? `Wygrywa gracz ${outcome.winner + 1}!` : outcome.kind === 'draw' ? 'Remis!' : 'Gra przerwana — osiągnięto limit rozgrywki.';
    const panel = el('section'); panel.append(el('h2', text),
      el('p', `HP gracza 1: ${view.hp[0]} · HP gracza 2: ${view.hp[1]}`),
      el('p', outcome.reason === 'empty-deck' ? 'Przeciwnik nie mógł dobrać karty.' : outcome.reason === 'hp' ? 'Przeciwnik stracił wszystkie punkty życia.' : ''),
      button('Zagraj ponownie — wybierz talie', setup, true)); app.append(panel);
  } else {
    const o = view.observation;
    const panel = el('section'); panel.append(el('h2', `Tura ${o.turn} — gracz ${o.player + 1} (${deckNames[view.decks[o.player]]})`));
    panel.append(el('p', `Twoje HP: ${o.self.hp} · Energia: ${o.self.energy}/${o.self.maxEnergy} · Ręka: ${o.self.handCount} · Talia: ${o.self.deckCount}`, 'status'),
      el('p', `Przeciwnik: gracz ${2 - o.player} (${deckNames[view.decks[1 - o.player]]}) · HP: ${o.opponent.hp} · Ręka: ${o.opponent.handCount} · Talia: ${o.opponent.deckCount}`));
    if (o.self.turnsTaken === 1) panel.append(el('p', 'Pierwsza własna tura: ataki są zablokowane.'));
    panel.append(el('p', o.self.maxEnergy >= o.rules.maxEnergy ? 'Osiągnięto maksymalną energię.' :
      o.self.energyCreated ? 'Tworzenie energii w tej turze jest już wykorzystane.' : 'Możesz zamienić jedną kartę z ręki na energię.'));
    const toolbar = el('div', undefined, 'toolbar');
    toolbar.append(button('Zakończ turę i zasłoń rękę', () => act(view.actions.find(e => e.action.type === 'endTurn').id), true),
      button('Nowa gra', () => { if (confirm('Przerwać tę partię i wybrać talie od nowa?')) setup(); }));
    panel.append(toolbar); rules(panel); app.append(panel);
    board(app, o.opponent, false, o); board(app, o.self, true, o);
    const hand = el('section'); hand.append(el('h2', 'Twoja ręka'));
    const cards = el('div', undefined, 'cards');
    if (!o.self.hand.length) hand.append(el('p', 'Nie masz kart na ręce.'));
    for (const [i, card] of o.self.hand.entries()) {
      const def = o.catalogs[o.player][card.cardId]; const article = el('article');
      article.append(el('h3', cardTitle(card, i, o.catalogs[o.player])),
        el('p', `Koszt: ${def.cost}${['unit', 'building'].includes(def.kind) ? ` · Atak: ${def.attack} · Życie: ${def.health}` : ''}`, 'status'));
      if (def.text) article.append(el('p', def.text));
      const entries = view.actions.filter(e => e.action.cardUid === card.uid);
      actionButtons(article, entries);
      if (!entries.some(e => e.action.type === 'playCard')) article.append(el('p', 'Zagranie teraz niedostępne: brakuje energii, celu lub wymaganej karty.', 'muted'));
      cards.append(article);
    }
    hand.append(cards); app.append(hand);
    if (o.self.knownOpponentHand.length) {
      const known = el('section'); known.append(el('h2', 'Karty podejrzane przez Kalimatisa'));
      for (const card of o.self.knownOpponentHand) known.append(el('p', o.catalogs[1 - o.player][card.cardId].name));
      app.append(known);
    }
  }
  const history = el('details'); history.append(el('summary', 'Historia ostatnich ruchów'));
  const log = el('ol'); for (const line of [...view.log].reverse()) log.append(el('li', line));
  history.append(log); app.append(history);
}

request('/api/view');
