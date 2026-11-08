/* Truco PWA: cache apenas dos arquivos estáticos versionados do Vite.
 * Partidas, sessões, login, API e WebSocket são SEMPRE online e nunca armazenados.
 */
const CACHE_ATIVOS = 'truco-assets-v1';
const PREFIXO = 'truco-assets-';

self.addEventListener('install', (evento) => {
  evento.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const chaves = await caches.keys();
    await Promise.all(chaves.filter((chave) => chave.startsWith(PREFIXO) && chave !== CACHE_ATIVOS).map((chave) => caches.delete(chave)));
    await self.clients.claim();
  })());
});

const HTML_OFFLINE = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#1f2b25">
<title>Truco — sem conexão</title>
<style>
  :root{color-scheme:dark;font-family:system-ui,sans-serif}
  body{min-height:100dvh;display:grid;place-items:center;margin:0;padding:24px;background:#141c18;color:#efeadf;text-align:center;box-sizing:border-box}
  main{max-width:360px}
  h1{font-size:2rem;margin:0 0 8px}
  p{color:#b9b4a8;line-height:1.6}
  button{min-height:48px;padding:10px 24px;border:0;border-radius:10px;background:#e9b02c;color:#1c1916;font-weight:800;font-size:1rem}
</style>
</head>
<body><main><h1>♠ Sem conexão</h1>
<p>O Truco precisa de internet para entrar nas mesas e jogar com outras pessoas. Conecte-se e tente novamente.</p>
<button onclick="location.reload()">Tentar novamente</button></main></body>
</html>`;

self.addEventListener('fetch', (evento) => {
  const requisicao = evento.request;
  if (requisicao.method !== 'GET') return;
  const url = new URL(requisicao.url);
  if (url.origin !== self.location.origin) return;

  // Sempre busca o HTML mais recente. Se estiver offline, avisa claramente:
  // não fingir que é possível jogar multiplayer sem conexão.
  if (requisicao.mode === 'navigate') {
    evento.respondWith(fetch(requisicao).catch(() => new Response(HTML_OFFLINE, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })));
    return;
  }

  // Somente bundles imutáveis /assets/[hash]. Não intercepta /api,
  // /matchmake, /saude, links mágicos, dados de contas nem solicitações de jogo.
  if (!url.pathname.startsWith('/assets/')) return;
  evento.respondWith((async () => {
    const cache = await caches.open(CACHE_ATIVOS);
    const guardada = await cache.match(requisicao);
    if (guardada) return guardada;
    const resposta = await fetch(requisicao);
    if (resposta.ok && resposta.type === 'basic') {
      await cache.put(requisicao, resposta.clone());
    }
    return resposta;
  })());
});
