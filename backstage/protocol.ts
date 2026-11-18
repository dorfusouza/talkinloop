// Só tipos, sem imports: o deck importa este arquivo. O papel de cada conexão vem do caminho (/ws é
// a plateia, /apresentador/ws é o palco), nunca de uma mensagem.
export type Link = { label: string; url: string };

export type Poll = { id: number; open: boolean; up: number; down: number };

// envio da tela para a plateia; `v` muda a cada foto (0 = nenhuma ainda) e vai em /tela.jpg?v=
export type Share = { on: boolean; v: number };

// Quiz: a pergunta mora no slide (campo `quiz`) e o deck a manda junto com a troca de slide. A
// resposta certa (`answer`) só sai do servidor depois de revelada.
export type Quiz = { question: string; options: string[]; answer: number };
export type QuizPhase = "off" | "open" | "reveal";
// `counts` vai vazio para a plateia enquanto o quiz está aberto, para ninguém ir com a maioria
export type QuizState = { id: number; phase: QuizPhase; question: string; options: string[]; counts: number[]; answered: number; answer: number | null };
export type Player = { name: string; points: number };
export type Board = { on: boolean; top: Player[]; players: number };

export type PublicState = {
  slide: { index: number; title: string };
  links: Link[];
  poll: Poll;
  share: Share;
  quiz: QuizState;
  board: Board;
};

export type StageState = PublicState & { connected: number; bot: boolean; publicUrl: string };

export type RemoteKey = "ArrowRight" | "ArrowLeft" | "b" | "v" | "f";
export type PointerMode = "laser" | "spot";
export type Vote = "up" | "down";

export type AudienceMessage =
  | { type: "react"; kind: string }
  | { type: "vote"; choice: Vote; cid?: string }
  | { type: "click"; url: string }
  | { type: "join"; name: string; cid?: string }
  | { type: "answer"; choice: number; cid?: string };

// open: abre o quiz do slide atual · reveal: mostra a certa e pontua · close: esconde
// board: liga/desliga o placar no telão · reset: zera o placar
export type QuizAction = "open" | "reveal" | "close" | "board" | "reset";

export type StageCommand =
  | { type: "bot"; on: boolean }
  | { type: "poll"; open: boolean }
  | { type: "share"; on: boolean }
  | { type: "quiz"; action: QuizAction };

export type DeckMessage =
  | { type: "slide"; index: number; title: string; links: Link[]; quiz?: Quiz | null }
  | { type: "view"; index: number; step: number; steps: number; black: boolean; notes: boolean; full: boolean; elapsed: number | null }
  | { type: "shot"; data: string } // data URL JPEG, até 2 MB, só com o envio ligado
  | StageCommand;

export type RemoteMessage =
  | { type: "hello"; as: "remote" }
  | { type: "key"; key: RemoteKey }
  | { type: "pointer"; x: number; y: number; mode: PointerMode; tap: boolean } // 0..1 do slide
  | { type: "pointer"; off: true }
  | StageCommand;

export type ClientMessage = AudienceMessage | DeckMessage | RemoteMessage;

export type BurstMessage = { type: "burst"; h: Record<string, number> };

export type PointerMessage =
  | { type: "pointer"; x: number; y: number; mode: PointerMode; tap: boolean }
  | { type: "pointer"; off: true };

// onde o deck está; `elapsed` é o cronômetro em ms no instante do envio
export type ViewMessage = { type: "view"; index: number; step: number; steps: number; black: boolean; full: boolean; elapsed: number | null; decks: number };

// Só para o aluno dono do id: nome, pontos, posição e como foi no último quiz.
export type YouMessage = {
  type: "you";
  name: string;
  points: number;
  rank: number | null;
  quiz: { id: number; choice: number | null; correct: boolean | null; gained: number } | null;
};

export type ToAudience = { type: "state"; state: PublicState } | BurstMessage | YouMessage;
export type ToDeck = { type: "state"; state: StageState } | BurstMessage | { type: "key"; key: RemoteKey } | PointerMessage;
export type ToRemote = { type: "state"; state: StageState } | BurstMessage | ViewMessage;
export type ServerMessage = ToAudience | ToDeck | ToRemote;
