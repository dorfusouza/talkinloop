import { BASE } from "@/components/base";
import Demo from "@/components/Demo";
import type { SlideBase } from "@/components/types";

export const slides: SlideBase[] = [
  {
    title: "Título", block: "Abertura", minute: "0:00", kind: "title",
    links: [{ label: "Site do autor", url: "https://example.com" }],
    content: (
      <>
        <div className="eyebrow">Nome do evento · 30 min</div>
        <h1>O título da sua <em>apresentação</em></h1>
        <p className="lead muted">Uma linha que diz para quem é e o que a pessoa leva.</p>
        <p className="small muted">Seu Nome, o que você faz</p>
      </>
    ),
    notes: <p>Peça para a plateia escanear o QR: ali ela reage, vota e recebe os links que você citar.</p>,
  },
  {
    title: "Passos", block: "Recursos", minute: "1:00",
    content: (
      <>
        <h2>Um ponto por clique</h2>
        <ul className="list">
          <li>O primeiro item já está na tela
            <ul><li>um detalhe dele, no segundo nível</li></ul>
          </li>
          <li data-frag="1">O segundo aparece no primeiro clique</li>
          <li data-frag="2">O terceiro, no segundo clique</li>
        </ul>
      </>
    ),
    notes: <p>Dois cliques neste slide. Voltar entra no slide anterior com tudo revelado.</p>,
  },
  {
    title: "Cartões", block: "Recursos", minute: "2:00",
    content: (
      <>
        <h2>Comparar duas ou três ideias</h2>
        <div className="cols3">
          <div className="card"><h3>Opção A</h3><p>Um cartão simples, para o que é contexto.</p></div>
          <div className="card gold" data-frag="1"><h3>Opção B</h3><p>O cartão de destaque: é o ponto do slide.</p></div>
          <div className="card warn" data-frag="2"><h3>Cuidado</h3><p>O cartão de alerta, para o risco ou a exceção.</p></div>
        </div>
      </>
    ),
    notes: <p>Use <code>cols</code> para duas colunas e <code>cols3</code> para três.</p>,
  },
  {
    title: "Etapas", block: "Recursos", minute: "2:30",
    content: (
      <>
        <h2>Um processo em etapas</h2>
        <div className="journey">
          <div className="step on"><b>Criar</b><span>a etapa em foco</span></div>
          <div className="step" data-frag="1"><b>Testar</b></div>
          <div className="step" data-frag="2"><b>Entregar</b></div>
          <div className="step" data-frag="3"><b>Operar</b></div>
        </div>
      </>
    ),
    notes: <p>Três cliques. Funciona com três a seis etapas.</p>,
  },
  {
    title: "Camadas", block: "Recursos", minute: "3:00",
    content: (
      <>
        <h2>O que fica entre uma coisa e outra</h2>
        <div className="layers">
          <div className="layer">Quem usa <span>pessoas · times</span></div>
          <div className="layer gold" data-frag="1">A camada que importa <span>o assunto do slide</span></div>
          <div className="layer rail" data-frag="2">Uma proteção <span>regras · limites</span></div>
          <div className="layer" data-frag="3">A base <span>o que sustenta tudo</span></div>
        </div>
      </>
    ),
    notes: <p>À esquerda o nome da camada; à direita, em fonte de código, exemplos dela.</p>,
  },
  {
    title: "Itens soltos", block: "Recursos", minute: "3:30",
    content: (
      <>
        <h2>Uma lista que não é uma sequência</h2>
        <div className="chips">
          <span>primeiro item</span>
          <span>segundo item</span>
          <span data-frag="1">terceiro item</span>
          <span data-frag="1">quarto item</span>
          <em data-frag="2">a legenda que une todos</em>
        </div>
      </>
    ),
    notes: <p>Itens com o mesmo <code>data-frag</code> aparecem juntos.</p>,
  },
  {
    title: "Números", block: "Recursos", minute: "4:00",
    content: (
      <>
        <div className="eyebrow">Fonte dos dados · ano</div>
        <div className="stats">
          <div className="stat"><b>90%</b><span>um número que sustenta o argumento</span></div>
          <div className="stat"><b>2h</b><span>outro, com a unidade junto</span></div>
          <div className="stat"><b>7</b><span>no máximo três por slide</span></div>
        </div>
        <p className="quote" data-frag="1">Uma citação curta fecha o slide.<cite>Quem disse, onde</cite></p>
      </>
    ),
    notes: <p>Diga a fonte em voz alta. O link dela pode ir em <code>links</code>, para a plateia abrir no celular.</p>,
  },
  {
    title: "Frase de impacto", block: "Recursos", minute: "5:00", kind: "statement",
    content: <p className="big">Uma frase sozinha na tela, com <em>um trecho</em> em destaque.</p>,
    notes: <p>Pausa depois de dizer a frase.</p>,
  },
  {
    title: "Código", block: "Recursos", minute: "6:00",
    content: (
      <>
        <h2>Código que cabe na tela</h2>
        <pre className="code">{`# comentário do bloco
`}<span className="k">docker</span>{` compose up --build

`}<span className="c"># palco, plateia e passador aparecem no terminal</span></pre>
      </>
    ),
    notes: <p>Poucas linhas, fonte grande. <code>k</code> destaca uma palavra, <code>c</code> esmaece um comentário, <code>w</code> marca um erro. <code>code big</code> aumenta a fonte para duas ou três linhas; <code>code small</code> diminui para trechos longos.</p>,
  },
  {
    title: "Imagem", block: "Recursos", minute: "6:30",
    content: (
      <>
        <h2>Uma imagem ou um diagrama</h2>
        <div className="diagram">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BASE}/exemplo.svg`} alt="Celular, backstage e telão ligados por setas" />
        </div>
      </>
    ),
    notes: <p>Descreva a imagem em <code>alt</code>. Captura de tela pequena fica borrada no telão: use pelo menos 1600 px de largura.</p>,
  },
  {
    title: "A plateia participa", block: "Ao vivo", minute: "7:00",
    links: [
      { label: "Um link citado neste slide", url: "https://example.com/artigo" },
      { label: "Outro, que fica disponível no celular", url: "https://example.com/video" },
    ],
    content: (
      <>
        <h2>A plateia participa pelo celular</h2>
        <ol className="steps">
          <li>Reage, e as reações sobem no telão</li>
          <li data-frag="1">Recebe os links deste slide</li>
          <li data-frag="2">Vota 👍 ou 👎 quando você pergunta</li>
        </ol>
      </>
    ),
    notes: <p>Tecla P abre e fecha a votação, em qualquer slide. A pergunta é falada, não escrita. Tecla L liga o robô, que reage se a sala ficar em silêncio.</p>,
  },
  {
    title: "Quiz", block: "Ao vivo", minute: "7:30", top: true,
    quiz: { question: "Qual destas linguagens roda no navegador sem instalar nada?", options: ["Java", "JavaScript", "C#", "Python"], answer: 1 },
    content: (
      <>
        <p className="eyebrow">Quiz valendo pontos</p>
        <h2>Qual destas linguagens roda no <em>navegador</em> sem instalar nada?</h2>
        <p className="lead">Responda pela página da plateia: quem acerta primeiro ganha mais pontos.</p>
      </>
    ),
    notes: <p>Tecla Q abre o quiz deste slide; Q de novo revela a certa e pontua; Q mais uma vez esconde. Tecla K mostra o placar. A pergunta, as opções e a certa ficam no campo quiz do slide.</p>,
  },
  {
    title: "Vídeo", block: "Ao vivo", minute: "8:00",
    content: (
      <>
        <div className="eyebrow">Demonstração gravada</div>
        <p className="lead">O que a plateia vai ver neste vídeo, em uma frase.</p>
        <Demo src="/demo/exemplo.mp4" fallback={<pre className="code">{`coloque o arquivo em public/demo/exemplo.mp4
enquanto ele não existir, este resumo em texto fica no lugar`}</pre>} />
      </>
    ),
    notes: <p>Tecla V toca e pausa. No PDF e na prévia do passador aparece o resumo em texto.</p>,
  },
  {
    title: "Encerramento", block: "Fechamento", minute: "9:00", kind: "final",
    links: [{ label: "Slides e contato", url: "https://example.com/contato" }],
    content: (
      <div className="final">
        <p>A frase que você quer que as pessoas levem para casa.</p>
        <div className="who">Seu Nome · <b>seu-site.com</b> · @seu_usuario</div>
      </div>
    ),
    notes: <p>Pausa. Depois, perguntas.</p>,
  },
];
