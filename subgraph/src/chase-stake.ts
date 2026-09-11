import { BigInt, Bytes, Address } from "@graphprotocol/graph-ts";
import {
  MatchCreated,
  PlayerJoined,
  MatchSettled,
  Refunded,
} from "../generated/ChaseStake/ChaseStake";
import { Match, Stake, Player, Protocol } from "../generated/schema";

const ZERO = BigInt.fromI32(0);

/**
 * Global counters. Created on first use rather than in a block handler, so the subgraph
 * has nothing to do until the escrow actually sees traffic.
 */
function protocol(): Protocol {
  let p = Protocol.load("global");
  if (p == null) {
    p = new Protocol("global");
    p.totalMatches = 0;
    p.settledMatches = 0;
    p.totalPlayers = 0;
    p.totalVolume = ZERO;
    p.totalPaidOut = ZERO;
  }
  return p as Protocol;
}

/**
 * Players are created lazily on first stake.
 *
 * `totalPlayers` increments only here, which is what makes it a genuine unique-wallet
 * count rather than a count of stakes.
 */
function player(addr: Address, ts: BigInt): Player {
  let id = addr as Bytes;
  let p = Player.load(id);
  if (p == null) {
    p = new Player(id);
    p.matchesPlayed = 0;
    p.matchesWon = 0;
    p.totalStaked = ZERO;
    p.totalWon = ZERO;
    p.totalRefunded = ZERO;
    p.netProfit = ZERO;
    p.biggestPot = ZERO;
    p.firstSeenAt = ts;
    p.lastPlayedAt = ts;

    let proto = protocol();
    proto.totalPlayers = proto.totalPlayers + 1;
    proto.save();
  }
  return p as Player;
}

/** netProfit is stored rather than computed at query time so it can be sorted on. */
function recomputeNet(p: Player): void {
  p.netProfit = p.totalWon.plus(p.totalRefunded).minus(p.totalStaked);
}

export function handleMatchCreated(event: MatchCreated): void {
  let m = new Match(event.params.matchId);
  m.host = event.params.host;
  m.stake = event.params.stake;
  m.pot = ZERO; // the host's own join arrives as a separate PlayerJoined
  m.deadline = event.params.deadline;
  m.settled = false;
  m.createdAt = event.block.timestamp;
  m.createdTx = event.transaction.hash;
  m.save();

  let proto = protocol();
  proto.totalMatches = proto.totalMatches + 1;
  proto.save();
}

export function handlePlayerJoined(event: PlayerJoined): void {
  let m = Match.load(event.params.matchId);
  // A join without a create would mean indexing started mid-history; skip rather than
  // invent a Match with fields we cannot know.
  if (m == null) return;

  // The contract reports the running pot, so trust it over accumulating locally —
  // that stays correct even if an event is ever reordered or replayed.
  m.pot = event.params.pot;
  m.save();

  let p = player(event.params.player, event.block.timestamp);
  p.matchesPlayed = p.matchesPlayed + 1;
  p.totalStaked = p.totalStaked.plus(event.params.stake);
  p.lastPlayedAt = event.block.timestamp;
  recomputeNet(p);
  p.save();

  let s = new Stake(
    event.params.matchId.toHexString() + "-" + event.params.player.toHexString()
  );
  s.match = m.id;
  s.player = p.id;
  s.amount = event.params.stake;
  s.refunded = false;
  s.joinedAt = event.block.timestamp;
  s.tx = event.transaction.hash;
  s.save();

  let proto = protocol();
  proto.totalVolume = proto.totalVolume.plus(event.params.stake);
  proto.save();
}

export function handleMatchSettled(event: MatchSettled): void {
  let m = Match.load(event.params.matchId);
  if (m == null) return;

  m.settled = true;
  m.winner = event.params.winner;
  m.payout = event.params.pot;
  m.settledAt = event.block.timestamp;
  m.settledTx = event.transaction.hash;
  m.save();

  let p = player(event.params.winner, event.block.timestamp);
  p.matchesWon = p.matchesWon + 1;
  p.totalWon = p.totalWon.plus(event.params.pot);
  if (event.params.pot.gt(p.biggestPot)) p.biggestPot = event.params.pot;
  recomputeNet(p);
  p.save();

  let proto = protocol();
  proto.settledMatches = proto.settledMatches + 1;
  proto.totalPaidOut = proto.totalPaidOut.plus(event.params.pot);
  proto.save();
}

export function handleRefunded(event: Refunded): void {
  let s = Stake.load(
    event.params.matchId.toHexString() + "-" + event.params.player.toHexString()
  );
  if (s != null) {
    s.refunded = true;
    s.save();
  }

  // A refund returns the buy-in, so it offsets the stake rather than counting as
  // winnings — otherwise reclaiming your own money would climb the leaderboard.
  let p = player(event.params.player, event.block.timestamp);
  p.totalRefunded = p.totalRefunded.plus(event.params.amount);
  recomputeNet(p);
  p.save();
}
