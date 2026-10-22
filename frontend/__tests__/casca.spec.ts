import { ConnectionQuality, ConnectionState } from 'livekit-client'
import { afterEach, describe, expect, it } from 'vitest'
import { abreGrupo, JANELA_DO_GRUPO_MS } from '../src/sala/chat'
import { estadoDaConexao, PRESO_SEM_ROTA_MS } from '../src/sala/estadoDaConexao'
import { arranjoDaGrade } from '../src/sala/grade'
import { LIMITE_DE_PESSOAS_PARA_SONS, somDaMudanca } from '../src/sala/sons'
import { tituloDaAba } from '../src/sala/tituloDaAba'
import { caminhoMascarado, CHAVE_DA_MASCARA, desmascarar, mascarar, restaurarEnderecoMascarado } from '../src/salas/mascara'
import { CORES_DE_AVATAR, corDoNome } from '../src/ui/avatares'

describe('arranjoDaGrade', () => {
  it('um quadro ocupa o que der na proporção 16:9', () => {
    expect(arranjoDaGrade(1, 1600, 900, 8)).toEqual({ colunas: 1, largura: 1600, altura: 900 })
    // Área mais alta que 16:9: quem limita é a largura.
    expect(arranjoDaGrade(1, 800, 900, 8)).toEqual({ colunas: 1, largura: 800, altura: 450 })
  })

  it('quatro quadros numa área larga viram 2×2, não 4×1', () => {
    const arranjo = arranjoDaGrade(4, 1000, 600, 8)
    expect(arranjo.colunas).toBe(2)
    // Duas colunas: quem limita é a largura, (1000 − 8) / 2.
    expect(arranjo.largura).toBe(496)
  })

  it('numa coluna estreita e alta, os quadros empilham', () => {
    expect(arranjoDaGrade(3, 360, 900, 8).colunas).toBe(1)
  })

  it('sem área ou sem quadros, tamanho zero', () => {
    expect(arranjoDaGrade(0, 1000, 600).largura).toBe(0)
    expect(arranjoDaGrade(3, 0, 0).largura).toBe(0)
  })
})

describe('somDaMudanca', () => {
  const base = { pessoas: ['ana', 'bia'], telas: [] as string[] }

  it('uma Tela começando vence alguém entrando na mesma mudança', () => {
    expect(somDaMudanca(base, { pessoas: ['ana', 'bia', 'caio'], telas: ['bia'] })).toBe('telaComecou')
  })

  it('terminar uma Tela, entrar e sair, cada um com o seu som', () => {
    expect(somDaMudanca({ ...base, telas: ['bia'] }, base)).toBe('telaTerminou')
    expect(somDaMudanca(base, { ...base, pessoas: ['ana', 'bia', 'caio'] })).toBe('entrou')
    expect(somDaMudanca(base, { ...base, pessoas: ['ana'] })).toBe('saiu')
    expect(somDaMudanca(base, base)).toBeNull()
  })

  it('numa sala com mais de 25 pessoas, entrar e sair não tocam; Tela sim', () => {
    const muitas = Array.from({ length: LIMITE_DE_PESSOAS_PARA_SONS + 1 }, (_, i) => `p${i}`)
    expect(somDaMudanca({ pessoas: muitas, telas: [] }, { pessoas: [...muitas, 'nova'], telas: [] })).toBeNull()
    expect(somDaMudanca({ pessoas: muitas, telas: [] }, { pessoas: muitas, telas: ['p1'] })).toBe('telaComecou')
  })
})

describe('tituloDaAba', () => {
  it('fora de sala é só o produto', () => {
    expect(tituloDaAba({})).toBe('janja-share')
  })

  it('na sala: não lidas, ao vivo e o nome, nessa ordem', () => {
    expect(tituloDaAba({ nomeDaSala: 'Eclipse' })).toBe('Eclipse · janja-share')
    expect(tituloDaAba({ nomeDaSala: 'Eclipse', aoVivo: true, naoLidas: 3 })).toBe('(3) ● ao vivo · Eclipse · janja-share')
    expect(tituloDaAba({ nomeDaSala: 'Eclipse', naoLidas: 120 })).toBe('(99+) Eclipse · janja-share')
  })
})

