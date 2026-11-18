"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Backdrop, slides } from "@/components/content";
import Chrome from "@/components/Chrome";
import Live from "@/components/Live";
import { BASE } from "@/components/base";
import { BUILD_PUBLIC_URL } from "@/components/config";
import { t } from "@/components/i18n";
import roteiroJson from "@/components/roteiro.json";

const roteiro = roteiroJson as Record<string, { html: string }>;

type View = { index: number; step: number; dir: 1 | -1 };
type Msg = { type: "go"; index: number; step: number } | { type: "black"; on: boolean };

const EXIT_MS = 520;
const total = slides.length;

const fragCount = (el: HTMLElement | null) => {
  if (!el) return 0;
  let max = 0;
  el.querySelectorAll<HTMLElement>("[data-frag]").forEach((f) => { max = Math.max(max, Number(f.dataset.frag) || 0); });
  return max;
};

const applyFrags = (el: HTMLElement | null, step: number) => {
  el?.querySelectorAll<HTMLElement>("[data-frag]").forEach((f) => {
    f.classList.toggle("frag-on", Number(f.dataset.frag) <= step);
  });
};

// Quebra títulos e frases de impacto em palavras (<span class="w">) para revelá-las uma a uma.
// Mexe só no DOM do slide recém-montado; o conteúdo de cada slide é uma referência constante,
// então o React não volta a reconciliar esses nós. Elementos com passo (data-frag) ficam de fora.
const WORDS = "h1, h2, .big, .quote, .final p";
const splitWords = (root: HTMLElement | null) => {
  root?.querySelectorAll<HTMLElement>(WORDS).forEach((el) => {
    if (el.dataset.split || el.closest("[data-frag]")) return;
    el.dataset.split = "1";
    let i = 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement?.closest("cite") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    const texts: Text[] = [];
    while (walker.nextNode()) texts.push(walker.currentNode as Text);
    texts.forEach((t) => {
      const frag = document.createDocumentFragment();
      (t.textContent ?? "").split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(part); return; }
        const w = document.createElement("span");
        w.className = "w";
        w.style.setProperty("--w", String(i++));
        w.textContent = part;
        frag.append(w);
      });
      t.replaceWith(frag);
    });
  });
};

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const minuteToMs = (m: string) => { const [a, b] = m.split(":").map(Number); return (a * 60 + b) * 1000; };

