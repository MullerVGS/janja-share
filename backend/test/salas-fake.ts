import { LivekitRoomProvider, ParticipanteSala, SalaNoSfu } from '../src/shared/livekit/livekit-room.provider'
import { SfuIndisponivel } from '../src/shared/erros'

/**
 * Dublê do SFU para os e2e de salas/ — nenhum LiveKit real está de pé nos testes. Controlado
 * inteiramente pelo próprio spec (salasAtuais, deveFalhar); estende LivekitRoomProvider (não
 * uma classe solta) para o TypeScript aceitar a injeção onde o tipo concreto é esperado —
 * `cache` é privado na base e nunca é tocado aqui, então a herança não vaza nada.
 */
export class LivekitRoomProviderFalso extends LivekitRoomProvider {
  salasAtuais: SalaNoSfu[] = []
  deveFalhar = false

  override async listarSalas(): Promise<SalaNoSfu[]> {
    if (this.deveFalhar) throw new SfuIndisponivel()
    return this.salasAtuais
  }

  override async participantes(slug: string): Promise<ParticipanteSala[]> {
    if (this.deveFalhar) throw new SfuIndisponivel()
    const sala = this.salasAtuais.find((s) => s.slug === slug)
    return (sala?.pessoas ?? []).map((nome) => ({ identidade: `${nome}-fake01`, nome, publicandoTela: false }))
  }

  override async criarSala(dados: { slug: string; nomeDaSala: string }): Promise<void> {
    if (this.deveFalhar) throw new SfuIndisponivel()
    this.salasAtuais.push({ slug: dados.slug, nome: dados.nomeDaSala, pessoas: [], telasNoAr: 0, cheia: false })
  }
}
