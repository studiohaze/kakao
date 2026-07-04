declare module '/topaz/topaz_wasm.js' {
  const init: (moduleOrPath?: unknown) => Promise<unknown>;
  export default init;
  export function run_with_modules(entry: string, root: string, modulesJson: string, input: string): string;
}
