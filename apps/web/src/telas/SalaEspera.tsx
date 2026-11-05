import type { MsgEstado } from '@truco/protocolo';
import { souDono } from '../logica/sala';
import { resumoRegras } from '../logica/textos';

interface Props {
  msg: MsgEstado;
  aoIniciar: () => void;
  aoSair: () => void;
}

export function SalaEspera({ msg, aoIniciar, aoSair }: Props) {
  const dono = souDono(msg);
  const faltam = msg.cadeiras.filter((c) => c.tipo === 'vazia').length;
  return (
    <main className="sala-espera">
      <h1>Sala de espera</h1>
      <p>{faltam > 0 ? `Esperando ${faltam} ${faltam === 1 ? 'jogador' : 'jogadores'}…` : 'Começando…'}</p>
      <ul className="lista-cadeiras">
        {msg.cadeiras.map((c, i) => (
          <li key={i}>
            <span>{c.nome ? (i === msg.minhaCadeira ? `${c.nome} (você)` : c.nome) : 'Lugar vago'}</span>
            <span>
              {c.tipo === 'bot' ? 'bot' : c.tipo === 'humano' ? (c.conectado ? 'pronto' : 'desconectado') : ''}
              {i % 2 === msg.minhaCadeira % 2 ? ' · sua dupla' : ''}
            </span>
          </li>
        ))}
      </ul>
      <ul className="resumo-regras" aria-label="Regras da mesa">
        {resumoRegras(msg.regras, msg.chanceInterceptarSinal).map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {dono ? (
        <button type="button" className="botao-principal" onClick={aoIniciar}>
          Começar com bots
        </button>
      ) : (
        <p>Só o dono da mesa pode começar antes de lotar.</p>
      )}
      <p>
        <button type="button" onClick={aoSair}>
          Sair
        </button>
      </p>
    </main>
  );
}
