import { describe, expect, it } from 'vitest'
import {
  decidir,
  descreverDegrau,
  GOVERNADOR_PARADO,
  perfilEfetivo,
  TETO_DE_DECISOES,
  zerarGovernador,
  type EstadoDoGovernador,
} from '../src/sala/governador'
import { PERFIL_PADRAO, PRESET_DO_CONTEUDO, type Codec, type PerfilDeQualidade } from '../src/sala/qualidade'
import { amostraVaziaDoEmissor, amostraVaziaDoEspectador, type AmostraDoEmissor, type AmostraDoEspectador } from '../src/telemetria/amostra'
import { anotar } from '../src/telemetria/historico'
import type { Espectador } from '../src/telemetria/relato'

const QUADROS: PerfilDeQualidade = { ...PERFIL_PADRAO, fps: 60, ceder: 'quadros' }
const RESOLUCAO: PerfilDeQualidade = { ...PERFIL_PADRAO, resolucao: '1080p', fps: 30, ceder: 'resolucao' }
const TEXTO: PerfilDeQualidade = PRESET_DO_CONTEUDO.texto // VP9 (SVC), cede quadros
const JOGO: PerfilDeQualidade = PRESET_DO_CONTEUDO.jogo // cede resolução; o codec vem da máquina
/** Codec sem SVC: o SFU não tem camada menor para dar ao espectador lento, e o pior deles é o teto. */
const SEM_SVC: PerfilDeQualidade = { ...PRESET_DO_CONTEUDO.jogo, codec: 'h264' }

/**
 * Um espectador visto agora, com o relato que o caso precisa e o resto vazio.
 *
 * `vistoEm` é `Date.now()` porque na sala de verdade os dois relógios são o mesmo (o
 * `timestamp` do `RTCStatsReport` é epoch em ms). Aqui o relógio da sessão é de brinquedo, e
 * `Date.now()` é simplesmente "recente sob qualquer relógio"; `vistoEm: 0` é o velho.
 */
function espectador(relato: Partial<AmostraDoEspectador>, extra: Partial<Espectador> = {}): Espectador {
  return {
    identidade: 'bia-1',
    nome: 'Bia',
    relato: { ...amostraVaziaDoEspectador(Date.now()), ...relato },
    vistoEm: Date.now(),
    ...extra,
  }
}

type Parcial = Partial<AmostraDoEmissor>

const NO_AR: Parcial = { fpsCodificado: 60, fpsCaptura: 60, altura: 1080, alturaDaCaptura: 1080, largura: 1920 }
const CPU: Parcial = { ...NO_AR, limitadoPor: 'cpu', fpsCodificado: 40 }

/** Alimenta o governador como o hook faz: uma amostra por segundo, o histórico crescendo. */
class Sessao {
  estado: EstadoDoGovernador = GOVERNADOR_PARADO
  historico: AmostraDoEmissor[] = []
  espectadores: readonly Espectador[] = []
  candidato: Codec | null = null
  emMs = 0

  constructor(readonly pedido: PerfilDeQualidade) {}

  comEspectadores(lista: readonly Espectador[]): this {
    this.espectadores = lista
    return this
  }

  comCandidato(codec: Codec | null): this {
    this.candidato = codec
    return this
  }

  segundos(quantos: number, parcial: Parcial): this {
    for (let i = 0; i < quantos; i += 1) {
      this.emMs += 1000
      this.historico = anotar(this.historico, { ...amostraVaziaDoEmissor(this.emMs), ...NO_AR, ...parcial })
      this.estado = decidir(this.estado, this.historico, this.pedido, this.espectadores, this.candidato)
    }
    return this
  }

  get degrau() {
    return this.estado.degrau
  }
}

