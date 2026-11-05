import type { MsgEstado } from '@truco/protocolo';
import { useState } from 'react';
import { type MsgChat, modoDaMesa } from '../api/protocolo-provisorio';
import { Chat } from '../componentes/Chat';
import { linkConvite } from '../logica/rotas';
import { souDono } from '../logica/sala';
import { resumoRegras } from '../logica/textos';

interface Props {
  msg: MsgEstado;
  aoIniciar: () => void;
  aoSair: () => void;
  /** `roomId` (código do convite). */
  salaId?: string | null;
  /** Origem da página (testes passam uma fixa). */
  origem?: string;
  chat?: MsgChat[];
  aoChat?: (texto: string) => void;
}

export function SalaEspera({ msg, aoIniciar, aoSair, salaId = null, origem = window.location.origin, chat = [], aoChat }: Props) {
  const dono = souDono(msg);
  const modo = modoDaMesa(msg);
  // Faltam humanos, não cadeiras: as vazias que sobrarem viram bots ao começar.
  const sentados = msg.cadeiras.filter((c) => c.tipo === 'humano').length;
  const faltam = Math.max(0, msg.humanosEsperados - sentados);
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
      {modo === 'privada' && salaId && <Convite link={linkConvite(origem, salaId)} />}
      {modo === 'privada' && aoChat && <Chat mensagens={chat} aoEnviar={aoChat} />}
      {modo === 'ranqueada' ? (
        <p>Partida ranqueada: começa quando todos entrarem.</p>
      ) : dono ? (
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

function Convite({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="convite">
      <label htmlFor="link-convite">Link de convite</label>
      <input id="link-convite" type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" onClick={() => void navigator.clipboard?.writeText(link).then(() => setCopiado(true), () => {})}>
        {copiado ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
  );
}
