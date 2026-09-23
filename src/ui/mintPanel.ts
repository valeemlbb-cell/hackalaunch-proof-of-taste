/**
 * The mint flow.
 *
 * Order of operations matters and is the point of the whole project:
 *   build -> disclose -> gate -> sign -> confirm -> offer the proof
 * The sign button does not exist until a receipt has been rendered, and it
 * stays disabled until the risks are acknowledged. A receipt that contains an
 * instruction the decoder could not explain can never enable it at all.
 */

import { Keypair } from '@solana/web3.js';

import { buildBadge, type BuiltBadge } from '../lib/badge';
import { CHAIN, connection, explorerTx, isMainnet, resolveCluster } from '../lib/cluster';
import { canonicalReceipt } from '../lib/receipt';
import { TASTES, type Taste, tasteById } from '../lib/tastes';
import { burnerSigner, detectWallets, forgetBurner, type Signer } from '../lib/wallet';
import { sol, shortAddress } from '../lib/format';
import { el, mount, requireEl } from './dom';
import { renderReceipt, type Stamp } from './receiptView';

interface State {
  taste: Taste;
  cluster: string;
  signer: Signer | null;
  built: BuiltBadge | null;
  stamp: Stamp;
  acknowledged: boolean;
  busy: boolean;
  message: string;
  error: string;
  signature: string;
}

const state: State = {
  taste: TASTES[0],
  cluster: 'devnet',
  signer: null,
  built: null,
  stamp: 'draft',
  acknowledged: false,
  busy: false,
  message: '',
  error: '',
  signature: '',
};

let onSignature: (signature: string) => void = () => {};

export function setSignatureHandler(handler: (signature: string) => void): void {
  onSignature = handler;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong and this app will not guess what.';
}

/* ── taste picker ──────────────────────────────────────────────────────── */

function renderTastes(): void {
  const grid = requireEl('#taste-grid');
  grid.replaceChildren(
    ...TASTES.map((taste) => {
      const card = el(
        'button',
        {
          type: 'button',
          class: 'taste-card',
          'aria-pressed': String(taste.id === state.taste.id),
          'data-taste-id': taste.id,
        },
        [el('b', {}, [taste.name]), el('small', {}, [taste.tagline])],
      );
      card.addEventListener('click', () => selectTaste(taste.id));
      return card;
    }),
  );
}

function selectTaste(id: string): void {
  state.taste = tasteById(id);
  document.documentElement.dataset.taste = id;
  state.built = null;
  state.stamp = 'draft';
  state.acknowledged = false;
  state.signature = '';
  state.message = '';
  renderTastes();
  renderSigner();
  if (state.signer) void build();
  else renderStage();
}

/* ── signer ────────────────────────────────────────────────────────────── */

function renderSigner(): void {
  const box = requireEl('#signer-box');
  const children: Node[] = [el('h2', {}, ['Who signs'])];

  if (state.signer) {
    children.push(
      el('p', { class: 'signer__meta' }, [`${state.signer.label} · ${state.signer.address.toBase58()}`]),
    );
    const row = el('div', { class: 'signer__row' }, []);
    const rebuild = el('button', { class: 'btn', type: 'button' }, ['Rebuild transaction']);
    rebuild.addEventListener('click', () => void build());
    row.append(rebuild);

    if (state.signer.kind === 'burner') {
      const airdrop = el('button', { class: 'btn', type: 'button' }, ['Request 1 devnet SOL']);
      airdrop.addEventListener('click', () => void airdropBurner());
      const forget = el('button', { class: 'btn', type: 'button' }, ['Forget this burner']);
      forget.addEventListener('click', () => {
        forgetBurner();
        state.signer = null;
        state.built = null;
        renderSigner();
        renderStage();
      });
      row.append(airdrop, forget);
    }
    children.push(row);
    if (state.signer.kind === 'burner') {
      children.push(
        el('p', { class: 'note' }, [
          'A throwaway devnet key is stored in this browser — press “Forget this burner” to erase it. It is never sent anywhere, it holds only devnet SOL, which is worthless, and this app will never ask you for a seed phrase or a private key. Never put real funds in it.',
        ]),
      );
    }
  } else {
    const wallets = detectWallets(CHAIN);
    const row = el('div', { class: 'signer__row' }, []);
    for (const option of wallets) {
      const button = el('button', { class: 'btn btn--primary', type: 'button' }, [option.name]);
      button.addEventListener('click', () => void connect(option.connect));
      row.append(button);
    }
    const burner = el('button', { class: 'btn', type: 'button' }, ['Use a devnet burner instead']);
    burner.addEventListener('click', () => void connect(async () => burnerSigner()));
    row.append(burner);
    children.push(row);
    children.push(
      el('p', { class: 'note' }, [
        wallets.length > 0
          ? 'Connecting only shares your public address. This app never asks for a seed phrase or a private key.'
          : 'No Solana wallet detected in this browser. The devnet burner lets you try the whole flow anyway — it is generated locally and holds only test SOL.',
      ]),
    );
  }

  if (state.error) children.push(el('p', { class: 'note note--warn' }, [state.error]));
  if (state.message) children.push(el('p', { class: 'note' }, [state.message]));

  box.replaceChildren(...children);
}

async function connect(connector: () => Promise<Signer>): Promise<void> {
  state.error = '';
  try {
    state.signer = await connector();
    renderSigner();
    await build();
  } catch (error) {
    state.error = errorText(error);
    renderSigner();
  }
}

