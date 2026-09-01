import type { Peca } from '../../sala/palco'
import { Avatar } from '../../ui/Avatar'
import { IconeMicrofoneMudo } from '../../ui/Icone'
import estilos from './FaixaDeAvatares.module.css'

interface Props {
  pessoas: Peca[]
  /** Quantos círculos cabem antes de o resto virar "+N" — o estreito mostra menos. */
  limite?: number
}

const LIMITE_PADRAO = 8

/**
 * Quem está na sala, em uma pílula no alto do palco.
 *
 * Substitui os retângulos do tamanho de uma tela que cada participante ganhava antes: presença
 * é uma informação pequena, e gastar meia tela com o avatar de quem está de câmera fechada
 * roubava o espaço de quem tem imagem de verdade para mostrar. Quem abre a câmera vira quadro;
 * quem só está aqui vira círculo.
 *
 * O anel diz quem fala e o selo diz quem está mudo — as duas perguntas que a pessoa faz sem
 * precisar abrir a barra lateral.
 */
export function FaixaDeAvatares({ pessoas, limite = LIMITE_PADRAO }: Props) {
  if (pessoas.length === 0) return null

  const visiveis = pessoas.slice(0, limite)
  const sobrando = pessoas.slice(limite)

  return (
    <div className={estilos.faixa} aria-label={`${pessoas.length} na sala`}>
      {visiveis.map((pessoa) => (
        <span
          key={pessoa.chave}
          className={estilos.circulo}
          title={`${pessoa.nome}${pessoa.proprio ? ' (você)' : ''}${pessoa.microfoneLigado ? '' : ' · mudo'}`}
        >
          <Avatar nome={pessoa.nome} tamanho="pequeno" falando={pessoa.falando} proprio={pessoa.proprio} />
          {!pessoa.microfoneLigado && (
            <span className={estilos.selo} aria-hidden="true">
              <IconeMicrofoneMudo tamanho={8} />
            </span>
          )}
        </span>
      ))}

      {sobrando.length > 0 && (
        <span className={estilos.excedente} title={sobrando.map((pessoa) => pessoa.nome).join(', ')}>
          +{sobrando.length}
        </span>
      )}
    </div>
  )
}
