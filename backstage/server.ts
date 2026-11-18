import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import QRCode from "qrcode";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { httpUrl, loadConfig } from "./config.ts";
import { createMetrics } from "./metrics.ts";
import type { Board, PointerMessage, Poll, PublicState, Quiz, QuizState, RemoteKey, ServerMessage, Share, StageState, ViewMessage, Vote, YouMessage } from "./protocol.ts";
import { renderReport } from "./report.ts";

const PORT = Number(process.env.PORT || 8080);
const DECK_DIR = path.resolve(process.env.DECK_DIR || path.join(import.meta.dirname, "..", "deck", "out"));
const DECK_PREFIX = "/apresentador";
const BOT_SILENCE_MS = Number(process.env.BOT_SILENCE_MS || 20000);
const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".txt": "text/plain", ".woff2": "font/woff2", ".ico": "image/x-icon" };

const config = loadConfig();
const t = config.t;
const KINDS = config.reactions.map((r) => r.id);

const AUTH = process.env.PRESENTER_AUTH !== "off";
const COOKIE = "stage";
function presenterToken(): string {
  if (process.env.PRESENTER_TOKEN) return process.env.PRESENTER_TOKEN;
  const file = process.env.DATA_DIR ? path.join(path.resolve(process.env.DATA_DIR), "presenter-token") : null;
  if (file) { try { const saved = fs.readFileSync(file, "utf8").trim(); if (saved) return saved; } catch {} }
  const fresh = crypto.randomBytes(18).toString("base64url");
  if (file) { try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, fresh, { mode: 0o600 }); } catch {} }
  return fresh;
}
const TOKEN = AUTH ? presenterToken() : "";
if (AUTH && TOKEN.length < 12) console.warn(t.banner.shortToken);
const digest = (v: string) => crypto.createHash("sha256").update(v).digest();
const sameToken = (v: unknown) => typeof v === "string" && crypto.timingSafeEqual(digest(v), digest(TOKEN));
function cookieToken(req: IncomingMessage): string | null {
  const m = /(?:^|;\s*)stage=([^;]+)/.exec(req.headers.cookie || "");
  if (!m?.[1]) return null;
  try { return decodeURIComponent(m[1]); } catch { return null; }
}
const isStage = (req: IncomingMessage) => !AUTH || sameToken(cookieToken(req));

const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
const DENIED = `<!doctype html><html lang="${esc(config.lang)}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(t.denied.title)}</title>
<body style="margin:0;min-height:100dvh;display:grid;place-items:center;background:#13181f;color:#f2ede2;font:17px/1.5 system-ui,sans-serif">
<main style="max-width:30em;padding:24px"><h1 style="font-size:22px;margin:0 0 8px">${esc(t.denied.title)}</h1>
<p>${esc(t.denied.body)}</p>
<p><a href="/" style="color:#e9ad40">${esc(t.denied.link)}</a></p></main></body></html>`;
function deny(res: ServerResponse) {
  res.writeHead(401, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(DENIED);
}

const state: { slide: PublicState["slide"]; links: PublicState["links"]; bot: boolean; poll: Poll; share: Share } = {
  slide: { index: 0, title: "" },
  links: [],
  bot: false,
  poll: { id: 0, open: false, up: 0, down: 0 },
  share: { on: false, v: 0 },
};
let shot: Buffer | null = null;
const SHOT_MAX = 2 * 1024 * 1024;
const votes = new Map<string, Vote>();
let lastHumanReaction = 0;

// Quiz e placar. A pergunta vem do slide atual; quem responde é identificado pelo mesmo id do
// navegador usado na votação, então recarregar a página não apaga os pontos.
const QUIZ_OFF: QuizState = { id: 0, phase: "off", question: "", options: [], counts: [], answered: 0, answer: null };
let slideQuiz: Quiz | null = null;   // o quiz do slide que está no telão
let quiz: QuizState = { ...QUIZ_OFF };
let quizKey = -1;                     // a resposta certa do quiz aberto; só vai para quiz.answer ao revelar
const answers = new Map<string, { choice: number; at: number }>();
const players = new Map<string, { name: string; points: number; last: YouMessage["quiz"] }>();
let boardOn = false;
const QUIZ_POINTS = 100, QUIZ_BONUS = 50, QUIZ_BONUS_STEP = 10; // certo: 100 + bônus pela ordem (1º +50, 2º +40...)

function parseQuiz(v: unknown): Quiz | null {
  if (typeof v !== "object" || v === null) return null;
  const { question, options, answer } = v as Record<string, unknown>;
  if (typeof question !== "string" || !Array.isArray(options)) return null;
  const opts = options.filter((o): o is string => typeof o === "string").map((o) => o.trim().slice(0, 160)).filter(Boolean);
  if (opts.length < 2 || opts.length > 6 || opts.length !== options.length) return null;
  if (!Number.isInteger(answer) || (answer as number) < 0 || (answer as number) >= opts.length) return null;
  return { question: question.trim().slice(0, 300), options: opts, answer: answer as number };
}
const cleanName = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const n = v.replace(/\s+/g, " ").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24);
  return n || null;
};
const ranking = () => [...players.values()].filter((p) => p.points > 0).sort((a, b) => b.points - a.points);
const board = (): Board => ({ on: boardOn, top: ranking().slice(0, 10).map(({ name, points }) => ({ name, points })), players: players.size });
const publicQuiz = (): QuizState => (quiz.phase === "open" ? { ...quiz, counts: [] } : quiz);

