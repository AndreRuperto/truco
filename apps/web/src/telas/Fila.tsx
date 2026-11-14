import type { Formato } from '@truco/api';
import type { Variante } from '@truco/engine';
import { type FormEvent, useState } from 'react';
import { formatarEspera } from '../logica/conta';
import type { EstadoFila, OpcoesFila } from '../rede/fila';

interface Props {
  estado: EstadoFila;
  aoEntrar: (o: OpcoesFila) => void;
  aoCancelar: () => void;
}

const REGRAS_FIXAS: Record<Variante, string> = {
  paulista: 'vira, 1 · 3 · 6 · 9 · 12, mão de 11 e de ferro, sem família',
  mineiro: 'manilhas fixas, 2 · 4 · 8 · 10 · 12, mão de 10 e de ferro, família fechada',
};

export function TelaFila({ estado, aoEntrar, aoCancelar }: Props) {
  const [variante, setVariante] = useState<Variante>(estado.opcoes?.variante ?? 'paulista');
  const [formato, setFormato] = useState<Formato>(estado.opcoes?.formato ?? '1x1');
  const [codigo, setCodigo] = useState(estado.opcoes?.codigoDupla ?? '');

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const c = codigo.trim();
    aoEntrar({ variante, formato, ...(formato === '2x2' && c ? { codigoDupla: c } : {}) });
  };

  return (
    <main className="tela-conta">
      <h1>Ranqueada</h1>
      {estado.status === 'fora' ? (
        <form className="formulario" onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="fila-variante">Variante</label>
            <select id="fila-variante" value={variante} onChange={(e) => setVariante(e.target.value as Variante)}>
              <option value="paulista">Paulista</option>
              <option value="mineiro">Mineiro</option>
            </select>
          </div>
          <div className="campo">
            <label htmlFor="fila-formato">Formato</label>
            <select id="fila-formato" value={formato} onChange={(e) => setFormato(e.target.value as Formato)}>
              <option value="1x1">1 contra 1 (cada um com um bot parceiro)</option>
              <option value="2x2">2 contra 2</option>
            </select>
          </div>
          {formato === '2x2' && (
            <div className="campo">
              <label htmlFor="fila-codigo">Código da dupla (opcional)</label>
              <input id="fila-codigo" type="text" maxLength={12} value={codigo} onChange={(e) => setCodigo(e.target.value)} />
              <p className="nota">Para jogar com um amigo, combinem um código (4 a 12 letras ou números) e os dois digitam o mesmo.</p>
            </div>
          )}
          <p className="nota">Regras fixas: {REGRAS_FIXAS[variante]}. Sair no meio conta como derrota e bloqueia a fila por 5 minutos.</p>
          <button type="submit" className="botao-principal">
            Entrar na fila
          </button>
        </form>
      ) : (
        <div className="status-fila" role="status">
          <p>
            {estado.status === 'pareado'
              ? 'Adversário encontrado! Abrindo a mesa…'
              : estado.info?.aguardandoParceiro
                ? 'Esperando seu parceiro entrar com o mesmo código…'
                : 'Procurando adversário…'}
          </p>
          {estado.info && (
            <p>
              {formatarEspera(estado.info.esperaS)} · faixa ±{estado.info.faixa} · {estado.info.naFila} na fila
            </p>
          )}
          {estado.status !== 'pareado' && (
            <button type="button" onClick={aoCancelar}>
              Cancelar
            </button>
          )}
        </div>
      )}
      {estado.erro && (
        <p className="erro-form" role="alert">
          {estado.erro}
        </p>
      )}
    </main>
  );
}