describe('governador: descer', () => {
  it('com 5 amostras limitadas e o eixo cedendo, desce em um passo ao maior degrau ≤ 0,9 × média', () => {
    const sessao = new Sessao(QUADROS).segundos(4, CPU)
    expect(sessao.degrau).toBeNull()

    sessao.segundos(1, CPU)
    // média 40 → 36 → o maior degrau que cabe é 30.
    expect(sessao.degrau).toBe(30)
    expect(sessao.estado.motivo).toBe('cpu')
    expect(perfilEfetivo(QUADROS, sessao.estado)).toEqual({ ...QUADROS, fps: 30 })
  })

  it('aceita 4 de 5 limitadas; 3 de 5 não', () => {
    const quatro = new Sessao(QUADROS).segundos(1, { ...NO_AR, fpsCodificado: 40 }).segundos(4, CPU)
    expect(quatro.degrau).toBe(30)

    const tres = new Sessao(QUADROS).segundos(2, { ...NO_AR, fpsCodificado: 40 }).segundos(3, CPU)
    expect(tres.degrau).toBeNull()
  })

  it('fonte parada não dispara: fps baixo sem limitação reportada fica como está', () => {
    const sessao = new Sessao(QUADROS).segundos(10, { ...NO_AR, fpsCodificado: 8, fpsCaptura: 8 })
    expect(sessao.degrau).toBeNull()
  })

  it('limitação sem o eixo ceder não dispara: 58 de 60 fps limitado por CPU é ruído', () => {
    const sessao = new Sessao(QUADROS).segundos(10, { ...CPU, fpsCodificado: 58 })
    expect(sessao.degrau).toBeNull()
  })

  it('"outro" não é limitação que o governador trate', () => {
    const sessao = new Sessao(QUADROS).segundos(10, { ...CPU, limitadoPor: 'outro' })
    expect(sessao.degrau).toBeNull()
  })

  it('amostra pausada pelo dynacast fica fora da janela', () => {
    const pausadas = new Sessao(QUADROS).segundos(10, { ...CPU, ativo: false, fpsCodificado: 0 })
    expect(pausadas.degrau).toBeNull()
    expect(pausadas.estado).toBe(GOVERNADOR_PARADO)

    // Pausada, a batida não decide nem ocupa vaga: a janela são as 5 ativas.
    const umaPausada = new Sessao(QUADROS).segundos(2, { ...NO_AR, fpsCodificado: 40 }).segundos(2, CPU)
    umaPausada.segundos(3, { ...CPU, ativo: false, fpsCodificado: 0 })
    umaPausada.segundos(1, CPU)
    expect(umaPausada.degrau).toBeNull()
    umaPausada.segundos(1, CPU)
    expect(umaPausada.degrau).toBe(30)
  })

  it('cedendo resolução, desce a altura da captura ao degrau que cabe e o perfil efetivo muda a resolução', () => {
    // 10 s e não 5: sob banda, a primeira janela vai para o teto de bitrate — o eixo caro é o segundo.
    const sessao = new Sessao(RESOLUCAO).segundos(10, { ...NO_AR, limitadoPor: 'banda', altura: 810, fpsCodificado: 30 })
    // 0,9 × 810 = 729 → 720.
    expect(sessao.degrau).toBe(720)
    expect(sessao.estado.motivo).toBe('banda')
    // O efetivo carrega os dois eixos que cederam: o teto de bitrate e a resolução.
    expect(perfilEfetivo(RESOLUCAO, sessao.estado)).toEqual({ ...RESOLUCAO, resolucao: '720p', tetoKbps: 2400 })
  })

  it('em nativa, "abaixo do pedido" é abaixo da altura que a captura entrega', () => {
    const nativa = { ...RESOLUCAO, resolucao: 'nativa' as const }
    const sessao = new Sessao(nativa).segundos(10, { ...NO_AR, limitadoPor: 'banda', alturaDaCaptura: 1200, altura: 900 })
    // 0,9 × 900 = 810 → 720.
    expect(sessao.degrau).toBe(720)
  })

  it('em resolução, qualquer altura abaixo do alvo já é ceder — sem folga', () => {
    const sessao = new Sessao(RESOLUCAO).segundos(10, { ...NO_AR, limitadoPor: 'banda', altura: 1078 })
    // 0,9 × 1078 = 970 → 720.
    expect(sessao.degrau).toBe(720)

    const noAlvo = new Sessao(RESOLUCAO).segundos(10, { ...NO_AR, limitadoPor: 'banda', altura: 1080 })
    expect(noAlvo.degrau).toBeNull()
  })

  it('pedido maior que o monitor não é o encoder cedendo: 1440p num monitor de 1080 não desce', () => {
    const alto = { ...RESOLUCAO, resolucao: '1440p' as const }
    const sessao = new Sessao(alto).segundos(10, { ...NO_AR, limitadoPor: 'banda', alturaDaCaptura: 1080, altura: 1080 })
    expect(sessao.degrau).toBeNull()
  })

  it('sem medida no eixo (fps nulo) não decide', () => {
    const sessao = new Sessao(QUADROS).segundos(10, { ...CPU, fpsCodificado: null })
    expect(sessao.degrau).toBeNull()
  })

  it('nunca sobe por uma descida: abaixo do último degrau, fica no último', () => {
    const sessao = new Sessao(QUADROS).segundos(5, { ...CPU, fpsCodificado: 2 })
    expect(sessao.degrau).toBe(5)
  })

  it('pedido no piso da escada não tem para onde descer: nenhuma decisão, nenhum "Auto"', () => {
    const cinco = new Sessao({ ...QUADROS, fps: 5 }).segundos(10, { ...CPU, fpsCodificado: 2 })
    expect(cinco.estado).toMatchObject({ degrau: null, decisoes: [] })

    const baixa = new Sessao({ ...RESOLUCAO, resolucao: '540p' }).segundos(10, { ...NO_AR, limitadoPor: 'banda', alturaDaCaptura: 540, altura: 400 })
    expect(baixa.estado).toMatchObject({ degrau: null, decisoes: [] })
  })

  it('depois de decidir, só amostras novas contam: precisa de 5 frescas para descer de novo', () => {
    const sessao = new Sessao(QUADROS).segundos(5, CPU)
    expect(sessao.degrau).toBe(30)

    sessao.segundos(4, { ...CPU, fpsCodificado: 12 })
    expect(sessao.degrau).toBe(30)

    sessao.segundos(1, { ...CPU, fpsCodificado: 12 })
    expect(sessao.degrau).toBe(10)
  })

  it('o motivo é o que mais apareceu na janela', () => {
    const sessao = new Sessao(QUADROS).segundos(2, CPU).segundos(3, { ...CPU, limitadoPor: 'banda' })
    expect(sessao.estado.motivo).toBe('banda')
  })
})

