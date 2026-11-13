import { RASCUNHO_LEGAL, RESPONSAVEL, VIGENCIA } from '../logica/legal';

/** Aviso de que o texto ainda não foi aprovado (D8). Some quando `RASCUNHO_LEGAL` virar false. */
export function AvisoRascunho() {
  if (!RASCUNHO_LEGAL) return null;
  return (
    <p className="aviso-rascunho" role="note">
      <strong>Rascunho.</strong> Este texto ainda está em revisão e pode mudar antes de valer.
    </p>
  );
}

/** #/privacidade: política de privacidade (LGPD), em linguagem simples. */
export function TelaPrivacidade() {
  return (
    <main className="tela-conta tela-legal">
      <h1>Privacidade</h1>
      <AvisoRascunho />
      <p>
        Vale a partir de {VIGENCIA}. Aqui está o que o Truco guarda sobre você, para quê, com quem compartilha e como
        pedir para apagar.
      </p>

      <h2>Quem cuida dos dados</h2>
      <p>
        {RESPONSAVEL.nome}, responsável pelo Truco. Contato para qualquer pedido sobre os seus dados: {RESPONSAVEL.email}.
      </p>

      <h2>O que guardamos</h2>
      <ul>
        <li>
          <strong>Conta:</strong> e-mail, apelido, foto de perfil (se você escolher uma) e, se entrar com o Google, o
          identificador da sua conta Google (não a senha).
        </li>
        <li>
          <strong>Jogo:</strong> partidas, placares, estatísticas (truco pedido, aceito, corridas), Elo e patente, conquistas.
        </li>
        <li>
          <strong>Loja:</strong> saldo e extrato de Fichas e Pila, itens que você tem e, quando a compra de Pila existir, os
          pedidos (valor, status e forma de pagamento; os dados do cartão ficam só com a InfinitePay).
        </li>
        <li>
          <strong>Endereço IP:</strong> usado só na memória do servidor, por alguns minutos, para limitar pedidos em excesso
          (proteção contra abuso). Não vai para o banco de dados.
        </li>
        <li>
          <strong>Cookies e armazenamento do aparelho:</strong> um cookie de sessão para manter você conectado; no próprio
          aparelho ficam suas escolhas de tema, som e regras da mesa, e um código para voltar à mesa se a conexão cair.
          Não usamos cookies de propaganda nem de rastreamento.
        </li>
        <li>
          <strong>Erros do aplicativo:</strong> quando algo quebra no navegador, recebemos a mensagem do erro, a tela onde
          aconteceu e a versão do app, sem e-mail nem identificação.
        </li>
      </ul>

      <h2>Para que usamos</h2>
      <ul>
        <li>Fazer você entrar na conta, jogar, montar o ranking e o histórico.</li>
        <li>Manter o saldo e as compras corretos e resolver reclamações.</li>
        <li>Proteger o jogo contra trapaça, abuso e ataques, e corrigir erros.</li>
      </ul>

      <h2>Com quem compartilhamos</h2>
      <ul>
        <li>
          <strong>Railway</strong>: hospeda o servidor e o banco de dados.
        </li>
        <li>
          <strong>Resend</strong>: envia o e-mail com o link para entrar (recebe só o seu e-mail).
        </li>
        <li>
          <strong>Google</strong>: só se você escolher entrar com o Google.
        </li>
        <li>
          <strong>InfinitePay</strong>: quando a compra de Pila existir, processa o pagamento.
        </li>
      </ul>
      <p>Não vendemos dados e não compartilhamos com mais ninguém, a não ser por ordem da Justiça.</p>

      <h2>Por quanto tempo</h2>
      <ul>
        <li>O link para entrar vale 15 minutos; a sessão, 30 dias. Os vencidos são apagados de hora em hora.</li>
        <li>Conta, partidas e extrato ficam enquanto a conta existir.</li>
        <li>
          Ao excluir a conta, apagamos e-mail, Google, foto, apelido e ranking na hora. As partidas continuam no histórico
          de quem jogou com você, como “Jogador removido”, e o extrato fica guardado sem identificação, para conferência
          de pagamentos.
        </li>
      </ul>

      <h2>Seus direitos</h2>
      <p>
        Pela LGPD você pode saber quais dados temos, corrigir, levar para outro serviço, revogar o consentimento e pedir a
        exclusão. Para excluir a conta você mesmo: <a href="#/perfil?editar">Perfil</a> → <strong>Excluir minha conta</strong>.
        Para o resto, escreva para {RESPONSAVEL.email}.
      </p>

      <h2>Menores de idade</h2>
      <p>
        O Truco não é feito para menores de 13 anos. Entre 13 e 18 anos, use com a autorização de um responsável. A compra
        de Pila é só para maiores de 18 anos.
      </p>

      <p>
        Veja também os <a href="#/termos">Termos de uso</a>.
      </p>
    </main>
  );
}
