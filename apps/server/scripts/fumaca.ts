/**
 * Teste de fumaça contra um servidor já rodando (local ou Railway):
 *   TRUCO_URL_FUMACA=http://127.0.0.1:2580 pnpm --filter @truco/server fumaca
 * Servidor local em modo produção (exige URL pública no boot):
 *   NODE_ENV=production TRUCO_PGLITE=memoria PORT=2580 TRUCO_URL_PUBLICA=http://localhost:2580 pnpm start
 */
import { Client } from '@colyseus/sdk';

const base = (process.env.TRUCO_URL_FUMACA ?? 'http://127.0.0.1:2567').replace(/\/+$/, '');

function ok(cond: unknown, msg: string): void {
  if (!cond) {
    console.error(`FALHOU: ${msg}`);
    process.exit(1);
  }
  console.log(`ok: ${msg}`);
}

const saude = await fetch(`${base}/saude`);
ok(saude.status === 200, 'GET /saude responde 200');
ok((await fetch(`${base}/`).then((r) => r.text())).includes('id="raiz"'), 'GET / serve o index.html do web');
ok((await fetch(`${base}/ranking/paulista`).then((r) => r.text())).includes('id="raiz"'), 'rota desconhecida cai no index.html');
const cfg = (await fetch(`${base}/api/config`).then((r) => r.json())) as Record<string, unknown> | null;
ok(!!cfg && typeof cfg === 'object' && 'google' in cfg, 'GET /api/config responde JSON');
const ranking = (await fetch(`${base}/api/ranking/paulista`).then((r) => r.json())) as { linhas?: unknown };
ok(Array.isArray(ranking.linhas), 'GET /api/ranking/paulista lê do banco');

const sala = await new Client(base).joinOrCreate('mesa', { humanos: 1, nome: 'Fumaça' });
const estado = await new Promise<{ cadeiras: { tipo: string }[] }>((resolver, rejeitar) => {
  const t = setTimeout(() => rejeitar(new Error('nenhum estado com visão em 10 s')), 10_000);
  for (const tipo of ['acao', 'sinal', 'fala', 'erro', 'chat']) sala.onMessage(tipo, () => {});
  sala.onMessage('estado', (m: { visao: unknown; cadeiras: { tipo: string }[] }) => {
    if (!m.visao) return;
    clearTimeout(t);
    resolver(m);
  });
  sala.send('sincronizar');
});
ok(estado.cadeiras.filter((c) => c.tipo === 'bot').length === 3, 'WebSocket: mesa com 3 bots começou');
await sala.leave(true);
console.log('fumaça: tudo certo');
process.exit(0);