describe('governador: subir', () => {
  it('sobe um degrau depois de 30 s sem limitação, e não antes', () => {
    const sessao = new Sessao(QUADROS).segundos(5, CPU)
    expect(sessao.degrau).toBe(30)

    sessao.segundos(29, { ...NO_AR, fpsCodificado: 30 })
    expect(sessao.degrau).toBe(30)

    sessao.segundos(1, { ...NO_AR, fpsCodificado: 30 })
    expect(sessao.degrau).toBe(45)
    expect(sessao.estado.motivo).toBe('cpu')
  })

  it('uma limitação no meio reinicia a contagem dos 30 s', () => {
    const sessao = new Sessao(QUADROS).segundos(5, CPU).segundos(20, { ...NO_AR, fpsCodificado: 30 })
    sessao.segundos(1, { ...CPU, fpsCodificado: 30 })
    sessao.segundos(29, { ...NO_AR, fpsCodificado: 30 })
    expect(sessao.degrau).toBe(30)

    sessao.segundos(1, { ...NO_AR, fpsCodificado: 30 })
    expect(sessao.degrau).toBe(45)
  })

  it('nunca passa do pedido: o degrau acima do pedido é o próprio pedido', () => {
    const trinta = { ...QUADROS, fps: 30 }
    const sessao = new Sessao(trinta).segundos(5, { ...CPU, fpsCodificado: 20 })
    expect(sessao.degrau).toBe(15)

    sessao.segundos(30, { ...NO_AR, fpsCodificado: 15 })
    expect(sessao.degrau).toBe(24)

    sessao.segundos(30, { ...NO_AR, fpsCodificado: 24 })
    expect(sessao.degrau).toBeNull()
    expect(sessao.estado.motivo).toBeNull()
    expect(perfilEfetivo(trinta, sessao.estado)).toBe(trinta)
  })

  it('em nativa, volta a nativa quando o degrau acima passa da altura da captura', () => {
    const nativa = { ...RESOLUCAO, resolucao: 'nativa' as const }
    const sessao = new Sessao(nativa).segundos(10, { ...NO_AR, limitadoPor: 'banda', alturaDaCaptura: 1200, altura: 900 })
    expect(sessao.degrau).toBe(720)

    // Com o degrau em vigor, a captura passa a entregar 720: a altura nativa precisa ter ficado guardada.
    sessao.segundos(30, { ...NO_AR, alturaDaCaptura: 720, altura: 720 })
    expect(sessao.degrau).toBe(1080)

    sessao.segundos(30, { ...NO_AR, alturaDaCaptura: 1080, altura: 1080 })
    expect(sessao.degrau).toBeNull()
  })

  it('descer de novo em menos de 60 s queima o degrau: não se volta a ele', () => {
    const sessao = new Sessao(QUADROS).segundos(5, CPU)
    sessao.segundos(30, { ...NO_AR, fpsCodificado: 30 })
    expect(sessao.degrau).toBe(45)

    sessao.segundos(5, { ...CPU, fpsCodificado: 35 })
    expect(sessao.degrau).toBe(30)
    expect(sessao.estado.queimados).toEqual([45])

    sessao.segundos(60, { ...NO_AR, fpsCodificado: 30 })
    expect(sessao.degrau).toBe(30)
  })

  it('só o degrau que falhou logo depois de subir queima; a descida seguinte não queima o alcançado por descida', () => {
    const sessao = new Sessao(QUADROS).segundos(5, CPU)
    sessao.segundos(30, { ...NO_AR, fpsCodificado: 30 })
    expect(sessao.degrau).toBe(45)

    sessao.segundos(5, { ...CPU, fpsCodificado: 35 })
    expect(sessao.degrau).toBe(30)
    sessao.segundos(5, { ...CPU, fpsCodificado: 12 })
    expect(sessao.degrau).toBe(10)
    expect(sessao.estado.queimados).toEqual([45])

    // Os 30 voltam a estar disponíveis; os 45, não.
    sessao.segundos(30, { ...NO_AR, fpsCodificado: 10 })
    expect(sessao.degrau).toBe(15)
    sessao.segundos(30, { ...NO_AR, fpsCodificado: 15 })
    expect(sessao.degrau).toBe(24)
    sessao.segundos(30, { ...NO_AR, fpsCodificado: 24 })
    expect(sessao.degrau).toBe(30)
    sessao.segundos(60, { ...NO_AR, fpsCodificado: 30 })
    expect(sessao.degrau).toBe(30)
  })

  /**
   * O eixo cedido só sobe depois de o teto chegar ao alvo — então toda subida de degrau acontece
   * com o teto acima do piso, e a descida por banda que vem depois começa pelo teto. Se essa
   * primeira janela apagasse a marca da subida, a queima nunca pegaria no link que subiu: seria
   * sobe 45 → falha → teto absorve → desce 30 sem queimar → 30 s → 45 de novo, para sempre.
   */
  it('a descida do teto não desarma a queima do degrau que acabou de subir', () => {
    const sessao = new Sessao(QUADROS).segundos(5, CPU)
    sessao.segundos(30, { ...NO_AR, fpsCodificado: 30 })
    expect(sessao.degrau).toBe(45)

    // Primeira janela sob banda: vai toda para o teto, e o degrau nem se mexe.
    sessao.segundos(5, { ...NO_AR, limitadoPor: 'banda', fpsCodificado: 35 })
    expect(sessao.estado).toMatchObject({ tetoKbps: 2_400, degrau: 45, queimados: [] })

    // Segunda janela: o teto já está no piso, e agora o degrau desce — queimando os 45.
    sessao.segundos(5, { ...NO_AR, limitadoPor: 'banda', fpsCodificado: 35 })
    expect(sessao.estado).toMatchObject({ degrau: 30, queimados: [45] })

    sessao.segundos(60, { ...NO_AR, fpsCodificado: 30 })
    expect(sessao.degrau).toBe(30)
  })

  it('descer de novo depois de 60 s não queima nada', () => {
    const sessao = new Sessao(QUADROS).segundos(5, CPU)
    sessao.segundos(30, { ...NO_AR, fpsCodificado: 30 })
    expect(sessao.degrau).toBe(45)

    sessao.segundos(30, { ...NO_AR, fpsCodificado: 45 })
    expect(sessao.degrau).toBeNull()
    sessao.segundos(60, { ...NO_AR, fpsCodificado: 60 })
    sessao.segundos(5, { ...CPU, fpsCodificado: 50 })
    expect(sessao.degrau).toBe(45)
    expect(sessao.estado.queimados).toEqual([])
  })

  it('o próprio pedido pode queimar: voltar a ele e cair logo em seguida deixa o degrau de baixo valendo', () => {
    const sessao = new Sessao(QUADROS).segundos(5, { ...CPU, fpsCodificado: 50 })
    expect(sessao.degrau).toBe(45)
    sessao.segundos(30, { ...NO_AR, fpsCodificado: 45 })
    expect(sessao.degrau).toBeNull()

    sessao.segundos(5, { ...CPU, fpsCodificado: 50 })
    expect(sessao.degrau).toBe(45)
    expect(sessao.estado.queimados).toEqual([60])

    sessao.segundos(90, { ...NO_AR, fpsCodificado: 45 })
    expect(sessao.degrau).toBe(45)
  })

  it('pausado pelo dynacast é ignorado: não decide, não mexe no estado, e o relógio dos 30 s segue contando', () => {
    const sessao = new Sessao(QUADROS).segundos(5, CPU)
    sessao.segundos(20, { ...NO_AR, fpsCodificado: 30 })
    const antes = sessao.estado
    sessao.segundos(20, { ...NO_AR, ativo: false, fpsCodificado: 0 })
    expect(sessao.estado).toBe(antes)

    sessao.segundos(1, { ...NO_AR, fpsCodificado: 30 })
    expect(sessao.degrau).toBe(45)
  })
})

