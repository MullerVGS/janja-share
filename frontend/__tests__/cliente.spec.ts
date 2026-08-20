import { describe, expect, it } from 'vitest'
import { ErroDaApi, mensagemDoErro } from '../src/api/cliente'

/**
 * `nome_invalido` (a pessoa) e `nome_da_sala_invalido` (a sala) são códigos distintos porque
 * falham por motivos distintos — um nome de sala `🎮` derrapa no slug, e "1 a 40 caracteres"
 * seria mentira sobre isso. As frases têm que ser diferentes, não a mesma reaproveitada.
 */
describe('frases dos códigos de domínio das salas', () => {
  it.each([
    ['nome_invalido', 'Escolha um nome com 1 a 40 caracteres.'],
    ['sala_existe', 'Já existe uma sala com esse nome — entre nela ou escolha outro.'],
    ['sala_nao_existe', 'Essa sala não existe mais.'],
    ['senha_incorreta', 'Senha incorreta.'],
    ['sala_cheia', 'A sala está cheia.'],
    ['muitas_salas', 'Tem sala demais no ar agora. Tente daqui a pouco.'],
    ['espere', 'Muitas tentativas. Espere alguns segundos.'],
    ['sfu_indisponivel', 'O servidor de mídia não respondeu. Tente de novo em instantes.'],
  ])('%s → %s', (codigo, frase) => {
    expect(mensagemDoErro(new ErroDaApi(400, codigo))).toBe(frase)
  })

  it('nome_da_sala_invalido tem frase própria, diferente da do nome da pessoa', () => {
    const frase = mensagemDoErro(new ErroDaApi(400, 'nome_da_sala_invalido'))
    expect(frase).not.toBe(mensagemDoErro(new ErroDaApi(400, 'nome_invalido')))
    expect(frase.toLowerCase()).not.toContain('1 a 40 caracteres')
  })
})
