import { describe, expect, it } from 'vitest'
import { decidirFoco, FOCO_INICIAL, type EstadoDoFoco } from '../src/sala/foco'
import type { Palco, Peca } from '../src/sala/palco'

function peca(parcial: Partial<Peca> & { chave: string }): Peca {
  return {
    identidade: parcial.chave,
    nome: parcial.chave,
    ehTela: true,
    proprio: false,
    microfoneLigado: false,
    falando: false,
    temAudio: false,
    ...parcial,
  }
}

function palco(telas: Peca[], pessoas: Peca[] = []): Palco {
  return { telas, pessoas }
}

describe('decidirFoco: entrar na sala', () => {
  it('com tela no ar, foca a primeira do palco', () => {
    const primeira = peca({ chave: 'tela:a' })
    const nova = peca({ chave: 'tela:b' })
    const resultado = decidirFoco(FOCO_INICIAL, palco([primeira, nova]), { tipo: 'palcoMudou', telasAntes: [] })
    expect(resultado).toEqual({ chave: 'tela:a', soltoPelaPessoa: false })
  })

  it('sem tela nenhuma, fica na grade', () => {
    const resultado = decidirFoco(FOCO_INICIAL, palco([]), { tipo: 'palcoMudou', telasAntes: [] })
    expect(resultado).toEqual(FOCO_INICIAL)
  })
})

describe('decidirFoco: clique', () => {
  it('clicar no palco solta o foco e marca soltoPelaPessoa', () => {
    const estado: EstadoDoFoco = { chave: 'tela:a', soltoPelaPessoa: false }
    const resultado = decidirFoco(estado, palco([peca({ chave: 'tela:a' })]), { tipo: 'clicouNoPalco' })
    expect(resultado).toEqual({ chave: null, soltoPelaPessoa: true })
  })

  it('clicar numa peça foca nela e desmarca soltoPelaPessoa, mesmo vindo de um solto de propósito', () => {
    const estado: EstadoDoFoco = { chave: null, soltoPelaPessoa: true }
    const resultado = decidirFoco(estado, palco([peca({ chave: 'tela:a' })]), { tipo: 'clicouNaPeca', chave: 'tela:a' })
    expect(resultado).toEqual({ chave: 'tela:a', soltoPelaPessoa: false })
  })

  it('vale para peça de pessoa também, não só tela', () => {
    const resultado = decidirFoco(FOCO_INICIAL, palco([], [peca({ chave: 'pessoa:bea', ehTela: false })]), {
      tipo: 'clicouNaPeca',
      chave: 'pessoa:bea',
    })
    expect(resultado).toEqual({ chave: 'pessoa:bea', soltoPelaPessoa: false })
  })
})

describe('decidirFoco: tela nova não rouba foco', () => {
  it('quem está em foco continua em foco quando uma tela nova sobe', () => {
    const estado: EstadoDoFoco = { chave: 'tela:a', soltoPelaPessoa: false }
    const resultado = decidirFoco(estado, palco([peca({ chave: 'tela:a' }), peca({ chave: 'tela:b' })]), {
      tipo: 'palcoMudou',
      telasAntes: ['tela:a'],
    })
    expect(resultado).toEqual(estado)
  })

  it('quem soltou de propósito continua na grade quando uma tela nova sobe', () => {
    const estado: EstadoDoFoco = { chave: null, soltoPelaPessoa: true }
    const resultado = decidirFoco(estado, palco([peca({ chave: 'tela:a' })]), { tipo: 'palcoMudou', telasAntes: [] })
    expect(resultado).toEqual(estado)
  })

  it('sem ninguém em foco e ninguém tendo soltado, a tela nova assume', () => {
    const resultado = decidirFoco(FOCO_INICIAL, palco([peca({ chave: 'tela:a' })]), { tipo: 'palcoMudou', telasAntes: [] })
    expect(resultado).toEqual({ chave: 'tela:a', soltoPelaPessoa: false })
  })
})

describe('decidirFoco: exceção da tela própria', () => {
  it('a própria tela nova assume o palco mesmo com outra peça em foco', () => {
    const estado: EstadoDoFoco = { chave: 'tela:a', soltoPelaPessoa: false }
    const propria = peca({ chave: 'tela:eu', proprio: true })
    const resultado = decidirFoco(estado, palco([peca({ chave: 'tela:a' }), propria]), {
      tipo: 'palcoMudou',
      telasAntes: ['tela:a'],
    })
    expect(resultado).toEqual({ chave: 'tela:eu', soltoPelaPessoa: false })
  })

  it('a própria tela nova assume mesmo quando a pessoa tinha soltado de propósito', () => {
    const estado: EstadoDoFoco = { chave: null, soltoPelaPessoa: true }
    const propria = peca({ chave: 'tela:eu', proprio: true })
    const resultado = decidirFoco(estado, palco([propria]), { tipo: 'palcoMudou', telasAntes: [] })
    expect(resultado).toEqual({ chave: 'tela:eu', soltoPelaPessoa: false })
  })

  it('uma tela própria que já estava no ar não rouba o foco de novo (não é "nova")', () => {
    const propria = peca({ chave: 'tela:eu', proprio: true })
    const outra = peca({ chave: 'tela:a' })
    const estado: EstadoDoFoco = { chave: 'tela:a', soltoPelaPessoa: false }
    const resultado = decidirFoco(estado, palco([propria, outra]), {
      tipo: 'palcoMudou',
      telasAntes: ['tela:eu', 'tela:a'],
    })
    expect(resultado).toEqual(estado)
  })
})

describe('decidirFoco: peça em foco que sai', () => {
  it('sem outra tela no ar, devolve para a grade sem marcar soltoPelaPessoa, e a próxima tela a subir assume', () => {
    const estado: EstadoDoFoco = { chave: 'tela:a', soltoPelaPessoa: false }

    const semAMinhaTela = decidirFoco(estado, palco([]), { tipo: 'palcoMudou', telasAntes: ['tela:a'] })
    expect(semAMinhaTela).toEqual({ chave: null, soltoPelaPessoa: false })

    const proxima = peca({ chave: 'tela:b' })
    const comTelaNova = decidirFoco(semAMinhaTela, palco([proxima]), { tipo: 'palcoMudou', telasAntes: [] })
    expect(comTelaNova).toEqual({ chave: 'tela:b', soltoPelaPessoa: false })
  })

  it('havendo outra tela viva, ela assume na mesma passada — ninguém fica na grade com tela no ar', () => {
    const estado: EstadoDoFoco = { chave: 'tela:a', soltoPelaPessoa: false }
    const resultado = decidirFoco(estado, palco([peca({ chave: 'tela:b' })]), {
      tipo: 'palcoMudou',
      telasAntes: ['tela:a', 'tela:b'],
    })
    expect(resultado).toEqual({ chave: 'tela:b', soltoPelaPessoa: false })
  })

  it('a pessoa em foco que sai da sala não promove ninguém quando não há tela no ar', () => {
    const estado: EstadoDoFoco = { chave: 'pessoa:bea', soltoPelaPessoa: false }
    const resultado = decidirFoco(estado, palco([], [peca({ chave: 'pessoa:eu', ehTela: false })]), {
      tipo: 'palcoMudou',
      telasAntes: [],
    })
    expect(resultado).toEqual({ chave: null, soltoPelaPessoa: false })
  })
})
