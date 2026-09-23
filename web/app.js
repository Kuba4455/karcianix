const app = document.querySelector('#app');
const errorBox = document.querySelector('#error');
let view;
let busy = false;
let token = localStorage.getItem('karcianix:seat');
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
async function request(path, data, quiet = false) {
  if (busy) return;
  busy = true; app.setAttribute('aria-busy', 'true');
  app.querySelectorAll('button, select, input').forEach(node => { node.disabled = true; });
  if (!quiet) showError('');
  try {
    const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) };
    const response = await fetch(path, data === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) { token = null; localStorage.removeItem('karcianix:seat'); view = null; render(); }
      throw new Error(result.error || 'Nie udało się wykonać ruchu.');
    }
    if (result.token) { token = result.token; localStorage.setItem('karcianix:seat', token); }
    if (result.phase === 'cancelled') { token = null; localStorage.removeItem('karcianix:seat'); view = null; render(); return; }
    const nextView = result.view ?? result;
    const changed = !view || nextView.phase !== view.phase || nextView.revision !== view.revision;
    view = nextView;
    if (!quiet || changed) render();
  } catch (error) {
    if (path === '/api/action' && token) {
      // A lost response may still have committed the move: refresh instead of retrying it.
      try {
        const response = await fetch('/api/view', { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) { view = await response.json(); render(); }
      } catch { /* Keep the last view. */ }
    }
    if (!quiet) showError(error.message);
  } finally {
    busy = false; app.setAttribute('aria-busy', 'false');
    app.querySelectorAll('button, select, input').forEach(node => { node.disabled = false; });
  }
}
const act = id => request('/api/action', { id, revision: view.revision });

function setup() {
  const panel = el('section'); panel.append(el('h2', 'Gra online'));
  panel.append(el('p', 'Każdy gracz otwiera tę stronę na swoim urządzeniu i wybiera własną talię. Gospodarz przekazuje drugiej osobie kod pokoju.'));
  const grid = el('div', undefined, 'form-grid');
  const deckLabel = el('label', 'Twoja talia'); const deck = el('select');
  for (const [id, name] of Object.entries(deckNames)) { const option = el('option', name); option.value = id; deck.append(option); }
  deckLabel.append(deck);
  const codeLabel = el('label', 'Kod pokoju (jeśli dołączasz)'); const code = el('input');
  code.placeholder = 'Np. A1B2C3D4E5F6'; code.maxLength = 12; code.autocomplete = 'off';
  codeLabel.append(code); grid.append(deckLabel, codeLabel);
  panel.append(grid);
  const toolbar = el('div', undefined, 'toolbar');
  toolbar.append(button('Utwórz pokój', () => request('/api/create', { deck: deck.value }), true),
    button('Dołącz do pokoju', () => request('/api/join', { deck: deck.value, code: code.value.trim() })));
  panel.append(toolbar);
  app.replaceChildren(panel); rules(panel);
}

function leave() {
  if (confirm('Anulować pokój?')) request('/api/cancel', {});
}

