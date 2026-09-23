/**
 * The verify flow: paste a signature, get an answer that does not depend on
 * this app remembering anything.
 */

import { connection, explorerTx, resolveCluster } from '../lib/cluster';
import { verifySignature, type VerifyResult } from '../lib/verify';
import { el, mount, requireEl } from './dom';
import { renderReceipt } from './receiptView';

let busy = false;

function verdict(result: VerifyResult): HTMLElement {
  const matches = result.matches;
  return el('div', { class: `verdict ${matches ? 'verdict--match' : 'verdict--mismatch'}` }, [
    el('span', { class: 'verdict__mark', 'aria-hidden': 'true' }, [matches ? '✓' : '✗']),
    el('span', { class: 'verdict__headline' }, [
      matches
        ? 'Match. The screen and the chain agree.'
        : 'Mismatch. This transaction does not match that receipt.',
    ]),
    el('span', {}, [
      el('span', { class: 'verdict__line' }, [`written into the transaction   ${result.claimedHash}`]),
      el('br', {}),
      el('span', { class: 'verdict__line' }, [`rebuilt from the chain         ${result.rebuiltHash}`]),
    ]),
  ]);
}

function footer(result: VerifyResult): HTMLElement {
  return el('div', { class: 'gate' }, [
    verdict(result),
    el('div', { class: 'result' }, [
      el('p', {}, [
        result.succeeded
          ? `Confirmed in slot ${result.slot}.`
          : `This transaction failed on chain (slot ${result.slot}).`,
      ]),
      el('a', { href: explorerTx(result.signature, result.receipt.cluster), target: '_blank', rel: 'noopener noreferrer' }, [
        'Open it on Solana Explorer',
      ]),
    ]),
  ]);
}

function renderMiss(reason: string): void {
  mount(
    requireEl('#verify-stage'),
    el('p', { class: 'receipt-empty' }, ['Nothing to verify.', el('br', {}), el('span', {}, [reason])]),
  );
}

async function run(signature: string): Promise<void> {
  if (busy) return;
  busy = true;
  mount(
    requireEl('#verify-stage'),
    el('p', { class: 'receipt-empty' }, [
      'Fetching the transaction and rebuilding the receipt from it…',
    ]),
  );
  try {
    const conn = connection();
    const result = await verifySignature(conn, signature, await resolveCluster(conn));
    if (!result.found) {
      renderMiss(result.reason);
      return;
    }
    mount(
      requireEl('#verify-stage'),
      renderReceipt(result.receipt, {
        receiptHash: result.rebuiltHash,
        stamp: result.matches && result.succeeded ? 'ok' : 'bad',
        canonical: result.canonical,
        chargedLamports: result.chargedLamports,
        footer: footer(result),
      }),
    );
  } catch (error) {
    renderMiss(error instanceof Error ? error.message : 'The RPC request failed.');
  } finally {
    busy = false;
  }
}

export function initVerifyPanel(): void {
  const form = requireEl<HTMLFormElement>('#verify-form');
  const input = requireEl<HTMLInputElement>('#verify-input');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void run(input.value);
  });
}

/** Called after a successful mint so the proof is one click away. */
export function prefillVerify(signature: string): void {
  requireEl<HTMLInputElement>('#verify-input').value = signature;
}
