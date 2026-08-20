import { Injectable } from '@nestjs/common'

// Bem maior que qualquer janela em uso hoje (60s para criar/entrar, 30s para senha errada) —
// só varre chave que está genuinamente morta, nunca uma ainda dentro da própria janela.
const TEMPO_MAXIMO_OCIOSO_MS = 10 * 60_000

/**
 * Janela deslizante em memória do processo — não sobrevive a reinício nem se compartilha entre
 * instâncias (app de amigos, um processo só; se isso mudar, o freio muda de casa). Relógio
 * injetado no construtor (não em `permite`) para o teste controlar o tempo sem timers reais e
 * sem precisar passá-lo em toda chamada.
 *
 * Usado em três pontos com chave e limites diferentes: criar sala (10/min por IP), entrar
 * (30/min por IP) e senha errada (5 por par IP+slug, janela de 30s) — a chave já carrega o
 * escopo, `permite` não sabe nem precisa saber qual dos três é.
 *
 * Sem faxina, o Map só cresce: um IP que aparece uma vez e nunca mais volta deixa o próprio
 * histórico (velho, mas não vazio) parado ali para sempre — nada revisita aquela chave para
 * filtrar. Por isso toda chamada varre o Map inteiro por chaves ociosas há mais que qualquer
 * janela real usada no app; O(nº de chaves distintas) é irrelevante na escala deste app.
 */
@Injectable()
export class Freio {
  private readonly tentativas = new Map<string, number[]>()

  constructor(private readonly agora: () => number = Date.now) {}

  permite(chave: string, limite: number, janelaMs: number): boolean {
    const agora = this.agora()
    this.varrerOciosos(agora)

    const inicioDaJanela = agora - janelaMs
    const historico = (this.tentativas.get(chave) ?? []).filter((t) => t > inicioDaJanela)

    if (historico.length >= limite) {
      this.tentativas.set(chave, historico)
      return false
    }

    historico.push(agora)
    this.tentativas.set(chave, historico)
    return true
  }

  /** Só para teste inspecionar que a faxina realmente reduz o número de chaves guardadas. */
  get tamanho(): number {
    return this.tentativas.size
  }

  private varrerOciosos(agora: number): void {
    for (const [chave, historico] of this.tentativas) {
      const maisRecente = historico[historico.length - 1] ?? -Infinity
      if (agora - maisRecente > TEMPO_MAXIMO_OCIOSO_MS) this.tentativas.delete(chave)
    }
  }
}
