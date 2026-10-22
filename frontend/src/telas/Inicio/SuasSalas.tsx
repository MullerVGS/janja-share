import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SalaNaLista } from '../../api/salas'
import { enderecoDaSala } from '../../salas/link'
import { esquecerSala, lerSuasSalas, type SalaLembrada } from '../../salas/suasSalas'
import { Botao } from '../../ui/Botao'
import { IconeFechar } from '../../ui/Icone'
import estilos from './SuasSalas.module.css'

interface Props {
  /** As Salas no ar do saguão: é por elas que se sabe se uma das suas tem gente agora. */
  noAr: SalaNaLista[] | undefined
}

const DIA_MS = 24 * 60 * 60 * 1000

/** "hoje", "ontem" ou a data curta — a última vez que este navegador entrou. */
export function quandoFoi(em: number, agora = Date.now()): string {
  const hoje = new Date(agora)
  hoje.setHours(0, 0, 0, 0)
  if (em >= hoje.getTime()) return 'hoje'
  if (em >= hoje.getTime() - DIA_MS) return 'ontem'
  return new Date(em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function estadoDa(sala: SalaLembrada, noAr: SalaNaLista[] | undefined): string {
  const viva = noAr?.find((item) => item.slug === sala.slug)
  const pessoas = viva?.pessoas.length ?? 0
  const agora = pessoas > 0 ? `${pessoas} ${pessoas === 1 ? 'pessoa' : 'pessoas'} agora` : null
  return [agora, sala.privada ? 'privada' : null, `última visita ${quandoFoi(sala.em)}`].filter(Boolean).join(' · ')
}

/**
 * As Salas fixas que este navegador visitou (ADR 0013), acordadas ou adormecidas, com entrar em
 * um clique e tirar da lista. É memória deste navegador: o saguão continua sem mostrar a Sala
 * adormecida de ninguém.
 */
export function SuasSalas({ noAr }: Props) {
  const navegar = useNavigate()
  const [salas, setSalas] = useState(() => lerSuasSalas())

  if (salas.length === 0) return null

  function tirar(slug: string) {
    esquecerSala(slug)
    setSalas(lerSuasSalas())
  }

  return (
    <section className={estilos.secao} aria-labelledby="titulo-suas-salas">
      <h2 id="titulo-suas-salas" className={estilos.titulo}>
        Suas salas
      </h2>
      <p className={estilos.subtitulo}>As salas que você abriu neste navegador. Voltam pelo mesmo link.</p>
      <ul className={estilos.lista}>
        {salas.map((sala) => (
          <li key={sala.slug} className={estilos.item}>
            <span className={estilos.info}>
              <span className={estilos.nome}>{sala.nome}</span>
              <span className={estilos.estado}>{estadoDa(sala, noAr)}</span>
            </span>
            <Botao aparencia="secundario" onClick={() => navegar(enderecoDaSala(sala.slug, sala.assinatura))}>
              Entrar
            </Botao>
            <button
              type="button"
              className={estilos.tirar}
              aria-label={`Tirar ${sala.nome} da lista`}
              title="Tirar da lista"
              onClick={() => tirar(sala.slug)}
            >
              <IconeFechar tamanho={15} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
