import { LARGURA_MINIMA_DA_LATERAL } from './sala/lateral'
import { ehCodec, lerPerfil, PERFIL_PADRAO, type Codec, type PerfilDeQualidade } from './sala/qualidade'
import { lerVolumes, type Volumes } from './sala/volumes'

/**
 * Preferências da pessoa neste navegador: um único objeto versionado em `localStorage`.
 *
 * A leitura é tolerante campo a campo — um valor estranho vira o padrão daquele campo, não o
 * descarte do conjunto. Só a versão errada zera tudo: é o jeito de mudar o formato sem migração.
 */
export const CHAVE_DAS_PREFERENCIAS = 'janja-share.preferencias'
const VERSAO = 1

export interface Preferencias {
  larguraDaLateral: number
  /** A barra lateral de pessoas e telas na composição larga; recolhida, o palco fica com o
   * espaço. Em tela estreita ela é camada e nasce sempre fechada, sem consultar isto. */
  barraLateralAberta: boolean
  /** O pedido da pessoa — o que o governador usa como teto. */
  perfil: PerfilDeQualidade
  /** A chave do governador. */
  automatico: boolean
  /**
   * A intenção da pessoa sobre o codec. `'auto'` entrega a escolha à máquina — que é o padrão,
   * porque o codec certo é propriedade do encoder daquele computador, e não do que está na tela.
   */
  codecPreferido: 'auto' | Codec
  /**
   * O codec que provou funcionar nesta máquina, gravado a cada correção do automático.
   *
   * É o que transforma "corrige uma vez por transmissão" em "erra uma vez na vida": sem isto,
   * toda live recomeçaria no palpite e pagaria de novo os primeiros trinta segundos ruins.
   */
  codecAprendido: Codec | null
  /** Volume local de cada pessoa e de cada tela, por nome. */
  volumes: Volumes
  /** Como os outros te veem. Editável no painel da pessoa, no rodapé da coluna. */
  nome: string
  /** Os sons curtos da sala (alguém entrou, saiu, começou ou parou uma Tela). */
  sons: boolean
  /** O volume desses sons, de 0 a 100. */
  volumeDosSons: number
  /** O id do microfone escolhido; vazio é o padrão do sistema. */
  microfone: string
  /** O id do aparelho por onde a Sala sai (fone, caixa); vazio é o padrão do sistema. */
  saidaDeSom: string
}

export const PREFERENCIAS_PADRAO: Preferencias = {
  larguraDaLateral: 340,
  barraLateralAberta: true,
  perfil: PERFIL_PADRAO,
  automatico: true,
  codecPreferido: 'auto',
  codecAprendido: null,
  volumes: {},
  nome: '',
  sons: true,
  volumeDosSons: 60,
  microfone: '',
  saidaDeSom: '',
}

type Leitor<T> = (valor: unknown) => T | undefined

const LEITORES: { [C in keyof Preferencias]: Leitor<Preferencias[C]> } = {
  larguraDaLateral: (valor) =>
    typeof valor === 'number' && Number.isFinite(valor) && valor >= LARGURA_MINIMA_DA_LATERAL ? valor : undefined,
  barraLateralAberta: (valor) => (typeof valor === 'boolean' ? valor : undefined),
  perfil: lerPerfil,
  automatico: (valor) => (typeof valor === 'boolean' ? valor : undefined),
  codecPreferido: (valor) => (valor === 'auto' || ehCodec(valor) ? valor : undefined),
  codecAprendido: (valor) => (ehCodec(valor) ? valor : valor === null ? null : undefined),
  volumes: lerVolumes,
  nome: (valor) => (typeof valor === 'string' ? valor : undefined),
  sons: (valor) => (typeof valor === 'boolean' ? valor : undefined),
  volumeDosSons: (valor) =>
    typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= 100 ? valor : undefined,
  microfone: (valor) => (typeof valor === 'string' ? valor : undefined),
  saidaDeSom: (valor) => (typeof valor === 'string' ? valor : undefined),
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
