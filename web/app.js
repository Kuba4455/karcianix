const app = document.querySelector('#app');
const errorBox = document.querySelector('#error');
let view;
let busy = false;
let polling = false;
let attackSelection = null;
let modalRevision = null;
const modal = document.querySelector('#modal');
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
  node.type = 'button'; node.addEventListener('click', () => { if (!busy && !node.disabled) handler(); }); return node;
}
function showError(message) { errorBox.textContent = message; errorBox.hidden = !message; }
async function request(path, data) {
  if (busy) return;
  busy = true; app.setAttribute('aria-busy', 'true');
  const locked = [...app.querySelectorAll('button, select, input')].map(node => [node, node.disabled]);
  locked.forEach(([node]) => { node.disabled = true; });
  showError('');
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
    if (changed || data !== undefined || path === '/api/view') render();
  } catch (error) {
    if (path === '/api/action' && token) {
      // A lost response may still have committed the move: refresh instead of retrying it.
      try {
        const response = await fetch('/api/view', { headers: { Authorization: `Bearer ${token}` } });
        if (response.ok) { view = await response.json(); render(); }
      } catch { /* Keep the last authoritative view. */ }
      render();
    }
    showError(error.message);
  } finally {
    busy = false; app.setAttribute('aria-busy', 'false');
    locked.forEach(([node, disabled]) => { node.disabled = disabled; });
  }
}
async function refresh() {
  if (!token || busy || polling) return;
  polling = true;
  const seat = token;
  try {
    const response = await fetch('/api/view', { headers: { Authorization: `Bearer ${seat}` } });
    if (seat !== token || busy) return;
    if (response.status === 401) {
      token = null; localStorage.removeItem('karcianix:seat'); view = null; render();
      showError('Sesja gry wygasła. Utwórz nowy pokój.');
      return;
    }
    if (!response.ok) return;
    const nextView = await response.json();
    if (seat !== token || busy || (view?.revision ?? -1) > (nextView.revision ?? -1)) return;
    const changed = !view || nextView.phase !== view.phase || nextView.revision !== view.revision;
    view = nextView;
    if (changed) render();
  } catch { /* A temporary connection failure does not interrupt card selection. */ }
  finally { polling = false; }
}
const act = (id, revision = view.revision) => {
  if (busy) return;
  if (view.phase !== 'playing' || revision !== view.revision || !view.actions.some(entry => entry.id === id)) {
    closeModal(); attackSelection = null; render(); showError('Stan gry się zmienił. Wybierz ruch ponownie.'); return;
  }
  attackSelection = null; closeModal();
  return request('/api/action', { id, revision });
};

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
  panel.className = 'panel lobby'; app.replaceChildren(panel);
}

function leave() {
  if (confirm('Anulować pokój?')) request('/api/cancel', {});
}

function rules(parent) {
  const details = el('details'); details.append(el('summary', 'Jak grać?'));
  const list = el('ul');
  for (const line of [
    'Start: 15 HP, 1 energia i 6 kart. Każdy może wymienić dowolną liczbę kart: wybrane wracają do talii, są tasowane z nią, a gracz dobiera z powrotem do 6. Drugi gracz dobiera dodatkowo 1 kartę w swojej pierwszej turze.',
    'Startujesz z energią 1/1. Po pełnej rundzie (turach obu graczy) maksimum energii obu graczy rośnie o 1, do 7. Na początku własnej tury energia odnawia się do maksimum. Kart nie można zamieniać na energię.',
    'Na karcie w ręce wybierz „Zagraj” i ewentualny cel. Zapłacisz podany koszt. Widać tylko legalne ruchy.',
    'Na własnej jednostce kliknij „Atakuj”, a następnie podświetlony cel. Możesz anulować atak przyciskiem lub Esc. Zdolności są w sekcji „Akcje dodatkowe” na karcie. Przeciwnika można zaatakować dopiero po opróżnieniu jego pola.',
    'Tylko gracz rozpoczynający nie atakuje w swojej pierwszej turze. Drugi gracz może atakować od pierwszej własnej tury. Lew i Ceplus czekają również w turze swojego wystawienia.',
    'Zakończ turę i zaczekaj na ruch drugiej osoby. Każdy widzi tylko własną rękę.',
    'Wygrywasz, gdy przeciwnik straci HP lub nie może dobrać wymaganej karty. Partie działają wyłącznie w pamięci serwera i wygasają po czterech godzinach bezczynności.',
  ]) list.append(el('li', line));
  details.append(list); parent.append(details);
}

