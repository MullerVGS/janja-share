import { describe, expect, it } from 'vitest'
import {
  desempacotar,
  empacotar,
  inserirEmOrdem,
  LIMITE_DO_TEXTO,
  TETO_DE_MENSAGENS,
  type MensagemNaTela,
} from '../src/sala/chat'

function naTela(ts: number, texto: string): MensagemNaTela {
  return { id: texto, nome: 'Bia', texto, ts, propria: false }
}

function bytes(valor: unknown): Uint8Array {
  return new TextEncoder().encode(typeof valor === 'string' ? valor : JSON.stringify(valor))
}

describe('payload do chat', () => {
  it('vai e volta inteiro', () => {
    const mensagem = { nome: 'Ana', texto: 'oi', ts: 1_700_000_000_000 }
    expect(desempacotar(empacotar(mensagem))).toEqual(mensagem)
  })

  it('recusa o que não é mensagem', () => {
    expect(desempacotar(bytes('{{{'))).toBeNull()
    expect(desempacotar(bytes(null))).toBeNull()
    expect(desempacotar(bytes(['a']))).toBeNull()
    expect(desempacotar(bytes({ nome: 'Bia' }))).toBeNull()
    expect(desempacotar(bytes({ nome: 7, texto: 'oi' }))).toBeNull()
    expect(desempacotar(bytes({ nome: 'Bia', texto: '   ' }))).toBeNull()
  })

  it('trunca texto e nome de um par malcomportado', () => {
    const mensagem = desempacotar(bytes({ nome: 'n'.repeat(200), texto: 't'.repeat(5000), ts: 1 }))
    expect(mensagem?.texto).toHaveLength(LIMITE_DO_TEXTO)
    expect(mensagem?.nome).toHaveLength(40)
  })

  it('sem ts usável, carimba a chegada em vez de descartar', () => {
    const antes = Date.now()
    const mensagem = desempacotar(bytes({ nome: 'Bia', texto: 'oi', ts: 'ontem' }))
    expect(mensagem?.ts).toBeGreaterThanOrEqual(antes)
  })
})

describe('ordenação da lista', () => {
  it('põe cada mensagem no lugar do seu ts', () => {
    let lista: MensagemNaTela[] = []
    lista = inserirEmOrdem(lista, naTela(300, 'c'))
    lista = inserirEmOrdem(lista, naTela(100, 'a'))
    lista = inserirEmOrdem(lista, naTela(200, 'b'))

    expect(lista.map((mensagem) => mensagem.texto)).toEqual(['a', 'b', 'c'])
  })

  it('empate mantém a ordem de chegada', () => {
    let lista: MensagemNaTela[] = []
    lista = inserirEmOrdem(lista, naTela(100, 'primeira'))
    lista = inserirEmOrdem(lista, naTela(100, 'segunda'))

    expect(lista.map((mensagem) => mensagem.texto)).toEqual(['primeira', 'segunda'])
  })

  it('não muta a lista recebida', () => {
    const original = [naTela(100, 'a')]
    const nova = inserirEmOrdem(original, naTela(200, 'b'))

    expect(original).toHaveLength(1)
    expect(nova).toHaveLength(2)
  })

  it('descarta o começo ao passar do teto — chat efêmero não guarda histórico', () => {
    let lista: MensagemNaTela[] = []
    for (let indice = 0; indice < TETO_DE_MENSAGENS + 5; indice += 1) {
      lista = inserirEmOrdem(lista, naTela(indice, `m${indice}`))
    }

    expect(lista).toHaveLength(TETO_DE_MENSAGENS)
    expect(lista[0]?.texto).toBe('m5')
    expect(lista[lista.length - 1]?.texto).toBe(`m${TETO_DE_MENSAGENS + 4}`)
  })
})