const metrics = createMetrics({ dataDir: process.env.DATA_DIR, getAudience: () => audience() });
const validCid = (c: unknown): string | null => (typeof c === "string" && /^[a-z0-9]{8,64}$/i.test(c) ? c : null);

const audienceConfig = JSON.stringify({ reactions: config.reactions, sourceUrl: config.sourceUrl, t: t.audience }).replace(/</g, "\\u003c");
const pageVars: Record<string, string> = {
  config: audienceConfig, theme: config.theme, title: esc(config.title), event: esc(config.event), lang: esc(config.lang),
  ...Object.fromEntries(Object.entries(t.audience).map(([k, v]) => [`t.${k}`, esc(v)])),
};
const audiencePage = Buffer.from(
  fs.readFileSync(path.join(import.meta.dirname, "public", "index.html"), "utf8").replace(/\{\{([\w.]+)\}\}/g, (all, k: string) => pageVars[k] ?? all),
);

function serveFile(res: ServerResponse, file: string) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const { pathname } = url;
  if (pathname === "/") {
    metrics.pageView();
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
    res.end(audiencePage);
    return;
  }
  if (pathname === DECK_PREFIX || pathname.startsWith(DECK_PREFIX + "/")) {
    const given = url.searchParams.get("token");
    if (AUTH && given !== null) {
      if (!sameToken(given)) return deny(res);
      // o token sai do endereço (histórico, captura de tela) e vira cookie só deste prefixo
      url.searchParams.delete("token");
      const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
      res.writeHead(302, {
        "set-cookie": `${COOKIE}=${encodeURIComponent(TOKEN)}; Path=${DECK_PREFIX}; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`,
        location: (pathname === DECK_PREFIX ? DECK_PREFIX + "/" : pathname) + url.search,
        "cache-control": "no-store", "referrer-policy": "no-referrer",
      });
      res.end();
      return;
    }
    if (!isStage(req)) return deny(res);
  }
  if (pathname === DECK_PREFIX + "/metricas/") { res.writeHead(301, { location: DECK_PREFIX + "/metricas" }); res.end(); return; }
  if (pathname === DECK_PREFIX + "/metricas") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(renderReport(metrics.report(), state.links, config));
    return;
  }
  if (pathname === DECK_PREFIX + "/metricas.json") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store", "content-disposition": `attachment; filename="metricas-${new Date().toISOString().slice(0, 10)}.json"` });
    res.end(JSON.stringify(metrics.report(), null, 1));
    return;
  }
  if (pathname === DECK_PREFIX + "/metricas/zerar") {
    // POST vindo da própria página (o navegador marca sec-fetch-site); nada de GET ou outro site
    const site = req.headers["sec-fetch-site"];
    if (req.method !== "POST" || (site && site !== "same-origin")) { res.writeHead(403); res.end(); return; }
    const archived = metrics.reset();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, archived }));
    return;
  }
  if (pathname.startsWith(DECK_PREFIX + "/metricas/arquivo/")) {
    const name = pathname.slice((DECK_PREFIX + "/metricas/arquivo/").length);
    if (!process.env.DATA_DIR || !/^metrics-[\w-]+\.json$/.test(name)) { res.writeHead(404); res.end("not found"); return; }
    res.setHeader("content-disposition", `attachment; filename="${name}"`);
    return serveFile(res, path.join(path.resolve(process.env.DATA_DIR), name));
  }
  if (pathname === "/healthz") { res.writeHead(200); res.end("ok"); return; }
  if (pathname === "/tela.jpg") {
    if (!shot || !state.share.on) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": "image/jpeg", "content-length": shot.length, "cache-control": "public, max-age=3600" });
    res.end(shot);
    return;
  }
  if (pathname === "/state") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(publicState())); return; }
  if (pathname === DECK_PREFIX) { res.writeHead(301, { location: DECK_PREFIX + "/" }); res.end(); return; }
  if (pathname.startsWith(DECK_PREFIX + "/")) {
    let rel: string;
    try { rel = decodeURIComponent(pathname.slice(DECK_PREFIX.length)); } catch { res.writeHead(400); res.end(); return; }
    if (rel.endsWith("/")) rel += "index.html"; // antes do join: no Windows ele troca / por \
    const file = path.join(DECK_DIR, rel);
    if (!file.startsWith(DECK_DIR + path.sep)) { res.writeHead(403); res.end(); return; }
    return serveFile(res, file);
  }
  res.writeHead(404); res.end("not found");
});

