import type { Cadeira } from '@truco/engine';
import { type FormEvent, useEffect, useRef, useState } from 'react';

export type ResultadoDenuncia = 'ok' | 'repetida' | 'invalida' | 'sem-conta';

interface Props {
  /** Os outros humanos da mesa. */
  pessoas: readonly { cadeira: Cadeira; nome: string }[];
  /** Última resposta do servidor (o `id` muda a cada uma). */
  resposta: { id: number; resultado: ResultadoDenuncia } | null;
  aoDenunciar: (cadeira: Cadeira, motivo: string) => void;
  aoFechar: () => void;
}

export const MAX_MOTIVO = 140;

const TEXTO: Record<ResultadoDenuncia, string> = {
  ok: 'Denúncia enviada. Quem administra o jogo vai olhar. Obrigado.',
  repetida: 'Você já denunciou essa pessoa nesta mesa.',
  'sem-conta': 'Entre na sua conta para denunciar.',
  invalida: 'Não deu para enviar a denúncia.',
};

/** Denúncia (F6.5): vai para a aba Auditoria do admin, com a partida e um motivo curto. */
export function Denunciar({ pessoas, resposta, aoDenunciar, aoFechar }: Props) {
  const [cadeira, setCadeira] = useState<Cadeira | null>(pessoas[0]?.cadeira ?? null);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const primeiro = useRef<HTMLSelectElement>(null);
  useEffect(() => primeiro.current?.focus(), []);
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (cadeira === null) return;
    if (!motivo.trim()) return void setErro('Diga o motivo em poucas palavras.');
    setErro(null);
    aoDenunciar(cadeira, motivo.trim());
  };
  return (
    <div
      className="painel-denunciar"
      role="dialog"
      aria-label="Denunciar"
      onKeyDown={(e) => {
        if (e.key === 'Escape') aoFechar();
      }}
    >
      <form className="formulario" onSubmit={enviar}>
        <div className="campo">
          <label htmlFor="denunciar-quem">Quem</label>
          <select id="denunciar-quem" ref={primeiro} value={cadeira ?? ''} onChange={(e) => setCadeira(Number(e.target.value) as Cadeira)}>
            {pessoas.map((p) => (
              <option key={p.cadeira} value={p.cadeira}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="denunciar-motivo">Motivo (até {MAX_MOTIVO} letras)</label>
          <input id="denunciar-motivo" type="text" autoComplete="off" maxLength={MAX_MOTIVO} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        {erro && (
          <p className="erro-form" role="alert">
            {erro}
          </p>
        )}
        <div className="linha">
          <button type="submit" className="botao-principal">
            Enviar denúncia
          </button>
          <button type="button" onClick={aoFechar}>
            Fechar
          </button>
        </div>
        <p role="status">{resposta ? TEXTO[resposta.resultado] : ''}</p>
      </form>
    </div>
  );
}
