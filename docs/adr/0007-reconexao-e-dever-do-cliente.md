# 0007 — Reconexão é dever do cliente

Status: aceito
Registro: 2026-08-30

## Contexto

O SFU nunca expulsa ninguém; as saídas involuntárias vinham do próprio cliente. O front reavaliava a validade do JWT a cada render e desconectava ao vencê-lo, embora a conexão viva receba tokens renovados do servidor. O SDK mede a sinalização com ping de 5 s e timeout de 15 s em timers da página; aba em segundo plano com timers limitados a um disparo por minuto fabrica o timeout, e a sequência de reconexões termina em queda. Quando o SDK desistia (~44 s), a interface parava em "Desconectado".

## Decisão

A validade guardada da credencial decide apenas se vale abrir uma conexão nova; uma sala conectada nunca é derrubada por ela. Os timers do SDK contam num Web Worker. O SDK insiste por pelo menos três minutos antes de desistir e, quando desiste sem a Pessoa ter saído, o cliente religa sozinho com as mesmas credenciais, parando só quando o servidor recusa a credencial, a Sala não existe mais ou outra aba tomou a identidade.

## Consequências

Sessões longas e abas em segundo plano deixam de cair por conta do cliente; quedas de rede reais se recuperam sem F5. Religar cria uma Pessoa nova no SFU: o Compartilhamento que estava no ar precisa ser reiniciado, e a sessão anterior aparece como saída para os outros.
