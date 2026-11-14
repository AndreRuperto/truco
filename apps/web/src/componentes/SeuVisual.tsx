import type { CarteiraApi, CatalogoApi, ItemLoja, Slot, UsuarioApi } from '@truco/api';
import { useState } from 'react';
import { equiparNaConta } from '../logica/equipar';
import { equipadoNoSlot, estadoDoItem } from '../logica/lojaItens';
import type { Api } from '../rede/api';
import { PreviaItem } from './PreviaItem';

/** Ordem no perfil: o que mais aparece para os outros primeiro. */
const GRUPOS: { slot: Slot; nome: string; mais: string }[] = [
  { slot: 'moldura', nome: 'Moldura', mais: 'Mais molduras na Loja' },
  { slot: 'verso', nome: 'Baralho', mais: 'Mais baralhos na Loja' },
  { slot: 'roupa', nome: 'Roupa', mais: 'Mais roupas na Loja' },
  { slot: 'tampo', nome: 'Mesa', mais: 'Mais mesas na Loja' },
  { slot: 'avatar', nome: 'Avatar', mais: 'Avatares na Loja' },
];

interface Props {
  usuario: UsuarioApi;
  catalogo: CatalogoApi | null;
  carteira: CarteiraApi | null;
  api: Pick<Api, 'loja'>;
  /** Depois de equipar: a App relê a carteira (e a sessão, se o avatar mudou). */
  aoMudar: () => Promise<void>;
}

/**
 * "Seu visual" no Editar perfil: escolhe entre os itens que a pessoa já tem (os de série, os comprados;
 * admin tem todos), sem passar pela loja. Escolher equipa na hora, com a mesma regra da loja.
 */
export function SeuVisual({ usuario, catalogo, carteira, api, aoMudar }: Props) {
  // Escolha otimista enquanto o servidor responde; erro devolve ao que a carteira diz.
  const [pendente, setPendente] = useState<Partial<Record<Slot, string>>>({});
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  if (!catalogo || !carteira) return <p className="seu-visual-carregando">Carregando seu visual…</p>;
  const itens = catalogo.itens;

  const escolher = async (item: ItemLoja) => {
    setPendente((p) => ({ ...p, [item.slot]: item.id }));
    setOcupado(true);
    setAviso(null);
    try {
      await equiparNaConta(api, item);
      await aoMudar();
      setAviso({ tipo: 'ok', texto: `${item.nome} equipado.` });
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setPendente((p) => {
        const resto = { ...p };
        delete resto[item.slot];
        return resto;
      });
      setOcupado(false);
    }
  };

  return (
    <section className="seu-visual" aria-labelledby="titulo-seu-visual">
      <h3 id="titulo-seu-visual">Seu visual</h3>
      <p className="seu-visual-dica">O que você já tem. Escolher equipa na hora; os outros veem na mesa.</p>
      {GRUPOS.map(({ slot, nome, mais }) => {
        const meus = itens.filter((i) => i.slot === slot && ['equipado', 'equipar'].includes(estadoDoItem(i, carteira, itens)));
        const atual = pendente[slot] ?? equipadoNoSlot(slot, carteira, itens);
        return (
          <div className="seu-visual-grupo" key={slot}>
            {meus.length > 0 ? (
              <div role="radiogroup" aria-label={nome} className="seu-visual-opcoes">
                <span className="seu-visual-nome" aria-hidden="true">
                  {nome}
                </span>
                {meus.map((item) => (
                  <label key={item.id} className="seu-visual-opcao" data-testid={`visual-${item.id}`}>
                    <input
                      type="radio"
                      name={`visual-${slot}`}
                      aria-label={item.nome}
                      checked={atual === item.id}
                      disabled={ocupado}
                      onChange={() => void escolher(item)}
                    />
                    <PreviaItem item={item} usuario={usuario} />
                    <span className="seu-visual-rotulo">{item.nome}</span>
                  </label>
                ))}
              </div>
            ) : (
              <span className="seu-visual-nome">{nome}</span>
            )}
            <a className="seu-visual-mais" href={`#/loja/${slot}`}>
              {mais}
            </a>
          </div>
        );
      })}
      {aviso && (
        <p className={aviso.tipo === 'erro' ? 'erro-form' : 'seu-visual-ok'} role={aviso.tipo === 'erro' ? 'alert' : 'status'}>
          {aviso.texto}
        </p>
      )}
    </section>
  );
}
