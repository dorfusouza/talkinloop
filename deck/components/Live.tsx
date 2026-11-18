"use client";

import { useEffect, useRef, useState } from "react";
import { liveUrl, sample } from "@/components/base";
import { EMOJI, FALLBACK_EMOJI } from "@/components/config";
import { t } from "@/components/i18n";
import type { Link, Quiz } from "@/components/types";
import type { DeckMessage, QuizAction, StageState, ToDeck } from "../../backstage/protocol";

type Reaction = { id: number; kind: string; x: number; delay: number };
type Pointer = { x: number; y: number; mode: "laser" | "spot"; off: boolean; taps: number };

const PER_BURST = 8;

type Props = {
  index: number; title: string; links: Link[]; quiz: Quiz | null;
  step: number; steps: number; black: boolean; notes: boolean; full: boolean; startedAt: number | null; scale: number;
  onPublicUrl?: (url: string) => void;
};

const NOT_IN_SHOT = ["reactions", "poll", "quiz-panel", "board-panel", "pointer-layer", "backdrop"];
const LETTERS = "ABCDEF";
const SHOT_W = 1600, SHOT_H = 900;

// As variáveis de cor do deck (--bg, --accent...) moram no :root, fora do que é fotografado: os
// SVGs dos diagramas usam `style="fill:var(--bg)"` e sem elas saem pretos.
function rootVars(): Record<string, string> {
  const cs = getComputedStyle(document.documentElement);
  const vars: Record<string, string> = {};
  for (let i = 0; i < cs.length; i++) { const k = cs[i]; if (k.startsWith("--")) vars[k] = cs.getPropertyValue(k); }
  return vars;
}

