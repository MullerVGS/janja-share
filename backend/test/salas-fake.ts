import { LivekitRoomProvider, MetadataDaSala, ParticipanteSala, SalaNoSfu } from '../src/shared/livekit/livekit-room.provider'
import { SfuIndisponivel } from '../src/shared/erros'

/**
 * Dublê do SFU para os e2e de salas/ — nenhum LiveKit real está de pé nos testes. Controlado
 * inteiramente pelo próprio spec (salasAtuais, deveFalhar); estende LivekitRoomProvider (não
 * uma classe solta) para o TypeScript aceitar a injeção onde o tipo concreto é esperado —
 * `cache` é privado na base e nunca é tocado aqui, então a herança não vaza nada.
 *
 * `criarSala` devolve um `nomeNoSfu` sintético (`<slug>-fakeN`) diferente do slug, do mesmo
 * jeito que o provider real gera `<slug>-<nonce>` — os testes que decodificam o JWT
 * e conferem `video.room` provam que o use case usa esse valor, não o slug bonito.
 */
export class LivekitRoomProviderFalso extends LivekitRoomProvider {
  salasAtuais: SalaNoSfu[] = []
  deveFalhar = false
  /**
   * Quem está conectado em cada encarnação, por `nomeNoSfu`, com a identidade do token. Sem
   * entrada aqui, `participantes()` deriva do `pessoas` da sala (identidade sintética).
   */
  presentes: Record<string, ParticipanteSala[]> = {}
  /** O último metadata gravado por `ajustarSala`, por `nomeNoSfu` — o que o SFU entregaria a quem está dentro. */
  metadataGravado: Record<string, MetadataDaSala> = {}
  /** Quanto o `createRoom` demora, em ms — o que abre a janela de corrida entre dois pedidos. */
  atrasoDeCriarMs = 0
  private proximoNonce = 1

  override async listarSalas(): Promise<SalaNoSfu[]> {
    if (this.deveFalhar) throw new SfuIndisponivel()
    return this.salasAtuais
  }

  override async listarSalasSemCache(): Promise<SalaNoSfu[]> {
    return this.listarSalas()
  }

  override async participantes(nomeNoSfu: string): Promise<ParticipanteSala[]> {
    if (this.deveFalhar) throw new SfuIndisponivel()
    const presentes = this.presentes[nomeNoSfu]
    if (presentes) return presentes
    const sala = this.salasAtuais.find((s) => s.nomeNoSfu === nomeNoSfu)
    return (sala?.pessoas ?? []).map((nome) => ({ identidade: `${nome}-fake01`, nome, publicandoTela: false }))
  }

  override async criarSala(dados: { slug: string; nomeDaSala: string; privada: boolean; fixa: boolean }): Promise<string> {
    if (this.deveFalhar) throw new SfuIndisponivel()
    if (this.atrasoDeCriarMs > 0) await new Promise((pronto) => setTimeout(pronto, this.atrasoDeCriarMs))
    const nomeNoSfu = `${dados.slug}-fake${this.proximoNonce++}`
    this.salasAtuais.push({
      slug: dados.slug,
      nomeNoSfu,
      nome: dados.nomeDaSala,
      privada: dados.privada,
      fixa: dados.fixa,
      pessoas: [],
      telasNoAr: 0,
      cheia: false,
    })
    return nomeNoSfu
  }

  override async ajustarSala(nomeNoSfu: string, metadata: MetadataDaSala): Promise<void> {
    if (this.deveFalhar) throw new SfuIndisponivel()
    this.metadataGravado[nomeNoSfu] = metadata
    const sala = this.salasAtuais.find((s) => s.nomeNoSfu === nomeNoSfu)
    if (!sala) return
    Object.assign(sala, {
      slug: metadata.slug,
      nome: metadata.nome,
      privada: metadata.privada,
      fixa: metadata.fixa,
      anteriores: metadata.anteriores,
    })
  }
}
