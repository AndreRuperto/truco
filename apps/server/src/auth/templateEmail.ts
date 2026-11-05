/**
 * E-mail do link mágico no visual "boteco" do jogo (lousa, papel, madeira).
 * Feito para clientes de e-mail: tabelas, estilos inline, sem SVG (o Gmail bloqueia)
 * e sem fontes web (cai para fontes do sistema). A logo é um PNG servido pelo próprio
 * site (`/email-zap.png`), na mesma origem do link.
 */
const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const COR = {
  fundo: '#e7eee9',
  lousa: '#1f2b25',
  giz: '#efeadf',
  gizSuave: '#b9b4a8',
  papel: '#fbf8f1',
  tinta: '#1c1916',
  tintaSuave: '#5b544c',
  madeira: '#9a6337',
  madeiraFunda: '#5e3a1f',
  grito: '#e9b02c',
  vermelho: '#b8202a',
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
    ? `<img src="${escapar(origem)}/email-zap.png" width="44" height="44" alt="" style="display:block;border:0;outline:none" />`
    : '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>Seu link para entrar no Truco</title>
</head>
<body style="margin:0;padding:0;background:${COR.fundo}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Toque no botão para sentar na mesa. O link vale por 15 minutos.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.fundo}">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
    <tr><td style="background:${COR.lousa};border:4px solid ${COR.madeiraFunda};border-bottom:0;border-radius:18px 18px 0 0;padding:20px 24px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:12px;vertical-align:middle">${logo}</td>
        <td style="vertical-align:middle;font-family:${FONTE};font-size:30px;font-weight:800;color:${COR.giz};letter-spacing:0.5px">Truco</td>
      </tr></table>
    </td></tr>
    <tr><td style="background:${COR.papel};border:4px solid ${COR.madeiraFunda};border-top:0;border-radius:0 0 18px 18px;padding:28px 24px 24px;font-family:${FONTE};color:${COR.tinta}">
      <p style="margin:0 0 8px;font-size:22px;font-weight:800;line-height:1.25">A mesa tá posta.</p>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.5">Toque no botão para entrar na sua conta e jogar ranqueada, ver seu perfil e seu histórico.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr>
        <td style="background:${COR.madeira};border:2px solid ${COR.madeiraFunda};border-radius:12px">
          <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${FONTE};font-size:18px;font-weight:800;color:${COR.papel};text-decoration:none">Entrar no Truco</a>
        </td>
      </tr></table>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:${COR.tintaSuave}">O link vale por <strong style="color:${COR.tinta}">15 minutos</strong> e só funciona uma vez. Se ele vencer, peça outro na tela Entrar.</p>
      <p style="margin:0 0 4px;font-size:13px;color:${COR.tintaSuave}">O botão não abriu? Copie e cole este endereço no navegador:</p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.4;word-break:break-all"><a href="${href}" style="color:${COR.vermelho}">${href}</a></p>
      <p style="margin:0;padding-top:16px;border-top:1px dashed #d9d2c4;font-size:13px;line-height:1.5;color:${COR.tintaSuave}">Se não foi você que pediu, pode ignorar: ninguém entra na conta sem clicar neste link.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}
