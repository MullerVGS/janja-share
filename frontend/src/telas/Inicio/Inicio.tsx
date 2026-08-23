import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createLocalScreenTracks, type LocalTrack } from 'livekit-client'
import { useNavigate } from 'react-router-dom'
import { ErroDaApi, mensagemDoErro } from '../../api/cliente'
import { LIMITE_DO_NOME, listarSalas, criarSala, type Credenciais } from '../../api/salas'
import { guardarCaptura } from '../../sala/capturaPendente'
import { opcoesDeCaptura } from '../../sala/useCompartilhamento'
import { gravarPreferencias, lerPreferencias } from '../../preferencias'
import { useSessao } from '../../sessao/sessao'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { DialogoCriarSala } from './DialogoCriarSala'
import { SalaLinha } from './SalaLinha'
import estilos from './Inicio.module.css'

/**
 * A frase de erro de `compartilharTela`.
 *
 * `criarSala` sempre rejeita com `ErroDaApi` (é o que `pedir` lança); `createLocalScreenTracks`
 * rejeita com `DOMException`, que também é `Error` mas cuja `.message` é do navegador, não do
 * produto — por isso `ErroDaApi` é conferido primeiro, antes do `Error` genérico.
 */
function fraseDoErroDeCompartilhar(erro: unknown): string {
  if (erro instanceof ErroDaApi) return mensagemDoErro(erro)
  return erro instanceof Error && erro.message ? erro.message : 'não foi possível compartilhar a tela'
}

/**
 * A entrada das salas: abrir a URL, ver o que está no ar e entrar em um clique.
 *
 * A ação primária é compartilhar a própria tela — é o motivo mais comum de abrir o app, e o
 * pedido original era "isso em um clique". `criarSala` só entra depois da captura: pedir a
 * permissão do navegador primeiro é o que deixa cancelar o seletor sem criar sala nenhuma.
 *
 * `refetchOnWindowFocus` liga aqui, na query — não no `QueryClient` global, que fica desligado
 * de propósito para o resto do app (uma sala que sumiu não melhora com insistência; a lista sim).
 */
export function Inicio() {
  const navegar = useNavigate()
  const { guardar } = useSessao()
  const [meuNome, setMeuNome] = useState(() => lerPreferencias().nome)
  const [criarAberto, setCriarAberto] = useState(false)
  const [compartilhando, setCompartilhando] = useState(false)
  const [pedindoNome, setPedindoNome] = useState(false)
  const [erroDeCompartilhar, setErroDeCompartilhar] = useState<unknown>(null)

  const lista = useQuery({
    queryKey: ['salas'],
    queryFn: listarSalas,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  })

  function definirNome(nome: string) {
    setMeuNome(nome)
    gravarPreferencias({ nome })
  }

  function entrarENavegar(credenciais: Credenciais) {
    guardar(credenciais)
    navegar(`/sala/${credenciais.slug}`)
  }

  async function compartilharTela() {
    const seuNome = meuNome.trim()
    if (seuNome === '') {
      setPedindoNome(true)
      return
    }
    setPedindoNome(false)
    setErroDeCompartilhar(null)
    setCompartilhando(true)

    let faixas: LocalTrack[] = []
    try {
      // Primeira linha do handler, sem `await` antes: é o gesto do clique que autoriza o
      // seletor nativo, e ele expira assim que alguma outra coisa roda primeiro.
      faixas = await createLocalScreenTracks(opcoesDeCaptura(lerPreferencias().perfil))
    } catch (falha) {
      // Cancelar o seletor é a pessoa desistindo, não um erro do produto.
      const nome = falha instanceof Error ? falha.name : ''
      if (nome !== 'NotAllowedError' && nome !== 'AbortError') setErroDeCompartilhar(falha)
      setCompartilhando(false)
      return
    }

    try {
      const credenciais = await criarSala({ seuNome })
      guardarCaptura(faixas)
      entrarENavegar(credenciais)
    } catch (falha) {
      // A captura já está aberta e a sala não nasceu: sem parar, o Chrome ficaria dizendo que
      // a pessoa está compartilhando a tela com ninguém do outro lado.
      faixas.forEach((faixa) => faixa.stop())
      setErroDeCompartilhar(falha)
      setCompartilhando(false)
    }
  }

  return (
    <div className={estilos.tela}>
      <header className={estilos.cabecalho}>
        <span className={estilos.marca}>janja-share</span>
        <Campo
          className={estilos.campoNome}
          rotulo="Seu nome"
          maxLength={LIMITE_DO_NOME}
          placeholder="como os outros vão te ver"
          value={meuNome}
          onChange={(e) => definirNome(e.target.value)}
        />
      </header>

      <div className={estilos.acaoPrincipal}>
        <Botao aparencia="primario" blocoInteiro ocupado={compartilhando} onClick={() => void compartilharTela()}>
          Compartilhar minha tela
        </Botao>
        {pedindoNome && meuNome.trim() === '' && (
          <Aviso tom="neutro">Escreva seu nome ali em cima antes de compartilhar.</Aviso>
        )}
        {erroDeCompartilhar !== null && <Aviso tom="erro">{fraseDoErroDeCompartilhar(erroDeCompartilhar)}</Aviso>}
      </div>

      <section className={estilos.salasNoAr}>
        <h2 className={estilos.tituloDaSecao}>Salas no ar</h2>

        {lista.isPending && <p className={estilos.carregando}>Carregando salas…</p>}

        {/* Um poll de fundo pode falhar sem derrubar `data` (react-query mantém o último sucesso) —
            por isso o aviso fica por cima da lista, e não no lugar dela: um 503 passageiro não pode
            desmontar cada `SalaLinha` e levar junto a senha ou o nome que a pessoa já digitou. A
            tela só-de-erro (sem lista nenhuma) só acontece quando ainda não há `data` nenhum — e é
            exatamente aí que falta dizer que o `refetchInterval` de 5s segue tentando: sem isso a
            tela lê como morta, não como "ainda carregando". */}
        {lista.isError && (
          <Aviso tom="erro">
            {mensagemDoErro(lista.error)}
            {!lista.data && ' Tentando de novo…'}
          </Aviso>
        )}

        {lista.data && lista.data.length === 0 && <p className={estilos.vazio}>Nenhuma sala no ar agora.</p>}

        {lista.data && lista.data.length > 0 && (
          <ul className={estilos.lista}>
            {lista.data.map((sala) => (
              <SalaLinha key={sala.slug} sala={sala} meuNome={meuNome} aoDefinirNome={definirNome} aoEntrar={entrarENavegar} />
            ))}
          </ul>
        )}

        <Botao aparencia="secundario" onClick={() => setCriarAberto(true)}>
          Criar sala
        </Botao>
      </section>

      <DialogoCriarSala
        aberto={criarAberto}
        meuNome={meuNome}
        aoDefinirNome={definirNome}
        aoFechar={() => setCriarAberto(false)}
        aoCriar={(credenciais) => {
          setCriarAberto(false)
          entrarENavegar(credenciais)
        }}
      />
    </div>
  )
}
