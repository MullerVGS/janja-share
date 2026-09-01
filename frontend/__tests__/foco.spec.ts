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
  it('com tela no ar, põe a primeira do palco em destaque', () => {
    const primeira = peca({ chave: 'tela:a' })
    const nova = peca({ chave: 'tela:b' })
    const resultado = decidirFoco(FOCO_INICIAL, palco([primeira, nova]), { tipo: 'palcoMudou', telasAntes: [] })
    expect(resultado).toEqual({ chave: 'tela:a' })
  })

  it('sem tela nenhuma, o destaque fica vago — quem desenha resolve o padrão', () => {
    const resultado = decidirFoco(FOCO_INICIAL, palco([]), { tipo: 'palcoMudou', telasAntes: [] })
    expect(resultado).toEqual(FOCO_INICIAL)
  })
})

describe('decidirFoco: clique', () => {
  it('clicar numa peça a põe em destaque', () => {
    const estado: EstadoDoFoco = { chave: 'tela:a' }
    const resultado = decidirFoco(estado, palco([peca({ chave: 'tela:a' }), peca({ chave: 'tela:b' })]), {
      tipo: 'clicouNaPeca',
      chave: 'tela:b',
    })
    expect(resultado).toEqual({ chave: 'tela:b' })
  })

  it('vale para peça de pessoa também, não só tela — câmera aberta é imagem como qualquer outra', () => {
    const resultado = decidirFoco(FOCO_INICIAL, palco([], [peca({ chave: 'pessoa:bea', ehTela: false })]), {
      tipo: 'clicouNaPeca',
      chave: 'pessoa:bea',
    })
    expect(resultado).toEqual({ chave: 'pessoa:bea' })
  })
})

describe('decidirFoco: tela nova não rouba o destaque', () => {
  it('quem está em destaque continua em destaque quando uma tela nova sobe', () => {
    const estado: EstadoDoFoco = { chave: 'tela:a' }
    const resultado = decidirFoco(estado, palco([peca({ chave: 'tela:a' }), peca({ chave: 'tela:b' })]), {
      tipo: 'palcoMudou',
      telasAntes: ['tela:a'],
    })
    expect(resultado).toEqual(estado)
  })

  it('sem ninguém em destaque, a tela nova assume', () => {
    const resultado = decidirFoco(FOCO_INICIAL, palco([peca({ chave: 'tela:a' })]), { tipo: 'palcoMudou', telasAntes: [] })
    expect(resultado).toEqual({ chave: 'tela:a' })
  })
})

describe('decidirFoco: exceção da tela própria', () => {
  it('a própria tela nova assume o palco mesmo com outra peça em destaque', () => {
    const estado: EstadoDoFoco = { chave: 'tela:a' }
    const propria = peca({ chave: 'tela:eu', proprio: true })
    const resultado = decidirFoco(estado, palco([peca({ chave: 'tela:a' }), propria]), {
      tipo: 'palcoMudou',
      telasAntes: ['tela:a'],
    })
    expect(resultado).toEqual({ chave: 'tela:eu' })
  })

  it('uma tela própria que já estava no ar não rouba o destaque de novo (não é "nova")', () => {
    const propria = peca({ chave: 'tela:eu', proprio: true })
    const outra = peca({ chave: 'tela:a' })
    const estado: EstadoDoFoco = { chave: 'tela:a' }
    const resultado = decidirFoco(estado, palco([propria, outra]), {
      tipo: 'palcoMudou',
      telasAntes: ['tela:eu', 'tela:a'],
    })
    expect(resultado).toEqual(estado)
  })
})

describe('decidirFoco: peça em destaque que sai', () => {
  it('sem outra tela no ar, o destaque fica vago — e a próxima tela a subir assume', () => {
    const estado: EstadoDoFoco = { chave: 'tela:a' }

    const semAMinhaTela = decidirFoco(estado, palco([]), { tipo: 'palcoMudou', telasAntes: ['tela:a'] })
    expect(semAMinhaTela).toEqual({ chave: null })

    const proxima = peca({ chave: 'tela:b' })
    const comTelaNova = decidirFoco(semAMinhaTela, palco([proxima]), { tipo: 'palcoMudou', telasAntes: [] })
    expect(comTelaNova).toEqual({ chave: 'tela:b' })
  })

  it('havendo outra tela viva, ela assume na mesma passada — ninguém fica olhando o vazio', () => {
    const estado: EstadoDoFoco = { chave: 'tela:a' }
    const resultado = decidirFoco(estado, palco([peca({ chave: 'tela:b' })]), {
      tipo: 'palcoMudou',
      telasAntes: ['tela:a', 'tela:b'],
    })
    expect(resultado).toEqual({ chave: 'tela:b' })
  })

  it('a pessoa em destaque que sai da sala não promove ninguém quando não há tela no ar', () => {
    const estado: EstadoDoFoco = { chave: 'pessoa:bea' }
    const resultado = decidirFoco(estado, palco([], [peca({ chave: 'pessoa:eu', ehTela: false })]), {
      tipo: 'palcoMudou',
      telasAntes: [],
    })
    expect(resultado).toEqual({ chave: null })
  })
})
