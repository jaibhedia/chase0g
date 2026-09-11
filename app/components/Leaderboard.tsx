'use client';

/**
 * Leaderboard, read from the ChaseStake subgraph on Arc.
 *
 * Every row here is reconstructed from escrow events — no server, no database, no
 * trusting us. Anyone can run the same query against the same endpoint and get the same
 * table, which is the part that makes it worth showing on a staking game rather than
 * just counting wins in Postgres.
 *
 * Ranked by netProfit rather than wins: in a game where every match costs a buy-in,
 * "won the most rounds" and "is up the most money" are different people, and the second
 * is the one players actually care about.
 */
import { useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { USDC_DECIMALS } from '@/lib/arc/chaseStake';
import { arcAddressUrl } from '@/lib/arc/chain';

const ENDPOINT = process.env.NEXT_PUBLIC_SUBGRAPH_URL || '';

const QUERY = `{
  players(first: 10, orderBy: netProfit, orderDirection: desc, where: { matchesPlayed_gt: 0 }) {
    id
    matchesPlayed
    matchesWon
    totalWon
    netProfit
  }
}`;

interface Row {
  id: string;
  matchesPlayed: number;
  matchesWon: number;
  totalWon: string;
  netProfit: string;
}

function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** USDC with a sign, so a losing row reads as a loss rather than a small number. */
function signed(raw: string): string {
  const n = Number(formatUnits(BigInt(raw), USDC_DECIMALS));
  const s = n.toFixed(2);
  return n > 0 ? `+${s}` : s;
}

export function Leaderboard({ highlight }: { highlight?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ENDPOINT) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: QUERY }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (Array.isArray(json?.data?.players)) setRows(json.data.players);
        else setFailed(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // No endpoint configured, the query failed, or the subgraph is still syncing and has
  // nothing yet — in every case say nothing rather than render an empty table, which
  // reads as a broken feature instead of an absent one.
  if (!ENDPOINT || failed || !rows || rows.length === 0) return null;

  return (
    <div className="p-5 pixel-panel text-left">
      <h3 className="pixel-font mb-1 text-center text-sm uppercase tracking-wider text-[#ffc93c] md:text-lg">
        Leaderboard
      </h3>
      <p className="mb-4 text-center text-[11px] text-[#f4e7c3]/60">
        Indexed from Arc by The Graph — ranked by USDC won, net of buy-ins.
      </p>

      <div className="space-y-2">
        {rows.map((r, i) => {
          const isYou = highlight && r.id.toLowerCase() === highlight.toLowerCase();
          const net = Number(formatUnits(BigInt(r.netProfit), USDC_DECIMALS));
          return (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 bg-[#261309] p-3 pixel-border"
              style={isYou ? { borderColor: '#ffc93c' } : undefined}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 bg-[#4d2813] px-2 py-1 text-[10px] font-bold text-[#f4e7c3] pixel-border">
                  #{i + 1}
                </span>
                <a
                  href={arcAddressUrl(r.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate font-mono text-sm text-[#f4e7c3] hover:text-white"
                  title={r.id}
                >
                  {isYou ? 'You' : short(r.id)}
                </a>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <span className="text-[11px] text-[#f4e7c3]/50">
                  {r.matchesWon}/{r.matchesPlayed}
                </span>
                <span
                  className="text-sm font-black tabular-nums"
                  style={{ color: net > 0 ? '#6AB04C' : net < 0 ? '#E8503A' : '#f4e7c3' }}
                >
                  {signed(r.netProfit)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
