import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net, { type AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { WebSocket } from "ws";
import type { BurstMessage, ClientMessage, PublicState, RemoteKey, ServerMessage, StageState, ViewMessage, YouMessage } from "../protocol.ts";

const TOKEN = "token-de-teste-123456";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "backstage-test-"));
const deckDir = path.join(tmp, "deck");
fs.mkdirSync(deckDir);
fs.writeFileSync(path.join(deckDir, "index.html"), "<h1>deck</h1>");

const baseConfig = {
  title: "Palestra <de> teste", event: "Evento X", lang: "pt-BR", timeZone: "America/Sao_Paulo", sourceUrl: "https://example.com/fonte",
  reactions: [{ id: "clap", emoji: "👏", label: "palmas" }, { id: "rocket", emoji: "🚀", label: "foguete" }],
  theme: { dark: { bg: "#101418", accentSoft: "rgba(1, 2, 3, .5)", accent: "red;} body{display:none" } },
};
function writeConfig(name: string, config: object): string {
  const file = path.join(tmp, name);
  fs.writeFileSync(file, JSON.stringify(config));
  return file;
}
const configFile = writeConfig("deck.config.json", baseConfig);

const freePort = () => new Promise<number>((resolve) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address() as AddressInfo; s.close(() => resolve(port)); }); });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const children: ChildProcess[] = [];

async function start(env: Record<string, string> = {}) {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(import.meta.dirname, "..", "server.ts")], {
    env: { PATH: process.env.PATH ?? "", PORT: String(port), DECK_DIR: deckDir, DECK_CONFIG: configFile, ...env },
    stdio: ["ignore", "pipe", "inherit"],
  });
  children.push(child);
  let out = "";
  child.stdout?.on("data", (d: Buffer) => { out += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + "/healthz")).ok) return { base, port, child, output: () => out }; } catch {}
    await sleep(50);
  }
  throw new Error("o servidor não subiu");
}

