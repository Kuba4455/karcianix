export type PlayerId = 0 | 1;
export type CardId =
  | 'asterix' | 'obelix' | 'panoramix' | 'falballa' | 'dobromina'
  | 'asparanoix' | 'ahigienix' | 'automatix' | 'geriatrix' | 'kakofonix'
  | 'miecz' | 'tarcza' | 'magiczny_napoj' | 'kociolek' | 'palisada'
  | 'dzik' | 'pieczony_dzik' | 'sierp' | 'spadajace_niebo' | 'gesi';
export type CardKind = 'unit' | 'building' | 'equipment' | 'spell';
export type Stance = 'attack' | 'defense';
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
export interface CardInstance { uid: string; cardId: CardId }
export interface Modifier {
  origin: CardId;
  attack: number;
  health: number;
  sourceUid?: string;
  expiresAtTurn?: number;
}
export interface Permanent extends CardInstance {
  damage: number;
  attacksUsed: number;
  stance: Stance;
  stanceChanged: boolean;
  modifiers: Modifier[];
  protectedBy?: string;
  auraActive: boolean;
  // Separate from modifiers: dispelling a potion does not cancel its hangover.
  potions: { expiresAtTurn: number }[];
  stuns: { sourceOwner: PlayerId; expiresAtOwnerTurn: number }[];
}
export interface PlayerState {
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
  | { type: 'createEnergy'; cardUid: string }
  | { type: 'playCard'; cardUid: string; targetUid?: string; debuff?: Debuff }
  | { type: 'setStance'; unitUid: string; stance: Stance }
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
  seed: number;
  currentPlayer: PlayerId;
  firstPlayer: PlayerId;
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
  self: PublicPlayer & { hand: CardInstance[]; energyCreated: boolean };
  opponent: PublicPlayer;
}
export type BotKind = 'random' | 'aggressive' | 'control';
export interface GameOptions {
  seed?: number;
  firstPlayer?: PlayerId;
  rules?: Partial<Rules>;
  catalogs?: [Catalog, Catalog];
  deckSeeds?: [number, number];
  botSeeds?: [number, number];
  bots?: [BotKind, BotKind];
  trace?: boolean;
}