describe('governador: subir o teto de bitrate', () => {
  it('com o link folgado e nada limitando, sobe o teto de bitrate em direção a 0,85 da banda', () => {
    const sessao = new Sessao(TEXTO).segundos(40, { ...NO_AR, bandaDisponivelKbps: 20_000 })
    expect(sessao.estado.tetoKbps).toBeGreaterThan(TEXTO.tetoKbps)
    expect(sessao.estado.tetoKbps).toBeLessThanOrEqual(0.85 * 20_000)
  })

  it('nunca passa de 0,85 da banda medida, por mais que o tempo passe', () => {
    const sessao = new Sessao(TEXTO).segundos(600, { ...NO_AR, bandaDisponivelKbps: 6_000 })
    expect(sessao.estado.tetoKbps).toBeLessThanOrEqual(0.85 * 6_000)
  })

  it('sem medida de banda não inventa: fica no valor de partida', () => {
    const sessao = new Sessao(TEXTO).segundos(120, { ...NO_AR, bandaDisponivelKbps: null })
    expect(sessao.estado.tetoKbps).toBeNull()
  })

  it('sobe em degraus de 30 s, um por vez — e o eixo cedido só volta depois do teto', () => {
    const sessao = new Sessao(TEXTO).segundos(5, { ...CPU, bandaDisponivelKbps: 20_000, fpsCodificado: 8 })
    expect(sessao.degrau).toBe(5)

    sessao.segundos(30, { ...NO_AR, bandaDisponivelKbps: 20_000, fpsCodificado: 5 })
    expect(sessao.estado.tetoKbps).toBe(5_000)
    expect(sessao.degrau).toBe(5)

    sessao.segundos(30, { ...NO_AR, bandaDisponivelKbps: 20_000, fpsCodificado: 5 })
    expect(sessao.estado.tetoKbps).toBe(6_250)
    expect(sessao.degrau).toBe(5)
  })

  it('sob banda, o teto desce antes de fps ou altura — e para no piso de 60% da partida', () => {
    const sessao = new Sessao(TEXTO).segundos(5, { ...NO_AR, limitadoPor: 'banda', fpsCodificado: 8 })
    // Um só degrau de teto: 0,6 × 4000 já é o piso, e a próxima janela vai para o eixo cedido.
    expect(sessao.estado).toMatchObject({ tetoKbps: 2_400, degrau: null, motivo: 'banda' })

    sessao.segundos(5, { ...NO_AR, limitadoPor: 'banda', fpsCodificado: 8 })
    expect(sessao.estado).toMatchObject({ tetoKbps: 2_400, degrau: 5 })
  })

  it('sob CPU o teto não se mexe: apertar o encoder não devolve ciclo nenhum', () => {
    const sessao = new Sessao(TEXTO).segundos(5, { ...CPU, fpsCodificado: 8 })
    expect(sessao.estado).toMatchObject({ tetoKbps: null, degrau: 5, motivo: 'cpu' })
  })

  /**
   * A UI não tem como deduzir sozinha que a busca acabou — sem este sinal ela diz "subindo"
   * para sempre, inclusive num link já convergido, que é promessa que nenhuma janela limpa
   * vai cumprir.
   */
  describe('quando a busca chega ao que a banda deixa', () => {
    it('enquanto ainda há degrau a dar, não se declara no alvo', () => {
      const sessao = new Sessao(TEXTO).segundos(40, { ...NO_AR, bandaDisponivelKbps: 20_000 })
      expect(sessao.estado.tetoKbps).toBeGreaterThan(TEXTO.tetoKbps)
      expect(sessao.estado.tetoNoAlvo).toBe(false)
    })

    it('uma janela limpa gasta sem degrau de subida marca o teto como o do link', () => {
      // 0,85 × 4000 é menor que a partida: não há para onde subir já na primeira janela limpa.
      const sessao = new Sessao(TEXTO).segundos(40, { ...NO_AR, bandaDisponivelKbps: 4_000 })
      expect(sessao.estado.tetoKbps).toBeNull()
      expect(sessao.estado.tetoNoAlvo).toBe(true)
    })

    it('sem banda medida a busca segue em aberto — não se sabe onde é o teto', () => {
      const sessao = new Sessao(TEXTO).segundos(120, { ...NO_AR, bandaDisponivelKbps: null })
      expect(sessao.estado.tetoNoAlvo).toBe(false)
    })

    it('a banda alargando desfaz a marca: há degrau novo a dar', () => {
      const sessao = new Sessao(TEXTO).segundos(40, { ...NO_AR, bandaDisponivelKbps: 4_000 })
      expect(sessao.estado.tetoNoAlvo).toBe(true)

      sessao.segundos(35, { ...NO_AR, bandaDisponivelKbps: 20_000 })
      expect(sessao.estado.tetoNoAlvo).toBe(false)
      expect(sessao.estado.tetoKbps).toBeGreaterThan(TEXTO.tetoKbps)
    })

    it('ceder o teto sob banda desfaz a marca: o que está no ar deixou de ser o do link', () => {
      const sessao = new Sessao(TEXTO).segundos(40, { ...NO_AR, bandaDisponivelKbps: 4_000 })
      expect(sessao.estado.tetoNoAlvo).toBe(true)

      sessao.segundos(5, { ...NO_AR, limitadoPor: 'banda', fpsCodificado: 8, bandaDisponivelKbps: 4_000 })
      expect(sessao.estado).toMatchObject({ tetoKbps: 2_400, tetoNoAlvo: false })
    })

    it('mexer nos controles zera a marca junto com o resto', () => {
      const sessao = new Sessao(TEXTO).segundos(40, { ...NO_AR, bandaDisponivelKbps: 4_000 })
      expect(zerarGovernador(sessao.historico).tetoNoAlvo).toBe(false)
    })
  })
})