type Role = "audience" | "stage";
type Client = WebSocket & {
  role: Role;
  sub: "deck" | "remote" | null;
  connCid: string | null;
  cid?: string;
  bucket: number;                // limitador de reações: 1 a cada 300 ms, rajada de 5
  last?: number;
  notes?: boolean;
  alive: boolean;
};
const WS_ROLES: Record<string, Role> = { "/ws": "audience", [DECK_PREFIX + "/ws"]: "stage" };
const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 * 1024 }); // a maior mensagem é a foto do slide
server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://x");
  const role = WS_ROLES[url.pathname];
  if (!role) { socket.destroy(); return; }
  if (role === "stage" && !isStage(req)) { socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"); socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const c = ws as Client;
    c.role = role;
    c.sub = role === "stage" ? "deck" : null;
    c.connCid = role === "audience" ? validCid(url.searchParams.get("cid")) : null;
    c.bucket = 0;
    c.alive = true;
    wss.emit("connection", c, req);
  });
});
const all = () => [...wss.clients] as Client[];
const isOpen = (c: Client) => c.readyState === 1;
const clients = (f: (c: Client) => boolean) => all().filter((c) => isOpen(c) && f(c));
const audience = () => clients((c) => c.role === "audience").length;
const decks = () => clients((c) => c.sub === "deck");
// Comandos do passador vão para UMA janela do deck: com projetor e notas abertos, as duas avançariam
// e o BroadcastChannel do Deck faria a outra andar de novo. Preferência pela janela sem o painel de
// notas, que é a do projetor (onde o vídeo precisa tocar).
const primaryDeck = () => { const d = decks(); return d.find((c) => !c.notes) ?? d[0]; };
const publicState = (): PublicState => ({ slide: state.slide, links: state.links, poll: state.poll, share: state.share, quiz: publicQuiz(), board: board() });
const stageState = (): StageState => ({ ...publicState(), quiz, connected: audience(), bot: state.bot, publicUrl });
const stateFor = (c: Client): ServerMessage => (c.role === "stage" ? { type: "state", state: stageState() } : { type: "state", state: publicState() });
const send = (c: Client, msg: ServerMessage) => { if (isOpen(c)) c.send(JSON.stringify(msg)); };
const broadcast = (msg: ServerMessage, filter: (c: Client) => boolean = () => true) => {
  const data = JSON.stringify(msg);
  for (const c of all()) if (isOpen(c) && filter(c)) c.send(data);
};
const sendState = () => {
  const pub = JSON.stringify({ type: "state", state: publicState() } satisfies ServerMessage);
  const stage = JSON.stringify({ type: "state", state: stageState() } satisfies ServerMessage);
  for (const c of all()) if (isOpen(c)) c.send(c.role === "stage" ? stage : pub);
};
let stateDirty = false;
const sendStateSoon = () => { stateDirty = true; };

