import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { configurarApp, type ExtrasApp } from '../src/http/app';
import type { Servicos } from '../src/servicos';

export interface Resposta {
  status: number;
  json: any;
  texto: string;
  setCookie: string | null;
  headers: Headers;
}

/** Sobe só o Express (sem Colyseus) numa porta efêmera. */
export async function subirApp(servicos: Servicos, extras: ExtrasApp = {}) {
  const app = express();
  configurarApp(app, servicos, extras);
  const srv = await new Promise<Server>((ok) => {
    const s = app.listen(0, '127.0.0.1', () => ok(s));
  });
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  async function pedir(caminho: string, o: { metodo?: string; corpo?: unknown; cookie?: string; tipo?: string; auth?: string; headers?: Record<string, string> } = {}): Promise<Resposta> {
    const headers: Record<string, string> = { ...o.headers };
    if (o.corpo !== undefined) headers['content-type'] = o.tipo ?? 'application/json';
    if (o.cookie) headers.cookie = o.cookie;
    if (o.auth) headers.authorization = o.auth;
    const r = await fetch(base + caminho, {
      method: o.metodo ?? (o.corpo !== undefined ? 'POST' : 'GET'),
      headers,
      body: o.corpo === undefined ? undefined : typeof o.corpo === 'string' ? o.corpo : JSON.stringify(o.corpo),
    });
    const texto = await r.text();
    let json: any = null;
    try {
      json = texto ? JSON.parse(texto) : null;
    } catch {
      // não era JSON (ex.: index.html)
    }
    return { status: r.status, json, texto, setCookie: r.headers.get('set-cookie'), headers: r.headers };
  }
  return { base, pedir, fechar: () => new Promise<void>((ok) => srv.close(() => ok())) };
}

/** "nome=valor" do Set-Cookie, para mandar de volta em `cookie`. */
export const cookieDe = (setCookie: string | null): string => setCookie?.split(';')[0] ?? '';

export const tokenDoLink = (link: string): string => new URL(link.replace('/#/', '/')).searchParams.get('token') ?? '';
