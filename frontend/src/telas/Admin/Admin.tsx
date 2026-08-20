import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ErroDaApi, mensagemDoErro } from '../../api/cliente'
import { criarConvite, listarConvites, revogarConvite, type ConviteCriado } from '../../api/convites'
import { buscarConfig, verSala } from '../../api/sala'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { IconeCerto, IconeCopiar } from '../../ui/Icone'
import { situacaoDoConvite } from './situacao'
import estilos from './Admin.module.css'

const CHAVE_DOS_CONVITES = ['admin', 'convites'] as const

function quando(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/**
 * O 404 aqui tem dois significados. Num convite, é o convite que não existe (`convite_invalido`);
 * na rota inteira, é a guarda de host do backend — que responde 404 para não revelar que o painel
 * existe. A guarda lança `NotFoundException`, e o filtro global a serve como
 * `{ erro: "nao_encontrado" }`, o mesmo corpo de uma rota que não existe: é esse código, e não o
 * fallback do navegador, que chega aqui quando o painel é aberto pelo host errado.
 */
function explicar(erro: unknown): string {
  if (erro instanceof ErroDaApi && erro.status === 404 && erro.codigo === 'nao_encontrado') {
    return 'Este painel só responde no host de administração. Abra pelo endereço admin, não pelo endereço da sala.'
  }
  return mensagemDoErro(erro)
}

function LinkNovo({ convite, aoFechar }: { convite: ConviteCriado; aoFechar(): void }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(convite.link)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }

  return (
    <div className={estilos.linkNovo}>
      <h3 className={estilos.tituloDoLink}>Link do convite “{convite.rotulo}”</h3>
      <p className={estilos.recado}>
        <strong>Copie agora.</strong> O servidor guarda só o hash do token — fechando este aviso, o link não
        pode ser mostrado de novo por ninguém, nem por você. Se perder, revogue e crie outro.
      </p>
      <div className={estilos.caixaDoLink}>
        <input className={estilos.entradaDoLink} readOnly value={convite.link} onFocus={(e) => e.target.select()} />
        <Botao aparencia="primario" onClick={() => void copiar()}>
          {copiado ? <IconeCerto tamanho={15} /> : <IconeCopiar tamanho={15} />}
          {copiado ? 'copiado' : 'copiar'}
        </Botao>
      </div>
      <Botao aparencia="fantasma" onClick={aoFechar}>
        já copiei, pode sumir
      </Botao>
    </div>
  )
}

