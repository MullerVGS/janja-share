import { LivekitRoomProvider, ParticipanteSala, SalaNoSfu } from '../src/shared/livekit/livekit-room.provider'
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
    const sala = this.salasAtuais.find((s) => s.nomeNoSfu === nomeNoSfu)
    return (sala?.pessoas ?? []).map((nome) => ({ identidade: `${nome}-fake01`, nome, publicandoTela: false }))
  }

  override async criarSala(dados: { slug: string; nomeDaSala: string; privada: boolean }): Promise<string> {
    if (this.deveFalhar) throw new SfuIndisponivel()
    const nomeNoSfu = `${dados.slug}-fake${this.proximoNonce++}`
    this.salasAtuais.push({
      slug: dados.slug,
      nomeNoSfu,
      nome: dados.nomeDaSala,
      privada: dados.privada,
      pessoas: [],
      telasNoAr: 0,
      cheia: false,
    })
    return nomeNoSfu
  }
}
