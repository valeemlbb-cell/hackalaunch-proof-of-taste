import './polyfill';

import './styles/app.css';
import './styles/receipt.css';

import { DEFAULT_RPC, connection, resolveCluster, rpcEndpoint, setRpcEndpoint } from './lib/cluster';
import { initMintPanel, setSignatureHandler } from './ui/mintPanel';
import { initVerifyPanel, prefillVerify } from './ui/verifyPanel';
import { requireEl } from './ui/dom';

function initTabs(): void {
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab'));
  const show = (name: string) => {
    for (const tab of tabs) tab.classList.toggle('is-active', tab.dataset.tab === name);
    requireEl('#panel-mint').classList.toggle('is-hidden', name !== 'mint');
    requireEl('#panel-verify').classList.toggle('is-hidden', name !== 'verify');
  };
  for (const tab of tabs) tab.addEventListener('click', () => show(tab.dataset.tab ?? 'mint'));
  (window as Window & { showTab?: (name: string) => void }).showTab = show;
}

function initRpcControl(): void {
  const label = requireEl('#rpc-label');
  const paint = () => {
    label.textContent = rpcEndpoint().replace(/^https?:\/\//, '');
  };
  paint();
  requireEl('#rpc-change').addEventListener('click', () => {
    const next = window.prompt(
      'Devnet RPC endpoint. This is stored in your browser only. Leave blank to reset.',
      rpcEndpoint(),
    );
    if (next === null) return;
    setRpcEndpoint(next.trim() || DEFAULT_RPC);
    paint();
    void showCluster();
  });
}

/** Ask the chain which chain it is, and print the answer rather than a claim. */
async function showCluster(): Promise<void> {
  const label = requireEl('#cluster-label');
  try {
    label.textContent = await resolveCluster(connection());
  } catch {
    label.textContent = 'unreachable';
  }
}

function boot(): void {
  initTabs();
  initRpcControl();
  void showCluster();
  initMintPanel();
  initVerifyPanel();
  setSignatureHandler((signature) => {
    prefillVerify(signature);
  });
}

boot();