async function airdropBurner(): Promise<void> {
  if (!state.signer) return;
  state.error = '';
  state.message = 'Asking the devnet faucet for 1 SOL…';
  renderSigner();
  try {
    const conn = connection();
    const signature = await conn.requestAirdrop(state.signer.address, 1_000_000_000);
    const latest = await conn.getLatestBlockhash('confirmed');
    await conn.confirmTransaction({ signature, ...latest }, 'confirmed');
    const balance = await conn.getBalance(state.signer.address, 'confirmed');
    state.message = `Balance: ${sol(balance)}.`;
  } catch (error) {
    state.message = '';
    state.error = `The public devnet faucet refused: ${errorText(error)}. Try faucet.solana.com, or set your own RPC at the bottom of the page.`;
  }
  renderSigner();
}

/* ── build + sign ──────────────────────────────────────────────────────── */

async function build(): Promise<void> {
  if (!state.signer || state.busy) return;
  state.busy = true;
  state.error = '';
  state.acknowledged = false;
  state.stamp = 'draft';
  state.signature = '';
  renderStage();
  try {
    const conn = connection();
    const cluster = await resolveCluster(conn);
    if (isMainnet(cluster)) {
      throw new Error(
        'That RPC points at mainnet-beta. This app is devnet-only and will not build a transaction that spends real SOL.',
      );
    }
    state.cluster = cluster;
    state.built = await buildBadge(conn, state.signer.address, Keypair.generate(), state.taste, cluster);
  } catch (error) {
    state.built = null;
    state.error = errorText(error);
    renderSigner();
  } finally {
    state.busy = false;
    renderStage();
  }
}

async function sign(): Promise<void> {
  if (!state.built || !state.signer || state.built.receipt.blocked) return;
  state.busy = true;
  state.error = '';
  renderStage();
  try {
    const conn = connection();
    const signature = await state.signer.signAndSend(state.built.transaction, conn);
    state.signature = signature;
    state.stamp = 'sent';
    renderStage();

    const latest = await conn.getLatestBlockhash('confirmed');
    const outcome = await conn.confirmTransaction(
      { signature, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
      'confirmed',
    );
    state.stamp = outcome.value.err ? 'bad' : 'ok';
    if (outcome.value.err) state.error = `The cluster rejected it: ${JSON.stringify(outcome.value.err)}`;
    else onSignature(signature);
  } catch (error) {
    state.stamp = 'bad';
    state.error = errorText(error);
  } finally {
    state.busy = false;
    renderStage();
  }
}

/* ── the gate under the receipt ────────────────────────────────────────── */

function footer(): HTMLElement {
  const built = state.built!;
  const blocked = built.receipt.blocked;

  const checkbox = el('input', { type: 'checkbox', id: 'ack' }) as HTMLInputElement;
  checkbox.checked = state.acknowledged;
  checkbox.disabled = blocked || state.stamp !== 'draft';
  checkbox.addEventListener('change', () => {
    state.acknowledged = checkbox.checked;
    button.disabled = !state.acknowledged || state.busy;
  });

  const button = el('button', { class: 'btn btn--primary btn--wide', type: 'button' }, [
    state.busy ? 'Working…' : `Sign and mint the ${state.taste.name} badge`,
  ]) as HTMLButtonElement;
  button.disabled = blocked || !state.acknowledged || state.busy || state.stamp !== 'draft';
  button.addEventListener('click', () => void sign());

  const children: Node[] = [
    el('label', { for: 'ack' }, [
      checkbox,
      el('span', {}, [
        `I have read the four sections above. I understand ${sol(
          built.receipt.totalLamports - built.receipt.refundableLamports,
        )} does not come back.`,
      ]),
    ]),
    button,
  ];

  if (blocked) {
    children.push(
      el('p', { class: 'note note--warn' }, [
        'Signing is disabled: this app could not explain every instruction, so it refuses to let you approve it.',
      ]),
    );
  }

  if (state.signature) {
    children.push(
      el('div', { class: 'result' }, [
        el('p', {}, [
          state.stamp === 'ok'
            ? 'Confirmed. The receipt hash is now on chain, in the memo and inside the badge itself.'
            : 'Signature submitted.',
        ]),
        el('a', { href: explorerTx(state.signature, state.cluster), target: '_blank', rel: 'noopener noreferrer' }, [
          `View ${shortAddress(state.signature, 8, 8)} on Solana Explorer`,
        ]),
      ]),
    );
  }

  if (state.error) children.push(el('p', { class: 'note note--warn' }, [state.error]));

  return el('div', { class: 'gate' }, children);
}

function renderStage(): void {
  const stage = requireEl('#receipt-stage');
  if (!state.signer) {
    mount(
      stage,
      el('p', { class: 'receipt-empty' }, [
        'Connect a signer to build the transaction.',
        el('br', {}),
        el('span', {}, ['Nothing is sent until you press sign.']),
      ]),
    );
    return;
  }
  if (!state.built) {
    mount(
      stage,
      el('p', { class: 'receipt-empty' }, [
        state.busy ? 'Building the transaction and pricing it…' : 'No transaction built.',
        el('br', {}),
        el('span', {}, [state.error || 'The receipt appears here before anything is signed.']),
      ]),
    );
    return;
  }
  mount(
    stage,
    renderReceipt(state.built.receipt, {
      receiptHash: state.built.receiptHash,
      stamp: state.stamp,
      canonical: canonicalReceipt(state.built.receipt),
      footer: footer(),
    }),
  );
}

export function initMintPanel(): void {
  document.documentElement.dataset.taste = state.taste.id;
  renderTastes();
  renderSigner();
  renderStage();
}
