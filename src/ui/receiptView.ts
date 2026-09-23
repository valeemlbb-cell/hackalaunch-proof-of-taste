/**
 * Renders a Receipt as the paper object that gives this project its name.
 * Pure rendering: no network, no state, no side effects.
 */

import { sol, shortAddress } from '../lib/format';
import type { Receipt } from '../lib/receipt';
import { el } from './dom';

export type Stamp = 'draft' | 'sent' | 'ok' | 'bad';

function stampText(stamp: Stamp, cluster: string): string {
  switch (stamp) {
    case 'draft':
      return 'Not signed yet';
    case 'sent':
      return 'Sent — awaiting confirmation';
    case 'ok':
      return `Confirmed on ${cluster}`;
    case 'bad':
      return 'Failed';
  }
}

export interface ReceiptViewOptions {
  receiptHash: string;
  stamp: Stamp;
  canonical: string;
  /** Rendered under the costs when the chain has spoken. */
  chargedLamports?: number | null;
  /** Appended at the bottom: the gate, the button, the result. */
  footer?: Node;
}

function section(title: string, body: Node): HTMLElement {
  return el('section', {}, [el('h3', {}, [title]), body]);
}

function stepList(receipt: Receipt): HTMLElement {
  return el(
    'ol',
    { class: 'steps' },
    receipt.steps.map((step) =>
      el('li', { class: step.action === 'unknown' ? 'is-unknown' : '' }, [
        el('p', {}, [step.summary]),
        ...step.details.map((detail) => el('p', { class: 'detail' }, [detail])),
      ]),
    ),
  );
}

function costList(receipt: Receipt, chargedLamports?: number | null): HTMLElement {
  const rows = receipt.costs.map((cost) =>
    el('div', { class: `cost${cost.refundable ? ' cost--refundable' : ''}` }, [
      el('span', { class: 'cost__label' }, [cost.label]),
      el('span', { class: 'cost__amount' }, [sol(cost.lamports)]),
      el('span', { class: 'cost__note' }, [cost.note]),
    ]),
  );

  rows.push(
    el('div', { class: 'cost cost--total' }, [
      el('span', { class: 'cost__label' }, ['Leaves your wallet now']),
      el('span', { class: 'cost__amount' }, [sol(receipt.totalLamports)]),
      el('span', { class: 'cost__note' }, [
        `${sol(receipt.refundableLamports)} of that is a refundable deposit you can reclaim.`,
      ]),
    ]),
  );

  rows.push(
    el('div', { class: 'cost cost--net' }, [
      el('span', { class: 'cost__label' }, ['Gone for good']),
      el('span', { class: 'cost__amount' }, [
        sol(receipt.totalLamports - receipt.refundableLamports),
      ]),
    ]),
  );

  if (chargedLamports === null) {
    rows.push(
      el('div', { class: 'cost' }, [
        el('span', { class: 'cost__label' }, ['The chain actually took']),
        el('span', { class: 'cost__amount' }, ['not shown']),
        el('span', { class: 'cost__note' }, [
          'This signer holds more lamports than JavaScript can subtract exactly, so this app will not print a comparison it cannot stand behind.',
        ]),
      ]),
    );
  } else if (chargedLamports !== undefined) {
    const matches = chargedLamports === receipt.totalLamports;
    rows.push(
      el('div', { class: 'cost' }, [
        el('span', { class: 'cost__label' }, ['The chain actually took']),
        el('span', { class: 'cost__amount' }, [sol(chargedLamports)]),
        el('span', { class: 'cost__note' }, [
          matches
            ? 'Exactly the figure on the receipt.'
            : `Differs from the quote by ${sol(chargedLamports - receipt.totalLamports)}.`,
        ]),
      ]),
    );
  }

  return el('div', { class: 'costs' }, rows);
}

function bullets(items: string[], variant?: string): HTMLElement {
  return el(
    'ul',
    { class: `bullets${variant ? ` ${variant}` : ''}` },
    items.map((item) =>
      el('li', { class: item.startsWith('STOP') ? 'is-blocking' : '' }, [item]),
    ),
  );
}

export function renderReceipt(receipt: Receipt, options: ReceiptViewOptions): HTMLElement {
  return el('article', { class: 'receipt' }, [
    el('div', { class: `receipt__stamp receipt__stamp--${options.stamp}` }, [
      stampText(options.stamp, receipt.cluster),
    ]),
    el('header', { class: 'receipt__head' }, [
      el('h2', { class: 'receipt__title' }, ['Mint a Taste Badge']),
      el('div', { class: 'receipt__sub' }, [
        el('span', {}, [`cluster ${receipt.cluster}`]),
        el('span', {}, [`taste ${receipt.taste}`]),
        el('span', {}, [`signer ${shortAddress(receipt.signer, 6, 6)}`]),
        el('span', {}, [`mint ${shortAddress(receipt.mint, 6, 6)}`]),
      ]),
    ]),

    section('What this transaction does, step by step', stepList(receipt)),
    section('What it costs', costList(receipt, options.chargedLamports)),
    section('What you get back', bullets(receipt.youGet)),
    section('What can go wrong', bullets(receipt.risks, 'bullets--risk')),

    el('div', { class: 'hashstrip' }, [
      el('span', { class: 'hashstrip__label' }, ['SHA-256 of this receipt — written into the transaction']),
      el('span', { class: 'hashstrip__value' }, [options.receiptHash]),
    ]),

    el('details', { class: 'raw' }, [
      el('summary', {}, ['Show the exact bytes being hashed']),
      el('pre', {}, [options.canonical]),
    ]),

    options.footer ?? null,
  ]);
}
