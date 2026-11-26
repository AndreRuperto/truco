/**
 * Contas com voz própria (clonada no ElevenLabs). Os áudios `<voz>-*.mp3` NÃO ficam no Git: em produção vêm
 * do volume em VOZES_PESSOAIS_DIR (ver `pastaVozesPessoais` em http/app.ts), no mesmo endereço /vozes/.
 * Chave = apelido da conta, sem caixa. Só vale para quem está LOGADO nessa conta: convidado com
 * o mesmo nome não ganha a voz (o MesaRoom só consulta isto com `client.auth`).
 */
const VOZES_DAS_CONTAS: Readonly<Record<string, string>> = { andreruperto: 'andre' };

export function vozDaConta(apelido: string): string | null {
  return VOZES_DAS_CONTAS[apelido.toLowerCase()] ?? null;
}
