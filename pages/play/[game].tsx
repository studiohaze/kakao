import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';
import fs from 'fs';
import path from 'path';
import GameFrame from '../../components/GameFrame';
import { isDomainWarSceneId } from '../../utils/domainWarRoutes';
import { highlightTopaz } from '../../utils/topazHighlight';

type ArcadeGame = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  basePath: string;
  entry: string;
  root: string;
  files: string[];
};

type ArcadeManifest = {
  schema: string;
  games: ArcadeGame[];
};

type LoadedModules = {
  entry: string;
  root: string;
  sourcesJson: string;
};

type TopazRuntime = {
  default: (moduleOrPath?: unknown) => Promise<unknown>;
  run_with_modules: (entry: string, root: string, modulesJson: string, input: string) => string;
};

type StepPacket = {
  state: string;
  scene: string;
  textKey: string;
  choiceKeys: string[];
};

type Props = {
  gameId: string;
  titleKey: string;
  descriptionKey: string;
  entry: string;
  root: string;
  sources: Record<string, string>;
  initialPacket: StepPacket | null;
};

function loadManifestFile(): ArcadeManifest {
  const filePath = path.join(process.cwd(), 'games', 'manifest.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as ArcadeManifest;
}

export const getStaticPaths: GetStaticPaths = async ({ locales, defaultLocale }) => {
  const manifest = loadManifestFile();
  const paths = [];
  for (const game of manifest.games) {
    if (locales && defaultLocale) {
      for (const locale of locales) {
        paths.push({ params: { game: game.id }, locale });
      }
    } else {
      paths.push({ params: { game: game.id } });
    }
  }
  return { paths, fallback: false };
};

// The opening scene is the deterministic start of the game (ch1_scene0). We derive its
// i18n keys from the scene-graph source of truth so the opening renders server-side
// without having to run the wasm at build time. Only domain-war ships today.
function deriveOpeningPacket(gameId: string): StepPacket | null {
  if (gameId !== 'domain-war') return null;
  try {
    const ch1 = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'data', 'gameContent', 'domain-ch1.json'), 'utf8')
    ) as Array<{ choices?: unknown[] }>;
    const choiceCount = Array.isArray(ch1?.[0]?.choices) ? ch1[0].choices!.length : 0;
    return {
      state: 'v1:ch1_scene0:',
      scene: 'ch1_scene0',
      textKey: 'domainCh1_scene0_text',
      choiceKeys: Array.from({ length: choiceCount }, (_, i) => `domainCh1_scene0_choice${i}_text`),
    };
  } catch {
    return null;
  }
}

export const getStaticProps: GetStaticProps<Props> = async ({ params, locale }) => {
  const gameId = String(params?.game || '');
  const manifest = loadManifestFile();
  const game = manifest.games.find((item) => item.id === gameId);
  if (!game) return { notFound: true };

  // Read the Topaz module sources at build time so the source (and the opening scene) live
  // in the static HTML, readable by crawlers, link-preview bots, and no-JS agents that never
  // run the wasm. In file order, so JSON.stringify(sources) matches the module map the wasm wants.
  const sources: Record<string, string> = {};
  for (const file of game.files) {
    sources[file] = fs.readFileSync(path.join(process.cwd(), 'games', game.basePath, file), 'utf8');
  }

  return {
    props: {
      ...(await serverSideTranslations(locale ?? 'ko', ['common'])),
      gameId,
      titleKey: game.titleKey,
      descriptionKey: game.descriptionKey,
      entry: game.entry,
      root: game.root,
      sources,
      initialPacket: deriveOpeningPacket(gameId),
    },
  };
};

function parseOutputPacket(output: string): StepPacket {
  const lines = output.split('\n');
  const state = lines.find((line) => line.startsWith('STATE:'))?.slice('STATE:'.length) ?? '';
  const scene = lines.find((line) => line.startsWith('SCENE:'))?.slice('SCENE:'.length) ?? 'ch1_scene0';
  const textKey = lines.find((line) => line.startsWith('TEXT:'))?.slice('TEXT:'.length) ?? '';
  const choices = lines.find((line) => line.startsWith('CHOICES:'))?.slice('CHOICES:'.length) ?? '';
  return {
    state,
    scene,
    textKey,
    choiceKeys: choices ? choices.split('|').filter(Boolean) : [],
  };
}