export default function Deck({ index: initial }: { index: number }) {
  const [view, setView] = useState<View>({ index: initial, step: 0, dir: 1 });
  const [leaving, setLeaving] = useState<{ index: number; step: number; dir: 1 | -1; key: number } | null>(null);
  const [fragTotal, setFragTotal] = useState(0);
  const [notes, setNotes] = useState(false);
  const [overview, setOverview] = useState(false);
  const [black, setBlack] = useState(false);
  const [idle, setIdle] = useState(false);
  const [full, setFull] = useState(false);
  const [fsArmed, setFsArmed] = useState(false);
  const [scale, setScale] = useState(1);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [publicUrl, setPublicUrl] = useState(BUILD_PUBLIC_URL);
  const onPublicUrl = useCallback((url: string) => { if (url) setPublicUrl(url); }, []);

  const slideRef = useRef<HTMLDivElement>(null);
  const leaveRef = useRef<HTMLDivElement>(null);
  const steps = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const slide = slides[view.index];

  const show = useCallback((index: number, step: number, broadcast = true) => {
    const cur = viewRef.current;
    if (index === cur.index && step === cur.step) return;
    if (index !== cur.index) {
      const dir: 1 | -1 = index > cur.index ? 1 : -1;
      setLeaving({ index: cur.index, step: cur.step, dir, key: Date.now() });
      viewRef.current = { index, step, dir };
      setView(viewRef.current);
      try { window.history.replaceState(window.history.state, "", `${BASE}/${index + 1}/`); } catch {}
    } else {
      viewRef.current = { ...cur, step };
      setView(viewRef.current);
    }
    setStartedAt((t) => t ?? Date.now());
    if (broadcast) channel.current?.postMessage({ type: "go", index, step } satisfies Msg);
  }, []);

  const next = useCallback(() => {
    const { index, step } = viewRef.current;
    if (step < steps.current) show(index, step + 1);
    else if (index + 1 < total) show(index + 1, 0);
  }, [show]);

  // Voltar entra no slide anterior com todos os fragmentos já visíveis (step = Infinity, ajustado no layout).
  const prev = useCallback(() => {
    const { index, step } = viewRef.current;
    if (step > 0) show(index, step - 1);
    else if (index > 0) show(index - 1, Number.MAX_SAFE_INTEGER);
  }, [show]);

  const jump = useCallback((i: number) => show(Math.min(Math.max(i, 0), total - 1), 0), [show]);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setLeaving(null), EXIT_MS);
    return () => clearTimeout(t);
  }, [leaving]);

  useLayoutEffect(() => {
    const el = slideRef.current;
    steps.current = fragCount(el);
    setFragTotal(steps.current);
    if (view.step > steps.current) { setView((v) => ({ ...v, step: steps.current })); return; }
    applyFrags(el, view.step);
  }, [view, overview]);

  useLayoutEffect(() => { splitWords(slideRef.current); }, [view.index, overview]);

  useLayoutEffect(() => { if (leaving) applyFrags(leaveRef.current, leaving.step); }, [leaving]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel("deck");
    channel.current = ch;
    ch.onmessage = (e: MessageEvent<Msg>) => {
      if (e.data.type === "go") show(e.data.index, e.data.step, false);
      if (e.data.type === "black") setBlack(e.data.on);
    };
    return () => ch.close();
  }, [show]);

  useEffect(() => {
    try { setNotes(localStorage.getItem("deck-notes") === "1"); } catch {}
  }, []);
  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth * (notes ? 0.62 : 1);
      setScale(Math.min(w / 1600, window.innerHeight / 900));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [notes]);

  useEffect(() => {
    if (!notes) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [notes]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), 2500); };
    wake();
    window.addEventListener("mousemove", wake);
    return () => { window.removeEventListener("mousemove", wake); clearTimeout(t); };
  }, []);

  // O navegador só entra em tela cheia após um gesto local. Pedido pelo passador, o deck fica
  // "armado" e entra no próximo clique dado no notebook.
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) { setFsArmed(false); document.exitFullscreen().catch(() => {}); return; }
    const req = document.documentElement.requestFullscreen?.();
    if (!req) return;
    req.then(() => setFsArmed(false)).catch(() => setFsArmed((v) => !v));
  }, []);
  useEffect(() => {
    const onChange = () => { setFull(Boolean(document.fullscreenElement)); if (document.fullscreenElement) setFsArmed(false); };
    onChange();
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    if (!fsArmed) return;
    const onClick = (e: MouseEvent) => {
      if (!e.isTrusted) return;
      e.stopPropagation(); // este clique é para a tela cheia, não para avançar o slide
      setFsArmed(false);
      document.documentElement.requestFullscreen?.().catch(() => {});
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [fsArmed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case "ArrowRight": case "ArrowDown": case " ": case "PageDown": case "Enter": e.preventDefault(); next(); break;
        case "ArrowLeft": case "ArrowUp": case "PageUp": case "Backspace": e.preventDefault(); prev(); break;
        case "Home": jump(0); break;
        case "End": jump(total - 1); break;
        case "n": case "N": setNotes((v) => { try { localStorage.setItem("deck-notes", v ? "0" : "1"); } catch {} return !v; }); break;
        case "o": case "O": setOverview((v) => !v); break;
        case "Escape": setOverview(false); setBlack(false); break;
        case "b": case "B": case ".":
          setBlack((v) => { channel.current?.postMessage({ type: "black", on: !v } satisfies Msg); return !v; });
          break;
        case "r": case "R": setStartedAt(Date.now()); break;
        case "f": case "F": toggleFull(); break;
        case "t": case "T": {
          const r = document.documentElement;
          r.dataset.theme = r.dataset.theme === "light" ? "" : "light";
          break;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, jump, toggleFull]);

  if (overview) {
    return (
      <div className="overview">
        {slides.map((s, i) => (
          <button key={i} className={`thumb ${i === view.index ? "on" : ""}`} onClick={() => { jump(i); setOverview(false); }}>
            <span>{String(i + 1).padStart(2, "0")} · {s.block} · {s.minute}</span>
            <b>{s.title}</b>
          </button>
        ))}
      </div>
    );
  }

  const frameStyle = { "--s": scale } as React.CSSProperties;
  const elapsed = startedAt ? now - startedAt : 0;
  const drift = startedAt ? elapsed - minuteToMs(slide.minute) : 0;
  const nextSlide = slides[view.index + 1];

  return (
    <div className={`deck ${idle ? "idle" : ""}`}>
      <div
        className={`stage ${notes ? "with-notes" : ""}`}
        onClick={(e) => { if ((e.target as HTMLElement).closest("a, button")) return; next(); }}
      >
        {Backdrop && <Backdrop slide={slide} step={view.step} steps={fragTotal} style={frameStyle} />}
        {leaving && (
          <div
            key={`out-${leaving.key}`}
            ref={leaveRef}
            className={`slide leave ${leaving.dir < 0 ? "back" : ""} ${slides[leaving.index].top ? "top" : ""} ${slides[leaving.index].kind ?? ""}`}
            style={{ "--s": scale } as React.CSSProperties}
            aria-hidden="true"
          >
            {slides[leaving.index].content}
          </div>
        )}
        <div
          key={`in-${view.index}`}
          ref={slideRef}
          className={`slide enter ${view.dir < 0 ? "back" : ""} ${slide.top ? "top" : ""} ${slide.kind ?? ""}`}
          style={{ "--s": scale } as React.CSSProperties}
          aria-live="polite"
        >
          {slide.content}
        </div>

        <Chrome kind={slide.kind} index={view.index} total={total} url={publicUrl} style={frameStyle} />

        <Live
          index={view.index} title={slide.title} links={slide.links ?? []} quiz={slide.quiz ?? null}
          step={view.step} steps={fragTotal} black={black} notes={notes} full={full} startedAt={startedAt} scale={scale} onPublicUrl={onPublicUrl}
        />
      </div>

      {notes && (
        <aside className="notes">
          <div className="clock">
            <b>{fmt(elapsed)}</b>
            <span>
              {t.deck.script} {slide.minute}
              {startedAt && Math.abs(drift) > 30000 && (
                <em className={drift > 0 ? "late" : "early"}> · {drift > 0 ? "+" : "−"}{fmt(Math.abs(drift))}</em>
              )}
            </span>
          </div>
          <h4>
            {String(view.index + 1).padStart(2, "0")} · {slide.block}
            {fragTotal > 0 && <> · {t.deck.step} {Math.min(view.step, fragTotal)}/{fragTotal}</>}
          </h4>
          {roteiro[String(view.index + 1).padStart(2, "0")] ? (
            <div className="notes-body roteiro" dangerouslySetInnerHTML={{ __html: roteiro[String(view.index + 1).padStart(2, "0")].html }} />
          ) : (
            <div className="notes-body">{slide.notes}</div>
          )}
          {nextSlide && (
            <div className="next">
              <h4>{t.deck.next}</h4>
              {nextSlide.title}
            </div>
          )}
          <p className="keys">{t.deck.notesKeys}</p>
        </aside>
      )}

      <div className="help">{t.deck.help}</div>

      {fsArmed && <div className="fs-hint" role="status">{t.deck.fullscreenHint}</div>}

      <div className={`blackout ${black ? "on" : ""}`} onClick={() => setBlack(false)} />
    </div>
  );
}