type TestClient = {
  next<T extends ServerMessage>(f: (m: ServerMessage) => m is T, ms?: number): Promise<T>;
  say(m: ClientMessage): void;
  raw(m: unknown): void;
  close(): void;
};
function connect(port: number, pathname: string, headers: Record<string, string> = {}): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${pathname}`, { headers });
    const seen: ServerMessage[] = [];
    const waiting: { f: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];
    ws.on("message", (raw) => {
      const m = JSON.parse(String(raw)) as ServerMessage;
      seen.push(m);
      for (const w of [...waiting]) if (w.f(m)) { waiting.splice(waiting.indexOf(w), 1); w.resolve(m); }
    });
    const client: TestClient = {
      next: <T extends ServerMessage>(f: (m: ServerMessage) => m is T, ms = 3000) => new Promise<T>((res, rej) => {
        const hit = seen.find(f);
        if (hit) return res(hit);
        waiting.push({ f, resolve: (m) => res(m as T) });
        setTimeout(() => rej(new Error("mensagem esperada não chegou")), ms).unref();
      }),
      say: (m) => ws.send(JSON.stringify(m)),
      raw: (m) => ws.send(JSON.stringify(m)),
      close: () => ws.close(),
    };
    ws.on("open", () => resolve(client));
    ws.on("error", reject);
  });
}

type StageMsg = { type: "state"; state: StageState };
type AudienceMsg = { type: "state"; state: PublicState };
type KeyMsg = { type: "key"; key: RemoteKey };
const stageWhere = (f: (s: StageState) => boolean = () => true) => (m: ServerMessage): m is StageMsg => m.type === "state" && "connected" in m.state && f(m.state);
const publicWhere = (f: (s: PublicState) => boolean = () => true) => (m: ServerMessage): m is AudienceMsg => m.type === "state" && f(m.state);
const isBurst = (m: ServerMessage): m is BurstMessage => m.type === "burst";
const isKey = (m: ServerMessage): m is KeyMsg => m.type === "key";
const viewAt = (index: number) => (m: ServerMessage): m is ViewMessage => m.type === "view" && m.index === index;

let srv: Awaited<ReturnType<typeof start>>;
const cookie = `stage=${encodeURIComponent(TOKEN)}`;
const text = async (url: string, init?: RequestInit) => (await fetch(url, init)).text();
before(async () => { srv = await start({ PRESENTER_TOKEN: TOKEN, PUBLIC_URL: "https://plateia.example.com/" }); });
after(() => { for (const c of children) c.kill(); fs.rmSync(tmp, { recursive: true, force: true }); });

test("a página da plateia vem do deck.config.json, com o texto escapado", async () => {
  const html = await text(srv.base + "/");
  assert.match(html, /<h1>Palestra &lt;de&gt; teste<\/h1>/);
  assert.match(html, /<small>Evento X<\/small>/);
  assert.match(html, /"id":"rocket"/);
  assert.match(html, /example\.com\/fonte/);
  assert.match(html, /<h2>Links citados<\/h2>/);
  assert.doesNotMatch(html, /\{\{[\w.]+\}\}/);
});

test("lang en: página da plateia, área negada, métricas e terminal em inglês", async () => {
  const en = await start({ PRESENTER_TOKEN: TOKEN, DECK_CONFIG: writeConfig("en.json", { ...baseConfig, lang: "en", timeZone: "UTC" }) });
  const page = await text(en.base + "/");
  assert.match(page, /<html lang="en">/);
  assert.match(page, /<h2>Links mentioned<\/h2>/);
  assert.match(page, /"live":"live"/);
  assert.match(await text(en.base + "/apresentador/"), /Presenter area/);
  assert.match(await text(en.base + "/apresentador/metricas", { headers: { cookie } }), /<h1>Talk metrics<\/h1>/);
  await sleep(200);
  assert.match(en.output(), /stage\s+http:\/\/localhost:\d+\/apresentador\/\?token=/);
});

test("os tokens de tema viram variáveis CSS; valor que não é cor fica de fora", async () => {
  const html = await text(srv.base + "/");
  assert.match(html, /<style>:root:root\{--bg:#101418;--accent-soft:rgba\(1, 2, 3, \.5\)\}<\/style>/);
  assert.doesNotMatch(html, /display:none/);
  assert.match(await text(srv.base + "/apresentador/metricas", { headers: { cookie } }), /:root:root\{--bg:#101418/);
});

test("a área do apresentador não abre sem o token", async () => {
  for (const p of ["/apresentador/", "/apresentador/remoto/", "/apresentador/metricas", "/apresentador/metricas.json", "/apresentador/?token=errado"]) {
    assert.equal((await fetch(srv.base + p, { redirect: "manual" })).status, 401, p);
  }
});

test("o link com token grava o cookie e limpa o endereço", async () => {
  const r = await fetch(`${srv.base}/apresentador/remoto/?token=${TOKEN}&x=1`, { redirect: "manual" });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get("location"), "/apresentador/remoto/?x=1");
  const set = r.headers.get("set-cookie") ?? "";
  assert.match(set, /^stage=token-de-teste-123456; Path=\/apresentador; HttpOnly; SameSite=Lax/);
  assert.doesNotMatch(set, /Secure/);
  const viaTunnel = await fetch(`${srv.base}/apresentador/?token=${TOKEN}`, { redirect: "manual", headers: { "x-forwarded-proto": "https" } });
  assert.match(viaTunnel.headers.get("set-cookie") ?? "", /; Secure$/);
  const page = await fetch(srv.base + "/apresentador/", { headers: { cookie } });
  assert.equal(page.status, 200);
  assert.equal(await page.text(), "<h1>deck</h1>");
});

test("o socket do palco exige o cookie; o da plateia é aberto", async () => {
  await assert.rejects(connect(srv.port, "/apresentador/ws"));
  await assert.rejects(connect(srv.port, "/apresentador/ws", { cookie: "stage=errado" }));
  const a = await connect(srv.port, "/ws");
  const s = await a.next(publicWhere());
  assert.equal("connected" in s.state, false);
  assert.equal("publicUrl" in s.state, false);
  a.close();
});

test("o palco recebe o endereço da plateia para desenhar o QR", async () => {
  const deck = await connect(srv.port, "/apresentador/ws", { cookie });
  const s = await deck.next(stageWhere());
  assert.equal(s.state.publicUrl, "https://plateia.example.com");
  deck.close();
});

test("reação da plateia chega ao telão; reação fora da lista é ignorada", async () => {
  const deck = await connect(srv.port, "/apresentador/ws", { cookie });
  const phone = await connect(srv.port, "/ws?cid=abcdefgh1234");
  phone.say({ type: "react", kind: "naoexiste" });
  phone.say({ type: "react", kind: "rocket" });
  const burst = await deck.next(isBurst);
  assert.deepEqual(burst.h, { rocket: 1 });
  deck.close(); phone.close();
});

test("a plateia não comanda: não abre votação nem troca o slide", async () => {
  const deck = await connect(srv.port, "/apresentador/ws", { cookie });
  const phone = await connect(srv.port, "/ws");
  phone.say({ type: "poll", open: true });
  phone.say({ type: "hello", as: "remote" });
  phone.say({ type: "slide", index: 7, title: "invadido", links: [{ label: "x", url: "https://evil.example" }] });
  phone.say({ type: "key", key: "ArrowRight" });
  await sleep(400);
  const state = await (await fetch(srv.base + "/state")).json() as PublicState;
  assert.equal(state.poll.open, false);
  assert.notEqual(state.slide.title, "invadido");
  assert.deepEqual(state.links, []);
  deck.close(); phone.close();
});

test("votação: o palco abre, a plateia vota uma vez por celular e pode trocar", async () => {
  const deck = await connect(srv.port, "/apresentador/ws", { cookie });
  const phone = await connect(srv.port, "/ws?cid=votante00001");
  deck.say({ type: "poll", open: true });
  await phone.next(publicWhere((s) => s.poll.open));
  phone.say({ type: "vote", choice: "up" });
  phone.say({ type: "vote", choice: "up" });
  await deck.next(stageWhere((s) => s.poll.up === 1));
  phone.say({ type: "vote", choice: "down" });
  const s = await deck.next(stageWhere((st) => st.poll.down === 1));
  assert.equal(s.state.poll.up, 0);
  deck.say({ type: "poll", open: false });
  deck.close(); phone.close();
});

test("quiz: a certa só aparece ao revelar, quem acerta primeiro ganha mais e o placar ordena", async () => {
  const deck = await connect(srv.port, "/apresentador/ws", { cookie });
  const ana = await connect(srv.port, "/ws?cid=alunaana0001");
  const bia = await connect(srv.port, "/ws?cid=alunabia0001");
  const caio = await connect(srv.port, "/ws?cid=alunocaio001");
  const isYou = (f: (m: YouMessage) => boolean) => (m: ServerMessage): m is YouMessage => m.type === "you" && f(m);

  // slide sem quiz: abrir não faz nada; quiz malformado também é ignorado
  deck.say({ type: "slide", index: 3, title: "Sem quiz", links: [] });
  deck.say({ type: "quiz", action: "open" });
  deck.raw({ type: "slide", index: 4, title: "Quiz ruim", links: [], quiz: { question: "?", options: ["só uma"], answer: 0 } });
  deck.say({ type: "quiz", action: "open" });
  await sleep(150);
  deck.say({ type: "slide", index: 5, title: "Quiz", links: [], quiz: { question: "2 + 2?", options: ["3", "4", "5"], answer: 1 } });
  await ana.next(publicWhere((s) => s.slide.title === "Quiz"));
  deck.say({ type: "quiz", action: "open" });
  const opened = await ana.next(publicWhere((s) => s.quiz.phase === "open"));
  assert.equal(opened.state.quiz.id, 1, "os slides sem quiz válido não abriram nada");
  assert.deepEqual(opened.state.quiz.options, ["3", "4", "5"]);
  assert.equal(opened.state.quiz.answer, null, "a resposta certa não vaza antes da hora");
  assert.deepEqual(opened.state.quiz.counts, [], "a plateia não vê a distribuição com o quiz aberto");

  ana.say({ type: "join", name: "  Ana\n\tSilva  " });
  await ana.next(isYou((m) => m.name === "Ana Silva"));
  bia.say({ type: "join", name: "Bia" });
  caio.say({ type: "join", name: "Caio" });
  ana.say({ type: "answer", choice: 1 });
  await sleep(30);
  bia.say({ type: "answer", choice: 1 });
  bia.say({ type: "answer", choice: 0 });   // segunda resposta não vale
  caio.say({ type: "answer", choice: 2 });
  caio.raw({ type: "answer", choice: 9 });  // fora da lista
  ana.say({ type: "quiz", action: "reveal" }); // a plateia não comanda
  const counted = await deck.next(stageWhere((s) => s.quiz.answered === 3));
  assert.deepEqual(counted.state.quiz.counts, [0, 2, 1]);
  assert.equal(counted.state.quiz.phase, "open");

  deck.say({ type: "quiz", action: "reveal" });
  const revealed = await bia.next(publicWhere((s) => s.quiz.phase === "reveal"));
  assert.equal(revealed.state.quiz.answer, 1);
  assert.deepEqual(revealed.state.quiz.counts, [0, 2, 1]);
  const a = await ana.next(isYou((m) => m.quiz?.id === 1));
  const b = await bia.next(isYou((m) => m.quiz?.id === 1));
  const c = await caio.next(isYou((m) => m.quiz?.id === 1));
  assert.deepEqual([a.points, a.rank, a.quiz?.correct], [150, 1, true]);
  assert.deepEqual([b.points, b.rank, b.quiz?.correct], [140, 2, true]);
  assert.deepEqual([c.points, c.rank, c.quiz?.correct], [0, null, false]);

  deck.say({ type: "quiz", action: "board" });
  const shown = await caio.next(publicWhere((s) => s.board.on));
  assert.deepEqual(shown.state.board.top, [{ name: "Ana Silva", points: 150 }, { name: "Bia", points: 140 }]);
  assert.equal(shown.state.board.players, 3);

  // recarregar a página (mesmo id) devolve nome e pontos
  ana.close();
  const ana2 = await connect(srv.port, "/ws?cid=alunaana0001");
  const back = await ana2.next(isYou(() => true));
  assert.deepEqual([back.name, back.points], ["Ana Silva", 150]);

  deck.say({ type: "quiz", action: "reset" });
  await deck.next(stageWhere((s) => s.board.players === 0 && !s.board.on));
  deck.say({ type: "quiz", action: "close" });
  deck.close(); ana2.close(); bia.close(); caio.close();
});

test("o deck libera links para a plateia; entrada malformada não derruba o servidor", async () => {
  const deck = await connect(srv.port, "/apresentador/ws", { cookie });
  const phone = await connect(srv.port, "/ws");
  deck.raw("texto solto");
  deck.raw({ type: "slide", index: "x", title: null, links: [null, 3, { url: 5 }, { label: "sem url" }] });
  deck.say({ type: "slide", index: 2, title: "Fontes", links: [{ label: "Artigo", url: "https://example.com/artigo" }] });
  const s = await phone.next(publicWhere((st) => st.slide.title === "Fontes"));
  assert.deepEqual(s.state.links, [{ label: "Artigo", url: "https://example.com/artigo" }]);
  assert.equal(s.state.slide.index, 2);
  deck.close(); phone.close();
});

test("passador: a tecla chega ao deck e o deck conta onde está", async () => {
  const deck = await connect(srv.port, "/apresentador/ws", { cookie });
  const remote = await connect(srv.port, "/apresentador/ws", { cookie });
  remote.say({ type: "hello", as: "remote" });
  deck.say({ type: "view", index: 3, step: 1, steps: 2, black: false, notes: false, full: false, elapsed: 1000 });
  const view = await remote.next(viewAt(3));
  assert.equal(view.steps, 2);
  remote.raw({ type: "key", key: "Delete" });
  remote.say({ type: "key", key: "ArrowRight" });
  assert.equal((await deck.next(isKey)).key, "ArrowRight");
  deck.close(); remote.close();
});

test("túnel rápido: o servidor pergunta o endereço ao cloudflared e avisa o palco", async () => {
  const metrics = http.createServer((req, res) => {
    if (req.url !== "/quicktunnel") { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ hostname: "quatro-palavras-ao-acaso.trycloudflare.com" }));
  });
  await new Promise<void>((r) => metrics.listen(0, "127.0.0.1", r));
  const s2 = await start({ PRESENTER_TOKEN: TOKEN, TUNNEL_METRICS: `http://127.0.0.1:${(metrics.address() as AddressInfo).port}` });
  const deck = await connect(s2.port, "/apresentador/ws", { cookie });
  const s = await deck.next(stageWhere((st) => st.publicUrl !== ""));
  assert.equal(s.state.publicUrl, "https://quatro-palavras-ao-acaso.trycloudflare.com");
  await sleep(300);
  assert.match(s2.output(), /passador\s+https:\/\/quatro-palavras-ao-acaso\.trycloudflare\.com\/apresentador\/remoto\/\?token=token-de-teste-123456/);
  deck.close(); metrics.close();
});

test("sem PRESENTER_TOKEN o servidor sorteia um e imprime o link do palco", async () => {
  const s3 = await start();
  await sleep(200);
  const m = /palco\s+(http:\/\/\S+\/apresentador\/\?token=([\w-]{20,}))/.exec(s3.output());
  assert.ok(m, s3.output());
  assert.equal((await fetch(s3.base + "/apresentador/", { redirect: "manual" })).status, 401);
  assert.equal((await fetch(`${s3.base}/apresentador/?token=${m[2]}`, { redirect: "manual" })).status, 302);
});

test("PRESENTER_AUTH=off: sem token, para quando outra camada protege o prefixo", async () => {
  const s4 = await start({ PRESENTER_AUTH: "off" });
  assert.equal((await fetch(s4.base + "/apresentador/")).status, 200);
  const deck = await connect(s4.port, "/apresentador/ws");
  await deck.next(stageWhere());
  deck.close();
});