export function Admin() {
  const cache = useQueryClient()
  const [rotulo, setRotulo] = useState('')
  const [validadeHoras, setValidadeHoras] = useState(24)
  const [ilimitado, setIlimitado] = useState(false)
  const [usosMax, setUsosMax] = useState(5)
  const [recemCriado, setRecemCriado] = useState<ConviteCriado | null>(null)

  const config = useQuery({ queryKey: ['config'], queryFn: buscarConfig, retry: false })
  const convites = useQuery({ queryKey: CHAVE_DOS_CONVITES, queryFn: listarConvites, retry: false })
  const sala = useQuery({ queryKey: ['admin', 'sala'], queryFn: verSala, retry: false, refetchInterval: 10_000 })

  const criar = useMutation({
    mutationFn: criarConvite,
    onSuccess: (criado) => {
      setRecemCriado(criado)
      setRotulo('')
      void cache.invalidateQueries({ queryKey: CHAVE_DOS_CONVITES })
    },
  })

  const revogar = useMutation({
    mutationFn: revogarConvite,
    onSuccess: () => void cache.invalidateQueries({ queryKey: CHAVE_DOS_CONVITES }),
  })

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    criar.mutate({ rotulo: rotulo.trim(), validadeHoras, usosMax: ilimitado ? null : usosMax })
  }

  return (
    <div className={estilos.tela}>
      <header className={estilos.topo}>
        <h1 className={estilos.titulo}>Convites</h1>
        {config.isSuccess && (
          <span className={estilos.subtitulo}>
            sala <code>{config.data.sala}</code> · SFU <code>{config.data.urlSfu}</code>
          </span>
        )}
      </header>

      {convites.isError && <Aviso tom="erro">{explicar(convites.error)}</Aviso>}

      <section className={estilos.bloco}>
        <h2 className={estilos.tituloDoBloco}>Novo convite</h2>
        {recemCriado ? (
          <LinkNovo convite={recemCriado} aoFechar={() => setRecemCriado(null)} />
        ) : (
          <form className={estilos.formulario} onSubmit={enviar}>
            <Campo
              rotulo="Rótulo"
              placeholder="para quem é este link"
              maxLength={60}
              required
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
            />
            <Campo
              rotulo="Validade (horas)"
              type="number"
              min={1}
              max={8760}
              required
              value={validadeHoras}
              onChange={(e) => setValidadeHoras(Number(e.target.value))}
            />
            <Campo
              rotulo="Usos"
              type="number"
              min={1}
              disabled={ilimitado}
              value={ilimitado ? '' : usosMax}
              onChange={(e) => setUsosMax(Number(e.target.value))}
              dica={
                <label className={estilos.caixaDeMarcar}>
                  <input type="checkbox" checked={ilimitado} onChange={(e) => setIlimitado(e.target.checked)} />
                  usos ilimitados
                </label>
              }
            />
            <Botao type="submit" aparencia="primario" ocupado={criar.isPending} disabled={rotulo.trim() === ''}>
              Criar convite
            </Botao>
          </form>
        )}
        {criar.isError && <Aviso tom="erro">{explicar(criar.error)}</Aviso>}
      </section>

      <section className={estilos.bloco}>
        <h2 className={estilos.tituloDoBloco}>Convites existentes</h2>
        {convites.isPending && <p className={estilos.vazio}>Carregando…</p>}
        {convites.isSuccess && convites.data.length === 0 && <p className={estilos.vazio}>Nenhum convite ainda.</p>}
        {convites.isSuccess && convites.data.length > 0 && (
          <table className={estilos.tabela}>
            <thead>
              <tr>
                <th>Rótulo</th>
                <th>Criado</th>
                <th>Expira</th>
                <th>Usos</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {convites.data.map((convite) => {
                const situacao = situacaoDoConvite(convite)
                return (
                  <tr key={convite.id}>
                    <td>{convite.rotulo}</td>
                    <td className={estilos.data}>{quando(convite.criadoEm)}</td>
                    <td className={estilos.data}>{quando(convite.expiraEm)}</td>
                    <td className={estilos.data}>
                      {convite.usos}
                      {convite.usosMax === null ? ' / ∞' : ` / ${convite.usosMax}`}
                    </td>
                    <td>
                      <span className={estilos.situacao} data-situacao={situacao}>
                        {situacao}
                      </span>
                    </td>
                    <td className={estilos.acao}>
                      {situacao === 'ativo' && (
                        <Botao
                          aparencia="perigo"
                          ocupado={revogar.isPending && revogar.variables === convite.id}
                          onClick={() => revogar.mutate(convite.id)}
                        >
                          Revogar
                        </Botao>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {revogar.isError && <Aviso tom="erro">{explicar(revogar.error)}</Aviso>}
      </section>

      <section className={estilos.bloco}>
        <h2 className={estilos.tituloDoBloco}>Na sala agora</h2>
        {sala.isSuccess && sala.data.participantes.length === 0 && <p className={estilos.vazio}>Ninguém.</p>}
        <ul className={estilos.pessoas}>
          {sala.data?.participantes.map((pessoa) => (
            <li key={pessoa.identidade} className={estilos.pessoa}>
              <span>{pessoa.nome}</span>
              {pessoa.entrouEm && <span className={estilos.data}>desde {quando(pessoa.entrouEm)}</span>}
              {pessoa.publicandoTela && <span className={estilos.compartilhando}>compartilhando tela</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