describe('governador: o outro lado', () => {
  it('espectador congelando segura a subida mesmo com o emissor limpo', () => {
    const sofrendo = [espectador({ freezes: { quantidade: 6, duracaoMs: 3000 }, desvioEntreQuadrosMs: 240 })]
    const sessao = new Sessao(TEXTO).comEspectadores(sofrendo).segundos(60, { ...NO_AR, bandaDisponivelKbps: 20_000 })
    expect(sessao.estado.tetoKbps).toBeNull()
  })

  it('espectador perdendo pacote também segura', () => {
    const sofrendo = [espectador({ perda: 8 })]
    const sessao = new Sessao(TEXTO).comEspectadores(sofrendo).segundos(60, { ...NO_AR, bandaDisponivelKbps: 20_000 })
    expect(sessao.estado.tetoKbps).toBeNull()
  })

  it('relato velho não conta — quem sumiu não está sofrendo', () => {
    const velho = [espectador({ freezes: { quantidade: 6, duracaoMs: 3000 }, desvioEntreQuadrosMs: 240 }, { vistoEm: 0 })]
    const sessao = new Sessao(TEXTO).comEspectadores(velho).segundos(60, { ...NO_AR, bandaDisponivelKbps: 20_000 })
    expect(sessao.estado.tetoKbps).toBeGreaterThan(TEXTO.tetoKbps)
  })

  /**
   * `freezes` é contador acumulado desde a assinatura: quem engasgou uma vez ao entrar carrega
   * o número para sempre. Se ele sozinho contasse como sofrimento, o governador nunca mais
   * subiria — e, em H.264, desceria até o chão com a sala inteira lisa.
   */
  it('congelamento antigo não é sofrimento: o que decide é o intervalo entre quadros de agora', () => {
    const cicatriz = [espectador({ freezes: { quantidade: 6, duracaoMs: 3000 }, desvioEntreQuadrosMs: 12 })]
    const sessao = new Sessao(TEXTO).comEspectadores(cicatriz).segundos(60, { ...NO_AR, bandaDisponivelKbps: 20_000 })
    expect(sessao.estado.tetoKbps).toBeGreaterThan(TEXTO.tetoKbps)
  })

  it('em codec sem SVC, espectador perdendo pacote faz descer, não só segurar', () => {
    const sofrendo = [espectador({ perda: 8 })]
    const sessao = new Sessao(SEM_SVC).comEspectadores(sofrendo).segundos(20, NO_AR)
    expect(sessao.degrau).not.toBeNull()
  })

  /**
   * O desvio é entre quadros *decodificados*: fonte que entrega poucos quadros irregulares —
   * vídeo pausado, tela parada, jogo em fps baixo — passa de 80 ms com a rede impecável. Como
   * cada descida reseta a janela, autorizar descida por ele levaria o preset Jogo ao fim da
   * escada em ~30 s no cenário mais provável dele.
   */
  it('desvio sozinho segura a subida, mas não autoriza descida: tela parada não é rede ruim', () => {
    const irregular = [espectador({ desvioEntreQuadrosMs: 240 })]
    const sessao = new Sessao(JOGO).comEspectadores(irregular).segundos(60, { ...NO_AR, bandaDisponivelKbps: 20_000 })
    expect(sessao.estado).toMatchObject({ degrau: null, tetoKbps: null })
  })

  /**
   * Sem quadro decodificado não há desvio e sem pacote não há perda: os dois chegam `null`, e o
   * relato de quem não está vendo nada se parece com o de quem está ótimo.
   */
  it('quem não recebe quadro nenhum segura a subida — é o mais prejudicado, e some dos outros sinais', () => {
    const travado = [espectador({ fpsDecodificado: 0, kbps: 0 })]
    const sessao = new Sessao(TEXTO).comEspectadores(travado).segundos(60, { ...NO_AR, bandaDisponivelKbps: 20_000 })
    expect(sessao.estado.tetoKbps).toBeNull()
  })

  it('recepção parada não faz descer: encolher o que se manda não conserta o que não chega', () => {
    const travado = [espectador({ fpsDecodificado: 0, kbps: 0 })]
    const sessao = new Sessao(JOGO).comEspectadores(travado).segundos(60, NO_AR)
    expect(sessao.degrau).toBeNull()
  })

  it('relato sem medida nenhuma não é sofrimento: zero é medida, `null` é ausência dela', () => {
    const semLeitura = [espectador({})]
    const sessao = new Sessao(TEXTO).comEspectadores(semLeitura).segundos(60, { ...NO_AR, bandaDisponivelKbps: 20_000 })
    expect(sessao.estado.tetoKbps).toBeGreaterThan(TEXTO.tetoKbps)
  })

  it('com SVC, espectador sofrendo não derruba a sala: o SFU já dá a ele uma camada menor', () => {
    const sofrendo = [espectador({ perda: 8 })]
    const sessao = new Sessao(TEXTO).comEspectadores(sofrendo).segundos(60, NO_AR)
    expect(sessao.degrau).toBeNull()
  })
})

