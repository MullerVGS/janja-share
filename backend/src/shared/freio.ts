import { Injectable } from '@nestjs/common'

/**
 * Janela deslizante em memória do processo — não sobrevive a reinício nem se compartilha entre
 * instâncias (app de amigos, um processo só; se isso mudar, o freio muda de casa). Relógio
 * injetado no construtor (não em `permite`) para o teste controlar o tempo sem timers reais e
 * sem precisar passá-lo em toda chamada.
 *
 * Usado em três pontos com chave e limites diferentes: criar sala (10/min por IP), entrar
 * (30/min por IP) e senha errada (5 por par IP+slug, janela de 30s) — a chave já carrega o
 * escopo, `permite` não sabe nem precisa saber qual dos três é.
 */
@Injectable()
export class Freio {
  private readonly tentativas = new Map<string, number[]>()

  constructor(private readonly agora: () => number = Date.now) {}

  permite(chave: string, limite: number, janelaMs: number): boolean {
    const agora = this.agora()
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
}
