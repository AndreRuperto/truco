import type { MsgEstado } from '@truco/protocolo';
import { useRef, useState } from 'react';
import { type MsgChat, modoDaMesa } from '../api/protocolo-provisorio';
import { Chat } from '../componentes/Chat';
import { ConfirmarSaida } from '../componentes/ConfirmarSaida';
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
  const [confirmarSaida, setConfirmarSaida] = useState(false);
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
        <button type="button" onClick={modo === 'ranqueada' ? () => setConfirmarSaida(true) : aoSair}>
          Sair
        </button>
      </p>
      {confirmarSaida && <ConfirmarSaida ranqueada aoSair={aoSair} aoCancelar={() => setConfirmarSaida(false)} textoFicar="Continuar esperando" />}
    </main>
  );
}

/** Copia com a Clipboard API; sem ela (HTTP, navegador antigo) ou se recusar, tenta execCommand. */
async function copiar(texto: string, campo: HTMLInputElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // cai no execCommand
  }
  if (!campo) return false;
  campo.focus();
  campo.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  }
}

function Convite({ link }: { link: string }) {
  const [situacao, setSituacao] = useState<'livre' | 'copiado' | 'falhou'>('livre');
  const campo = useRef<HTMLInputElement>(null);
  return (
    <div className="convite">
      <label htmlFor="link-convite">Link de convite</label>
      <input ref={campo} id="link-convite" type="text" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" onClick={() => void copiar(link, campo.current).then((ok) => setSituacao(ok ? 'copiado' : 'falhou'))}>
        {situacao === 'copiado' ? 'Copiado!' : 'Copiar'}
      </button>
      {situacao === 'falhou' && (
        <p className="nota" role="status">
          Selecione e copie o link
        </p>
      )}
    </div>
  );
}