describe('governador: memória e descrição', () => {
  it('sem histórico o estado não muda', () => {
    expect(decidir(GOVERNADOR_PARADO, [], QUADROS)).toBe(GOVERNADOR_PARADO)
  })

  it('zerar apaga degrau e queimados, e a janela recomeça agora: as amostras de antes não decidem de novo', () => {
    const sessao = new Sessao(QUADROS).segundos(5, CPU)
    sessao.estado = zerarGovernador(sessao.historico)
    expect(sessao.estado).toMatchObject({ degrau: null, queimados: [], janelaDesdeMs: 5000 })

    sessao.segundos(4, CPU)
    expect(sessao.degrau).toBeNull()
    sessao.segundos(1, CPU)
    expect(sessao.degrau).toBe(30)

    expect(zerarGovernador([])).toBe(GOVERNADOR_PARADO)
  })

  it('registra cada decisão com de/para/motivo, limitado', () => {
    const sessao = new Sessao(QUADROS).segundos(5, { ...CPU, fpsCodificado: 50 })
    expect(sessao.estado.decisoes).toEqual([{ emMs: 5000, de: null, para: 45, motivo: 'cpu' }])

    // Ciclos de um degrau, espaçados o bastante para não queimar nada: sobe aos 30 s, desce aos 100 s.
    for (let i = 0; i < TETO_DE_DECISOES; i += 1) {
      sessao.segundos(95, { ...NO_AR, fpsCodificado: 60 }).segundos(5, { ...CPU, fpsCodificado: 50 })
    }
    expect(sessao.estado.queimados).toEqual([])
    expect(sessao.estado.decisoes).toHaveLength(TETO_DE_DECISOES)
    expect(sessao.estado.decisoes.at(-1)).toMatchObject({ de: null, para: 45, motivo: 'cpu' })
  })

  it('descreve o degrau como a pessoa lê: de → para, unidade e motivo', () => {
    expect(descreverDegrau(QUADROS, GOVERNADOR_PARADO)).toBeNull()

    const quadros = new Sessao(QUADROS).segundos(5, CPU)
    expect(descreverDegrau(QUADROS, quadros.estado)).toEqual({ transicao: '60 → 30 fps', degrau: '30', motivo: 'CPU' })

    const resolucao = new Sessao(RESOLUCAO).segundos(10, { ...NO_AR, limitadoPor: 'banda', altura: 810 })
    expect(descreverDegrau(RESOLUCAO, resolucao.estado)).toEqual({ transicao: '1080p → 720p', degrau: '720p', motivo: 'banda' })

    const nativa = { ...RESOLUCAO, resolucao: 'nativa' as const }
    const emNativa = new Sessao(nativa).segundos(10, { ...NO_AR, limitadoPor: 'banda', alturaDaCaptura: 1200, altura: 900 })
    expect(descreverDegrau(nativa, emNativa.estado)?.transicao).toBe('nativa → 720p')
  })
})


