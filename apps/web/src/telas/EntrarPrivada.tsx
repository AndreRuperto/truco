import { type FormEvent, useState } from 'react';
import { SeletorAvatar } from '../componentes/SeletorAvatar';
import { gravarApelido } from '../logica/lobby';

interface Props {
  codigo: string;
  nomeInicial: string;
  aoEntrar: (nome: string) => void;
  avatar?: string | null;
  aoTrocarAvatar?: (avatar: string | null) => void | Promise<void>;
}

export function TelaEntrarPrivada({ codigo, nomeInicial, aoEntrar, avatar = null, aoTrocarAvatar }: Props) {
  const [nome, setNome] = useState(nomeInicial);
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    gravarApelido(nome.trim());
    aoEntrar(nome.trim() || 'Jogador');
  };
  return (
    <main className="tela-conta">
      <h1>Mesa privada</h1>
      <p>
        Você foi convidado para a mesa <code>{codigo}</code>.
      </p>
      <form className="formulario" onSubmit={enviar}>
        <div className="campo">
          <label htmlFor="apelido-privada">Apelido</label>
          <div className="apelido-com-foto">
            {aoTrocarAvatar && <SeletorAvatar apelido={nome} valor={avatar} aoMudar={aoTrocarAvatar} />}
            <input id="apelido-privada" type="text" maxLength={20} value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="botao-principal">
          Entrar na mesa
        </button>
      </form>
    </main>
  );
}
