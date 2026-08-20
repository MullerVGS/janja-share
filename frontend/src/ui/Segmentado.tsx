import estilos from './Segmentado.module.css'

export interface OpcaoSegmentada<T> {
  valor: T
  rotulo: string
  /** Vira o `title` do botão — usado para explicar a escolha sem alongar o rótulo. */
  descricao?: string
}

interface Props<T> {
  rotulo: string
  opcoes: readonly OpcaoSegmentada<T>[]
  valor: T
  aoEscolher(valor: T): void
}

/**
 * Escolha única em botões lado a lado. É um `radiogroup` de verdade e não um `<select>` porque
 * o painel de qualidade vive aberto durante a chamada: cada opção precisa custar um clique.
 */
export function Segmentado<T extends string | number>({ rotulo, opcoes, valor, aoEscolher }: Props<T>) {
  return (
    <div className={estilos.grupo}>
      <span className={estilos.rotulo} id={`seg-${rotulo}`}>
        {rotulo}
      </span>
      <div className={estilos.trilha} role="radiogroup" aria-labelledby={`seg-${rotulo}`}>
        {opcoes.map((opcao) => (
          <button
            key={String(opcao.valor)}
            type="button"
            role="radio"
            aria-checked={opcao.valor === valor}
            title={opcao.descricao}
            className={estilos.opcao}
            onClick={() => aoEscolher(opcao.valor)}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
    </div>
  )
}
