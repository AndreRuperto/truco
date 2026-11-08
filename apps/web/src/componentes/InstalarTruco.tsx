import { useEffect, useState } from 'react';

interface PedidoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function estaInstalado(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone || ios;
}

/** Android/desktop: convite nativo quando permitido. iOS e abas internas: instruções. */
export function InstalarTruco() {
  const [pedido, setPedido] = useState<PedidoInstalacao | null>(null);
  const [instalado, setInstalado] = useState(estaInstalado);
  const [guia, setGuia] = useState(false);
  const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    const disponivel = (evento: Event) => {
      evento.preventDefault();
      setPedido(evento as PedidoInstalacao);
    };
    const concluido = () => {
      setInstalado(true);
      setPedido(null);
      setGuia(false);
    };
    window.addEventListener('beforeinstallprompt', disponivel);
    window.addEventListener('appinstalled', concluido);
    return () => {
      window.removeEventListener('beforeinstallprompt', disponivel);
      window.removeEventListener('appinstalled', concluido);
    };
  }, []);

  if (instalado) return null;

  const instalar = async () => {
    if (!pedido) {
      setGuia((atual) => !atual);
      return;
    }
    try {
      await pedido.prompt();
      // Após aceitar/recusar, esse evento não pode ser reutilizado.
      await pedido.userChoice?.catch(() => undefined);
    } catch {
      setGuia(true);
    } finally {
      setPedido(null);
    }
  };

  return (
    <section className="instalar-truco" aria-label="Instalar o Truco no celular">
      <span className="instalar-truco-icone" aria-hidden="true">♠</span>
      <div className="instalar-truco-texto">
        <strong>Truco no seu celular</strong>
        <small>Abra pela tela inicial, com aparência de aplicativo.</small>
      </div>
      <button type="button" className="instalar-truco-botao" onClick={() => void instalar()} aria-expanded={guia}>
        Instalar
      </button>
      {guia && (
        <p className="instalar-truco-guia" role="status">
          {ios
            ? 'No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.'
            : 'Abra este site no Chrome, toque no menu ⋮ e escolha Instalar app ou Adicionar à tela inicial. Se estiver dentro de outro aplicativo, use Abrir no Chrome primeiro.'}
        </p>
      )}
    </section>
  );
}
