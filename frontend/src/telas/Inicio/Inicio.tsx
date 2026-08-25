import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type LocalTrack } from 'livekit-client'
import { useNavigate } from 'react-router-dom'
import { ErroDaApi, mensagemDoErro } from '../../api/cliente'
import { LIMITE_DO_NOME, listarSalas, criarSala, type Credenciais } from '../../api/salas'
import { capturarTela } from '../../sala/captura'
import { guardarCaptura } from '../../sala/capturaPendente'
import { gravarPreferencias, lerPreferencias } from '../../preferencias'
import { useSessao } from '../../sessao/sessao'
import { Aviso } from '../../ui/Aviso'
import { Avatar } from '../../ui/Avatar'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { IconeInicio, IconeMais, IconePessoas, IconeTela } from '../../ui/Icone'
import { Marca } from '../../ui/Marca'
import { ItemDoTrilho, Trilho } from '../../ui/Trilho'
import { DialogoCriarSala } from './DialogoCriarSala'
import { SalaLinha } from './SalaLinha'
import estilos from './Inicio.module.css'

/**
 * A frase de erro de `compartilharTela`.
 *
 * `criarSala` sempre rejeita com `ErroDaApi` (é o que `pedir` lança); `capturarTela`
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
      faixas = await capturarTela(lerPreferencias().perfil)
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

  const quantidadeDeSalas = lista.data?.length ?? 0
  const quantidadeDePessoas = lista.data?.reduce((total, sala) => total + sala.pessoas.length, 0) ?? 0

  return (
    <div className={estilos.tela}>
      <nav className={estilos.trilho} aria-label="Atalhos principais">
        <Trilho>
          <ItemDoTrilho rotulo="Saguão" ativo>
            <IconeInicio tamanho={22} />
          </ItemDoTrilho>
          <ItemDoTrilho rotulo="Nova sala" aoClicar={() => setCriarAberto(true)}>
            <IconeMais tamanho={22} />
          </ItemDoTrilho>
        </Trilho>
      </nav>

      <aside className={estilos.navegacao} aria-label="Navegação do saguão">
        <header className={estilos.cabecalhoDaNavegacao}>
          <Marca />
        </header>

        <div className={estilos.menu}>
          <span className={estilos.rotuloDoMenu}>Início</span>
          <div className={estilos.itemDoMenu} data-ativo>
            <IconePessoas tamanho={19} />
            <span>Salas no ar</span>
            <span className={estilos.contadorDoMenu}>{quantidadeDeSalas}</span>
          </div>
          <button type="button" className={estilos.itemDoMenu} onClick={() => setCriarAberto(true)}>
            <IconeMais tamanho={19} />
            <span>Nova sala</span>
          </button>
        </div>

        <div className={estilos.identidade}>
          <Avatar
            className={estilos.avatarDaIdentidade}
            nome={meuNome}
            tamanho="medio"
            status="online"
          />
          <Campo
            className={estilos.campoNome}
            rotulo="Seu nome"
            maxLength={LIMITE_DO_NOME}
            placeholder="como vão te ver"
            value={meuNome}
            onChange={(e) => definirNome(e.target.value)}
          />
        </div>
      </aside>

      <main className={estilos.principal}>
        <header className={estilos.topo}>
          <span className={estilos.canalAtual}>
            <span aria-hidden="true">#</span> saguão
          </span>
          <span className={estilos.resumoDoTopo}>
            <span className={estilos.pontoAoVivo} aria-hidden="true" />
            {quantidadeDePessoas === 0
              ? 'Tudo tranquilo por aqui'
              : `${quantidadeDePessoas} ${quantidadeDePessoas === 1 ? 'pessoa por aqui' : 'pessoas por aqui'}`}
          </span>
        </header>

        <div className={estilos.rolagem}>
          <section className={estilos.hero}>
            <div className={estilos.heroTexto}>
              <span className={estilos.sobretitulo}>Rápido · efêmero · sem conta</span>
              <h1 className={estilos.titulo}>Sua tela, sua turma, sem complicação.</h1>
              <p className={estilos.descricao}>
                Abra uma sala, chame quem quiser e compartilhe em poucos segundos. Quando todo mundo sair, ela
                desaparece.
              </p>
              <div className={estilos.acoesDoHero}>
                <Botao aparencia="primario" ocupado={compartilhando} onClick={() => void compartilharTela()}>
                  <IconeTela tamanho={19} />
                  Compartilhar minha tela
                </Botao>
                <Botao aparencia="secundario" onClick={() => setCriarAberto(true)}>
                  <IconeMais tamanho={19} />
                  Criar sala
                </Botao>
              </div>
              <div className={estilos.avisosDoHero}>
                {pedindoNome && meuNome.trim() === '' && (
                  <Aviso tom="neutro">Escreva seu nome na lateral antes de compartilhar.</Aviso>
                )}
                {erroDeCompartilhar !== null && (
                  <Aviso tom="erro">{fraseDoErroDeCompartilhar(erroDeCompartilhar)}</Aviso>
                )}
              </div>
            </div>

            <div className={estilos.previa} aria-hidden="true">
              <div className={estilos.previaTopo}>
                <span />
                <span />
                <span />
                <span className={estilos.previaEndereco}>sua sala está no ar</span>
              </div>
              <div className={estilos.previaCorpo}>
                <div className={estilos.previaTela}>
                  <IconeTela tamanho={34} />
                  <span>compartilhando agora</span>
                </div>
                <div className={estilos.previaPessoas}>
                  <span>AM</span>
                  <span>BR</span>
                  <span>+2</span>
                </div>
              </div>
            </div>
          </section>

          <section className={estilos.salasNoAr}>
            <header className={estilos.cabecalhoDaSecao}>
              <div>
                <span className={estilos.tituloDaSecao}>Salas no ar</span>
                <p className={estilos.subtituloDaSecao}>Entre em uma conversa que já começou.</p>
              </div>
              {quantidadeDeSalas > 0 && <span className={estilos.contagem}>{quantidadeDeSalas} ao vivo</span>}
            </header>

            {lista.isPending && <p className={estilos.carregando}>Carregando salas…</p>}

            {/* Um poll de fundo pode falhar sem derrubar `data` (react-query mantém o último sucesso) —
                por isso o aviso fica por cima da lista, e não no lugar dela. */}
            {lista.isError && (
              <Aviso tom="erro">
                {mensagemDoErro(lista.error)}
                {!lista.data && ' Tentando de novo…'}
              </Aviso>
            )}

            {lista.data && lista.data.length === 0 && (
              <div className={estilos.vazio}>
                <span className={estilos.iconeVazio} aria-hidden="true">
                  <IconePessoas tamanho={28} />
                </span>
                <strong>Nenhuma sala no ar agora.</strong>
                <span>Comece uma e mande o link para a turma.</span>
              </div>
            )}

            {lista.data && lista.data.length > 0 && (
              <ul className={estilos.lista}>
                {lista.data.map((sala) => (
                  <SalaLinha
                    key={sala.slug}
                    sala={sala}
                    meuNome={meuNome}
                    aoDefinirNome={definirNome}
                    aoEntrar={entrarENavegar}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

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
