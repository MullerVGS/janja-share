import { ehAba, LARGURA_MINIMA_DA_LATERAL, type Aba } from './sala/lateral'
import { ehPerfil, PERFIL_PADRAO, type PerfilDeQualidade } from './sala/qualidade'
import { lerVolumes, type Volumes } from './sala/volumes'

/**
 * Preferências da pessoa neste navegador: um único objeto versionado em `localStorage`.
 *
 * A leitura é tolerante campo a campo — um valor estranho vira o padrão daquele campo, não o
 * descarte do conjunto. Só a versão errada zera tudo: é o jeito de mudar o formato sem migração.
 */
export const CHAVE_DAS_PREFERENCIAS = 'share.preferencias'
const VERSAO = 1

export interface Preferencias {
  larguraDaLateral: number
  abaDaLateral: Aba
  /** O pedido da pessoa — o que o governador usa como teto. */
  perfil: PerfilDeQualidade
  /** A chave do governador. */
  automatico: boolean
  /** Volume local de cada pessoa e de cada tela, por nome. */
  volumes: Volumes
  /** Como os outros te veem. Editável no topo do Início. */
  nome: string
}

export const PREFERENCIAS_PADRAO: Preferencias = {
  larguraDaLateral: 340,
  abaDaLateral: 'chat',
  perfil: PERFIL_PADRAO,
  automatico: true,
  volumes: {},
  nome: '',
}

type Leitor<T> = (valor: unknown) => T | undefined

const LEITORES: { [C in keyof Preferencias]: Leitor<Preferencias[C]> } = {
  larguraDaLateral: (valor) =>
    typeof valor === 'number' && Number.isFinite(valor) && valor >= LARGURA_MINIMA_DA_LATERAL ? valor : undefined,
  abaDaLateral: (valor) => (ehAba(valor) ? valor : undefined),
  perfil: (valor) => (ehPerfil(valor) ? valor : undefined),
  automatico: (valor) => (typeof valor === 'boolean' ? valor : undefined),
  volumes: lerVolumes,
  nome: (valor) => (typeof valor === 'string' ? valor : undefined),
}

const CAMPOS = Object.keys(LEITORES) as (keyof Preferencias)[]

export function lerPreferencias(): Preferencias {
  let cru: unknown
  try {
    cru = JSON.parse(localStorage.getItem(CHAVE_DAS_PREFERENCIAS) ?? 'null')
  } catch {
    return { ...PREFERENCIAS_PADRAO }
  }
  if (cru === null || typeof cru !== 'object' || Array.isArray(cru)) return { ...PREFERENCIAS_PADRAO }
  const guardado = cru as Record<string, unknown>
  if (guardado.versao !== VERSAO) return { ...PREFERENCIAS_PADRAO }

  const preferencias = { ...PREFERENCIAS_PADRAO }
  for (const nome of CAMPOS) ler(preferencias, nome, guardado[nome])
  return preferencias
}

function ler<C extends keyof Preferencias>(destino: Preferencias, nome: C, valor: unknown) {
  const lido = LEITORES[nome](valor)
  if (lido !== undefined) destino[nome] = lido
}

export function gravarPreferencias(parcial: Partial<Preferencias>): Preferencias {
  const novas = { ...lerPreferencias(), ...parcial }
  try {
    localStorage.setItem(CHAVE_DAS_PREFERENCIAS, JSON.stringify({ versao: VERSAO, ...novas }))
  } catch {
    // Armazenamento bloqueado: a preferência vale só até recarregar.
  }
  return novas
}
