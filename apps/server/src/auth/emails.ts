import { htmlDoLinkMagico } from './templateEmail';

export interface Email {
  para: string;
  assunto: string;
  texto: string;
  html: string;
}

export interface Emails {
  enviar(e: Email): Promise<void>;
}


export function emailDoLink(url: string, para: string): Email {
  return {
    para,
    assunto: 'Seu link para entrar no Truco',
    texto: `Para entrar no Truco, abra este link (vale por 15 minutos, uma vez só):\n\n${url}\n\nSe não foi você, ignore este e-mail.`,
    html: htmlDoLinkMagico(url),
  };
}

export function extrairLink(texto: string): string | null {
  return texto.match(/https?:\/\/\S+/)?.[0] ?? null;
}

/** Dev sem RESEND_API_KEY: o link aparece no console do servidor. */
export function emailsConsole(log: (msg: string) => void = console.log): Emails {
  return {
    async enviar(e) {
      log(`[e-mail para ${e.para}] ${e.assunto}\n${e.texto}`);
    },
  };
}

/** E2E (`TRUCO_EMAIL_TESTE=1`): guarda em memória e `GET /api/teste/emails` expõe. */
export class CaixaDeTeste implements Emails {
  readonly enviados: Email[] = [];
  async enviar(e: Email): Promise<void> {
    this.enviados.push(e);
    if (this.enviados.length > 200) this.enviados.shift();
  }
}

export function emailsResend(o: { chave: string; remetente: string; fetch?: typeof fetch }): Emails {
  const f = o.fetch ?? fetch;
  return {
    async enviar(e) {
      const r = await f('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${o.chave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: o.remetente, to: [e.para], subject: e.assunto, text: e.texto, html: e.html }),
      });
      if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
    },
  };
}