function closeModal() { if (modal.open) modal.close(); modalRevision = null; }
function openModal(title, content, revision = null) {
  closeModal();
  document.querySelector('#modal-title').textContent = title;
  document.querySelector('#modal-content').replaceChildren(content);
  modalRevision = revision; modal.showModal();
}
document.querySelector('#modal-close').addEventListener('click', closeModal);
modal.addEventListener('close', () => { modalRevision = null; });
document.querySelector('#rules-button').addEventListener('click', () => {
  const content = el('div'); rules(content); content.firstElementChild.open = true;
  openModal('Zasady gry', content);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !modal.open && attackSelection) cancelAttack();
});
function availableActions() { return view.phase === 'playing' && !view.mulligan ? view.actions : []; }
function attackEntries() {
  return attackSelection ? availableActions().filter(e => e.action.type === 'attack' && e.action.attackerUid === attackSelection.uid) : [];
}
function cancelAttack() {
  const uid = attackSelection?.uid; attackSelection = null; render();
  [...app.querySelectorAll('[data-attack]')].find(node => node.dataset.attack === uid)?.focus();
}
function beginAttack(uid) {
  attackSelection = { uid, revision: view.revision }; render();
  const target = app.querySelector('.target-button');
  target?.focus({ preventScroll: true });
  app.querySelector('.attack-banner')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function chooseAction(title, entries) {
  if (!entries.length || attackSelection) return;
  const revision = view.revision;
  if (entries.length === 1) { act(entries[0].id, revision); return; }
  const choices = el('div', undefined, 'actions choice-list');
  choices.append(el('p', 'Wybierz cel lub wariant efektu.'));
  for (const entry of entries) choices.append(button(entry.label, () => act(entry.id, revision)));
  choices.append(button('Anuluj', closeModal)); openModal(title, choices, revision);
}
function actionButton(label, handler, enabled, primary = false) {
  const node = button(label, handler, primary); node.disabled = !enabled; return node;
}
function cardShell(card, def, stats) {
  const article = el('article', undefined, 'card'); article.dataset.card = card.uid;
  const cost = el('span', `${def.cost}`, 'cost'); cost.setAttribute('aria-label', `Koszt: ${def.cost} energii`);
  article.append(cost, el('div', def.kind === 'unit' ? 'Jednostka' : def.kind === 'building' ? 'Budowla' : 'Akcja', 'eyebrow'), el('h3', def.name));
  if (['unit', 'building'].includes(def.kind)) {
    const values = el('div', undefined, 'stats');
    for (const [value, label] of [[stats?.attack ?? def.attack, 'Atak'], [stats?.health ?? def.health, 'Obrona / HP']]) {
      const stat = el('div'); stat.append(el('strong', `${value}`), el('span', label)); values.append(stat);
    }
    article.append(values);
    if (stats && stats.health < stats.maxHealth) article.append(el('span', `Maksymalne HP: ${stats.maxHealth}`, 'damage-note'));
  } else article.append(el('div', 'Efekt specjalny', 'spell-marker'));
  article.append(el('p', def.text || 'Bez dodatkowych zdolności.', 'card-description'));
  return article;
}
function playerBar(player, own, o) {
  const bar = el('div', undefined, 'player-bar');
  const identity = el('div', undefined, 'identity');
  identity.append(el('div', own ? `Gracz ${o.player + 1} / Ty` : `Gracz ${2 - o.player} / Przeciwnik`, 'player-name'),
    el('div', `Talia: ${deckNames[view.decks[own ? o.player : 1 - o.player]]}`, 'muted'));
  bar.append(el('div', own ? 'TY' : 'VS', 'avatar'), identity);
  const resources = el('div', undefined, 'resources');
  for (const [label, value, cls] of [['Życie', `${player.hp} / ${o.rules.startingHp}`, 'hp'], ['Energia', `${player.energy} / ${player.maxEnergy}`, 'energy'], ['W ręce', player.handCount, ''], ['W talii', player.deckCount, '']]) {
    const resource = el('div', undefined, `resource ${cls}`); resource.append(el('span', label), el('strong', `${value}`)); resources.append(resource);
  }
  bar.append(resources);
  const entry = !own && attackEntries().find(e => e.action.targetUid === `player:${1 - o.player}`);
  if (entry) {
    bar.classList.add('target-player');
    const target = button('Atakuj przeciwnika →', () => act(entry.id, attackSelection.revision), true);
    target.classList.add('target-button'); target.dataset.target = entry.action.targetUid; bar.append(target);
  }
  return bar;
}
function board(parent, player, own, o) {
  const section = el('section', undefined, `zone ${own ? 'own' : 'enemy'}`);
  section.append(playerBar(player, own, o));
  const label = el('div', undefined, 'row-label'); label.append(el('h2', own ? 'Twoje pole' : 'Pole przeciwnika'), el('span', `Jednostki: ${player.board.length}`)); section.append(label);
  const grid = el('div', undefined, 'cards');
  const catalog = o.catalogs[own ? o.player : 1 - o.player];
  if (!player.board.length) grid.append(el('div', 'Pole jest puste.', 'empty-slot'));
  for (const card of player.board) {
    const def = catalog[card.cardId]; const stats = view.boardStats[card.uid];
    const article = cardShell(card, def, stats);
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
    if (status.length) article.append(el('p', status.join(' · '), 'card-status'));
    if (own) {
      const actions = availableActions();
      const attacks = actions.filter(e => e.action.type === 'attack' && e.action.attackerUid === card.uid);
      const extra = actions.filter(({ action: a }) => a.type !== 'attack' && (a.sourceUid === card.uid || (a.type === 'unhide' && a.targetUid === card.uid)));
      const controls = el('div', undefined, 'card-actions');
      controls.append(el('div', 'Atak', 'eyebrow'));
      const selected = attackSelection?.uid === card.uid;
      const attack = actionButton(selected ? 'Anuluj atak' : '⚔ Atakuj', () => selected ? cancelAttack() : beginAttack(card.uid), selected || (!attackSelection && attacks.length > 0), !selected);
      attack.dataset.attack = card.uid; controls.append(attack);
      if (selected) article.classList.add('selected');
      if (!attacks.length) controls.append(el('span', view.phase !== 'playing' ? 'Poczekaj na swoją turę.' : 'Brak legalnego ataku.', 'muted'));
      controls.append(el('div', 'Akcje dodatkowe', 'eyebrow'));
      const labels = { sacrifice: 'Poświęć jednostkę…', hide: 'Schowaj jednostkę…', unhide: 'Odsłoń jednostkę' };
      for (const type of [...new Set(extra.map(e => e.action.type))]) {
        controls.append(actionButton(labels[type] ?? 'Użyj zdolności…', () => chooseAction(def.name, extra.filter(e => e.action.type === type)), !attackSelection));
      }
      if (!extra.length) controls.append(el('span', 'Brak dostępnych zdolności.', 'muted'));
      article.append(controls);
    } else if (attackSelection) {
      const entry = attackEntries().find(e => e.action.targetUid === card.uid);
      if (entry) {
        article.classList.add('target');
        const target = button(`Atakuj: ${def.name} →`, () => act(entry.id, attackSelection.revision), true);
        target.classList.add('target-button'); target.dataset.target = card.uid; article.append(target);
      } else { article.classList.add('unavailable-target'); article.append(el('span', 'Nie można wybrać tego celu.', 'muted')); }
    }
    grid.append(article);
  }
  section.append(grid); parent.append(section);
}
function handPanel(parent, o) {
  const section = el('section', undefined, 'hand-section');
  const heading = el('div', undefined, 'section-heading'); heading.append(el('h2', `Twoja ręka / ${o.self.handCount}`), el('span', 'Zagraj kartę, płacąc jej koszt energii', 'muted')); section.append(heading);
  const cards = el('div', undefined, 'cards hand');
  if (!o.self.hand.length) cards.append(el('p', 'Nie masz kart na ręce.', 'muted'));
  for (const card of o.self.hand) {
    const def = o.catalogs[o.player][card.cardId]; const article = cardShell(card, def);
    const entries = availableActions().filter(e => e.action.cardUid === card.uid);
    const plays = entries.filter(e => e.action.type === 'playCard');
    const controls = el('div', undefined, 'card-actions');
    const play = actionButton(plays.length > 1 ? 'Zagraj · wybierz efekt…' : `Zagraj · ${def.cost} energii`, () => chooseAction(def.name, plays), !attackSelection && !!plays.length, true); play.dataset.play = card.uid;
    controls.append(play);
    if (view.phase !== 'playing' || view.mulligan) controls.append(el('span', 'Akcje dostępne w Twojej turze.', 'muted'));
    else {
      if (!plays.length) controls.append(el('span', 'Zagranie niedostępne: koszt, cel lub wymaganie karty.', 'muted'));
    }
    article.append(controls); cards.append(article);
  }
  section.append(cards); parent.append(section);
}
function mulliganPanel() {
  const o = view.observation;
  const panel = el('section', undefined, 'panel');
  panel.append(el('div', `Pokój ${view.roomCode} / Przygotowanie`, 'eyebrow'), el('h2', `Wymiana kart gracza ${o.player + 1}`),
    el('p', 'Zaznacz karty do wymiany albo pozostaw wszystkie. Wybrane wrócą do talii; po jej potasowaniu dobierzesz do sześciu kart. Możesz ponownie trafić na tę samą kartę.'));
  const cards = el('div', undefined, 'cards'); const selected = new Set();
  const confirm = button('Zatwierdź wymianę (0)', () => request('/api/action', {
    id: view.actions.find(e => e.action.type === 'mulligan').id, revision: view.revision, cardUids: [...selected],
  }), true);
  for (const card of o.self.hand) {
    const def = o.catalogs[o.player][card.cardId]; const article = cardShell(card, def);
    const label = el('label', undefined, 'mulligan-choice'); const checkbox = el('input'); checkbox.type = 'checkbox';
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selected.add(card.uid); else selected.delete(card.uid);
      article.classList.toggle('selected', checkbox.checked); confirm.textContent = `Zatwierdź wymianę (${selected.size})`;
    });
    label.append(checkbox, document.createTextNode(' Wymień kartę')); article.append(label); cards.append(article);
  }
  panel.append(cards, confirm); app.append(panel);
}
function render() {
  if (attackSelection && (view?.phase !== 'playing' || view.mulligan || attackSelection.revision !== view.revision)) attackSelection = null;
  if (modalRevision !== null && modalRevision !== view?.revision) closeModal();
  app.replaceChildren();
  document.querySelector('#room-label').textContent = view?.roomCode ? `Pokój: ${view.roomCode}` : 'Gra online · 1 na 1';
  if (!view) { setup(); return; }
  if (view.phase === 'waiting-for-guest') {
    const panel = el('section', undefined, 'panel handoff');
    panel.append(el('div', 'Pokój utworzony', 'eyebrow'), el('h2', 'Czekam na drugiego gracza'), el('p', view.roomCode, 'room-code'),
      el('p', `Twoja talia: ${deckNames[view.decks[view.seat]]}. Przekaż kod pokoju drugiej osobie.`),
      button('Odśwież', () => request('/api/view')), button('Anuluj pokój', leave)); app.append(panel); return;
  }
  if (view.phase === 'finished') {
    const outcome = view.outcome;
    const text = outcome.kind === 'win' ? `Wygrywa gracz ${outcome.winner + 1}!` : outcome.kind === 'draw' ? 'Remis!' : 'Osiągnięto limit rozgrywki.';
    const panel = el('section', undefined, 'panel handoff'); panel.append(el('h2', text),
      el('p', `HP gracza 1: ${view.hp[0]} · HP gracza 2: ${view.hp[1]}`),
      el('p', outcome.reason === 'empty-deck' ? 'Przeciwnik nie mógł dobrać karty.' : outcome.reason === 'hp' ? 'Przeciwnik stracił wszystkie punkty życia.' : ''),
      button('Nowy pokój', () => { token = null; localStorage.removeItem('karcianix:seat'); view = null; render(); }, true)); app.append(panel);
  } else {
    if (view.mulligan && view.phase === 'playing') { mulliganPanel(); return; }
    const o = view.observation; const waiting = view.phase === 'waiting-for-turn';
    const title = el('div', undefined, 'page-heading'); title.append(el('div', 'Arena / Pojedynek online', 'eyebrow'), el('h1', waiting ? 'Obserwuj. Zaplanuj swój ruch.' : 'Twój ruch. Twoja strategia.')); app.append(title);
    if (attackSelection) {
      const banner = el('div', undefined, 'attack-banner'); banner.setAttribute('role', 'status');
      banner.append(el('span', 'Wybierz podświetloną kartę lub przeciwnika. Pozostałe cele są niedostępne.'), button('Anuluj atak · Esc', cancelAttack)); app.append(banner);
    }
    const layout = el('div', undefined, 'game-layout'); const field = el('div'); const arena = el('div', undefined, 'arena');
    board(arena, o.opponent, false, o);
    const turn = el('div', undefined, 'turn-bar');
    turn.append(el('strong', view.mulligan ? 'Przeciwnik wybiera karty startowe' : `Tura ${o.turn} · ${waiting ? 'Ruch przeciwnika' : 'Twój ruch'}`));
    const end = availableActions().find(e => e.action.type === 'endTurn');
    turn.append(actionButton('Zakończ turę →', () => act(end.id), !!end && !attackSelection, true)); arena.append(turn);
    board(arena, o.self, true, o); field.append(arena); handPanel(field, o); layout.append(field);
    const sidebar = el('aside'); const info = el('section', undefined, 'panel'); info.append(el('div', 'Status rozgrywki', 'eyebrow'), el('h2', waiting ? 'Ruch przeciwnika' : 'Twoja tura'));
    info.append(el('p', waiting ? 'Twoje pole i ręka pozostają widoczne. Ruchy udostępnią się automatycznie po zmianie tury.' : 'Wybierz akcję bezpośrednio na karcie. Po kliknięciu „Atakuj” zobaczysz legalne cele.'));
    if (!waiting && o.turn === 1 && !o.rules.allowFirstTurnAttacks) info.append(el('p', 'Gracz rozpoczynający nie atakuje w pierwszej turze.', 'muted'));
    if (!waiting) info.append(el('p', o.self.maxEnergy >= o.rules.maxEnergy ? 'Osiągnięto maksymalną energię.' : 'Po turach obu graczy maksimum energii wzrośnie o 1, do 7. Energia odnawia się na początku Twojej tury.', 'muted'));
    sidebar.append(info);
    if (view.log?.length) sidebar.append(historyPanel());
    if (o.self.knownOpponentHand.length) {
      const known = el('section', undefined, 'panel'); known.append(el('h2', 'Podejrzane karty'));
      for (const card of o.self.knownOpponentHand) known.append(el('p', o.catalogs[1 - o.player][card.cardId].name)); sidebar.append(known);
    }
    layout.append(sidebar); app.append(layout);
  }
  if (view.phase === 'finished' && view.log?.length) app.append(historyPanel());
}
function historyPanel() {
  const history = el('section', undefined, 'panel'); history.append(el('div', 'Przebieg pojedynku', 'eyebrow'), el('h2', 'Ostatnie ruchy'));
  const log = el('ol', undefined, 'game-log'); for (const line of [...view.log].reverse()) log.append(el('li', line)); history.append(log); return history;
}
if (token) request('/api/view'); else { view = null; render(); }
setInterval(refresh, 2500);