// Posição do deck para o passador. `elapsed` é o cronômetro do deck no instante `at`; quem recebe
// soma o tempo que passou, então relógios diferentes entre notebook e celular não importam.
const view: { index: number; step: number; steps: number; black: boolean; full: boolean; elapsed: number | null; at: number } =
  { index: 0, step: 0, steps: 0, black: false, full: false, elapsed: null, at: Date.now() };
const presenterView = (): ViewMessage => ({
  type: "view", index: view.index, step: view.step, steps: view.steps, black: view.black, full: view.full,
  elapsed: view.elapsed === null ? null : view.elapsed + (Date.now() - view.at), decks: decks().length,
});
const sendView = () => broadcast(presenterView(), (c) => c.sub === "remote");

const REMOTE_KEYS: readonly RemoteKey[] = ["ArrowRight", "ArrowLeft", "b", "v", "f"];
const isRemoteKey = (k: unknown): k is RemoteKey => (REMOTE_KEYS as readonly unknown[]).includes(k);
const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);
const unit = (v: unknown) => Math.min(1, Math.max(0, Number(v)));

// Reações vão em lote: um emoji por mensagem chegou a ~89 mil mensagens/s com 200 pessoas.
const FLUSH_MS = 250;
let pending: Record<string, number> | null = null;
const addReaction = (kind: string) => {
  pending ??= {};
  pending[kind] = (pending[kind] || 0) + 1;
};
setInterval(() => {
  if (pending) { broadcast({ type: "burst", h: pending }); pending = null; }
  if (stateDirty) { stateDirty = false; sendState(); }
}, FLUSH_MS);

const sendStage = () => broadcast({ type: "state", state: stageState() }, (c) => c.role === "stage");

// Cada socket fica com o primeiro id que mandou, para não dar para inflar trocando o id.
const cidOf = (ws: Client, m: Record<string, unknown>) => (ws.cid ??= ws.connCid || validCid(m.cid) || `ws:${Math.random()}`);
function youFor(cid: string): YouMessage {
  const p = players.get(cid);
  const i = p ? ranking().indexOf(p) : -1;
  return { type: "you", name: p?.name ?? "", points: p?.points ?? 0, rank: i >= 0 ? i + 1 : null, quiz: p?.last ?? null };
}
const sendYou = (cid: string) => {
  const msg = youFor(cid);
  for (const c of clients((c) => c.role === "audience" && (c.cid ?? c.connCid) === cid)) send(c, msg);
};
const player = (cid: string) => {
  let p = players.get(cid);
  if (!p) { p = { name: `${t.audience.anonymous} ${players.size + 1}`, points: 0, last: null }; players.set(cid, p); }
  return p;
};

