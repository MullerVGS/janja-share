# 0016 — A casca de canal de voz

Status: aceito
Registro: 2026-10-22

## Contexto

A interface tinha duas telas sem nada em comum: o saguão (um cabeçalho, um texto de boas-vindas e cartões de salas) e a Sala (barra lateral de pessoas e telas, palco sem grade, faixa de avatares no alto, barra flutuante). Quem usa o janja-share chega de uma ferramenta de conversa por canais de voz e já sabe ler aquela forma: a lista de lugares à esquerda, as pessoas dentro de cada canal de voz, a conexão e o "eu" no rodapé, a chamada no meio e o chat do canal ao lado. O ADR 0008 tinha tirado a presença do palco para a Tela não dividir espaço com iniciais; a forma de referência resolve o mesmo problema de outro jeito — tudo é quadro na grade, e um quadro em foco cresce com o resto numa faixa embaixo.

## Decisão

A interface inteira mora numa **casca** só, igual no saguão e na Sala, com as medidas e os estados dessa forma — escritos em CSS nosso, com ícones Phosphor e a fonte Inter:

- **Barra de título** de 32 px com o lugar atual; **trilho** de 72 px com o saguão no alto, um traço, "Suas salas" como ícones de 40 px com as iniciais e o "+" de criar por último. A pílula branca na borda do ícone diz o estado: alta na Sala à mostra, média sob o ponteiro, um ponto na Sala que tem gente agora.
- **Coluna de salas** de 302 px: cabeçalho de 48 px e as Salas públicas acordadas como canais de voz, com quem está dentro (avatar de 24 px, microfone fechado, selo "Ao vivo" de quem compartilha). A Sala atual fica acesa, ganha o ⚙ de ajustar e, se privada, aparece só para quem está nela, com cadeado. Em ordem de nome, para não dançar a cada volta do poll. Para desenhar isso, `GET /api/salas` passou a mandar `presentes` (nome, Tela no ar, microfone aberto) ao lado de `pessoas`.
- **Painéis** num cartão flutuante no rodapé do trilho e da coluna: o de **voz conectada** (estado em cor com explicação ao clicar, o nome da Sala que leva de volta à chamada, desligar e a fileira compartilhar · recarregar mídia · convidar) e o **da pessoa** (avatar, nome, microfone, ensurdecer e preferências — o nome e os sons moram ali).
- **A chamada** é a página: preta, com o cabeçalho flutuando no alto (nome da Sala; convidar, mostrar quem não compartilha e chat à direita) e a barra centrada embaixo (microfone, tela ou o menu "No ar", quem assiste, voltar à grade e sair em vermelho). Os dois somem com o ponteiro parado, como a moldura já sumia; no celular ficam.
- **Grade e foco** substituem o palco sem grade do ADR 0008. Telas **e Pessoas** são quadros 16:9 do mesmo tamanho — o maior que couber —, a Pessoa como avatar sobre a cor dela, com o contorno verde de quem fala. Um quadro em foco (o `Destaque` de sempre, com zoom, cartões de estado, PiP e tela cheia) fica grande, com os outros numa **faixa** embaixo. "Voltar à grade" é uma escolha que fica: Tela nova dos outros aparece como quadro sem tirar ninguém da grade; a própria Tela nova continua indo ao foco. Sem escolha, a primeira Tela continua assumindo o foco, como antes. O botão do alto esconde os quadros de quem não compartilha.
- **O chat** é a coluna à direita da chamada, com mensagens agrupadas por autor (avatar de 40 px, nome e hora na primeira; as seguintes só com o texto), e divide a gaveta com Qualidade e Métricas, que continuam ali. As Métricas também se abrem pelo estado da conexão do painel de voz.
- **Convidar** é um diálogo com o link num campo e o Copiar ao lado, com o prazo da guarda embaixo.
- **O saguão** é a página quando não há chamada à mostra: boas-vindas com "Criar sala", "Suas salas" em lista e o disclaimer no rodapé. Ele pode ser aberto por cima de uma Sala conectada: a chamada segue por baixo, e o nome da Sala no painel de voz (ou a própria Sala na coluna) a traz de volta. Entrar em outra Sala troca de Sala.
- **No celular** (até 720 px), a lista (trilho, coluna e painéis) é uma tela e a página é outra; a chamada ocupa a tela, com a seta para voltar à lista no cabeçalho e os botões da barra em círculos.
- **Paleta**: degraus de cinza neutro (barra, trilho e coluna no mais baixo; a página um acima; painéis e menus mais acima), estados de lista como camadas de cinza a 12/16/20%, o acento do janja-share cheio no botão principal e no ícone escolhido, vermelho cheio no sair e no "Ao vivo", verde em "voz conectada" e em quem fala. Os avatares ganham uma de seis cores sorteada pelo nome.

A imersão continua (o clique único na Tela em foco): agora ela tira de cena a casca inteira — barra de título, trilho, coluna e painéis — e a faixa.

## Consequências

`foco.ts` ganhou o estado de grade escolhida (`grade: true`) e o evento `voltouAGrade`, e a Pessoa voltou a sustentar um foco. `NavegacaoDaSala`, `Cabecalho`, `FaixaDeAvatares`, `Tira` e `CartaoDaSala` saíram; as Salas no ar deixaram de ser cartões e passaram a ser a coluna. A entrada numa Sala pela lista é só ir ao link dela: a entrada direta (ADR 0013) e a `EntradaDaSala`, desenhada por cima da casca, cuidam do resto.

A regra de tinta do tema Nocturne (acento só como tinta) deixou de valer; a de peso (600 no máximo) continua, porque a fonte embarcada não tem mais.

O microfone tem duas portas (a barra e o painel da pessoa), lidas do mesmo `Room` por `useMicrofone`.

## Revisão do ADR 0008

O palco volta a ter grade e a presença volta a ser quadro, agora do mesmo tamanho que a Tela e escondível. Fica do 0008: a Tela em foco sem moldura de barra lateral, a imersão no clique único e a tela cheia no duplo clique.