function rules(parent) {
  const details = el('details'); details.append(el('summary', 'Jak grać?'));
  const list = el('ul');
  for (const line of [
    'Start: 15 HP, 1 energia i 6 kart. Każdy może odrzucić dowolną liczbę kart, dobrać do 6 i ponownie tasuje pozostałą talię. Drugi gracz dobiera dodatkowo 1 kartę w swojej pierwszej turze.',
    'Raz na turę możesz zamienić kartę z ręki na energię. Zwiększa to maksimum i dostępną energię o 1, do limitu 10. Energia odnawia się co turę.',
    'Na karcie w ręce wybierz „Zagraj…” i cel albo zamianę na energię. Zapłacisz podany koszt. Widać tylko legalne ruchy.',
    'Na własnej jednostce wybierz cel ataku lub zdolność. Przeciwnika można zaatakować dopiero po opróżnieniu jego pola.',
    'Tylko gracz rozpoczynający nie atakuje w swojej pierwszej turze. Drugi gracz może atakować od pierwszej własnej tury. Lew i Ceplus czekają również w turze swojego wystawienia.',
    'Zakończ turę i zaczekaj na ruch drugiej osoby. Każdy widzi tylko własną rękę.',
    'Wygrywasz, gdy przeciwnik straci HP lub nie może dobrać wymaganej karty. Partie działają wyłącznie w pamięci serwera i wygasają po czterech godzinach bezczynności.',
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
function mulliganPanel() {
  const o = view.observation;
  const panel = el('section');
  panel.append(el('h2', `Pokój ${view.roomCode} · Wymiana kart gracza ${o.player + 1}`),
    el('p', 'Zaznacz karty do odrzucenia albo pozostaw wszystkie. Dobierzesz do sześciu kart, a pozostała talia zostanie ponownie potasowana.'));
  const cards = el('div', undefined, 'cards');
  const selected = new Set();
  const confirm = button('Zatwierdź wymianę (0)', () => request('/api/action', {
    id: view.actions.find(e => e.action.type === 'mulligan').id, revision: view.revision, cardUids: [...selected],
  }), true);
  for (const [i, card] of o.self.hand.entries()) {
    const def = o.catalogs[o.player][card.cardId];
    const article = el('article'); const label = el('label');
    const checkbox = el('input'); checkbox.type = 'checkbox';
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selected.add(card.uid); else selected.delete(card.uid);
      confirm.textContent = `Zatwierdź wymianę (${selected.size})`;
    });
    label.append(checkbox, document.createTextNode(` ${cardTitle(card, i, o.catalogs[o.player])} · koszt ${def.cost}`));
    article.append(label);
    if (def.text) article.append(el('p', def.text));
    cards.append(article);
  }
  panel.append(cards, confirm); app.append(panel);
}
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
    if (own && view.phase === 'playing') actionButtons(article, view.actions.filter(({ action: a }) => a.attackerUid === card.uid || a.sourceUid === card.uid || (a.type === 'unhide' && a.targetUid === card.uid)));
    grid.append(article);
  }
  section.append(grid); parent.append(section);
}