function quizCommand(action: unknown) {
  if (action === "open") {
    if (!slideQuiz || quiz.phase === "open") return;
    quiz = { id: quiz.id + 1, phase: "open", question: slideQuiz.question, options: slideQuiz.options, counts: slideQuiz.options.map(() => 0), answered: 0, answer: null };
    quizKey = slideQuiz.answer;
    answers.clear();
    boardOn = false;
  } else if (action === "reveal") {
    if (quiz.phase !== "open") return;
    quiz = { ...quiz, phase: "reveal", answer: quizKey };
    // pontua: certo vale 100, mais um bônus para quem acertou primeiro
    const right = [...answers].filter(([, a]) => a.choice === quizKey).sort((a, b) => a[1].at - b[1].at);
    const gained = new Map(right.map(([cid], rank) => [cid, QUIZ_POINTS + Math.max(0, QUIZ_BONUS - rank * QUIZ_BONUS_STEP)]));
    for (const [cid, a] of answers) {
      const p = player(cid);
      const g = gained.get(cid) ?? 0;
      p.points += g;
      p.last = { id: quiz.id, choice: a.choice, correct: g > 0, gained: g };
    }
    for (const [cid, p] of players) if (!answers.has(cid)) p.last = { id: quiz.id, choice: null, correct: null, gained: 0 };
    for (const cid of players.keys()) sendYou(cid);
  } else if (action === "close") {
    if (quiz.phase === "off") return;
    quiz = { ...quiz, phase: "off" };
  } else if (action === "board") {
    boardOn = !boardOn;
  } else if (action === "reset") {
    players.clear();
    answers.clear();
    boardOn = false;
    quiz = { ...QUIZ_OFF, id: quiz.id };
    for (const c of clients((c) => c.role === "audience")) send(c, { type: "you", name: "", points: 0, rank: null, quiz: null });
  } else return;
  sendState();
}