export default function Live({ index, title, links, quiz, step, steps, black, notes, full, startedAt, scale, onPublicUrl }: Props) {
  const ws = useRef<WebSocket | null>(null);
  const [online, setOnline] = useState(false);
  const [state, setState] = useState<StageState>({ slide: { index: 0, title: "" }, links: [], poll: { id: 0, open: false, up: 0, down: 0 }, share: { on: false, v: 0 }, quiz: { id: 0, phase: "off", question: "", options: [], counts: [], answered: 0, answer: null }, board: { on: false, top: [], players: 0 }, connected: 0, bot: false, publicUrl: "" });
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [pointer, setPointer] = useState<Pointer | null>(null);
  const seq = useRef(0);
  const pointerOff = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let sock: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout>;
    let closed = false;
    let lastMsg = 0;
    const connect = () => {
      try { sock = new WebSocket(liveUrl()); } catch { return; }
      ws.current = sock;
      sock.onopen = () => { lastMsg = Date.now(); setOnline(true); };
      sock.onclose = () => { setOnline(false); setPointer(null); if (!closed) timer = setTimeout(connect, 3000); };
      sock.onerror = () => sock?.close();
      sock.onmessage = (e) => {
        lastMsg = Date.now();
        let m: ToDeck;
        try { m = JSON.parse(e.data) as ToDeck; } catch { return; }
        if (m.type === "state") setState(m.state);
        if (m.type === "burst") {
          const add: Reaction[] = sample(m.h ?? {}, PER_BURST).map((k) => ({ id: seq.current++, kind: k, x: 8 + Math.random() * 84, delay: Math.random() * 250 }));
          if (!add.length) return;
          setReactions((rs) => [...rs, ...add].slice(-40));
          const ids = new Set(add.map((r) => r.id));
          setTimeout(() => setReactions((rs) => rs.filter((r) => !ids.has(r.id))), 4500);
        }
        if (m.type === "key") window.dispatchEvent(new KeyboardEvent("keydown", { key: m.key, bubbles: true }));
        if (m.type === "pointer") {
          clearTimeout(pointerOff.current);
          const fade = () => {
            setPointer((p) => (p ? { ...p, off: true } : p));
            pointerOff.current = setTimeout(() => setPointer(null), 1400);
          };
          if ("off" in m) fade();
          else {
            const at = m;
            setPointer((p) => ({ x: at.x, y: at.y, mode: at.mode, off: false, taps: (p?.taps ?? 0) + (at.tap ? 1 : 0) }));
            // o passador reenvia a cada 1,5 s com o dedo parado; 5 s sem notícia = celular sumiu, apaga
            pointerOff.current = setTimeout(fade, 5000);
          }
        }
      };
    };
    connect();
    // o servidor manda estado a cada 10 s; 30 s em silêncio = conexão fantasma, reconecta
    const watchdog = setInterval(() => { if (sock?.readyState === WebSocket.OPEN && Date.now() - lastMsg > 30000) sock.close(); }, 5000);
    return () => { closed = true; clearTimeout(timer); clearInterval(watchdog); clearTimeout(pointerOff.current); sock?.close(); };
  }, []);

  const sendMsg = (msg: DeckMessage) => { if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(msg)); };

  const publicUrl = state.publicUrl;
  useEffect(() => { if (publicUrl) onPublicUrl?.(publicUrl); }, [publicUrl, onPublicUrl]);

  useEffect(() => {
    if (online) sendMsg({ type: "slide", index, title, links, quiz });
  }, [online, index, title, links, quiz]);

  useEffect(() => {
    if (online) sendMsg({ type: "view", index, step: Math.min(step, steps), steps, black, notes, full, elapsed: startedAt ? Date.now() - startedAt : null });
  }, [online, index, step, steps, black, notes, full, startedAt]);

  // foto do slide → plateia, enquanto o envio estiver ligado. Espera as animações de entrada
  // assentarem; cada mudança de slide ou de passo gera uma foto nova (a anterior é descartada).
  const sharing = state.share.on;
  const fontCss = useRef<string | null>(null);
  useEffect(() => {
    if (!online || !sharing || black) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const stage = document.querySelector<HTMLElement>(".stage");
      if (!stage) return;
      try {
        const { toCanvas, getFontEmbedCSS } = await import("html-to-image");
        fontCss.current ??= await getFontEmbedCSS(stage);
        const ratio = Math.min(2, SHOT_W / (SHOT_W * scale));
        const full = await toCanvas(stage, {
          pixelRatio: ratio,
          backgroundColor: getComputedStyle(document.body).backgroundColor,
          fontEmbedCSS: fontCss.current,
          style: rootVars() as unknown as Partial<CSSStyleDeclaration>,
          filter: (n) => !(n instanceof Element && NOT_IN_SHOT.some((c) => n.classList.contains(c))),
        });
        // o palco é a janela inteira; a foto é só o retângulo 16:9 do slide, no centro dela
        const k = full.width / stage.clientWidth;
        const w = SHOT_W * scale * k, h = SHOT_H * scale * k;
        const out = document.createElement("canvas");
        out.width = SHOT_W; out.height = SHOT_H;
        out.getContext("2d")!.drawImage(full, (full.width - w) / 2, (full.height - h) / 2, w, h, 0, 0, SHOT_W, SHOT_H);
        const data = out.toDataURL("image/jpeg", 0.82);
        if (!cancelled) sendMsg({ type: "shot", data });
      } catch (e) { console.warn("foto do slide para a plateia falhou", e); }
    }, 1800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [online, sharing, black, index, step, scale]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "l" || e.key === "L") sendMsg({ type: "bot", on: !state.bot });
      if (e.key === "p" || e.key === "P") sendMsg({ type: "poll", open: !state.poll.open });
      // Q: abre o quiz do slide → revela a certa → esconde. K: placar no telão.
      if (e.key === "q" || e.key === "Q") {
        const action: QuizAction | null = state.quiz.phase === "open" ? "reveal" : state.quiz.phase === "reveal" ? "close" : quiz ? "open" : null;
        if (action) sendMsg({ type: "quiz", action });
      }
      if (e.key === "k" || e.key === "K") sendMsg({ type: "quiz", action: "board" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.bot, state.poll.open, state.quiz.phase, quiz]);

  if (!online) return null;
  const votes = state.poll.up + state.poll.down;
  const q = state.quiz;
  const most = Math.max(1, ...q.counts);
  const upPct = votes ? Math.round((state.poll.up / votes) * 100) : 50;

  return (
    <>
      {pointer && (
        <div
          className={`pointer-layer ${pointer.mode} ${pointer.off ? "off" : ""}`}
          style={{ "--s": scale, "--px": `${pointer.x * 1600}px`, "--py": `${pointer.y * 900}px` } as React.CSSProperties}
          aria-hidden="true"
        >
          {pointer.mode === "spot" ? <div className="spot" /> : <div className="laser" />}
          {pointer.taps > 0 && <span key={pointer.taps} className="ping" />}
        </div>
      )}
      <div className="reactions" aria-hidden="true">
        {reactions.map((r) => (
          <span key={r.id} className="reaction" style={{ left: `${r.x}%`, animationDelay: `${r.delay}ms` }}>
            {EMOJI[r.kind] ?? FALLBACK_EMOJI}
          </span>
        ))}
      </div>
      {state.poll.open && (
        <div className="poll" role="status" aria-label={`${state.poll.up} ${t.deck.yes}, ${state.poll.down} ${t.deck.no}`}>
          <span className="poll-emoji">👍</span>
          <b>{state.poll.up}</b>
          <div className={`poll-bar ${votes ? "" : "empty"}`}><div style={{ width: `${upPct}%` }} /></div>
          <b className="down">{state.poll.down}</b>
          <span className="poll-emoji">👎</span>
        </div>
      )}
      {q.phase !== "off" && !state.board.on && (
        <div className={`quiz-panel ${q.phase}`} role="status">
          <div className="quiz-head">
            <b>❓ {t.deck.quiz}</b>
            <span>{q.answered} {q.answered === 1 ? t.deck.answer : t.deck.answers}</span>
          </div>
          <ol className="quiz-opts">
            {q.options.map((o, i) => (
              <li key={i} className={q.phase === "reveal" && i === q.answer ? "right" : ""}>
                <i>{LETTERS[i] ?? i + 1}</i>
                <span>{o}</span>
                {q.phase === "reveal" && (
                  <>
                    <div className="quiz-bar"><div style={{ width: `${((q.counts[i] ?? 0) / most) * 100}%` }} /></div>
                    <b>{q.counts[i] ?? 0}</b>
                  </>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      {state.board.on && (
        <div className="board-panel" role="status">
          <h3>🏆 {t.deck.board}</h3>
          {state.board.top.length ? (
            <ol>
              {state.board.top.slice(0, 5).map((p, i) => (
                <li key={i}><span>{p.name}</span><b>{p.points}</b></li>
              ))}
            </ol>
          ) : <p>{t.deck.boardEmpty}</p>}
        </div>
      )}
    </>
  );
}