function render() {
  app.replaceChildren();
  if (!view) { setup(); return; }
  if (view.phase === 'waiting-for-guest') {
    const panel = el('section', undefined, 'handoff');
    panel.append(el('h2', 'Czekam na drugiego gracza'),
      el('p', `Twój pokój: ${view.roomCode} · jesteś graczem ${view.seat + 1}.`),
      el('p', 'Przekaż kod pokoju drugiej osobie. Nie udostępniaj jej swojego urządzenia ani danych przeglądarki.'),
      button('Odśwież', () => request('/api/view')),
      button('Anuluj pokój', leave));
    app.append(panel); return;
  }
  if (view.phase === 'finished') {
    const outcome = view.outcome;
    const text = outcome.kind === 'win' ? `Wygrywa gracz ${outcome.winner + 1}!` : outcome.kind === 'draw' ? 'Remis!' : 'Gra przerwana — osiągnięto limit rozgrywki.';
    const panel = el('section'); panel.append(el('h2', text),
      el('p', `HP gracza 1: ${view.hp[0]} · HP gracza 2: ${view.hp[1]}`),
      el('p', outcome.reason === 'empty-deck' ? 'Przeciwnik nie mógł dobrać karty.' : outcome.reason === 'hp' ? 'Przeciwnik stracił wszystkie punkty życia.' : ''),
      button('Nowy pokój', () => { token = null; localStorage.removeItem('karcianix:seat'); view = null; render(); }, true)); app.append(panel);
  } else {
    if (view.mulligan && view.phase === 'playing') { mulliganPanel(); return; }
    const o = view.observation;
    const waiting = view.phase === 'waiting-for-turn';
    const panel = el('section'); panel.append(el('h2', view.mulligan ? `Pokój ${view.roomCode} · Gracz ${view.currentPlayer + 1} wybiera karty do wymiany` : `Pokój ${view.roomCode} · Tura ${o.turn} — ${waiting ? `ruch gracza ${view.currentPlayer + 1}` : `gracz ${o.player + 1}`} (${deckNames[view.decks[waiting ? view.currentPlayer : o.player]]})`));
    if (waiting) panel.append(el('p', view.mulligan ? 'Zaraz wybierzesz własne karty do wymiany. Twoja ręka pozostaje widoczna.' : 'Czekasz na ruch przeciwnika. Twoje pole i ręka są widoczne; ruchy będą dostępne w Twojej turze.', 'status'));
    panel.append(el('p', `Twoje HP: ${o.self.hp} · Energia: ${o.self.energy}/${o.self.maxEnergy} · Ręka: ${o.self.handCount} · Talia: ${o.self.deckCount}`, 'status'),
      el('p', `Przeciwnik: gracz ${2 - o.player} (${deckNames[view.decks[1 - o.player]]}) · HP: ${o.opponent.hp} · Ręka: ${o.opponent.handCount} · Talia: ${o.opponent.deckCount}`));
    if (!waiting) {
      if (o.turn === 1 && !o.rules.allowFirstTurnAttacks) panel.append(el('p', 'Pierwsza tura gracza rozpoczynającego: ataki są zablokowane.'));
      panel.append(el('p', o.self.maxEnergy >= o.rules.maxEnergy ? 'Osiągnięto maksymalną energię.' :
        o.self.energyCreated ? 'Tworzenie energii w tej turze jest już wykorzystane.' : 'Możesz zamienić jedną kartę z ręki na energię.'));
      const toolbar = el('div', undefined, 'toolbar');
      toolbar.append(button('Zakończ turę', () => act(view.actions.find(e => e.action.type === 'endTurn').id), true));
      panel.append(toolbar);
    }
    rules(panel); app.append(panel);
    board(app, o.opponent, false, o); board(app, o.self, true, o);
    const hand = el('section'); hand.append(el('h2', 'Twoja ręka'));
    const cards = el('div', undefined, 'cards');
    if (!o.self.hand.length) hand.append(el('p', 'Nie masz kart na ręce.'));
    for (const [i, card] of o.self.hand.entries()) {
      const def = o.catalogs[o.player][card.cardId]; const article = el('article');
      article.append(el('h3', cardTitle(card, i, o.catalogs[o.player])),
        el('p', `Koszt: ${def.cost}${['unit', 'building'].includes(def.kind) ? ` · Atak: ${def.attack} · Życie: ${def.health}` : ''}`, 'status'));
      if (def.text) article.append(el('p', def.text));
      if (!waiting) {
        const entries = view.actions.filter(e => e.action.cardUid === card.uid);
        actionButtons(article, entries);
        if (!entries.some(e => e.action.type === 'playCard')) article.append(el('p', 'Zagranie teraz niedostępne: brakuje energii, celu lub wymaganej karty.', 'muted'));
      }
      cards.append(article);
    }
    hand.append(cards); app.append(hand);
    if (o.self.knownOpponentHand.length) {
      const known = el('section'); known.append(el('h2', 'Karty podejrzane przez Kalimatisa'));
      for (const card of o.self.knownOpponentHand) known.append(el('p', o.catalogs[1 - o.player][card.cardId].name));
      app.append(known);
    }
  }
  if (view.log) {
    const history = el('details'); history.append(el('summary', 'Historia ostatnich ruchów'));
    const log = el('ol'); for (const line of [...view.log].reverse()) log.append(el('li', line));
    history.append(log); app.append(history);
  }
}

if (token) request('/api/view'); else { view = null; render(); }
setInterval(() => { if (token && !busy) request('/api/view', undefined, true); }, 2500);
