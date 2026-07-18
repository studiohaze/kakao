/* tslint:disable */
/* eslint-disable */

/**
 * Type-check a source (the `topaz check` gate).
 */
export function check(src: string): string;

/**
 * Run a source after the same static gate `topaz run` applies.
 */
export function run(src: string): string;

/**
 * Run a source with a host `input()` payload — the Markdown live editor passes
 * its textarea value here, so `let md = input(); print(renderMarkdown(md))`
 * renders on every keystroke. Same static gate as `run`; the payload reaches the
 * program through the SAME `TestHost`/`builtin_input` leaf the native engine uses.
 */
export function run_with_input(src: string, input: string): string;

/**
 * Module-aware run: resolve, type-check, and run a multi-file unit from a JSON
 * `{ "path.tpz": "source", ... }` map, returning the same `Outcome` JSON as
 * `run_with_input`. `entry` is the virtual entry path (e.g. `"main.tpz"`) and
 * `root` is the virtual module root (`""` for the map's top level). The
 * single-file `run`/`run_with_input` path is unchanged for existing apps.
 */
export function run_with_modules(entry: string, root: string, modules_json: string, input: string): string;

/**
 * The Topaz toolchain version (e.g. `5.4.0`) — the reproducibility stamp reports the exact
 * toolchain that produced a result. (The playground crate itself is unversioned; this is the
 * workspace/language-line version from `topaz_syntax`.)
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly check: (a: number, b: number) => [number, number];
    readonly run: (a: number, b: number) => [number, number];
    readonly run_with_input: (a: number, b: number, c: number, d: number) => [number, number];
    readonly run_with_modules: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly version: () => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
