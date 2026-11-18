# Guia para criar uma apresentação neste repositório

Para pessoas e para agentes de código. Quem chega aqui quase sempre quer uma de duas coisas:
montar uma apresentação nova ou trazer uma que já existe. Para as duas há uma skill com o passo a
passo (`.claude/skills/nova-apresentacao` e `.claude/skills/migrar-apresentacao`); este arquivo é
a referência que elas usam.

## Onde fica cada coisa

```
deck/                      o motor do deck (Next.js): não precisa mudar para fazer uma apresentação
  components/ app/ scripts/
  talks/
    starter/               a apresentação inicial: um slide para cada recurso
    <a-sua>/               criada com `npm run new -- <nome>`
backstage/                 o servidor ao vivo (TypeScript): plateia, passador, métricas
  protocol.ts              todas as mensagens ao vivo, tipadas; o deck importa daqui
```

Uma apresentação é uma pasta em `deck/talks/` com:

- `deck.config.json`: título, evento, autor, idioma (`lang`: `pt-BR` ou `en`), fuso (`timeZone`), reações, tema, link do código-fonte.
- `slides/index.tsx`: os slides (e o que só esta palestra usa: imagens em SVG, um fundo próprio).
- `ROTEIRO.md`: a fala de cada slide (opcional).
- `public/`: imagens e vídeos.

A variável `TALK` escolhe qual pasta o motor usa (padrão: `starter`):

```bash
cd deck
npm ci                                   # uma vez, antes de qualquer outro comando
npm run new -- minha-palestra            # copia talks/starter
TALK=minha-palestra npm run dev          # http://localhost:3000/apresentador/
TALK=minha-palestra npm run typecheck
TALK=minha-palestra npm run pdf          # deck/slides.pdf
TALK=minha-palestra npm run png          # deck/slides-png/01.png, 02.png... (para conferir)
cd .. && TALK=minha-palestra docker compose up --build   # com plateia e túnel
```

No PowerShell: `$env:TALK = 'minha-palestra'; npm run dev`.

Regra de dependência: a apresentação importa do motor (`@/components/...`), nunca o contrário. O
motor enxerga a apresentação só por `components/content.ts`, e o contrato está em
`components/types.ts`.

## Um slide

`slides/index.tsx` exporta `slides`, uma lista. Cada item:

```tsx
{
  title: "Nome curto",        // visão geral, notas e página da plateia
  block: "Abertura",          // bloco do roteiro
  minute: "0:00",             // minuto em que o slide começa; o cronômetro mostra adiantado/atrasado
  kind: "title",              // opcional: "title" | "statement" | "final"
  top: true,                  // opcional: alinha ao topo e reduz o título (slide com muito conteúdo)
  links: [{ label: "Texto", url: "https://..." }], // liberados para a plateia a partir deste slide
  quiz: { question: "Pergunta?", options: ["A", "B", "C"], answer: 1 }, // opcional: quiz valendo pontos
  content: (<><h2>Título</h2><p className="lead">Texto</p></>),
  notes: <p>Lembrete para o apresentador.</p>,
}
```

O palco tem 1600x900 e é escalado para a janela. `talks/starter/slides/index.tsx` tem um exemplo
funcionando de cada bloco abaixo.

| Bloco | Classes | Para quê |
|---|---|---|
| Texto | `eyebrow`, `lead`, `muted`, `small`; `<em>` destaca na cor do tema; `<code>` para um termo de código | hierarquia do slide |
| Frase | `big` (com `kind: "statement"`), `quote` + `cite` | uma ideia sozinha na tela |
| Listas | `ul.list` (um `<ul>` dentro de um `<li>` faz o segundo nível), `ol.steps` | tópicos e sequências |
| Colunas | `cols` (2), `cols3` (3) | lado a lado |
| Cartões | `card`, `card gold`, `card warn` | comparar; `gold` é o ponto do slide |
| Etapas | `journey` > `step` (`<b>` nome, `<span>` detalhe); `step on` destaca | um processo, de três a seis etapas |
| Camadas | `layers` > `layer` (`<span>` exemplos à direita); `layer gold`, `layer rail` | o que fica entre uma coisa e outra |
| Itens soltos | `chips` > `span`; um `<em>` no fim vira a legenda | lista que não é sequência |
| Números | `stats` > `stat` (`<b>` número, `<span>` legenda, `<small>` fonte ou valor anterior) | um a três números; bom para antes/depois |
| Código | `pre.code` (`.k` destaca, `.c` esmaece, `.s` texto literal, `.w` erro); `code big` para 2 ou 3 linhas, `code small` para trechos longos | terminal e trechos curtos |
| Imagem | `diagram` > `<img>` ou `<svg>` | foto, captura de tela, diagrama |
| Encerramento | `final` > `p` + `who` (com `kind: "final"`) | a frase final e a assinatura |