wss.on("connection", (ws: Client) => {
  ws.on("pong", () => { ws.alive = true; });
  send(ws, stateFor(ws));
  sendStage();
  if (ws.role === "audience") { metrics.device(ws.connCid); metrics.audienceChanged(audience()); }
  if (ws.role === "audience" && ws.connCid && players.has(ws.connCid)) send(ws, youFor(ws.connCid));
  if (ws.role === "stage") sendView();

  ws.on("message", (raw) => {
    // O que chega é entrada de fora: cada campo é conferido antes de usar. Os tipos de protocol.ts
    // dizem o que um cliente correto manda; aqui não se confia neles.
    let m: Record<string, unknown>;
    try { const parsed: unknown = JSON.parse(String(raw)); if (typeof parsed !== "object" || parsed === null) return; m = parsed as Record<string, unknown>; } catch { return; }
    const stage = ws.role === "stage";
    switch (m.type) {
      case "react": {
        if (typeof m.kind !== "string" || !KINDS.includes(m.kind)) return;
        const now = Date.now();
        ws.bucket = Math.max(0, ws.bucket - (now - (ws.last ?? now)) / 300) + 1;
        ws.last = now;
        if (ws.bucket > 5) return;
        lastHumanReaction = now;
        addReaction(m.kind);
        metrics.reaction(m.kind, false);
        break;
      }
      case "click": {
        const clicked = m.url;
        if (typeof clicked === "string" && state.links.some((l) => l.url === clicked)) metrics.click(clicked);
        break;
      }
      case "vote": {
        if (!state.poll.open || (m.choice !== "up" && m.choice !== "down")) return;
        // O celular manda um id que guarda no navegador: reconectar (tela apagada) não vira voto novo.
        const cid = cidOf(ws, m);
        const prev = votes.get(cid);
        if (prev === m.choice) return;
        if (prev) state.poll[prev]--;
        state.poll[m.choice]++;
        votes.set(cid, m.choice);
        metrics.pollVote(state.poll);
        sendStateSoon();
        break;
      }
      case "join": {
        if (stage) return;
        const name = cleanName(m.name);
        if (!name) return;
        const cid = cidOf(ws, m);
        const p = players.get(cid);
        if (p) p.name = name;
        else players.set(cid, { name, points: 0, last: null });
        sendYou(cid);
        sendStateSoon();
        break;
      }
      case "answer": {
        // uma resposta por aluno e por quiz: a primeira vale (é ela que conta para o bônus de rapidez)
        if (stage || quiz.phase !== "open" || !Number.isInteger(m.choice)) return;
        const choice = m.choice as number;
        if (choice < 0 || choice >= quiz.options.length) return;
        const cid = cidOf(ws, m);
        if (answers.has(cid)) return;
        answers.set(cid, { choice, at: Date.now() });
        player(cid);
        quiz.counts[choice] = (quiz.counts[choice] ?? 0) + 1;
        quiz.answered++;
        sendStateSoon();
        break;
      }
      case "quiz":
        if (!stage) return;
        quizCommand(m.action);
        break;

      case "hello":
        if (!stage) return;
        ws.sub = m.as === "remote" ? "remote" : "deck";
        if (ws.sub === "remote") send(ws, presenterView());
        sendView();
        break;
      case "slide": {
        if (ws.sub !== "deck") return;
        state.slide = { index: int(m.index), title: String(m.title || "") };
        slideQuiz = parseQuiz(m.quiz);
        metrics.slide(state.slide.index, state.slide.title);
        for (const l of Array.isArray(m.links) ? m.links as unknown[] : []) {
          if (typeof l !== "object" || l === null) continue;
          const { url: u, label } = l as { url?: unknown; label?: unknown };
          if (typeof u === "string" && u && !state.links.some((k) => k.url === u)) state.links.push({ label: String(label || u), url: u });
        }
        sendState();
        break;
      }
      case "view":
        if (ws.sub !== "deck") return;
        ws.notes = Boolean(m.notes);
        if (ws !== primaryDeck()) return; // a janela de notas repete a mesma navegação
        Object.assign(view, {
          index: int(m.index), step: int(m.step), steps: int(m.steps), black: Boolean(m.black), full: Boolean(m.full),
          elapsed: typeof m.elapsed === "number" && Number.isFinite(m.elapsed) ? Math.max(0, m.elapsed) : null, at: Date.now(),
        });
        sendView();
        break;
      case "key": {
        if (ws.sub !== "remote" || !isRemoteKey(m.key)) return;
        const d = primaryDeck();
        if (d) send(d, { type: "key", key: m.key });
        break;
      }
      case "pointer": {
        if (ws.sub !== "remote") return;
        const toDecks = (msg: PointerMessage) => broadcast(msg, (c) => c.sub === "deck");
        if (m.off) { toDecks({ type: "pointer", off: true }); break; }
        if (!Number.isFinite(Number(m.x)) || !Number.isFinite(Number(m.y))) return;
        toDecks({ type: "pointer", x: unit(m.x), y: unit(m.y), mode: m.mode === "spot" ? "spot" : "laser", tap: Boolean(m.tap) });
        break;
      }
      case "share":
        if (!stage) return;
        if (Boolean(m.on) === state.share.on) return;
        shot = null;
        state.share = { on: Boolean(m.on), v: 0 };
        sendState();
        break;
      case "shot": {
        if (ws.sub !== "deck" || ws !== primaryDeck() || !state.share.on) return;
        const prefix = "data:image/jpeg;base64,";
        if (typeof m.data !== "string" || !m.data.startsWith(prefix)) return;
        const buf = Buffer.from(m.data.slice(prefix.length), "base64");
        if (buf.length < 4 || buf.length > SHOT_MAX || buf[0] !== 0xff || buf[1] !== 0xd8) return;
        shot = buf;
        state.share = { on: true, v: Date.now() };
        sendState();
        break;
      }
      case "bot":
        if (!stage) return;
        state.bot = Boolean(m.on);
        sendStage();
        break;
      case "poll":
        if (!stage) return;
        if (m.open && !state.poll.open) { state.poll = { id: state.poll.id + 1, open: true, up: 0, down: 0 }; votes.clear(); metrics.pollOpen(); }
        else if (!m.open && state.poll.open) { state.poll.open = false; metrics.pollClose(state.poll); }
        sendState();
        break;
    }
  });
  ws.on("close", () => { sendStage(); if (ws.role === "stage") sendView(); });
});

