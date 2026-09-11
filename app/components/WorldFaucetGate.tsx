'use client';

/**
 * Faucet claim, gated on World ID Selfie Check.
 *
 * The faucet used to be deliberately invisible: a new player's wallet was funded the
 * instant it existed, with no button, because a button between a player and the thing
 * they came to do is just a step. That is still the behaviour when World ID is not
 * configured, and still the behaviour for anyone who does not need money.
 *
 * A selfie cannot be silent, though, so when the gate is armed there is exactly one
 * interruption and it is framed as what it is — free money on the other side of a
 * five-second check, not a chore. It is only ever shown to someone the server has already
 * confirmed it would pay, so nobody is asked to verify for nothing.
 *
 * Order matters here: we try the claim first and let the SERVER decide whether a proof is
 * needed. Asking the client to reason about eligibility would mean trusting the client
 * with the answer, and the client is the one thing in this flow with a motive to lie.
 */
import { useEffect, useRef, useState } from 'react';
import { IDKitRequestWidget, selfieCheckLegacy, type IDKitResult, type RpContext } from '@worldcoin/idkit';

const SOCKET_BASE = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

interface WorldConfig {
  enabled: boolean;
  appId: string;
  rpId: string;
  action: string;
  environment: 'staging' | 'production';
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'needs-verification' }
  | { kind: 'verifying' }
  | { kind: 'funded'; amount: string; txHash: string }
  | { kind: 'error'; message: string };

export function WorldFaucetGate({ address, userId }: { address: string | null; userId: string | null }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [world, setWorld] = useState<WorldConfig | null>(null);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [widgetOpen, setWidgetOpen] = useState(false);
  // Guards React's double-invoked effects in development from firing two claims for the
  // same address. Every guard that actually matters is server-side.
  const attempted = useRef<string | null>(null);

  // Try the claim as soon as there is a wallet. The server answers with either "funded",
  // a plain refusal, or "you need to prove you're human first".
  useEffect(() => {
    if (!address || attempted.current === address) return;
    attempted.current = address;

    (async () => {
      try {
        const res = await fetch(`${SOCKET_BASE}/arc/faucet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, userId }),
        });
        const data = await res.json();

        if (data?.ok) {
          setPhase({ kind: 'funded', amount: data.amount, txHash: data.txHash });
          return;
        }
        if (data?.needsWorldId) {
          const cfg = await fetch(`${SOCKET_BASE}/world/config`).then((r) => r.json());
          if (cfg?.enabled) {
            setWorld(cfg);
            setPhase({ kind: 'needs-verification' });
          }
          return;
        }
        // Every other refusal is "you already have money" or "the faucet is off", and
        // neither is worth interrupting a player with. The stake panel raises it later if
        // they genuinely cannot afford a buy-in.
      } catch {
        /* Silent — see above. */
      }
    })();
  }, [address, userId]);

  /**
   * Fetch a fresh RP signature and open the widget.
   *
   * Signatures are short-lived, so this is pulled per attempt rather than once on mount —
   * a player who leaves the prompt sitting and comes back would otherwise present an
   * expired one and see a failure that looks like the credential was rejected.
   */
  async function beginVerification() {
    if (!world) return;
    setPhase({ kind: 'verifying' });
    try {
      const sig = await fetch(`${SOCKET_BASE}/world/rp-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: world.action }),
      }).then((r) => r.json());

      if (!sig?.signature) {
        setPhase({ kind: 'error', message: 'Could not start verification. Try again.' });
        return;
      }
      setRpContext({
        rp_id: world.rpId,
        nonce: sig.nonce,
        created_at: sig.created_at,
        expires_at: sig.expires_at,
        signature: sig.signature,
      });
      setWidgetOpen(true);
    } catch {
      setPhase({ kind: 'error', message: 'Could not reach the server. Try again.' });
    }
  }

  /**
   * Send the proof to our server, which forwards it to World for verification and — only
   * if it checks out — releases the drip.
   *
   * The proof goes to the server rather than being verified in the browser on purpose:
   * a client-side "verified: true" is worth nothing, and the nullifier that keys the
   * ledger has to be one the server watched World confirm.
   */
  async function submitProof(result: IDKitResult) {
    const res = await fetch(`${SOCKET_BASE}/arc/faucet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, userId, proof: result }),
    });
    const data = await res.json();
    if (!data?.ok) {
      // Thrown so IDKit surfaces it as a failed verification rather than closing as if it
      // had worked.
      throw new Error(data?.reason || 'Verification failed.');
    }
    setPhase({ kind: 'funded', amount: data.amount, txHash: data.txHash });
  }

  if (phase.kind === 'idle') return null;

  if (phase.kind === 'funded') {
    return (
      <div className="mb-4 bg-[#1f3d1f] p-3 pixel-border text-center">
        <p className="text-sm text-[#a8e063]">
          {phase.amount} USDC sent to your wallet — you&apos;re ready to play.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 bg-[#261309] p-4 pixel-border text-center">
      <h3 className="pixel-font text-sm uppercase tracking-wider text-[#ffc93c] mb-2">
        Claim 2 USDC
      </h3>
      <p className="mb-4 text-[12px] leading-relaxed text-[#f4e7c3]/70">
        Ranked matches need a buy-in, so the first one is on us. One quick check that
        you&apos;re a real person — no ID, no name, nothing stored about your face.
      </p>

      {phase.kind === 'error' && (
        <p className="mb-3 text-[12px] text-[#E8503A]">{phase.message}</p>
      )}

      <button
        onClick={beginVerification}
        disabled={phase.kind === 'verifying'}
        className="w-full px-6 py-3 bg-[#ffc93c] text-[#1a1a1a] pixel-font font-bold hover:brightness-110 transition disabled:opacity-50"
      >
        {phase.kind === 'verifying' ? 'Opening World ID…' : 'Verify & claim'}
      </button>

      <p className="mt-3 text-[10px] text-[#f4e7c3]/40">
        Verified with World ID Selfie Check. Stops one person claiming the faucet
        from ten different emails.
      </p>

      {world && rpContext && (
        <IDKitRequestWidget
          open={widgetOpen}
          onOpenChange={setWidgetOpen}
          app_id={world.appId as `app_${string}`}
          action={world.action}
          rp_context={rpContext}
          environment={world.environment}
          // Selfie Check is issued as a World ID 3.0-era credential, so the request has
          // to accept legacy proofs. With this false the widget opens and then finds
          // nothing it is willing to accept.
          allow_legacy_proofs={true}
          // Bound to the wallet being funded, so a proof captured for one address cannot
          // be replayed to fund another.
          preset={selfieCheckLegacy({ signal: address ?? '' })}
          handleVerify={submitProof}
          onSuccess={() => setWidgetOpen(false)}
          onError={() =>
            setPhase({ kind: 'error', message: 'Verification didn’t complete. Try again.' })
          }
        />
      )}
    </div>
  );
}