- **Passos:** `data-frag="1"`, `"2"`... revela o elemento por clique. Elementos com o mesmo número aparecem juntos.
- **Vídeo:** `<Demo src="/demo/x.mp4" fallback={...} />`; o arquivo vai em `public/demo/`.
- **Imagem:** arquivo em `public/` e `src={`${BASE}/arquivo.png`}`, com `BASE` de `@/components/base`, dentro de `<div className="diagram">`. Sempre com `alt`.
- **`kind: "title"` e `"final"`** fazem o QR da plateia crescer; use no primeiro e no último slide.
- **Quiz:** o campo `quiz` do slide tem a pergunta, de 2 a 6 opções e `answer`, o índice da certa
  (começa em 0). Com o slide no telão, a tecla `Q` (ou o botão ❓ do passador) abre o quiz, `Q` de
  novo revela a certa e pontua, e `Q` mais uma vez esconde. Cada aluno digita o nome uma vez na
  página da plateia e responde uma vez por quiz; acertar vale 100 pontos, mais um bônus para os
  primeiros (+50, +40, +30, +20, +10). A tecla `K` (ou 🏆 no passador) mostra o placar; o passador
  tem o botão de zerar. Os pontos ficam na memória do backstage: reiniciar o servidor zera.

### O que a moldura já ocupa

Todo slide tem, por cima do conteúdo e sem você escrever nada:

- **o autor** (`author.name` e `author.tagline` do config), no canto inferior esquerdo. Não repita o nome no slide: no título e no encerramento, use a linha de assinatura para outra coisa (cargo, contato, link dos slides).
- **o QR da plateia**, pequeno (112 px) no canto inferior direito, com o endereço e o contador `04 / 12` ao lado.
- em `title` e `final`, **o QR grande** ocupa a metade direita, o contador some e o texto fica limitado a 940 px de largura.
- **o placar da votação**, enquanto ela está aberta, numa faixa no rodapé central. A pergunta pode estar escrita no slide ou só ser falada; não ponha nada essencial nos últimos 120 px do slide de uma votação.
- **o painel do quiz**, enquanto ele está aberto ou revelado, no rodapé central e mais alto (cerca de 340 px com quatro opções). Num slide de quiz, use `top: true` e deixe a metade de baixo livre.
- **o placar do quiz** (tecla `K`), um cartão no centro, por cima de tudo.

O QR só existe com o backstage no ar. No PDF ele sai apenas se houver endereço fixo, então para conferir se algum conteúdo passa por baixo dele gere com `NEXT_PUBLIC_QR_URL=https://example.com TALK=<nome> npm run png`.

### Quanto cabe

O palco é fixo em 1600x900 e nada encolhe sozinho: o que não cabe é cortado. Como referência:

- `big`: até umas 25 palavras. `lead`: duas linhas. `quote`: três linhas mais a fonte.
- `ul.list`: cinco itens de uma linha, ou três com segundo nível. `ol.steps`: quatro.
- `card`: título curto e até três linhas de texto; em `cols3`, duas.
- `journey`: três a seis etapas, com uma ou duas palavras cada. `layers`: até cinco.
- `stat`: o número com até cinco caracteres ("47 min", "92%"); acima disso use `big`.
- `pre.code`: dez linhas de 70 colunas; `code big`, três linhas de 50; `code small`, catorze de 85.
- `layers` e `chips` têm largura máxima e deixam espaço à direita; é intencional.

Slide que estoura vira dois slides, ou o excesso vai para o roteiro.

- **Fundo próprio:** exporte de `slides/index.tsx` um componente `Backdrop` cuja raiz tem as
  classes `frame backdrop`. Ele recebe o slide e o passo atuais (`BackdropProps` em
  `components/types.ts`), fica atrás de todos os slides e não anima na troca: serve para um desenho
  que evolui ao longo da apresentação. Campos próprios nos slides entram estendendo `SlideBase`.

## Tema

O `theme` do `deck.config.json` troca cores e fontes sem tocar em CSS:

```json
"theme": {
  "fontsUrl": "https://fonts.googleapis.com/css2?family=...",
  "fonts": { "display": "Fonte dos títulos", "body": "Fonte do texto", "mono": "Fonte de código" },
  "dark":  { "bg": "#101418", "accent": "#5ec2f2", "...": "..." },
  "light": { "bg": "#f6f8fa", "accent": "#0b6fa8", "...": "..." }
}
```

| Token | Onde aparece |
|---|---|
| `bg`, `bgGlow` | fundo do palco e o brilho do gradiente |
| `surface`, `line` | cartões e bordas |
| `fg`, `muted` | texto principal e secundário |
| `accent` | destaque: `<em>` dos títulos, marcadores, moldura do QR |
| `accentInk` | texto sobre a cor de destaque (botões) |
| `accentSoft` | fundo suave de destaque: cartão `gold`, marca-texto, código inline |
| `shine` | reflexo que passa pelo cartão `gold` |
| `codeBg`, `codeFg` | blocos de código (o destaque `.k` usa `accent`) |
| `warn`, `ok` | alerta e sucesso |

