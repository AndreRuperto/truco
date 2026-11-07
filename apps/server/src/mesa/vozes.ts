/**
 * Contas com voz própria (clonada no ElevenLabs; os áudios ficam em web/public/vozes/<voz>-*.mp3).
 * Chave = apelido da conta, sem caixa. Só vale para quem está LOGADO nessa conta: convidado com
 * o mesmo nome não ganha a voz (o MesaRoom só consulta isto com `client.auth`).
 */
const VOZES_DAS_CONTAS: Readonly<Record<string, string>> = { andreruperto: 'andre' };

export function vozDaConta(apelido: string): string | null {
  return VOZES_DAS_CONTAS[apelido.toLowerCase()] ?? null;
}
