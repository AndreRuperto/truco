import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agendarLimpeza } from './limpeza';
import { MesaRoom } from './MesaRoom';
import { encerrarOrfas } from './repo/partidas';
import { limparExpirados } from './repo/usuarios';
import { criarServidor } from './servidor';
import { servicosDoAmbiente } from './servicos';
import { limiteMesasDoAmbiente, reconexaoDoAmbiente, temposDoAmbiente } from './tempos';
import { LimiteTaxa } from './auth/limite';
import { log } from './log';

// Erros que escaparam: rejeição não tratada só vai para o log (o processo segue); exceção não tratada
// vai para o log e derruba o processo (o estado pode estar inconsistente; o Railway reinicia).
process.on('unhandledRejection', (motivo) => log.erro('rejeicao_nao_tratada', motivo));
process.on('uncaughtException', (e) => {
  log.erro('excecao_nao_tratada', e);
  process.exit(1);
});

const PASTA_WEB = fileURLToPath(new URL('../../web/dist/', import.meta.url));
// Fora do repositório: o PGlite em disco falha em sistemas de arquivos como exFAT (errno 28).
const PASTA_PGLITE = join(homedir(), '.truco', 'pglite');

MesaRoom.tempos = temposDoAmbiente(process.env);
MesaRoom.reconexaoS = reconexaoDoAmbiente(process.env);
MesaRoom.limiteCriacao = new LimiteTaxa(limiteMesasDoAmbiente(process.env), 10 * 60_000);
const { servicos, config, fechar } = await servicosDoAmbiente(process.env, { pastaPglite: PASTA_PGLITE });
for (const a of config.avisos) log.aviso('config_aviso', { aviso: a });
// Partidas que o processo anterior não fechou (crash/SIGKILL): abandonadas, sem Elo nem bloqueio.
// Antes do `listen`: nenhuma partida viva existe ainda.
const orfas = await encerrarOrfas(servicos.banco, servicos.agora());
if (orfas > 0) log.aviso('partidas_orfas_fechadas', { quantidade: orfas });

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
log.info('servidor_ouvindo', { porta, banco, web: pastaWeb ? 'build servido' : 'não servido', tempos: process.env.TRUCO_TEMPOS ?? null });
