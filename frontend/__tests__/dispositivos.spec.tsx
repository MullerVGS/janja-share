import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Room } from 'livekit-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { lerPreferencias } from '../src/preferencias'
import { dispositivosDoTipo, opcoesDeDispositivos, trocarNaSala } from '../src/sala/dispositivos'
import { PainelDaPessoa } from '../src/telas/Casca/PainelDaPessoa'

function aparelho(kind: MediaDeviceKind, deviceId: string, label: string): MediaDeviceInfo {
  return { kind, deviceId, label, groupId: '', toJSON: () => ({}) }
}

const APARELHOS = [
  aparelho('audioinput', 'default', 'Padrão - Microfone do headset'),
  aparelho('audioinput', 'communications', 'Comunicações - Microfone do headset'),
  aparelho('audioinput', 'mic-headset', 'Microfone do headset'),
  aparelho('audioinput', 'mic-notebook', 'Microfone interno'),
  aparelho('audiooutput', 'default', 'Padrão - Alto-falantes'),
  aparelho('audiooutput', 'fone', 'Fone do headset'),
  aparelho('videoinput', 'camera', 'Câmera'),
]

/** `enumerateDevices` e `setSinkId` de mentira; o jsdom não tem nenhum dos dois. */
function habilitarAparelhos(lista: MediaDeviceInfo[]) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { enumerateDevices: async () => lista, addEventListener: () => {}, removeEventListener: () => {} },
    configurable: true,
  })
  Object.defineProperty(HTMLMediaElement.prototype, 'setSinkId', { value: async () => {}, configurable: true })
}

afterEach(() => {
  delete (navigator as { mediaDevices?: unknown }).mediaDevices
  delete (HTMLMediaElement.prototype as { setSinkId?: unknown }).setSinkId
  localStorage.clear()
})

describe('os aparelhos de som', () => {
  it('cada tipo na sua lista, sem os apelidos do Chrome', () => {
    expect(dispositivosDoTipo(APARELHOS, 'microfone')).toEqual([
      { id: 'mic-headset', nome: 'Microfone do headset' },
      { id: 'mic-notebook', nome: 'Microfone interno' },
    ])
    expect(dispositivosDoTipo(APARELHOS, 'saida')).toEqual([{ id: 'fone', nome: 'Fone do headset' }])
  })

  it('sem nome (antes da permissão) fica a posição; sem id não há o que escolher', () => {
    const escondidos = [aparelho('audioinput', '', ''), aparelho('audioinput', 'a1', ''), aparelho('audioinput', 'a2', '')]
    expect(dispositivosDoTipo(escondidos, 'microfone')).toEqual([
      { id: 'a1', nome: 'Microfone 1' },
      { id: 'a2', nome: 'Microfone 2' },
    ])
  })

  it('o padrão do sistema não vira opção da Sala; o escolhido vai como preferência', () => {
    expect(opcoesDeDispositivos('', '')).toEqual({})
    habilitarAparelhos(APARELHOS)
    expect(opcoesDeDispositivos('mic-headset', 'fone')).toEqual({
      audioCaptureDefaults: { deviceId: 'mic-headset' },
      audioOutput: { deviceId: 'fone' },
    })
  })

  it('na Sala, o microfone troca sem exigir o aparelho e o padrão é o `default`', async () => {
    const switchActiveDevice = vi.fn().mockResolvedValue(true)
    const sala = { switchActiveDevice } as unknown as Room
    await trocarNaSala(sala, 'microfone', 'mic-headset')
    await trocarNaSala(sala, 'microfone', '')
    await trocarNaSala(sala, 'saida', 'fone')
    expect(switchActiveDevice.mock.calls).toEqual([
      ['audioinput', 'mic-headset', false],
      ['audioinput', 'default', false],
      ['audiooutput', 'fone'],
    ])
  })
})

describe('as preferências do painel da pessoa', () => {
  it('escolher microfone e saída guarda a escolha e avisa a Sala', async () => {
    habilitarAparelhos(APARELHOS)
    const usuario = userEvent.setup()
    const aoTrocarDispositivo = vi.fn()
    render(
      <PainelDaPessoa
        nome="Ana"
        aoMudarNome={vi.fn()}
        estado="Na sala"
        microfone={null}
        surdo={null}
        aoTrocarDispositivo={aoTrocarDispositivo}
      />,
    )
    await usuario.click(screen.getByRole('button', { name: 'Preferências' }))
    const microfone = screen.getByRole('combobox', { name: 'Microfone' })
    await waitFor(() => expect(screen.getByRole('option', { name: 'Microfone interno' })).toBeInTheDocument())

    await usuario.selectOptions(microfone, 'Microfone interno')
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Saída de som' }), 'Fone do headset')

    expect(aoTrocarDispositivo.mock.calls).toEqual([
      ['microfone', 'mic-notebook'],
      ['saida', 'fone'],
    ])
    expect(lerPreferencias()).toMatchObject({ microfone: 'mic-notebook', saidaDeSom: 'fone' })
  })

  it('o fone guardado que está desligado aparece como desconectado, sem trocar a escolha', async () => {
    habilitarAparelhos(APARELHOS)
    localStorage.setItem('janja-share.preferencias', JSON.stringify({ versao: 1, saidaDeSom: 'fone-guardado' }))
    const usuario = userEvent.setup()
    render(<PainelDaPessoa nome="Ana" aoMudarNome={vi.fn()} estado="No saguão" microfone={null} surdo={null} />)
    await usuario.click(screen.getByRole('button', { name: 'Preferências' }))

    const saida = screen.getByRole('combobox', { name: 'Saída de som' })
    await waitFor(() => expect(saida).toHaveValue('fone-guardado'))
    expect(screen.getByRole('option', { name: 'Aparelho desconectado' })).toBeInTheDocument()
  })

  it('sem como escolher a saída (Safari), só o microfone aparece', async () => {
    habilitarAparelhos(APARELHOS)
    delete (HTMLMediaElement.prototype as { setSinkId?: unknown }).setSinkId
    const usuario = userEvent.setup()
    render(<PainelDaPessoa nome="Ana" aoMudarNome={vi.fn()} estado="No saguão" microfone={null} surdo={null} />)
    await usuario.click(screen.getByRole('button', { name: 'Preferências' }))

    expect(screen.getByRole('combobox', { name: 'Microfone' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Saída de som' })).not.toBeInTheDocument()
  })

  it('sem a permissão do microfone, diz por que a lista está vazia', async () => {
    habilitarAparelhos([aparelho('audioinput', '', ''), aparelho('audiooutput', '', '')])
    const usuario = userEvent.setup()
    render(<PainelDaPessoa nome="Ana" aoMudarNome={vi.fn()} estado="No saguão" microfone={null} surdo={null} />)
    await usuario.click(screen.getByRole('button', { name: 'Preferências' }))

    expect(await screen.findByText(/Abra o microfone uma vez/)).toBeInTheDocument()
  })
})
