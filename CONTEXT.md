# Contexto de domínio

O janja-share permite compartilhar tela em salas que a turma reabre pelo mesmo link, sem contas.

## Glossário

**Sala** — encontro identificado por um nome. Pode ser pública no saguão ou privada; a privada não é listada e ganha um sufixo sorteado no slug, então só chega nela quem tem o link. Um mesmo nome é único entre salas vivas (acordadas ou adormecidas) e pode ser reutilizado com segurança depois que a sala expira. Nome e visibilidade podem mudar depois de criar, por qualquer Pessoa presente: a Sala não tem dono.

**Sala fixa** — o padrão. Quando todos saem, ela adormece em vez de morrer e fica guardada por 7 dias, contados de novo a cada encontro.

**Sala efêmera** — a que some logo depois que todos saem ("Apagar quando todos saírem").

**Acordada** e **adormecida** — estados da Sala viva no SFU: acordada tem gente (ou é efêmera nos instantes antes de sumir); adormecida é a fixa sem ninguém. O saguão mostra só as públicas acordadas.

**Expirada** — a Sala que não volta mais pelo link: o prazo da guarda passou, ou ela era efêmera.

**Encarnação** — cada vida de uma Sala no SFU, com nome interno `<slug>-<nonce>`. Recriar a Sala pelo link faz uma encarnação nova; mudar nome ou visibilidade não.

**Link da Sala** — o endereço `/sala/<slug>` e, na fixa, a assinatura `?k=`, que a traz de volta se o SFU tiver reiniciado. O link é a identidade da Sala: é ele que vai no convite e em Suas salas.

**Suas salas** — as Salas fixas que este navegador visitou, guardadas só nele, para voltar em um clique.

**Pessoa** — alguém presente em uma Sala, com nome e identidade válidos somente naquela encarnação. `Participant` aparece apenas na integração técnica com o LiveKit; não use `User` ou `Account` no domínio.

**Compartilhamento** — atividade iniciada por uma Pessoa para publicar uma Tela. Pode incluir o som da tela como acompanhante opcional. Não use `Transmissão` como termo de domínio.

**Tela** — conteúdo visual publicado por uma Pessoa durante um Compartilhamento.

**Palco** — a área principal de uma Sala, onde a chamada é mostrada: a grade, ou um Quadro em foco com a faixa.

**Quadro** — o espaço do Palco ocupado por uma Tela ou por uma Pessoa (o avatar dela). A Sala não tem câmera.

**Grade** e **foco** — os dois jeitos do Palco: na grade, todos os Quadros do mesmo tamanho; em foco, um Quadro grande e os outros na **faixa** embaixo. Voltar à grade é uma escolha que fica até o próximo clique num Quadro ou até a própria Tela entrar no ar.

**Casca** — a moldura comum ao saguão e à Sala: barra de título, **trilho** (o saguão e Suas salas), **coluna de salas** (as Salas no ar com quem está dentro) e os painéis de voz e da pessoa no rodapé.
