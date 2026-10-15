import { Buffer } from "buffer";
// The cell codec also runs in browsers, where Buffer is not a platform global.
if (!(globalThis as unknown as { Buffer?: typeof Buffer }).Buffer) {
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

export const CellBuffer = (globalThis as unknown as { Buffer: typeof Buffer }).Buffer;