function packetFor(state: string, event: string): string {
  return `DW1\nSTATE:${state}\nEVENT:${event}`;
}

function stateForScene(sceneId: string): string {
  return `v1:${sceneId}:`;
}

function sceneFromQuery(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null;
  return isDomainWarSceneId(value) ? value : null;
}

export default function ArcadePlayer({
  gameId,
  titleKey,
  descriptionKey,
  entry,
  root,
  sources: initialSources,
  initialPacket,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const { t } = useTranslation('common');
  const router = useRouter();
  const runtimeRef = useRef<TopazRuntime | null>(null);
  const modulesRef = useRef<LoadedModules | null>(null);
  const stateRef = useRef(initialPacket?.state ?? '');
  const pendingSceneRef = useRef<string | null>(null);
  const [packet, setPacket] = useState<StepPacket | null>(initialPacket);
  const [sources] = useState<Record<string, string>>(initialSources);
  const [sourceFile, setSourceFile] = useState(entry);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [loading, setLoading] = useState(!initialPacket);
  const [error, setError] = useState<string | null>(null);
  // 부트는 게임당 1회만. runEvent 의존성이 라우터 쿼리 변경마다 새 참조가 되어
  // 부트가 재실행되면, 딥링크 규약(빈 방문경로)이 진행 중인 뒤로 스택을 덮어쓴다.
  // Boot once per game: runEvent's identity changes with every query update, and a
  // re-boot rebuilds a deep-link state whose empty visited path wipes the back stack.
  const bootedGameRef = useRef<string | null>(null);

  const title = t(titleKey);
  const description = t(descriptionKey);
  // The wasm wants the module map as JSON. Derive it from the seeded sources so it is not
  // shipped twice in the page payload; key order matches the build-time file order.
  const sourcesJson = useMemo(() => JSON.stringify(sources), [sources]);
  // No-JS / crawler fallback source, derived from the same seeded sources (not shipped twice).
  const noscriptSource = useMemo(
    () => Object.entries(sources).map(([file, src]) => `// ===== ${file} =====\n${src}`).join('\n\n\n'),
    [sources]
  );

  const replaceSceneUrl = useCallback(
    (scene: string) => {
      pendingSceneRef.current = scene;
      router.push(
        { pathname: '/play/[game]', query: { game: gameId, at: scene } },
        undefined,
        { shallow: true }
      );
    },
    [gameId, router]
  );

  const runEvent = useCallback(
    (event: string, overrideState?: string, syncUrl = true) => {
      const runtime = runtimeRef.current;
      const modules = modulesRef.current;
      if (!runtime || !modules) return;

      const inputState = overrideState ?? stateRef.current;
      const raw = runtime.run_with_modules(
        modules.entry,
        modules.root || '',
        modules.sourcesJson,
        packetFor(inputState, event)
      );
      const result = JSON.parse(raw);
      if (result.ok === false) {
        const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics.join('\n') : raw;
        throw new Error(diagnostics);
      }
      const nextPacket = parseOutputPacket(result.output || '');
      stateRef.current = nextPacket.state;
      setPacket(nextPacket);
      setError(null);
      if (syncUrl) replaceSceneUrl(nextPacket.scene);
    },
    [replaceSceneUrl]
  );

  useEffect(() => {
    if (!router.isReady) return;
    if (bootedGameRef.current === gameId) return;
    bootedGameRef.current = gameId;
    let cancelled = false;

    // The sources are already seeded from getStaticProps, so boot only has to bring the wasm
    // runtime online and sync the first step for interactivity. No client fetch needed.
    async function boot() {
      setError(null);
      try {
        const runtimeUrl = '/topaz/topaz_wasm.js';
        const runtime = (await import(/* webpackIgnore: true */ runtimeUrl)) as TopazRuntime;
        await runtime.default();

        if (cancelled) return;
        runtimeRef.current = runtime;
        modulesRef.current = { entry, root, sourcesJson };

        const at = sceneFromQuery(router.query.at);
        if (at) runEvent('back', stateForScene(at), false);
        else runEvent('restart', '', true);
        setLoading(false);
      } catch (bootError) {
        if (!cancelled) {
          setError(bootError instanceof Error ? bootError.message : String(bootError));
          setLoading(false);
        }
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
  }, [gameId, router.isReady, runEvent, entry, root, sourcesJson]);

  useEffect(() => {
    if (!router.isReady || !packet || !runtimeRef.current || !modulesRef.current) return;
    const at = sceneFromQuery(router.query.at);
    if (pendingSceneRef.current) {
      if (at === pendingSceneRef.current) pendingSceneRef.current = null;
      return;
    }
    if (at && at !== packet.scene) {
      try {
        runEvent('back', stateForScene(at), false);
      } catch (routeError) {
        setError(routeError instanceof Error ? routeError.message : String(routeError));
      }
    }
  }, [packet, router.isReady, router.query.at, runEvent]);

  const hasBackStack = useMemo(() => {
    if (!packet?.state) return false;
    const parts = packet.state.split(':');
    return Boolean(parts[2]);
  }, [packet?.state]);

  const sourceFiles = useMemo(() => Object.keys(sources), [sources]);

  const handleChoice = (index: number) => {
    try {
      runEvent(`choice_${index}`);
    } catch (choiceError) {
      setError(choiceError instanceof Error ? choiceError.message : String(choiceError));
    }
  };

  const handleBack = () => {
    try {
      runEvent('back');
    } catch (backError) {
      setError(backError instanceof Error ? backError.message : String(backError));
    }
  };

  const handleRestart = () => {
    try {
      runEvent('restart', '');
    } catch (restartError) {
      setError(restartError instanceof Error ? restartError.message : String(restartError));
    }
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
      </Head>
      <GameFrame title={title}>
        <main className="text-left">
          {loading && <p className="text-sm text-gray-600">{t('arcade_loading')}</p>}
          {error && <pre className="mb-4 whitespace-pre-wrap rounded-md bg-red-50 p-3 text-xs text-red-800">{error}</pre>}
          {packet && (
            <>
              <p className="mb-6 whitespace-pre-line text-base leading-relaxed">{t(packet.textKey)}</p>
              <div className="flex flex-col gap-3">
                {packet.choiceKeys.map((key, index) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleChoice(index)}
                    className="rounded-md bg-black px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-gray-800"
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={!hasBackStack}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('arcade_back')}
                </button>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 transition hover:bg-gray-100"
                >
                  {t('arcade_restart')}
                </button>
                <button
                  type="button"
                  onClick={() => setSourceOpen((open) => !open)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 transition hover:bg-gray-100"
                >
                  {sourceOpen ? t('arcade_sourceClose') : t('arcade_sourceOpen')}
                </button>
              </div>
              {sourceOpen && (
                <section className="mt-4 border-t border-gray-200 pt-4">
                  <select
                    value={sourceFile}
                    onChange={(event) => setSourceFile(event.target.value)}
                    className="mb-3 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                    aria-label={t('arcade_sourceFile')}
                  >
                    {sourceFiles.map((file) => (
                      <option key={file} value={file}>
                        {file}
                      </option>
                    ))}
                  </select>
                  <pre
                    className="tz-code max-h-80 overflow-auto rounded-md bg-gray-950 p-3 text-xs leading-relaxed text-gray-100"
                    dangerouslySetInnerHTML={{ __html: highlightTopaz(sources[sourceFile] || '') }}
                  />
                </section>
              )}
              <footer className="mt-8 border-t border-gray-200 pt-4 text-xs leading-relaxed text-gray-500">
                {t('kakao_disclaimer')}
              </footer>
            </>
          )}
          {/* No-JS / crawler fallback: the game runs on wasm, so agents that don't execute
              JavaScript still get the Topaz source that powers it. */}
          <noscript>
            <section className="mt-6 border-t border-gray-200 pt-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">{t('arcade_sourceOpen')}</h2>
              <pre className="overflow-auto rounded-md bg-gray-950 p-3 text-xs leading-relaxed text-gray-100">{noscriptSource}</pre>
            </section>
          </noscript>
        </main>
      </GameFrame>
    </>
  );
}
