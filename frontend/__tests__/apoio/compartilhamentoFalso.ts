import { vi } from 'vitest'
import { GOVERNADOR_PARADO } from '../../src/sala/governador'
import { PERFIL_PADRAO } from '../../src/sala/qualidade'
import type { Compartilhamento } from '../../src/sala/useCompartilhamento'

/**
 * O compartilhamento de tela como a UI o vê, sem SDK por baixo. Cada teste sobrescreve só o
 * que a sua pergunta exige — e um campo novo no contrato aparece aqui uma vez, não em cada spec.
 */
export function compartilhamentoFalso(parcial: Partial<Compartilhamento> = {}): Compartilhamento {
  const perfil = parcial.perfil ?? PERFIL_PADRAO
  return {
    ativo: false,
    perfil,
    definirPerfil: vi.fn(),
    perfilEfetivo: perfil,
    automatico: true,
    definirAutomatico: vi.fn(),
    governador: GOVERNADOR_PARADO,
    relatorio: null,
    codecPendente: null,
    audioDaTela: null,
    alternarAudioDaTela: vi.fn(async () => {}),
    erro: null,
    ocupado: false,
    alternar: vi.fn(async () => {}),
    reiniciar: vi.fn(async () => {}),
    trocarDeTela: vi.fn(async () => {}),
    adotar: vi.fn(async () => {}),
    trocandoTela: false,
    ...parcial,
  }
}
