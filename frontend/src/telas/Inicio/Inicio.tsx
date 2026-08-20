import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { mensagemDoErro } from '../../api/cliente'
import { listarSalas, type Credenciais } from '../../api/salas'
import { gravarPreferencias, lerPreferencias } from '../../preferencias'
import { useSessao } from '../../sessao/sessao'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { DialogoCriarSala } from './DialogoCriarSala'
import { SalaLinha } from './SalaLinha'
import estilos from './Inicio.module.css'

const LIMITE_DO_NOME = 40

/**
 * A porta que não é convite: abrir a URL, ver o que está rolando e entrar em um clique.
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

  return (
    <div className={estilos.tela}>
      <header className={estilos.cabecalho}>
        <span className={estilos.marca}>share</span>
        <Campo
          className={estilos.campoNome}
          rotulo="Seu nome"
          maxLength={LIMITE_DO_NOME}
          placeholder="como os outros vão te ver"
          value={meuNome}
          onChange={(e) => definirNome(e.target.value)}
        />
      </header>

      {lista.isPending && <p className={estilos.carregando}>Carregando salas…</p>}

      {lista.isError && <Aviso tom="erro">{mensagemDoErro(lista.error)}</Aviso>}

      {lista.isSuccess && lista.data.length === 0 && (
        <div className={estilos.vazio}>
          <p>Nenhuma sala no ar agora.</p>
          <Botao aparencia="primario" onClick={() => setCriarAberto(true)}>
            Criar sala
          </Botao>
        </div>
      )}

      {lista.isSuccess && lista.data.length > 0 && (
        <>
          <ul className={estilos.lista}>
            {lista.data.map((sala) => (
              <SalaLinha key={sala.slug} sala={sala} meuNome={meuNome} aoDefinirNome={definirNome} aoEntrar={entrarENavegar} />
            ))}
          </ul>
          <Botao aparencia="secundario" onClick={() => setCriarAberto(true)}>
            Criar sala
          </Botao>
        </>
      )}

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
