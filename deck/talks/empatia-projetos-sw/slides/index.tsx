import type { SlideBase } from "@/components/types";

/* Mapa de empatia: seis áreas em volta da persona. Usa as variáveis do tema, então vale nos dois temas. */
const MapaEmpatia = () => (
  <svg viewBox="0 0 1200 520" role="img" aria-label="Mapa de empatia: a persona no centro, com Vê, Escuta, Pensa e sente, Fala e faz, Dores e Necessidades">
    {[
      { x: 20, y: 10, t: "VÊ", d: "o que enxerga no dia a dia" },
      { x: 700, y: 10, t: "ESCUTA", d: "o que ouve de amigos e da mídia" },
      { x: 20, y: 180, t: "PENSA E SENTE", d: "medos, desejos, o que não diz" },
      { x: 700, y: 180, t: "FALA E FAZ", d: "o que diz e como se comporta" },
      { x: 20, y: 350, t: "DORES", d: "frustrações e obstáculos", warn: true },
      { x: 700, y: 350, t: "NECESSIDADES", d: "o que precisa de verdade", gold: true },
    ].map((b) => (
      <g key={b.t}>
        <rect x={b.x} y={b.y} width={480} height={150} rx={18} fill={b.gold ? "var(--accent-soft)" : "var(--surface)"} stroke={b.warn ? "var(--warn)" : b.gold ? "var(--accent)" : "var(--line)"} strokeWidth={3} />
        <text x={b.x + 28} y={b.y + 56} fontSize={30} fontWeight={800} fill={b.warn ? "var(--warn)" : "var(--accent)"} letterSpacing={1.5}>{b.t}</text>
        <text x={b.x + 28} y={b.y + 104} fontSize={26} fill="var(--fg)">{b.d}</text>
      </g>
    ))}
    <circle cx={600} cy={170} r={64} fill="var(--accent)" />
    <circle cx={600} cy={152} r={20} fill="var(--accent-ink)" />
    <path d="M563 208 q37 -40 74 0" fill="var(--accent-ink)" />
    <text x={600} y={268} textAnchor="middle" fontSize={24} fontWeight={800} fill="var(--fg)">PERSONA</text>
  </svg>
);

type Slide = Omit<SlideBase, "notes"> & Partial<Pick<SlideBase, "notes">>;

