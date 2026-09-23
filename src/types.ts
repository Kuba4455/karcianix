export type PlayerId = 0 | 1;
export type DeckId = 'galowie' | 'rzymianie';
export type CardId =
  | 'asterix' | 'obelix' | 'panoramix' | 'falballa' | 'dobromina'
  | 'asparanoix' | 'ahigienix' | 'automatix' | 'geriatrix' | 'kakofonix'
  | 'miecz' | 'tarcza' | 'magiczny_napoj' | 'kociolek' | 'palisada'
  | 'dzik' | 'pieczony_dzik' | 'sierp' | 'spadajace_niebo' | 'gesi'
  | 'cezar' | 'brutus' | 'legionista' | 'wieniec' | 'katapulta' | 'antywirus'
  | 'zolw' | 'zapchlenius' | 'popus' | 'a38' | 'pieknus' | 'tester_luster'
  | 'kalimatis' | 'ceplus' | 'tarcza_rzymska' | 'kodeks' | 'hasta' | 'lew' | 'koloseum' | 'oszczep';
export type CardKind = 'unit' | 'building' | 'equipment' | 'spell';
export type Debuff = 'both' | 'attack' | 'health';
export interface CardDefinition {
  id: CardId;
  name: string;
  kind: CardKind;
  cost: number;
  attack: number;
  health: number;
  gender: 'male' | 'female' | 'none';
  text: string;
  abilityEnabled: boolean;
}
export type Catalog = Record<CardId, CardDefinition>;
export type CardPatch = Partial<Pick<CardDefinition, 'cost' | 'attack' | 'health' | 'abilityEnabled'>>;
export interface CardInstance { uid: string; cardId: CardId; owner?: PlayerId }
export interface Modifier {
  origin: CardId;
  attack: number;
  health: number;
  sourceUid?: string;
  expiresAtOwnerTurn?: number;
  sourceOwner?: PlayerId;
}
export interface Permanent extends CardInstance {
  enteredTurn?: number;
  hiddenBy?: string;
  borrowedFrom?: PlayerId;
  temporaryDamage?: { amount: number; owner: PlayerId; expiresAtOwnerTurn: number }[];
  damage: number;
  /** Damage already absorbed by the conditional HP bonus against male attackers. */
  maleDefenseDamage: number;
  attacksUsed: number;
  modifiers: Modifier[];
  protectedBy?: string;
  auraActive: boolean;
  // Separate from modifiers: dispelling a potion does not cancel its hangover.
  potions: { sourceOwner: PlayerId; expiresAtOwnerTurn: number }[];
  stuns: { sourceOwner: PlayerId; expiresAtOwnerTurn: number }[];
}
export interface PlayerState {
  knownOpponentHand: CardInstance[];
  hp: number;
  maxEnergy: number;
  energy: number;
  energyCreated: boolean;
  turnsTaken: number;
  deck: CardInstance[];
  hand: CardInstance[];
  board: Permanent[];
  discard: CardInstance[];
  energyCards: CardInstance[];
}
export interface Rules {
  startingHp: number;
  startingEnergy: number;
  openingHand: number;
  drawPerTurn: number;
  secondPlayerFirstDraw: number;
  allowFirstTurnAttacks: boolean;
  maxEnergy: number;
  maxTurns: number;
  maxActionsPerTurn: number;
  poisonStacks: boolean;
  emptyDeck: 'loss' | 'skip';
  stunRetaliation: boolean;
}
export type Action =
  | { type: 'mulligan'; cardUids: string[] }
  | { type: 'createEnergy'; cardUid: string }
  | { type: 'playCard'; cardUid: string; targetUid?: string; debuff?: Debuff; choice?: 'peek' | 'steal'; discardUid?: string; summonCount?: number }
  | { type: 'sacrifice'; sourceUid: string; targetUid: string; bonus: Debuff }
  | { type: 'hide'; sourceUid: string; targetUid: string }
  | { type: 'unhide'; targetUid: string }
  | { type: 'attack'; attackerUid: string; targetUid: string }
  | { type: 'endTurn' };
export interface CardMetrics {
  drawn: number;
  played: number;
  burned: number;
  playableCopyTurns: number;
  handCopyTurns: number;
  unitDamage: number;
  directDamage: number;
  kills: number;
  healing: number;
  damagePrevented: number;
  stunsApplied: number;
}
export type Metrics = Record<CardId, CardMetrics>;
export type Outcome =
  | { kind: 'win'; winner: PlayerId; reason: 'hp' | 'empty-deck' }
  | { kind: 'draw'; reason: 'simultaneous-hp' }
  | { kind: 'truncated'; reason: 'turn-limit' | 'action-limit' };
export interface GameEvent {
  turn: number;
  type: string;
  player?: PlayerId;
  cardId?: CardId;
  uid?: string;
  targetUid?: string;
  amount?: number;
}
export interface GameState {
  decks: [DeckId, DeckId];
  randomEffects: number;
  seed: number;
  currentPlayer: PlayerId;
  firstPlayer: PlayerId;
  pendingMulligan: [boolean, boolean];
  turn: number;
  actionsThisTurn: number;
  rules: Rules;
  catalogs: [Catalog, Catalog];
  players: [PlayerState, PlayerState];
  metrics: [Metrics, Metrics];
  outcome: Outcome | null;
  events: GameEvent[] | null;
}
export interface PublicPlayer {
  hp: number;
  energy: number;
  maxEnergy: number;
  handCount: number;
  deckCount: number;
  turnsTaken: number;
  board: Permanent[];
  discard: CardInstance[];
  energyCards: CardInstance[];
}
export interface PlayerObservation {
  player: PlayerId;
  turn: number;
  rules: Rules;
  catalogs: [Catalog, Catalog];
  self: PublicPlayer & { hand: CardInstance[]; energyCreated: boolean; knownOpponentHand: CardInstance[] };
  opponent: PublicPlayer;
}
export type BotKind = 'random' | 'aggressive' | 'control';
export interface GameOptions {
  decks?: [DeckId, DeckId];
  seed?: number;
  firstPlayer?: PlayerId;
  rules?: Partial<Rules>;
  catalogs?: [Catalog, Catalog];
  deckSeeds?: [number, number];
  botSeeds?: [number, number];
  bots?: [BotKind, BotKind];
  trace?: boolean;
}