/**
 * Cedendo resolução (540 de 1080) e com a assinatura de encoder **incapaz**: 700 kbps de um teto
 * de 8000 e 12 dos 60 quadros da fonte. É o retrato do caso medido, e é o que o governador exige
 * para gastar a correção de codec — CPU apertada sozinha não basta.
 */
const CEDENDO: Parcial = { ...NO_AR, altura: 540, kbps: 700, fpsCodificado: 12, fpsCaptura: 60 }
/** Cedendo resolução por CPU, mas entregando bem: caso de degrau, nunca de trocar codec. */
const CEDENDO_SEM_SER_INCAPAZ: Parcial = { ...NO_AR, altura: 540, kbps: 6_000, fpsCodificado: 55, fpsCaptura: 60 }
/** A assinatura de encoder afogado, sem `limitadoPor`: é o que o Firefox entrega. */
const AFOGADO_SEM_MOTIVO: Parcial = { ...CEDENDO, limitadoPor: null, kbps: 700, fpsCodificado: 12, fpsCaptura: 60 }

describe('governador: eixo de codec', () => {
  it('sob cpu, troca o codec antes de ceder degrau', () => {
    const sessao = new Sessao(JOGO).comCandidato('vp9').segundos(5, { ...CEDENDO, limitadoPor: 'cpu' })
    expect(sessao.estado.codec).toBe('vp9')
    expect(sessao.estado.codecCorrigido).toBe(true)
    expect(sessao.degrau).toBeNull()
  })

  it('corrige uma vez só: a segunda janela ruim cede degrau', () => {
    const sessao = new Sessao(JOGO).comCandidato('vp9').segundos(5, { ...CEDENDO, limitadoPor: 'cpu' })
    expect(sessao.estado.codec).toBe('vp9')

    sessao.comCandidato('h264').segundos(5, { ...CEDENDO, limitadoPor: 'cpu' })
    expect(sessao.estado.codec).toBe('vp9')
    expect(sessao.degrau).not.toBeNull()
  })

  it('não troca codec sob banda — lá o teto é o eixo barato', () => {
    const sessao = new Sessao(JOGO).comCandidato('vp9').segundos(5, { ...CEDENDO, limitadoPor: 'banda' })
    expect(sessao.estado.codec).toBeNull()
    expect(sessao.estado.tetoKbps).not.toBeNull()
  })

  it('encoder apertado mas entregando bem cede degrau, e não gasta a correção de codec', () => {
    const sessao = new Sessao(JOGO).comCandidato('vp9').segundos(5, { ...CEDENDO_SEM_SER_INCAPAZ, limitadoPor: 'cpu' })
    expect(sessao.estado.codec).toBeNull()
    expect(sessao.estado.codecCorrigido).toBe(false)
    expect(sessao.degrau).not.toBeNull()
  })

  it('sem candidato não troca nada, e o degrau segue seu curso', () => {
    const sessao = new Sessao(JOGO).comCandidato(null).segundos(5, { ...CEDENDO, limitadoPor: 'cpu' })
    expect(sessao.estado.codec).toBeNull()
    expect(sessao.degrau).not.toBeNull()
  })

  it('a inferência entra quando o navegador não informa o motivo', () => {
    const sessao = new Sessao(JOGO).comCandidato('vp9').segundos(5, AFOGADO_SEM_MOTIVO)
    expect(sessao.estado.codec).toBe('vp9')
    expect(sessao.estado.motivo).toBe('cpu')
  })

  it('o motivo nativo vence a inferência', () => {
    // A amostra tem a assinatura de cpu, mas o navegador diz banda: quem manda é a medida.
    const sessao = new Sessao(JOGO).comCandidato('vp9').segundos(5, { ...AFOGADO_SEM_MOTIVO, limitadoPor: 'banda' })
    expect(sessao.estado.motivo).toBe('banda')
    expect(sessao.estado.codec).toBeNull()
  })

  it('o codec corrigido sobrevive a zerar — quem zera é o pedido, não a máquina', () => {
    const sessao = new Sessao(JOGO).comCandidato('vp9').segundos(5, { ...CEDENDO, limitadoPor: 'cpu' })
    const zerado = zerarGovernador(sessao.historico, sessao.estado)
    expect(zerado.codec).toBe('vp9')
    expect(zerado.codecCorrigido).toBe(true)
    expect(zerado.degrau).toBeNull()
    expect(zerado.tetoKbps).toBeNull()
  })

  it('parar de transmitir esquece o codec: a próxima partida consulta a máquina de novo', () => {
    expect(GOVERNADOR_PARADO.codec).toBeNull()
    expect(GOVERNADOR_PARADO.codecCorrigido).toBe(false)
  })

  it('perfilEfetivo sobrepõe o codec como sobrepõe o teto', () => {
    const estado: EstadoDoGovernador = { ...GOVERNADOR_PARADO, codec: 'vp9' }
    expect(perfilEfetivo(JOGO, estado).codec).toBe('vp9')
    expect(perfilEfetivo(JOGO, GOVERNADOR_PARADO).codec).toBe(JOGO.codec)
  })
})
