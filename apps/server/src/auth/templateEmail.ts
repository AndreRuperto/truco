/**
 * E-mail do link mágico no tema escuro do jogo: a noite do bar em volta, a lousa no meio,
 * giz no texto e o amarelo do grito de truco no botão.
 * Feito para clientes de e-mail: tabelas, estilos inline, sem SVG (o Gmail bloqueia)
 * e sem fontes web (cai para fontes do sistema). A logo é um PNG servido pelo próprio
 * site (`/email-zap.png`), na mesma origem do link.
 */
const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Os mesmos valores dos tokens de apps/web/src/estilos.css (--lousa-noite, --lousa, --giz…). */
const COR = {
  noite: '#141c18',
  lousa: '#1f2b25',
  lousaFunda: '#18221d',
  borda: '#33443b',
  madeiraFunda: '#5e3a1f',
  giz: '#efeadf',
  gizSuave: '#b9b4a8',
  grito: '#e9b02c',
  tinta: '#1c1916',
};

const FONTE = "'Bricolage Grotesque', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function origemDe(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

export function htmlDoLinkMagico(url: string): string {
  const href = escapar(url);
  const origem = origemDe(url);
  const logo = origem
    ? `<img src="${escapar(origem)}/email-zap.png" width="40" height="40" alt="" style="display:block;border:0;outline:none" />`
    : '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>Seu link para entrar no Truco</title>
</head>
<body style="margin:0;padding:0;background:${COR.noite}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Toque no botão para sentar na mesa. O link vale por 15 minutos.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${COR.noite}" style="background:${COR.noite}">
<tr><td align="center" style="padding:32px 16px 24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
    <tr><td align="center" style="padding:0 0 20px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:10px;vertical-align:middle">${logo}</td>
        <td style="vertical-align:middle;font-family:${FONTE};font-size:28px;font-weight:800;color:${COR.giz};letter-spacing:0.3px">Truco</td>
      </tr></table>
    </td></tr>
    <tr><td bgcolor="${COR.lousa}" style="background:${COR.lousa};border:4px solid ${COR.madeiraFunda};border-radius:18px;padding:28px 24px 24px;font-family:${FONTE};color:${COR.giz}">
      <p style="margin:0 0 10px;font-size:26px;font-weight:800;line-height:1.2;color:${COR.giz}">A mesa tá posta.</p>
      <p style="margin:0 0 22px;font-size:16px;line-height:1.55;color:${COR.giz}">Toque no botão para entrar na sua conta e jogar ranqueada, ver seu perfil e seu histórico.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid ${COR.borda};border-radius:12px;background:${COR.lousaFunda}" bgcolor="${COR.lousaFunda}"><tr>
        <td width="50%" style="padding:12px 16px;border-right:1px solid ${COR.borda};font-family:${FONTE}">
          <span style="display:block;font-size:13px;color:${COR.gizSuave}">Vale por</span>
          <span style="display:block;font-size:16px;font-weight:800;color:${COR.giz}">15 minutos</span>
        </td>
        <td width="50%" style="padding:12px 16px;font-family:${FONTE}">
          <span style="display:block;font-size:13px;color:${COR.gizSuave}">Funciona</span>
          <span style="display:block;font-size:16px;font-weight:800;color:${COR.giz}">uma vez só</span>
        </td>
      </tr></table>
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 24px"><tr>
        <td bgcolor="${COR.grito}" style="background:${COR.grito};border-radius:12px">
          <a href="${href}" style="display:inline-block;padding:14px 32px;font-family:${FONTE};font-size:18px;font-weight:800;color:${COR.tinta};text-decoration:none">Entrar no Truco</a>
        </td>
      </tr></table>
      <p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:${COR.gizSuave}">O botão não abriu? Copie e cole este endereço no navegador:</p>
      <p style="margin:0 0 20px;font-size:13px;line-height:1.45;word-break:break-all"><a href="${href}" style="color:${COR.grito}">${href}</a></p>
      <p style="margin:0;padding-top:16px;border-top:1px solid ${COR.borda};font-size:13px;line-height:1.5;color:${COR.gizSuave}">Se o link vencer, peça outro na tela Entrar. Se não foi você que pediu, pode ignorar: ninguém entra na conta sem clicar neste link.</p>
    </td></tr>
    <tr><td align="center" style="padding:18px 8px 0;font-family:${FONTE};font-size:12px;line-height:1.5;color:${COR.gizSuave}">Truco, a mesa online para jogar com os amigos</td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}
