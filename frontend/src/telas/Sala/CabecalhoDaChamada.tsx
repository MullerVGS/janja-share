import { fraseDaGuarda } from '../../salas/link'
import { IconeChat, IconeConvite, IconePessoas, IconeSalaDeVoz, IconeVoltar } from '../../ui/Icone'
import estilos from './CabecalhoDaChamada.module.css'

interface Props {
  nomeDaSala: string
  fixa: boolean
  /** No celular: volta para a lista, com a chamada seguindo por baixo. */
  aoVoltarALista(): void
  aoConvidar(): void
  chatAberto: boolean
  naoLidasNoChat: number
  aoAlternarChat(): void
  /** A grade mostra também quem não compartilha (o padrão) ou só as Telas. */
  mostrandoPessoas: boolean
  aoAlternarPessoas(): void
}

/**
 * O cabeçalho da chamada, flutuando no alto da área preta: o alto-falante e o nome da Sala à
 * esquerda; convidar, mostrar quem não compartilha e o chat à direita.
 */
export function CabecalhoDaChamada({
  nomeDaSala,
  fixa,
  aoVoltarALista,
  aoConvidar,
  chatAberto,
  naoLidasNoChat,
  aoAlternarChat,
  mostrandoPessoas,
  aoAlternarPessoas,
}: Props) {
  return (
    <header className={estilos.cabecalho}>
      <button type="button" className={estilos.voltar} aria-label="Ver as salas" title="Ver as salas" onClick={aoVoltarALista}>
        <IconeVoltar tamanho={20} />
      </button>
      <span className={estilos.icone} aria-hidden="true">
        <IconeSalaDeVoz tamanho={20} />
      </span>
      <h1 className={estilos.nome}>{nomeDaSala}</h1>
      <span className={estilos.guarda} title={fraseDaGuarda(fixa)}>
        {fixa ? 'fixa' : 'efêmera'}
      </span>

      <span className={estilos.espacador} />

      <button type="button" className={estilos.botao} aria-label="Convidar" title="Convidar" onClick={aoConvidar}>
        <IconeConvite tamanho={22} />
      </button>
      <button
        type="button"
        className={estilos.botao}
        aria-pressed={mostrandoPessoas}
        aria-label="Mostrar quem não compartilha"
        title={mostrandoPessoas ? 'Esconder quem não compartilha' : 'Mostrar quem não compartilha'}
        onClick={aoAlternarPessoas}
      >
        <IconePessoas tamanho={22} />
      </button>
      <button
        type="button"
        className={estilos.botao}
        aria-pressed={chatAberto}
        aria-label="Chat"
        title={chatAberto ? 'Esconder o chat' : 'Mostrar o chat'}
        onClick={aoAlternarChat}
      >
        <IconeChat tamanho={22} />
        {naoLidasNoChat > 0 && (
          <span className={estilos.contador} aria-label={`${naoLidasNoChat} mensagens não lidas`}>
            {naoLidasNoChat}
          </span>
        )}
      </button>
    </header>
  )
}