function botTick() {
  const quiet = Date.now() - lastHumanReaction > BOT_SILENCE_MS;
  const first = KINDS[0];
  if (state.bot && quiet && wss.clients.size > 0 && first) {
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const kind = Math.random() < 0.75 ? first : KINDS[Math.floor(Math.random() * KINDS.length)] ?? first;
      setTimeout(() => { addReaction(kind); metrics.reaction(kind, true); }, i * (250 + Math.random() * 500));
    }
    lastHumanReaction = Date.now() - BOT_SILENCE_MS / 2;
  }
  setTimeout(botTick, 4000 + Math.random() * 6000);
}
botTick();

setInterval(() => {
  for (const c of all()) {
    if (!c.alive) { c.terminate(); continue; }
    c.alive = false;
    try { c.ping(); } catch {}
  }
}, 15000);
// O reenvio do estado serve de batimento: o cliente reconecta após 30 s sem receber nada.
setInterval(sendState, 10000);

setInterval(() => metrics.tick(), 10000);
for (const sig of ["SIGTERM", "SIGINT"] as const) process.on(sig, () => { metrics.save(); process.exit(0); });

// Endereço da plateia: PUBLIC_URL, senão o que o túnel rápido sorteou, senão o do deck.config.json.
const FIXED_URL = httpUrl(process.env.PUBLIC_URL);
const TUNNEL_METRICS = (process.env.TUNNEL_METRICS || "").replace(/\/+$/, "");
let publicUrl = FIXED_URL || config.publicUrl;
function setPublicUrl(u: string) {
  if (!u || u === publicUrl) return;
  publicUrl = u;
  sendStage();
  void banner();
}
async function askTunnel() {
  let found = false;
  try {
    const r = await fetch(TUNNEL_METRICS + "/quicktunnel", { signal: AbortSignal.timeout(2000) });
    const body: unknown = await r.json();
    const host = typeof body === "object" && body !== null ? (body as { hostname?: unknown }).hostname : null;
    if (typeof host === "string" && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host)) { found = true; setPublicUrl("https://" + host); }
  } catch {}
  setTimeout(askTunnel, found ? 30000 : 2000).unref();
}

function lanUrl(): string {
  if (fs.existsSync("/.dockerenv")) return "";
  for (const list of Object.values(os.networkInterfaces())) for (const i of list ?? []) if (i.family === "IPv4" && !i.internal) return `http://${i.address}:${PORT}`;
  return "";
}
async function banner() {
  const b = t.banner;
  const local = (process.env.LOCAL_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
  const q = AUTH ? `?token=${encodeURIComponent(TOKEN)}` : "";
  const reach = publicUrl || lanUrl();
  const remote = reach ? `${reach}${DECK_PREFIX}/remoto/${q}` : "";
  const w = Math.max(b.stage.length, b.audience.length, b.remote.length, b.metrics.length) + 2;
  const row = (name: string, value: string) => `  ${name.padEnd(w)}${value}`;
  const hint = publicUrl ? "" : "   " + (TUNNEL_METRICS && !FIXED_URL ? b.waitingTunnel : b.lanOnly);
  const out = [
    "",
    `  ${config.title}`,
    "",
    row(b.stage, `${local}${DECK_PREFIX}/${q}`),
    row(b.audience, (reach || b.noPublicUrl) + hint),
    row(b.remote, remote || b.remoteLater),
    row(b.metrics, `${local}${DECK_PREFIX}/metricas`),
  ];
  if (!AUTH) out.push("", `  ${b.authOff}`);
  if (!fs.existsSync(DECK_DIR)) out.push("", `  ${b.noDeck} ${DECK_DIR}`);
  if (remote) {
    try { out.push("", `  ${b.remoteQr}`, "", (await QRCode.toString(remote, { type: "terminal", small: true })).replace(/^/gm, "  ")); } catch {}
  }
  console.log(out.join("\n") + "\n");
}

server.listen(PORT, () => {
  void banner();
  if (TUNNEL_METRICS && !FIXED_URL) void askTunnel();
});