const lista: Slide[] = [
  {
    title: "Título", block: "Abertura", minute: "0:00", kind: "title",
    content: (
      <>
        <div className="eyebrow">Projetos de Software · Design Thinking · Sessão 02</div>
        <h1>Empatia: entender o usuário <em>antes</em> de criar</h1>
        <p className="lead muted">Hoje vocês saem com uma persona, um mapa de empatia e um roteiro de entrevista.</p>
        <p className="small muted">Abram o endereço ao lado do QR no navegador do notebook: ali vocês entram, reagem, votam e jogam o quiz.</p>
      </>
    ),
    notes: <p>Peça para todos abrirem o endereço no notebook e digitarem o nome (vale para o placar).</p>,
  },
  {
    title: "Onde estamos", block: "Abertura", minute: "0:03",
    links: [{ label: "Design Thinking (IDEO)", url: "https://designthinking.ideo.com/" }],
    content: (
      <>
        <h2>As 5 etapas do Design Thinking</h2>
        <div className="journey">
          <div className="step on"><b>Empatia</b><span>hoje</span></div>
          <div className="step"><b>Definição</b></div>
          <div className="step"><b>Ideação</b></div>
          <div className="step"><b>Protótipo</b></div>
          <div className="step"><b>Teste</b></div>
        </div>
        <p className="lead muted">Quem faltou na aula passada: é só isto. Hoje começa o projeto de vocês.</p>
      </>
    ),
  },
  {
    title: "Quiz: primeira etapa", block: "Abertura", minute: "0:08", top: true,
    quiz: { question: "Qual é a primeira etapa do Design Thinking?", options: ["Ideação", "Empatia", "Prototipação", "Teste"], answer: 1 },
    content: (
      <>
        <p className="eyebrow">Quiz valendo pontos</p>
        <h2>Qual é a <em>primeira</em> etapa do Design Thinking?</h2>
      </>
    ),
    notes: <p>Q abre, Q revela e pontua, Q esconde. K mostra o placar.</p>,
  },
  {
    title: "Mobilização", block: "Abertura", minute: "0:12", kind: "statement",
    content: <p className="big">Todo mundo já usou um app com um recurso que <em>ninguém pediu</em>. Alguém perguntou ao usuário?</p>,
    notes: <p>Tecla P abre a votação 👍/👎: "Já usei um app com recurso inútil".</p>,
  },
  {
    title: "Objetivos de hoje", block: "Abertura", minute: "0:17",
    content: (
      <>
        <h2>Até o fim da aula, sua equipe terá</h2>
        <ul className="list">
          <li>Um <em>problema real</em> escolhido</li>
          <li data-frag="1">Uma <em>persona</em> e um <em>mapa de empatia</em></li>
          <li data-frag="2">Uma <em>matriz CSD</em> do que já sabe e do que ainda não sabe</li>
          <li data-frag="3">Um <em>roteiro de 10 perguntas abertas</em>, já treinado</li>
        </ul>
      </>
    ),
  },
  {
    title: "O que é empatia", block: "Empatia", minute: "0:20", kind: "statement",
    links: [{ label: "Vídeo: menino de 7 anos conversa com senhor de 64", url: "https://youtu.be/a4rejxbqepM" }],
    content: <p className="big">Empatia é olhar o problema com os olhos de <em>quem o vive</em>. Nos apaixonamos pelo problema, não pela ideia.</p>,
  },
  {
    title: "4 formas de se aproximar", block: "Empatia", minute: "0:23",
    content: (
      <>
        <h2>Como se constrói empatia</h2>
        <div className="journey">
          <div className="step on"><b>Observar</b><span>o comportamento no contexto</span></div>
          <div className="step" data-frag="1"><b>Engajar</b><span>entrevistar e conversar</span></div>
          <div className="step" data-frag="2"><b>Imergir</b><span>viver o contexto</span></div>
          <div className="step" data-frag="3"><b>Pesquisar</b><span>o problema e os parecidos</span></div>
        </div>
      </>
    ),
  },
  {
    title: "Efeito Hawthorne", block: "Empatia", minute: "0:30",
    content: (
      <>
        <h2>Cuidado ao observar</h2>
        <div className="cols">
          <div className="card warn"><h3>Efeito Hawthorne</h3><p>Quem sabe que está sendo observado muda o comportamento.</p></div>
          <div className="card gold" data-frag="1"><h3>O que fazer</h3><p>Observe com discrição e compare o que a pessoa <em>diz</em> com o que ela <em>faz</em>.</p></div>
        </div>
      </>
    ),
  },
  {
    title: "Persona × público-alvo", block: "Persona e mapa", minute: "0:35",
    content: (
      <>
        <h2>Persona não é público-alvo</h2>
        <div className="cols">
          <div className="card"><h3>Público-alvo</h3><p>Descreve um <em>grupo</em>: idade, renda, cidade.</p></div>
          <div className="card gold" data-frag="1"><h3>Persona</h3><p>Descreve uma <em>pessoa</em>: nome, rotina, medos e o que precisa.</p></div>
        </div>
        <p className="lead muted" data-frag="2">Mesma idade, mesma cidade, mesma renda: ainda assim, pessoas muito diferentes.</p>
      </>
    ),
  },
  {
    title: "Quiz: persona", block: "Persona e mapa", minute: "0:40", top: true,
    quiz: {
      question: "Qual item descreve uma PERSONA?",
      options: [
        "Jovens de 18 a 25 anos, classe C",
        "Mariana, 5 anos, sente tédio nas aulas online e quer brincar com os amigos",
        "Moradores de cidades do interior",
        "Clientes que compram pela internet",
      ],
      answer: 1,
    },
    content: (
      <>
        <p className="eyebrow">Quiz valendo pontos</p>
        <h2>Qual item descreve uma <em>persona</em>?</h2>
      </>
    ),
  },
  {
    title: "Mapa de empatia", block: "Persona e mapa", minute: "0:45", top: true,
    content: (
      <>
        <h2>O mapa de empatia</h2>
        <div className="diagram"><MapaEmpatia /></div>
      </>
    ),
  },
  {
    title: "Exemplo: Mariana", block: "Persona e mapa", minute: "0:52", top: true,
    content: (
      <>
        <h2>Exemplo: Mariana, 5 anos, pré-escola</h2>
        <div className="cols3">
          <div className="card"><h3>Pensa e sente</h3><p>medo do desconhecido, tédio, vontade de compartilhar</p></div>
          <div className="card"><h3>Vê</h3><p>desenhos animados, amigos por vídeo, unboxing</p></div>
          <div className="card"><h3>Escuta</h3><p>conversa dos pais, advertências dos professores</p></div>
        </div>
        <div className="cols3">
          <div className="card"><h3>Fala e faz</h3><p>brinca com bonecos, pinta, monta peças</p></div>
          <div className="card warn" data-frag="1"><h3>Dores</h3><p>ideias reprimidas; tecnologia como única conexão social</p></div>
          <div className="card gold" data-frag="2"><h3>Necessidades</h3><p>cuidado, carinho, atividade física</p></div>
        </div>
      </>
    ),
  },
  {
    title: "Escolham o problema", block: "Persona e mapa", minute: "1:00",
    content: (
      <>
        <h2>Atividade 1 · escolham o problema <small className="muted">(15 min)</small></h2>
        <ol className="steps">
          <li>Cada pessoa sugere um problema <em>real</em> (empresa, escola, comunidade)</li>
          <li data-frag="1">Escolham o que vocês conseguem <em>entrevistar</em></li>
          <li data-frag="2">Escrevam em uma frase: quem sofre e com quê</li>
        </ol>
      </>
    ),
  },
  {
    title: "Persona e mapa: 40 min", block: "Persona e mapa", minute: "1:15", kind: "statement",
    content: <p className="big">Criem a <em>persona</em> e o <em>mapa de empatia</em> do seu desafio. <em>40 minutos.</em></p>,
    notes: <p>Cronometre 40 min. Circule pelas equipes: a persona tem nome, rotina e uma dor concreta?</p>,
  },
  {
    title: "Compartilhar", block: "Persona e mapa", minute: "1:55",
    content: (
      <>
        <h2>Cada equipe lê a sua persona em 1 minuto</h2>
        <ul className="list">
          <li>Nome, rotina e a <em>maior dor</em></li>
          <li data-frag="1">Sem discutir: só ouvir</li>
          <li data-frag="2">Depois, votamos: <em>parece uma pessoa real?</em> 👍 / 👎</li>
        </ul>
      </>
    ),
    notes: <p>Tecla P abre a votação a cada persona lida.</p>,
  },
  {
    title: "Dizer × fazer", block: "Entrevista", minute: "2:10",
    content: (
      <>
        <h2>Por que entrevistar?</h2>
        <div className="cols">
          <div className="card"><h3>O que a pessoa diz</h3><p>"Eu sempre leio o manual."</p></div>
          <div className="card gold" data-frag="1"><h3>O que ela faz</h3><p>Abre o manual só quando algo quebra.</p></div>
        </div>
        <p className="lead muted" data-frag="2">Procure inconsistências: pensar e fazer são coisas diferentes.</p>
      </>
    ),
  },
  {
    title: "Formatos", block: "Entrevista", minute: "2:15",
    content: (
      <>
        <h2>Três formas de ouvir o usuário</h2>
        <div className="chips">
          <span>formulário online</span>
          <span>entrevista presencial ou online</span>
          <span>observação · sombra</span>
          <em data-frag="1">hoje: entrevista exploratória, uma conversa roteirizada</em>
        </div>
      </>
    ),
  },
  {
    title: "Preparação", block: "Entrevista", minute: "2:20",
    content: (
      <>
        <h2>Antes da conversa</h2>
        <ol className="steps">
          <li>Peça para <em>gravar</em> (com autorização)</li>
          <li data-frag="1">Ajuste as perguntas ao <em>tempo</em> que você tem</li>
          <li data-frag="2">Fuja do <em>sim</em> e do <em>não</em>: peça respostas completas</li>
          <li data-frag="3">Ordene por <em>prioridade</em></li>
        </ol>
      </>
    ),
  },
  {
    title: "Abordagem", block: "Entrevista", minute: "2:30",
    content: (
      <>
        <h2>Como conduzir a conversa</h2>
        <div className="journey">
          <div className="step on"><b>Introdução</b><span>"Me conte sobre suas experiências..."</span></div>
          <div className="step" data-frag="1"><b>Contexto</b><span>"Me fale da última vez que você..."</span></div>
          <div className="step" data-frag="2"><b>Direcionamento</b><span>"Pode me mostrar como você...?"</span></div>
          <div className="step" data-frag="3"><b>Porquês</b><span>"Por quê?", até a causa</span></div>
        </div>
      </>
    ),
  },
  {
    title: "5 porquês", block: "Entrevista", minute: "2:38",
    content: (
      <>
        <h2>Os 5 porquês <small className="muted">(exemplo ilustrativo)</small></h2>
        <div className="journey">
          <div className="step on"><b>Abandonam o cadastro</b></div>
          <div className="step" data-frag="1"><b>Formulário longo</b></div>
          <div className="step" data-frag="2"><b>12 campos</b></div>
          <div className="step" data-frag="3"><b>Coletar tudo de uma vez</b></div>
          <div className="step" data-frag="4"><b>Ninguém ouviu o usuário</b></div>
        </div>
        <p className="lead muted" data-frag="4">A causa raiz quase nunca é o primeiro porquê.</p>
      </>
    ),
  },
  {
    title: "Boa e má pergunta", block: "Entrevista", minute: "2:45",
    content: (
      <>
        <h2>Perguntem de forma neutra</h2>
        <div className="cols">
          <div className="card warn"><h3>Evitem</h3><p>"Quais problemas você tem?"</p><p>"Você usaria isso?"</p></div>
          <div className="card gold" data-frag="1"><h3>Prefiram</h3><p>"Me conte sobre a última vez que você..."</p><p>Depois, silêncio: deixe pensar.</p></div>
        </div>
      </>
    ),
  },
  {
    title: "Quiz: melhor pergunta", block: "Entrevista", minute: "2:52", top: true,
    quiz: {
      question: "Qual é a melhor pergunta para uma entrevista exploratória?",
      options: [
        "Você usaria um app de entregas?",
        "Me conte sobre a última vez que você pediu comida em casa.",
        "Quais problemas você tem com entregas?",
        "O preço das entregas é justo?",
      ],
      answer: 1,
    },
    content: (
      <>
        <p className="eyebrow">Quiz valendo pontos</p>
        <h2>Qual é a <em>melhor</em> pergunta para uma entrevista exploratória?</h2>
      </>
    ),
  },
  {
    title: "Intervalo", block: "Intervalo", minute: "3:00", kind: "statement",
    content: <p className="big"><em>Intervalo</em> · 15 minutos</p>,
    notes: <p>Tecla B deixa a tela preta, se preferir. Intervalo regimental da grade: 10h10 às 10h25.</p>,
  },
  {
    title: "Matriz CSD", block: "Roteiro", minute: "3:15",
    content: (
      <>
        <h2>Matriz CSD: o que sei e o que não sei</h2>
        <div className="cols3">
          <div className="card"><h3>Certezas</h3><p>o que já sabemos de verdade</p></div>
          <div className="card gold" data-frag="1"><h3>Suposições</h3><p>o que achamos, mas não confirmamos</p></div>
          <div className="card warn" data-frag="2"><h3>Dúvidas</h3><p>o que não sabemos</p></div>
        </div>
      </>
    ),
  },
  {
    title: "CSD: 10 min", block: "Roteiro", minute: "3:20", kind: "statement",
    content: <p className="big">Preencham a <em>matriz CSD</em> do seu usuário. <em>10 minutos.</em></p>,
    notes: <p>Suposições e dúvidas viram perguntas na próxima atividade.</p>,
  },
  {
    title: "Anote tudo", block: "Roteiro", minute: "3:30",
    content: (
      <>
        <h2>Durante a entrevista, anotem</h2>
        <ul className="list">
          <li>Um item por <em>post-it</em>: uma citação, uma dor, uma oportunidade</li>
          <li data-frag="1">Anotem o que chamou atenção, sem transcrever</li>
          <li data-frag="2">Um membro pergunta, <em>outro anota</em></li>
        </ul>
      </>
    ),
  },
  {
    title: "Roteiro: 20 min", block: "Roteiro", minute: "3:35", kind: "statement",
    content: <p className="big">Escrevam o <em>roteiro de 10 perguntas abertas</em>, tiradas das suas dúvidas. <em>20 minutos.</em></p>,
    notes: <p>Confira se há perguntas de sim/não e troque. Ordenar por prioridade.</p>,
  },
  {
    title: "Treino entre equipes", block: "Roteiro", minute: "3:55",
    content: (
      <>
        <h2>Treino em trios · 20 min</h2>
        <div className="cols3">
          <div className="card gold"><h3>Entrevistador</h3><p>faz as perguntas do roteiro</p></div>
          <div className="card"><h3>Entrevistado</h3><p>responde como a persona</p></div>
          <div className="card"><h3>Anotador</h3><p>registra em post-its</p></div>
        </div>
        <p className="lead muted" data-frag="1">Troquem os papéis a cada 6 minutos.</p>
      </>
    ),
  },
  {
    title: "Quiz: CSD", block: "Fechamento", minute: "4:15", top: true,
    quiz: {
      question: "O que a matriz CSD organiza?",
      options: ["Custos, Prazos e Escopo", "Certezas, Suposições e Dúvidas", "Clientes, Serviços e Demandas", "Código, Sistema e Dados"],
      answer: 1,
    },
    content: (
      <>
        <p className="eyebrow">Quiz de revisão</p>
        <h2>O que a <em>matriz CSD</em> organiza?</h2>
      </>
    ),
  },
  {
    title: "Quiz: Hawthorne", block: "Fechamento", minute: "4:19", top: true,
    quiz: {
      question: "O que é o efeito Hawthorne?",
      options: [
        "O entrevistado repete a pergunta",
        "Quem é observado muda o comportamento",
        "O usuário só diz o que gosta",
        "O time cai na primeira ideia",
      ],
      answer: 1,
    },
    content: (
      <>
        <p className="eyebrow">Quiz de revisão</p>
        <h2>O que é o <em>efeito Hawthorne</em>?</h2>
      </>
    ),
    notes: <p>Depois de revelar, tecla K mostra o placar.</p>,
  },
  {
    title: "Próximos passos", block: "Fechamento", minute: "4:23",
    content: (
      <>
        <h2>O que fica pronto e o que vem</h2>
        <div className="cols">
          <div className="card gold"><h3>Entrega de hoje (Classroom)</h3><p>Roteiro de 10 perguntas e persona (rascunho).</p></div>
          <div className="card" data-frag="1"><h3>Até 23/11</h3><p>Entrevistem 1 pessoa real e levem os post-its.</p></div>
        </div>
        <p className="lead muted" data-frag="2">Registrem no Classroom o que cada um fez.</p>
      </>
    ),
  },
  {
    title: "Encerramento", block: "Fechamento", minute: "4:27", kind: "final",
    content: (
      <div className="final">
        <p>Apaixonem-se pelo <em>problema</em>, não pela ideia.</p>
        <div className="who">Próxima aula: definição e ideação · <b>23/11</b></div>
      </div>
    ),
  },
];

/* A fala de cada slide está no ROTEIRO.md; as notes só entram onde há um lembrete extra. */
export const slides: SlideBase[] = lista.map((s) => ({ notes: <p>A fala deste slide está no roteiro.</p>, ...s }));
