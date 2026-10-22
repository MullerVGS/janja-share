import { useEffect, useState } from 'react'
import { fraseDaGuarda } from '../../salas/link'
import { Botao } from '../../ui/Botao'
import { Dialogo } from '../../ui/Dialogo'
import estilos from './DialogoConvite.module.css'

/** "Copiado" dura 1,6 s — o mesmo prazo do "Copiado" das Métricas. */
const AVISO_DE_COPIA_MS = 1600

interface Props {
  aberto: boolean
  nomeDaSala: string
  fixa: boolean
  /** O link inteiro da Sala, com a assinatura. */
  link: string
  /**
   * O link não aparece: a Sala é privada e a sua Tela está no ar — o campo poderia sair na Tela.
   * O Copiar continua levando o link inteiro.
   */
  oculto: boolean
  aoFechar(): void
}

/** Convidar: o link da Sala num campo só de leitura, o Copiar ao lado e o prazo da guarda embaixo. */
export function DialogoConvite({ aberto, nomeDaSala, fixa, link, oculto, aoFechar }: Props) {
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!copiado) return
    const volta = setTimeout(() => setCopiado(false), AVISO_DE_COPIA_MS)
    return () => clearTimeout(volta)
  }, [copiado])

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
    } catch {
      // Sem permissão ou sem a API: o link continua na barra de endereço (quando não oculto).
    }
  }

  return (
    <Dialogo aberto={aberto} titulo={`Convide a turma para ${nomeDaSala}`} aoFechar={aoFechar}>
      <div className={estilos.corpo}>
        <span className={estilos.rotulo}>Mande este link para quem você quer na sala</span>
        <div className={estilos.campo} data-copiado={copiado || undefined}>
          <input
            className={estilos.link}
            readOnly
            aria-label="Link da sala"
            value={oculto ? 'Oculto enquanto sua tela está no ar; use o Copiar' : link}
            onFocus={(evento) => {
              if (!oculto) evento.target.select()
            }}
          />
          <Botao aparencia={copiado ? 'secundario' : 'primario'} aria-label="Copiar convite" onClick={() => void copiar()}>
            {copiado ? 'Copiado' : 'Copiar'}
          </Botao>
        </div>
        <p className={estilos.guarda}>{fraseDaGuarda(fixa)}</p>
      </div>
    </Dialogo>
  )
}
