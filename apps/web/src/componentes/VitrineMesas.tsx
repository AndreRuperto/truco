import { useState } from 'react';

export type TipoMesaVitrine = 'classica' | 'desafio';
export type AcessoMesaVitrine = 'publica' | 'privada';

interface Props {
  aoCriar: (tipo: TipoMesaVitrine, acesso: AcessoMesaVitrine) => void;
  aoRanqueada: () => void;
}

const MESAS = [
  {
    id: 'classica',
    titulo: 'Mesa Clássica',
    descricao: 'O feltro de todo dia. Convide amigos e complete os assentos vazios com bots.',
    categoria: 'CASUAL',
    detalhe: 'BOTS FÁCEIS',
  },
  {
    id: 'desafio',
    titulo: 'Mesa Desafio',
    descricao: 'O mesmo pano, bots mais atentos. Os assentos vazios entram no difícil.',
    categoria: 'CASUAL',
    detalhe: 'BOTS DIFÍCEIS',
  },
  {
    id: 'ranqueada',
    titulo: 'Mesa Ranqueada',
    descricao: 'Elo em disputa: quatro pessoas, ou duas com um bot difícil na dupla de cada uma, valendo metade.',
    categoria: 'COMPETITIVA',
    detalhe: '2 OU 4 PESSOAS',
  },
] as const;

/** Arte em CSS, leve e responsiva, inspirada no feltro e na madeira do Truco. */
function MiniaturaMesa({ tipo }: { tipo: (typeof MESAS)[number]['id'] }) {
  return (
    <div className={`vitrine-mesa-ilustrada tema-${tipo}`} aria-hidden="true">
      <div className="vitrine-mesa-oval">
        <span className="vitrine-mesa-marca">TRUCO</span>
        <span className="vitrine-mesa-cartas">
          <span />
          <span />
          <span />
        </span>
      </div>
      <span className="vitrine-mesa-assento assento-cima" />
      <span className="vitrine-mesa-assento assento-direita" />
      <span className="vitrine-mesa-assento assento-baixo" />
      <span className="vitrine-mesa-assento assento-esquerda" />
    </div>
  );
}

/**
 * Atalhos de criação na página Salas.
 * Ranqueada não pode ser criada manualmente (servidor só aceita via fila Elo).
 */
export function VitrineMesas({ aoCriar, aoRanqueada }: Props) {
  const [acesso, setAcesso] = useState<AcessoMesaVitrine>('publica');

  return (
    <section className="vitrine-mesas" aria-labelledby="titulo-abrir-mesa">
      <div className="vitrine-mesas-intro">
        <div>
          <span className="vitrine-mesas-selo">AS SALAS DO CLUBE</span>
          <h1 id="titulo-abrir-mesa">Abra uma mesa</h1>
        </div>
        <p>Você será o anfitrião: convide pelo código da sala ou deixe a mesa aberta para o clube.</p>
      </div>

      <fieldset className="vitrine-mesas-acesso">
        <legend>Quem poderá entrar nas mesas casuais?</legend>
        <div className="vitrine-mesas-acesso-opcoes">
          <label>
            <input
              type="radio"
              name="acesso-mesa"
              value="publica"
              checked={acesso === 'publica'}
              onChange={() => setAcesso('publica')}
            />
            Aberta ao clube
          </label>
          <label>
            <input
              type="radio"
              name="acesso-mesa"
              value="privada"
              checked={acesso === 'privada'}
              onChange={() => setAcesso('privada')}
            />
            Privada · por convite
          </label>
        </div>
      </fieldset>

      <div className="vitrine-mesas-grade">
        {MESAS.map((mesa) => (
          <article className={`vitrine-mesa-card card-${mesa.id}`} key={mesa.id}>
            <div className="vitrine-mesa-imagem">
              <MiniaturaMesa tipo={mesa.id} />
              {mesa.id === 'ranqueada' && <span className="vitrine-mesa-elo">ELO</span>}
            </div>
            <div className="vitrine-mesa-conteudo">
              <h2>{mesa.titulo}</h2>
              <p>{mesa.descricao}</p>
              <div className="vitrine-mesa-tags">
                <span>{mesa.categoria}</span>
                <span>{mesa.detalhe}</span>
              </div>
              {mesa.id === 'ranqueada' ? (
                <button
                  type="button"
                  className="vitrine-mesa-botao"
                  onClick={aoRanqueada}
                  aria-label="Ir para fila ranqueada"
                >
                  Entrar na fila <span aria-hidden="true">→</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="vitrine-mesa-botao"
                  aria-label={`Abrir ${mesa.titulo}`}
                  onClick={() => aoCriar(mesa.id, acesso)}
                >
                  Abrir mesa <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className="vitrine-mesas-nota">
        Mesas abertas aparecem na lista do clube. Mesas privadas só aceitam convidados com o link.
        A ranqueada usa a fila Elo e precisa de conta.
      </p>
    </section>
  );
}
