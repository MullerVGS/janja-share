import { slugDaSala } from '../src/shared/slug'
import { gerarNomeDeSala } from '../src/salas/nomeAutomatico'

/** Sorteio determinístico: devolve sempre o primeiro item de cada lista. */
const primeiro = () => 0

describe('gerarNomeDeSala', () => {
  it('devolve duas palavras em PT-BR, capitalizadas', () => {
    const nome = gerarNomeDeSala(new Set(), primeiro)
    expect(nome.split(' ')).toHaveLength(2)
    expect(nome).toMatch(/^[A-ZÀ-Ú][a-zà-ú]+ [A-ZÀ-Ú][a-zà-ú]+$/)
  })

  it('o nome sempre vira slug válido', () => {
    const slug = slugDaSala(gerarNomeDeSala(new Set(), primeiro))
    expect(slug).toMatch(/^[a-z0-9-]{1,32}$/)
  })

  it('não devolve nome cujo slug já está em uso', () => {
    const usado = slugDaSala(gerarNomeDeSala(new Set(), primeiro))
    const outro = gerarNomeDeSala(new Set([usado]), primeiro)
    expect(slugDaSala(outro)).not.toBe(usado)
  })

  it('com o sorteio travado e a combinação toda em uso, desempata por sufixo', () => {
    const base = gerarNomeDeSala(new Set(), primeiro)
    const usados = new Set([slugDaSala(base)])
    const segundo = gerarNomeDeSala(usados, primeiro)
    expect(segundo).not.toBe(base)
    expect(slugDaSala(segundo)).not.toBe(slugDaSala(base))
  })

  it('é estável: mesmo sorteio, mesmo resultado', () => {
    expect(gerarNomeDeSala(new Set(), primeiro)).toBe(gerarNomeDeSala(new Set(), primeiro))
  })
})
