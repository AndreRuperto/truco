import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agendarLimpeza } from './limpeza';
import { MesaRoom } from './MesaRoom';
import { encerrarOrfas } from './repo/partidas';
import { limparExpirados } from './repo/usuarios';
import { criarServidor } from './servidor';
import { servicosDoAmbiente } from './servicos';
import { temposDoAmbiente } from './tempos';

const PASTA_WEB = fileURLToPath(new URL('../../web/dist/', import.meta.url));
const PASTA_PGLITE = fileURLToPath(new URL('../.dados/pglite', import.meta.url));

MesaRoom.tempos = temposDoAmbiente(process.env);
const { servicos, config, fechar } = await servicosDoAmbiente(process.env, { pastaPglite: PASTA_PGLITE });
for (const a of config.avisos) console.warn(`truco: aviso: ${a}`);
// Partidas que o processo anterior não fechou (crash/SIGKILL): abandonadas, sem Elo nem bloqueio.
// Antes do `listen`: nenhuma partida viva existe ainda.
const orfas = await encerrarOrfas(servicos.banco, servicos.agora());
if (orfas > 0) console.warn(`truco: aviso: ${orfas} partida(s) sem fim do processo anterior fechada(s) como abandonada(s)`);

const pastaWeb = existsSync(join(PASTA_WEB, 'index.html')) ? PASTA_WEB : null;
const servidor = criarServidor(servicos, { pastaWeb });
// Sessões e links vencidos: no boot e a cada hora (timer com unref).
const pararLimpeza = agendarLimpeza(() => limparExpirados(servicos.banco, servicos.agora()));
// Redeploy/SIGTERM: antes de o Colyseus derrubar as conexões, nenhuma queda vira abandono.
servidor.onBeforeShutdown(() => MesaRoom.desligar());
servidor.onShutdown(async () => {
  pararLimpeza();
  // As salas já foram descartadas (cada onDispose espera o próprio registro); garante que
  // nenhuma gravação de partida fique pela metade antes de fechar o banco.
  await MesaRoom.esperarGravacoes();
  await fechar();
});

const porta = Number(process.env.PORT ?? 2567);
await servidor.listen(porta);
const banco = config.databaseUrl ? 'postgres' : config.pastaPglite ? `pglite em ${config.pastaPglite}` : 'pglite em memória';
const modo = process.env.TRUCO_TEMPOS ? `, tempos: ${process.env.TRUCO_TEMPOS}` : '';
console.log(`truco: servidor ouvindo na porta ${porta} (banco: ${banco}; web: ${pastaWeb ? 'build servido' : 'não servido'}${modo})`);
