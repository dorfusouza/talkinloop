"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { slides } from "@/components/content";
import { liveUrl } from "@/components/base";
import { t } from "@/components/i18n";
import { PreviewContext } from "@/components/preview";
import type { RemoteKey, RemoteMessage, StageState, ToRemote, ViewMessage } from "../../backstage/protocol";
import roteiroJson from "@/components/roteiro.json";

type Roteiro = Record<string, { title: string; ato: string | null; intro: string; html: string }>;
const roteiro = roteiroJson as Roteiro;

type View = ViewMessage;
type Room = StageState;
type Mode = "laser" | "spot";

const total = slides.length;
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
const minuteToMs = (m: string) => { const [a, b] = m.split(":").map(Number); return (a * 60 + b) * 1000; };
const buzz = (ms = 12) => { try { navigator.vibrate?.(ms); } catch {} };

export default function Remote() {
  const ws = useRef<WebSocket | null>(null);
  const [online, setOnline] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const viewAt = useRef(0);
  const [room, setRoom] = useState<Room>({ slide: { index: 0, title: "" }, links: [], poll: { id: 0, open: false, up: 0, down: 0 }, share: { on: false, v: 0 }, quiz: { id: 0, phase: "off", question: "", options: [], counts: [], answered: 0, answer: null }, board: { on: false, top: [], players: 0 }, connected: 0, bot: false, publicUrl: "" });
  const [now, setNow] = useState(0);
  const cheers = useRef<{ t: number; n: number }[]>([]);
  const [heat, setHeat] = useState(0);
  const [fsAsk, setFsAsk] = useState(false); // o navegador exige um clique no próprio telão para entrar em tela cheia
  const [mode, setMode] = useState<Mode>("laser");
  const modeRef = useRef<Mode>("laser");
  modeRef.current = mode;

  const send = (m: RemoteMessage) => { if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(m)); };

  useEffect(() => {
    let sock: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout>;
    let closed = false;
    let lastMsg = 0;
    const connect = () => {
      try { sock = new WebSocket(liveUrl()); } catch { return; }
      ws.current = sock;
      sock.onopen = () => { lastMsg = Date.now(); setOnline(true); sock?.send(JSON.stringify({ type: "hello", as: "remote" } satisfies RemoteMessage)); };
      sock.onclose = () => { setOnline(false); if (!closed) timer = setTimeout(connect, 2000); };
      sock.onerror = () => sock?.close();
      sock.onmessage = (e) => {
        lastMsg = Date.now();
        let m: ToRemote;
        try { m = JSON.parse(e.data) as ToRemote; } catch { return; }
        if (m.type === "view") { viewAt.current = Date.now(); setView(m); }
        if (m.type === "state") setRoom(m.state);
        if (m.type === "burst") {
          const n = Object.values(m.h ?? {}).reduce((a, b) => a + b, 0);
          if (n) cheers.current.push({ t: Date.now(), n });
        }
      };
    };
    connect();
    const watchdog = setInterval(() => { if (sock?.readyState === WebSocket.OPEN && Date.now() - lastMsg > 30000) sock.close(); }, 5000);
    const onVisible = () => { if (document.visibilityState === "visible" && sock?.readyState !== WebSocket.OPEN) { clearTimeout(timer); sock?.close(); connect(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { closed = true; clearTimeout(timer); clearInterval(watchdog); document.removeEventListener("visibilitychange", onVisible); sock?.close(); };
  }, []);

  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNow(t);
      cheers.current = cheers.current.filter((c) => t - c.t < 10000);
      setHeat(cheers.current.reduce((a, c) => a + c.n, 0));
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);

  const lock = useRef<WakeLockSentinel | null>(null);
  const keepAwake = async () => {
    if (lock.current && !lock.current.released) return;
    try { lock.current = (await navigator.wakeLock?.request("screen")) ?? null; } catch {}
  };
  useEffect(() => {
    keepAwake();
    const onVisible = () => { if (document.visibilityState === "visible") keepAwake(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); lock.current?.release().catch(() => {}); };
  }, []);

  useEffect(() => { try { const m = localStorage.getItem("remote-mode"); if (m === "spot" || m === "laser") setMode(m); } catch {} }, []);
  const toggleMode = () => setMode((m) => { const n = m === "laser" ? "spot" : "laser"; try { localStorage.setItem("remote-mode", n); } catch {} return n; });

  const index = view?.index ?? 0;
  const step = view?.step ?? 0;
  const slide = slides[Math.min(index, total - 1)];
  const box = useRef<HTMLDivElement>(null);
  const slideEl = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLElement>(null);
  useEffect(() => { scriptRef.current?.scrollTo({ top: 0 }); }, [index]);
  const [pscale, setPscale] = useState(0.2);
  const [hasVideo, setHasVideo] = useState(false);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setPscale(el.clientWidth / 1600);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = slideEl.current;
    el?.querySelectorAll<HTMLElement>("[data-frag]").forEach((f) => f.classList.toggle("frag-on", Number(f.dataset.frag) <= step));
    setHasVideo(Boolean(el?.querySelector("[data-video]")));
  }, [index, step]);

  const pressing = useRef(false);
  const pending = useRef<{ x: number; y: number; tap: boolean } | null>(null);
  const raf = useRef(0);
  const [finger, setFinger] = useState<{ x: number; y: number } | null>(null);

  const flush = () => {
    raf.current = 0;
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    send({ type: "pointer", x: p.x, y: p.y, mode: modeRef.current, tap: p.tap });
  };
  const at = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const queue = (p: { x: number; y: number }, tap: boolean) => {
    pending.current = { ...p, tap: tap || Boolean(pending.current?.tap) };
    if (!raf.current) raf.current = requestAnimationFrame(flush);
  };
  const onDown = (e: React.PointerEvent) => {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    pressing.current = true;
    const p = at(e);
    setFinger(p);
    queue(p, true);
    keepAwake();
    buzz(8);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pressing.current) return;
    const p = at(e);
    setFinger(p);
    queue(p, false);
  };
  const onUp = () => {
    if (!pressing.current) return;
    pressing.current = false;
    setFinger(null);
    if (raf.current) { cancelAnimationFrame(raf.current); flush(); }
    send({ type: "pointer", off: true });
  };
  // Dedo parado sobre um ponto: reenvia a posição a cada 1,5 s (o deck apaga o ponteiro depois de
  // 5 s sem notícia, para ele não ficar preso no telão se o celular sumir no meio do gesto).
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  if (finger) lastPos.current = finger;
  useEffect(() => {
    const i = setInterval(() => { if (pressing.current && lastPos.current) queue(lastPos.current, false); }, 1500);
    const onHidden = () => { if (document.visibilityState === "hidden") onUp(); };
    document.addEventListener("visibilitychange", onHidden);
    return () => { clearInterval(i); document.removeEventListener("visibilitychange", onHidden); };
  });

  const key = (k: RemoteKey) => { send({ type: "key", key: k }); buzz(); keepAwake(); };

  const elapsed = view?.elapsed != null ? view.elapsed + (now - viewAt.current) : null;
  const drift = elapsed != null ? elapsed - minuteToMs(slide.minute) : 0;
  const deckUp = online && (view?.decks ?? 0) > 0;
  const status = !online ? t.remote.reconnecting : deckUp ? t.remote.deckOn : t.remote.deckOff;
  const steps = view?.steps ?? 0;
  const nextSlide = slides[index + 1];
  const texto = roteiro[pad(index + 1)];

  return (
    <div className={`remote ${deckUp ? "" : "down"}`}>
      <header>
        <div className="pos">
          {pad(index + 1)}/{total} · {slide.block}
          {steps > 0 && <> · {t.deck.step} {Math.min(step, steps)}/{steps}</>}
        </div>
        <div className={`status ${!online ? "off" : deckUp ? "on" : "warn"}`} title={status}><i />{deckUp ? null : status}</div>
        <div className="clock">
          {elapsed != null ? fmt(elapsed) : "0:00"}
          <small>
            {t.deck.script} {slide.minute}
            {elapsed != null && Math.abs(drift) > 30000 && <em className={drift > 0 ? "late" : "early"}> {drift > 0 ? "+" : "−"}{fmt(Math.abs(drift))}</em>}
          </small>
        </div>
        <div className="room">{room.connected} {t.remote.inRoom}{heat > 0 && <> · {heat} {t.remote.reactionsPer10s}</>}</div>
      </header>

      <section className="script" aria-label={t.remote.scriptLabel} ref={scriptRef}>
        <h2>{slide.title}</h2>
        {texto ? (
          <>
            {texto.intro && <div className="ato-intro" dangerouslySetInnerHTML={{ __html: texto.intro }} />}
            <div className="roteiro" dangerouslySetInnerHTML={{ __html: texto.html }} />
          </>
        ) : (
          <div className="notes-text">{slide.notes}</div>
        )}
        {nextSlide && <p className="next-up">{t.remote.nextUp} <b>{nextSlide.title}</b></p>}
      </section>

      <div className="rm-main">
      <div
        ref={box}
        className={`rm-preview preview ${view?.black ? "black" : ""}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        aria-label={t.remote.previewLabel}
      >
        <PreviewContext.Provider value={true}>
          <div key={index} ref={slideEl} className={`slide ${slide.top ? "top" : ""} ${slide.kind ?? ""}`} style={{ "--s": pscale } as React.CSSProperties}>
            {slide.content}
          </div>
        </PreviewContext.Provider>
        {finger && <span className={`finger ${mode}`} style={{ left: `${finger.x * 100}%`, top: `${finger.y * 100}%` }} />}
      </div>

      {room.poll.open && (
        <div className="vote-strip" role="status" aria-label={`${room.poll.up} ${t.deck.yes}, ${room.poll.down} ${t.deck.no}`}>
          <span>👍 <b>{room.poll.up}</b></span>
          <div className="bar"><div style={{ width: `${room.poll.up + room.poll.down ? Math.round((room.poll.up / (room.poll.up + room.poll.down)) * 100) : 50}%` }} /></div>
          <span><b>{room.poll.down}</b> 👎</span>
        </div>
      )}

      {room.quiz.phase !== "off" && (
        <div className="vote-strip quiz-strip" role="status">
          <span>❓ <b>{room.quiz.answered}</b> {room.quiz.answered === 1 ? t.deck.answer : t.deck.answers}</span>
          <span className="quiz-counts">
            {room.quiz.options.map((_, i) => (
              <span key={i} className={room.quiz.phase === "reveal" && i === room.quiz.answer ? "right" : ""}>{"ABCDEF"[i]} {room.quiz.counts[i] ?? 0}</span>
            ))}
          </span>
        </div>
      )}

      {(slide.quiz || room.quiz.phase !== "off" || room.board.on) && (
        <div className="tools quiz-tools">
          <button
            className={room.quiz.phase !== "off" ? "on" : ""}
            disabled={room.quiz.phase === "off" && !slide.quiz}
            onClick={() => { send({ type: "quiz", action: room.quiz.phase === "open" ? "reveal" : room.quiz.phase === "reveal" ? "close" : "open" }); buzz(); }}
            aria-label={t.remote.quizLabel}
          >
            {room.quiz.phase === "open" ? t.remote.quizReveal : room.quiz.phase === "reveal" ? t.remote.quizClose : t.remote.quizOpen}
          </button>
          <button
            className={room.board.on ? "on" : ""}
            onClick={() => { send({ type: "quiz", action: "board" }); buzz(); }}
            aria-label={t.remote.boardLabel}
          >
            {t.remote.board} · {room.board.players}
          </button>
          {room.board.on && (
            <button onClick={() => { if (window.confirm(t.remote.boardResetConfirm)) send({ type: "quiz", action: "reset" }); }}>♻ {t.remote.boardReset}</button>
          )}
        </div>
      )}

      <div className="tools pair">
        <button className={view?.full || fsAsk ? "on" : ""} onClick={() => { key("f"); if (!view?.full) { setFsAsk(true); setTimeout(() => setFsAsk(false), 8000); } }} aria-label={view?.full ? t.remote.exitFullscreenLabel : t.remote.fullscreenLabel}>
          {view?.full ? t.remote.exitFullscreen : fsAsk ? t.remote.fullscreenAsk : t.remote.fullscreen}
        </button>
        <button className={room.share.on ? "on" : ""} onClick={() => { send({ type: "share", on: !room.share.on }); buzz(); }} aria-label={room.share.on ? t.remote.stopShareLabel : t.remote.shareLabel}>
          {room.share.on ? (room.share.v ? t.remote.sharing : t.remote.shareStarting) : t.remote.share}
        </button>
      </div>

      <div className="tools">
        <button onClick={toggleMode} aria-label={mode === "laser" ? t.remote.laserLabel : t.remote.spotLabel}>{mode === "laser" ? t.remote.laser : t.remote.spot}</button>
        <button className={view?.black ? "on" : ""} onClick={() => key("b")} aria-label={t.remote.blackLabel}>{t.remote.black}</button>
        <button className={room.poll.open ? "on" : ""} onClick={() => { send({ type: "poll", open: !room.poll.open }); buzz(); }} aria-label={room.poll.open ? t.remote.closePollLabel : t.remote.openPollLabel}>
          {room.poll.open ? t.remote.closePoll : t.remote.openPoll}
        </button>
        {hasVideo && <button onClick={() => key("v")}>{t.remote.video}</button>}
        <button className={room.bot ? "on" : ""} onClick={() => { send({ type: "bot", on: !room.bot }); buzz(); }} aria-label={t.remote.botLabel}>🤖</button>
      </div>

      <nav className="nav">
        <button className="prev" onClick={() => key("ArrowLeft")} aria-label={t.remote.back}>◀</button>
        <button className="next" onClick={() => key("ArrowRight")} aria-label={t.remote.forwardLabel}>{t.remote.forward}</button>
      </nav>
      </div>
    </div>
  );
}
