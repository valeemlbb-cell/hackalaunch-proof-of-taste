/**
 * @solana/web3.js and the SPL libraries read a Node-style `Buffer` global while
 * their own modules are still evaluating. ES module imports run in order, so
 * this file has to be the first import in the entry point — putting the same
 * assignment inside main.ts would run too late.
 */

import { Buffer } from 'buffer';

const scope = globalThis as unknown as { Buffer?: typeof Buffer };
if (!scope.Buffer) scope.Buffer = Buffer;
