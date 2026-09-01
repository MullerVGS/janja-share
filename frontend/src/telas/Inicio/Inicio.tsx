import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { mensagemDoErro } from '../../api/cliente'
import { LIMITE_DO_NOME, listarSalas, type Credenciais } from '../../api/salas'
import { gravarPreferencias, lerPreferencias } from '../../preferencias'
import { useSessao } from '../../sessao/sessao'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { IconeMais, IconeMarca, IconePessoas } from '../../ui/Icone'
import { Marca } from '../../ui/Marca'
import { CartaoDaSala } from './CartaoDaSala'
import { DialogoCriarSala } from './DialogoCriarSala'
import estilos from './Inicio.module.css'

/**
 * A entrada das salas: abrir a URL, ver o que está no ar e entrar em um clique.
 *
 * O saguão tem uma ação só — criar uma sala. Compartilhar tela é o que se faz *dentro* de uma,
 * e oferecer isso aqui obrigava a home a saber capturar, criar e navegar antes de existir sala
 * nenhuma: três coisas podendo falhar num clique, para chegar no mesmo lugar que "Criar sala"
 * chega em dois.
 *
 * `refetchOnWindowFocus` liga aqui, na query — não no `QueryClient` global, que fica desligado
 * de propósito para o resto do app (uma sala que sumiu não melhora com insistência; a lista sim).
 */
export function Inicio() {
  const navegar = useNavigate()
  const { guardar } = useSessao()
  const [meuNome, setMeuNome] = useState(() => lerPreferencias().nome)
  const [criarAberto, setCriarAberto] = useState(false)

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

  const quantidadeDeSalas = lista.data?.length ?? 0
  const quantidadeDePessoas = lista.data?.reduce((total, sala) => total + sala.pessoas.length, 0) ?? 0

  return (
    <div className={estilos.tela}>
      <header className={estilos.topo}>
        <Marca />
        <span className={estilos.espacador} />
        <span className={estilos.porAqui}>
          <IconePessoas tamanho={15} />
          {quantidadeDePessoas === 0
            ? 'tudo tranquilo por aqui'
            : `${quantidadeDePessoas} ${quantidadeDePessoas === 1 ? 'pessoa por aqui' : 'pessoas por aqui'}`}
        </span>
        <input
          className={estilos.campoNome}
          aria-label="Seu nome"
          title="Como vão te ver"
          placeholder="seu nome"
          maxLength={LIMITE_DO_NOME}
          value={meuNome}
          onChange={(evento) => definirNome(evento.target.value)}
        />
      </header>

      <div className={estilos.rolagem}>
        <section className={estilos.hero}>
          <div className={estilos.heroTexto}>
            <span className={estilos.sobretitulo}>rápido · efêmero · sem conta</span>
            <h1 className={estilos.titulo}>Sua tela, sua turma, sem complicação.</h1>
            <p className={estilos.descricao}>
              Abra uma sala, chame quem quiser e compartilhe em poucos segundos. Quando todo mundo sair, ela
              desaparece.
            </p>
            <div className={estilos.acoesDoHero}>
              <Botao aparencia="primario" onClick={() => setCriarAberto(true)}>
                <IconeMais tamanho={16} />
                Criar sala
              </Botao>
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
                <span className={estilos.previaPulso}>
                  <IconeMarca tamanho={26} />
                </span>
                <span>compartilhando agora</span>
              </div>
              <div className={estilos.previaPessoas}>
                <span>AM</span>
                <span>BR</span>
                <span className={estilos.previaExcedente}>+2</span>
              </div>
            </div>
          </div>
        </section>

        <section className={estilos.salasNoAr}>
          <header className={estilos.cabecalhoDaSecao}>
            <h2 className={estilos.tituloDaSecao}>Salas no ar</h2>
            <span className={estilos.espacador} />
            {quantidadeDeSalas > 0 && (
              <span className={estilos.contagem}>
                <span className={estilos.pontoAoVivo} aria-hidden="true" />
                {quantidadeDeSalas} ao vivo
              </span>
            )}
          </header>
          <p className={estilos.subtituloDaSecao}>Entre em uma conversa que já começou.</p>

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
                <IconePessoas tamanho={26} />
              </span>
              <strong>Nenhuma sala no ar agora.</strong>
              <span>Comece uma e mande o link para a turma.</span>
            </div>
          )}

          {lista.data && lista.data.length > 0 && (
            <ul className={estilos.lista}>
              {lista.data.map((sala) => (
                <CartaoDaSala
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
