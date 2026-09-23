import { randomBytes } from 'node:crypto';
import { DECKS } from './cards.ts';
import { PlayError, PlaySession } from './play-session.ts';
import type { DeckId, PlayerId } from './types.ts';

const MAX_ROOMS = 1000;
const ROOM_IDLE_MS = 4 * 60 * 60 * 1000;

interface Room {
  code: string;
  tokens: [string, string | null];
  decks: [DeckId, DeckId | null];
  session: PlaySession;
  touched: number;
}

function deckId(value: unknown): DeckId {
  if (typeof value !== 'string' || !Object.hasOwn(DECKS, value)) throw new PlayError('Wybierz poprawną talię.');
  return value as DeckId;
}

export class OnlineRooms {
  private rooms = new Map<string, Room>();
  private seats = new Map<string, { room: Room; player: PlayerId }>();

  private prune() {
    const now = Date.now();
    for (const room of this.rooms.values()) if (now - room.touched > ROOM_IDLE_MS) {
      this.rooms.delete(room.code);
      for (const token of room.tokens) if (token) this.seats.delete(token);
    }
  }

  create(deck: unknown) {
    const selected = deckId(deck);
    this.prune();
    if (this.rooms.size >= MAX_ROOMS) throw new PlayError('Serwer ma już zbyt wiele aktywnych pokoi.', 503);
    let code: string;
    do { code = randomBytes(6).toString('hex').toUpperCase(); } while (this.rooms.has(code));
    const token = randomBytes(32).toString('hex');
    const room: Room = { code, tokens: [token, null], decks: [selected, null], session: new PlaySession(), touched: Date.now() };
    this.rooms.set(code, room);
    this.seats.set(token, { room, player: 0 });
    return { token, view: this.view(token) };
  }

  join(code: unknown, deck: unknown) {
    const selected = deckId(deck);
    this.prune();
    if (typeof code !== 'string' || !/^[0-9A-F]{12}$/.test(code.trim().toUpperCase())) throw new PlayError('Nieprawidłowy kod pokoju.');
    const room = this.rooms.get(code.trim().toUpperCase());
    if (!room) throw new PlayError('Nie znaleziono pokoju.', 404);
    if (room.tokens[1]) throw new PlayError('W pokoju grają już dwie osoby.', 409);
    const token = randomBytes(32).toString('hex');
    room.tokens[1] = token;
    room.decks[1] = selected;
    room.session.start({ decks: room.decks as [DeckId, DeckId], firstPlayer: 'random', revision: 0 });
    room.session.reveal(1);
    room.touched = Date.now();
    this.seats.set(token, { room, player: 1 });
    return { token, view: this.view(token) };
  }

  private seat(token: unknown) {
    this.prune();
    if (typeof token !== 'string' || !this.seats.has(token)) throw new PlayError('Sesja wygasła albo brak dostępu do pokoju.', 401);
    const seat = this.seats.get(token)!;
    seat.room.touched = Date.now();
    return seat;
  }

  cancel(token: unknown) {
    const { room, player } = this.seat(token);
    if (player !== 0 || room.tokens[1]) throw new PlayError('Można anulować tylko pokój oczekujący na drugiego gracza.', 409);
    this.rooms.delete(room.code);
    this.seats.delete(room.tokens[0]);
    return { phase: 'cancelled' as const };
  }

  view(token: unknown) {
    const { room, player } = this.seat(token);
    const common = { roomCode: room.code, seat: player, decks: room.decks };
    if (!room.tokens[1]) return { ...common, phase: 'waiting-for-guest' as const };
    const view = room.session.view();
    if (view.phase === 'finished') return { ...common, ...view };
    if (view.phase !== 'playing') throw new Error('Nieoczekiwany stan partii online.');
    return { ...common, ...room.session.viewFor(player) };
  }

  act(token: unknown, id: unknown, revision: unknown) {
    const { room, player } = this.seat(token);
    if (!room.tokens[1]) throw new PlayError('Poczekaj na drugiego gracza.', 409);
    const current = room.session.view();
    if (current.phase !== 'playing' || current.observation.player !== player) throw new PlayError('Poczekaj na swoją turę.', 403);
    const result = room.session.act(id, revision);
    if (result.phase === 'handoff') room.session.reveal(result.revision);
    return this.view(token);
  }
}
