import type { ConfigApi, UsuarioApi } from '@truco/api';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { BotaoGoogle, type CarregarGoogle } from '../componentes/BotaoGoogle';
import type { Api } from '../rede/api';

interface Props {
  token: string | null;
  config: ConfigApi;
  api: Pick<Api, 'pedirLink' | 'confirmarLink' | 'entrarGoogle'>;
  aoEntrar: (u: UsuarioApi) => void;
  carregarGoogle?: CarregarGoogle;
}

const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function TelaEntrar({ token, config, api, aoEntrar, carregarGoogle }: Props) {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'livre' | 'enviando' | 'enviado' | 'confirmando'>(token ? 'confirmando' : 'livre');
  const [erro, setErro] = useState<string | null>(null);
  /** Token já tirado da URL e em confirmação (só uma vez por token). */
  const confirmado = useRef<string | null>(null);

  useEffect(() => {
    if (!token || confirmado.current === token) return;
    confirmado.current = token;
    // O token é de uso único e não pode ficar na URL nem no histórico (voltar, compartilhar a aba).
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#/entrar`);
    setEstado('confirmando');
    api.confirmarLink(confirmado.current).then(
      (r) => aoEntrar(r.usuario),
      (e: unknown) => {
        setErro(mensagemDe(e));
        setEstado('livre');
      },
    );
  }, [token, api, aoEntrar]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEstado('enviando');
    try {
      await api.pedirLink(email.trim());
      setEstado('enviado');
    } catch (x) {
      setErro(mensagemDe(x));
      setEstado('livre');
    }
  };

  const google = async (credencial: string) => {
    setErro(null);
    try {
      aoEntrar((await api.entrarGoogle(credencial)).usuario);
    } catch (x) {
      setErro(mensagemDe(x));
    }
  };

  return (
    <main className="tela-conta">
      <h1>Entrar</h1>
      {estado === 'confirmando' ? (
        <p role="status">Entrando…</p>
      ) : estado === 'enviado' ? (
        <p role="status">
          Enviamos um link para <strong>{email.trim()}</strong>. Abra-o neste navegador para entrar (vale por 15 minutos).
        </p>
      ) : (
        <form className="formulario" onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="email">E-mail</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" className="botao-principal" disabled={estado === 'enviando'}>
            Enviar link
          </button>
        </form>
      )}
      {config.google && estado !== 'confirmando' && <BotaoGoogle clientId={config.google} aoCredencial={(c) => void google(c)} carregar={carregarGoogle} />}
      {erro && (
        <p className="erro-form" role="alert">
          {erro}
        </p>
      )}
      <p className="nota">Sem conta você joga Clássica e Desafio como convidado. Ranqueada, histórico e perfil pedem login.</p>
    </main>
  );
}