describe('estadoDaConexao', () => {
  it('conectado é verde, e as barrinhas dizem a qualidade medida', () => {
    const bom = estadoDaConexao(ConnectionState.Connected, ConnectionQuality.Excellent, 0)
    expect(bom).toMatchObject({ rotulo: 'Voz conectada', tom: 'bom', sinal: 'bom' })
    expect(estadoDaConexao(ConnectionState.Connected, ConnectionQuality.Poor, 0).sinal).toBe('medio')
    expect(estadoDaConexao(ConnectionState.Connected, ConnectionQuality.Lost, 0).sinal).toBe('ruim')
  })

  it('conectando é amarelo; preso por 10 s vira "Sem rota" com o que fazer', () => {
    expect(estadoDaConexao(ConnectionState.Connecting, undefined, 0)).toMatchObject({ rotulo: 'Conectando', tom: 'medio' })
    const preso = estadoDaConexao(ConnectionState.Connecting, undefined, PRESO_SEM_ROTA_MS)
    expect(preso).toMatchObject({ rotulo: 'Sem rota', tom: 'ruim' })
    expect(preso.explicacao).toMatch(/Sua rede parece bloquear a mídia/)
  })

  it('reconectando e desconectado têm explicação própria', () => {
    expect(estadoDaConexao(ConnectionState.Reconnecting, undefined, 0).rotulo).toBe('Reconectando')
    expect(estadoDaConexao(ConnectionState.Disconnected, undefined, 0)).toMatchObject({ rotulo: 'Desconectado', tom: 'ruim' })
  })
})

describe('abreGrupo', () => {
  it('mesma pessoa em sequência continua o grupo; outra pessoa ou 7 min depois abre outro', () => {
    const ana = { nome: 'Ana', texto: 'a', ts: 0 }
    expect(abreGrupo(undefined, ana)).toBe(true)
    expect(abreGrupo(ana, { ...ana, ts: 60_000 })).toBe(false)
    expect(abreGrupo(ana, { ...ana, nome: 'Bia' })).toBe(true)
    expect(abreGrupo(ana, { ...ana, ts: JANELA_DO_GRUPO_MS + 1 })).toBe(true)
  })
})

describe('corDoNome', () => {
  it('o mesmo nome dá sempre a mesma cor, de uma paleta de seis', () => {
    expect(corDoNome('Ana')).toBe(corDoNome(' ana '))
    expect(CORES_DE_AVATAR).toContain(corDoNome('Bia'))
  })
})

describe('máscara do endereço da Sala privada', () => {
  afterEach(() => {
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('troca o sufixo sorteado por "oculta" e devolve o verdadeiro ao desmascarar', () => {
    window.history.replaceState(null, '', '/sala/eclipse-c0ffee?k=a.b')
    mascarar('eclipse-c0ffee', '/sala/eclipse-c0ffee?k=a.b')
    expect(window.location.pathname).toBe(caminhoMascarado('eclipse-c0ffee'))
    expect(window.location.pathname).toBe('/sala/eclipse-oculta')
    expect(window.location.search).toBe('')

    desmascarar()
    expect(`${window.location.pathname}${window.location.search}`).toBe('/sala/eclipse-c0ffee?k=a.b')
    expect(sessionStorage.getItem(CHAVE_DA_MASCARA)).toBeNull()
  })

  it('o F5 com a barra mascarada volta ao endereço verdadeiro antes do roteador ler', () => {
    mascarar('eclipse-c0ffee', '/sala/eclipse-c0ffee?k=a.b')
    restaurarEnderecoMascarado()
    expect(`${window.location.pathname}${window.location.search}`).toBe('/sala/eclipse-c0ffee?k=a.b')
  })

  it('desmascarar depois de navegar para outro lugar não puxa a pessoa de volta', () => {
    mascarar('eclipse-c0ffee', '/sala/eclipse-c0ffee?k=a.b')
    window.history.replaceState(null, '', '/')
    desmascarar()
    expect(window.location.pathname).toBe('/')
  })
})
