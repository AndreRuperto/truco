import { type FormEvent, useEffect, useRef, useState } from 'react';
import { MAX_CHAT, type MsgChat } from '../api/protocolo-provisorio';

interface Props {
  mensagens: MsgChat[];
  aoEnviar: (texto: string) => void;
}

export function Chat({ mensagens, aoEnviar }: Props) {
  const [texto, setTexto] = useState('');
  const ultima = useRef<HTMLLIElement>(null);
  // Mensagem nova: mostra a última (scrollIntoView não existe no jsdom).
  useEffect(() => {
    ultima.current?.scrollIntoView?.({ block: 'nearest' });
  }, [mensagens.length]);
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    aoEnviar(t);
    setTexto('');
  };
  return (
    <section className="chat" aria-label="Chat da mesa">
      <ol className="chat-mensagens">
        {mensagens.map((m, i) => (
          <li key={i} ref={i === mensagens.length - 1 ? ultima : undefined}>
            <strong>{m.nome}:</strong> {m.texto}
          </li>
        ))}
      </ol>
      <form className="chat-form" onSubmit={enviar}>
        <label htmlFor="chat-texto" className="visualmente-oculto">
          Mensagem
        </label>
        <input id="chat-texto" type="text" autoComplete="off" maxLength={MAX_CHAT} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <button type="submit">Enviar</button>
      </form>
    </section>
  );
}
