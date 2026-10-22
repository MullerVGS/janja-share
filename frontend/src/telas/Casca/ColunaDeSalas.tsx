import type { ReactNode } from 'react'
import { mensagemDoErro } from '../../api/cliente'
import { presentesDa, type SalaNaLista } from '../../api/salas'
import { Avatar } from '../../ui/Avatar'
import {
  IconeCadeado,
  IconeMicrofoneMudo,
  IconePreferencias,
  IconeSalaDeVoz,
  IconeSetaBaixo,
} from '../../ui/Icone'
import type { PessoaNaColuna, SalaAtual } from './tipos'
import estilos from './ColunaDeSalas.module.css'

interface Props {
  noAr: SalaNaLista[] | undefined
  carregando: boolean
  erro: unknown
  salaAtual: SalaAtual | null
  aoEscolher(slug: string): void
  /** O ⚙ da Sala atual: mudar nome e visibilidade. */
  aoAjustar?(): void
  /** O que fecha a coluna por baixo, acima dos painéis — o rodapé do saguão no celular. */
  rodape?: ReactNode
}

interface Linha {
  slug: string
  nome: string
  privada: boolean
  cheia: boolean
  pessoas: PessoaNaColuna[]
}

function linhasDa(noAr: SalaNaLista[] | undefined, salaAtual: SalaAtual | null): Linha[] {
  // Em ordem de nome: o servidor devolve as Salas em qualquer ordem, e a coluna não pode dançar
  // a cada volta do poll.
  const ordenadas = [...(noAr ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const publicas: Linha[] = ordenadas.map((sala) => ({
    slug: sala.slug,
    nome: sala.nome,
    privada: false,
    cheia: sala.cheia,
    pessoas: presentesDa(sala).map((presente, indice) => ({ chave: `${presente.nome}-${indice}`, ...presente })),
  }))
  if (!salaAtual) return publicas
  // A Sala atual vale pelo `Room`, mais fresco que a lista; a privada não está na lista e entra
  // no alto, com o cadeado.
  const atual: Linha = {
    slug: salaAtual.slug,
    nome: salaAtual.nome,
    privada: salaAtual.privada,
    cheia: false,
    pessoas: salaAtual.pessoas,
  }
  const naLista = publicas.findIndex((linha) => linha.slug === salaAtual.slug)
  if (naLista === -1) return [atual, ...publicas]
  return publicas.map((linha, indice) => (indice === naLista ? atual : linha))
}

function PessoaDaSala({ pessoa }: { pessoa: PessoaNaColuna }) {
  return (
    <li className={estilos.pessoa}>
      <span className={estilos.conteudoDaPessoa}>
        <Avatar nome={pessoa.nome} tamanho={24} falando={pessoa.falando} />
        <span className={estilos.nomeDaPessoa} data-falando={pessoa.falando || undefined}>
          {pessoa.nome}
        </span>
        <span className={estilos.icones}>
          {pessoa.comProblema && (
            <span
              className={estilos.alerta}
              role="img"
              aria-label={`${pessoa.nome} pode estar com problemas de conexão`}
              title={`${pessoa.nome} pode estar com problemas para se conectar à sala`}
            >
              !
            </span>
          )}
          {pessoa.aoVivo && <span className={estilos.aoVivo}>Ao vivo</span>}
          {!pessoa.microfoneAberto && (
            <span className={estilos.mudo} title="microfone fechado" aria-label="microfone fechado" role="img">
              <IconeMicrofoneMudo tamanho={16} />
            </span>
          )}
        </span>
      </span>
    </li>
  )
}

/**
 * A coluna das salas: o cabeçalho com o nome do produto e as Salas públicas acordadas como
 * canais de voz, cada uma com quem está dentro — avatar, microfone fechado e o selo "Ao vivo" de
 * quem compartilha. Clicar entra; a Sala atual fica acesa e ganha o ⚙ de ajustar.
 */
export function ColunaDeSalas({ noAr, carregando, erro, salaAtual, aoEscolher, aoAjustar, rodape }: Props) {
  const linhas = linhasDa(noAr, salaAtual)

  return (
    <div className={estilos.coluna}>
      <header className={estilos.cabecalho}>
        <span className={estilos.titulo}>janja-share</span>
        <IconeSetaBaixo tamanho={16} />
      </header>

      <div className={estilos.rolagem}>
        <h2 className={estilos.categoria}>
          <IconeSetaBaixo tamanho={12} />
          Salas no ar
        </h2>

        {carregando && linhas.length === 0 && <p className={estilos.nota}>Carregando salas…</p>}
        {Boolean(erro) && (
          <p className={estilos.nota} role="alert" data-tom="erro">
            {mensagemDoErro(erro)}
            {!noAr && ' Tentando de novo…'}
          </p>
        )}
        {!carregando && !erro && linhas.length === 0 && (
          <p className={estilos.nota}>Nenhuma sala no ar agora. Crie uma no + do trilho.</p>
        )}

        <ul className={estilos.lista} aria-label="Salas no ar">
          {linhas.map((linha) => {
            const atual = salaAtual?.slug === linha.slug
            const escolhida = atual && salaAtual.aMostra
            return (
              <li key={linha.slug} className={estilos.sala} data-escolhida={escolhida || undefined} data-atual={atual || undefined}>
                <div className={estilos.linhaDaSala}>
                  <button
                    type="button"
                    className={estilos.entrar}
                    aria-current={escolhida ? 'page' : undefined}
                    disabled={linha.cheia && !atual}
                    onClick={() => aoEscolher(linha.slug)}
                  >
                    <span className={estilos.iconeDaSala} aria-hidden="true">
                      <IconeSalaDeVoz tamanho={20} />
                      {linha.privada && (
                        <span className={estilos.cadeado}>
                          <IconeCadeado tamanho={10} />
                        </span>
                      )}
                    </span>
                    <span className={estilos.nomeDaSala}>{linha.nome}</span>
                    {linha.cheia && !atual && <span className={estilos.cheia}>cheia</span>}
                  </button>
                  {atual && aoAjustar && (
                    <button
                      type="button"
                      className={estilos.ajustar}
                      aria-label="Mudar nome ou visibilidade"
                      title="Mudar nome ou visibilidade"
                      onClick={aoAjustar}
                    >
                      <IconePreferencias tamanho={16} />
                    </button>
                  )}
                </div>
                {linha.pessoas.length > 0 && (
                  <ul className={estilos.pessoas} aria-label={`Quem está em ${linha.nome}`}>
                    {linha.pessoas.map((pessoa) => (
                      <PessoaDaSala key={pessoa.chave} pessoa={pessoa} />
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
        {rodape}
      </div>
    </div>
  )
}