`dark` é o tema que abre no telão; `light` é o da tecla `T` e do PDF com `--tema=claro`. Todo
token é opcional: o que faltar usa o padrão do motor (ardósia e âmbar). Ao mudar `accent`, mude
nos dois temas e confira o contraste: a mesma cor raramente funciona sobre fundo claro e escuro.
A página da plateia usa as cores de `dark`. Confira os dois temas (`npm run png -- --tema=claro`). Os valores aceitam só notação de cor (`#rrggbb`,
`rgb()`, `rgba()`, nomes).

## Os outros campos do `deck.config.json`

- `author.name` e `author.tagline`: a assinatura da moldura, em todo slide. `tagline` é curto: um site, uma empresa.
- `publicUrl`: endereço fixo da plateia, quando houver (domínio próprio com túnel nomeado). Vazio é o normal: o backstage informa o endereço do túnel ao subir.
- `sourceUrl`: link do código-fonte, mostrado na página da plateia. Preencha se você modificou o motor e serve a versão modificada (a AGPL pede); só com slides seus, pode ficar vazio.
- `reactions`: os botões da plateia (até seis). O primeiro é o que o robô mais usa. Troque quando a palestra pedir outro tom.
- `timeZone`: o fuso de onde a apresentação acontece, para os horários das métricas.
- `poweredBy`: `false` tira a linha "feito com Talk in Loop" do canto dos slides. Ela é pequena e
  leva para a página do projeto; deixar é uma forma de retribuir.

## Idioma

`lang` no `deck.config.json` escolhe o idioma da interface: `pt-BR` ou `en` (qualquer valor que
não comece com `pt` cai em inglês). Vale para o passador, as dicas de teclas, a página da plateia,
as métricas e o que o servidor imprime. Os slides e o roteiro você escreve no idioma que quiser.
Os textos ficam em `deck/components/i18n.ts` e `backstage/i18n.ts`; um idioma novo é um bloco a
mais em cada um.

## O roteiro

Em `ROTEIRO.md`, cada `### NN · Título` vira o texto do slide NN nas notas (tecla `N`) e no
passador. Só o número conta (o título é para você se achar), e o separador pode ser `·`, `-` ou
`.`. Ao rodar qualquer comando, o `prepare` imprime `roteiro: N slides` e avisa de seções fora do
padrão, de números sem slide e de sobras da apresentação inicial: leia esses avisos. `## Bloco` agrupa; o texto logo abaixo dele entra junto do primeiro slide do bloco. Sem
a seção, valem as `notes` do slide.

## Conferir

```bash
cd deck && npm ci && TALK=<nome> npm run typecheck && TALK=<nome> npm run png
cd ../backstage && npm ci && npm run typecheck && npm test   # só se você mexeu no backstage
```

Olhe as imagens geradas (`deck/slides-png/`, uma por slide) antes de dizer que está pronto: é a
forma mais rápida de ver todos os slides, e qualquer agente consegue abrir um PNG. Elas mostram
tudo já revelado: animações, passos e a votação só aparecem com o deck rodando. `npm run pdf` gera
o mesmo conteúdo num arquivo só, para enviar ou imprimir.

Para subir de verdade, da raiz: `TALK=<nome> docker compose up --build`. O terminal imprime o
link do palco (abrir no notebook), o endereço da plateia e o QR do passador; os links com
`?token=` são de quem apresenta.

## Cuidados

- O link com `?token=` dá controle dos slides. Não coloque em slide, print nem commit.
- A página da plateia monta links com `textContent` e só aceita `http(s)`. Mantenha assim.
- O socket da plateia (`/ws`) só reage, vota e conta clique. Comando novo de palco vai no socket do palco (`/apresentador/ws`), entra em `backstage/protocol.ts` e ganha teste em `backstage/test/`.
- O servidor confere cada campo do que recebe: os tipos do protocolo descrevem um cliente correto, não protegem contra um malicioso.
- O backstage roda os `.ts` direto no Node (22.18+), sem build: nada de `enum`, `namespace` ou propriedades de construtor, e os imports relativos levam a extensão `.ts`.
- A lista de tokens de tema existe em dois lugares (`deck/components/theme.ts` e `backstage/config.ts`); mude nos dois.
- `deck/public/`, `deck/components/roteiro.json` e `deck/components/talk.generated.ts` são gerados por `scripts/prepare.mjs`. Não edite; edite a pasta da apresentação.
- O estado vive na memória de um processo: uma réplica por apresentação.
