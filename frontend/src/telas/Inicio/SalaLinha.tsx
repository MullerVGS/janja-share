import { useState } from 'react'
import { mensagemDoErro } from '../../api/cliente'
import { LIMITE_DO_NOME, type Credenciais, type SalaNaLista } from '../../api/salas'
import { useEntradaNaSala } from '../../sala/useEntradaNaSala'
import { Aviso } from '../../ui/Aviso'
import { Avatar } from '../../ui/Avatar'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { IconeCadeado } from '../../ui/Icone'
import estilos from './SalaLinha.module.css'

/** Avatares de sobra viram um "+N" — uma fila crescendo sem teto por sala fica ilegível. */
const MAX_AVATARES_VISIVEIS = 6

interface Props {
  sala: SalaNaLista
  /** O que já está em `preferencias.nome` — vazio quando a pessoa nunca preencheu. */
  meuNome: string
  /** Grava o nome digitado aqui de volta em `preferencias`, para a próxima sala não perguntar de novo. */
  aoDefinirNome(nome: string): void
  aoEntrar(credenciais: Credenciais): void
}

/**
 * Uma linha da lista. "Entrar" só abre um formulário na própria linha quando falta alguma coisa
 * — senha da sala, ou o nome de quem está entrando; do contrário vai direto.
 */
export function SalaLinha({ sala, meuNome, aoDefinirNome, aoEntrar }: Props) {
  const [expandido, setExpandido] = useState(false)
  const entrada = useEntradaNaSala({
    slug: sala.slug,
    meuNome,
    aoDefinirNome,
    aoEntrar,
    aoFalhar: () => setExpandido(true),
  })

  function clicarEntrar() {
    if (!sala.temSenha && !entrada.precisaDoNome) {
      void entrada.enviar()
      return
    }
    setExpandido(true)
  }

  function cancelar() {
    setExpandido(false)
    entrada.limpar()
  }

  return (
    <li className={estilos.linha} data-vazia={sala.pessoas.length === 0 || undefined} data-cheia={sala.cheia || undefined}>
      <div className={estilos.info}>
        <span className={estilos.nome}>{sala.nome}</span>
        {sala.temSenha && (
          <span className={estilos.cadeado} title="Sala com senha">
            <IconeCadeado tamanho={14} />
          </span>
        )}
        {sala.telasNoAr > 0 && (
          <span className={estilos.telas}>
            {sala.telasNoAr} {sala.telasNoAr === 1 ? 'tela' : 'telas'} no ar
          </span>
        )}
      </div>

      <div className={estilos.pessoas}>
        {sala.pessoas.length === 0 ? (
          <span className={estilos.vazio}>ninguém agora</span>
        ) : (
          <div className={estilos.avatares}>
            {sala.pessoas.slice(0, MAX_AVATARES_VISIVEIS).map((pessoa, indice) => (
              <Avatar
                key={`${pessoa}-${indice}`}
                className={estilos.avatar}
                nome={pessoa}
                tamanho="mini"
                title={pessoa}
                aria-label={pessoa}
              />
            ))}
            {sala.pessoas.length > MAX_AVATARES_VISIVEIS && (
              <span
                className={estilos.avatarExtra}
                title={sala.pessoas.slice(MAX_AVATARES_VISIVEIS).join(', ')}
              >
                +{sala.pessoas.length - MAX_AVATARES_VISIVEIS}
              </span>
            )}
          </div>
        )}
      </div>

      {entrada.erro !== null && (
        <div className={estilos.aviso}>
          <Aviso tom="erro">{mensagemDoErro(entrada.erro)}</Aviso>
        </div>
      )}

      {expandido ? (
        <form className={estilos.formulario} onSubmit={entrada.enviar}>
          {entrada.precisaDoNome && (
            <Campo
              rotulo="Seu nome"
              autoFocus
              maxLength={LIMITE_DO_NOME}
              placeholder="como os outros vão te ver"
              value={entrada.nomeLocal}
              onChange={(e) => entrada.setNomeLocal(e.target.value)}
            />
          )}
          {sala.temSenha && (
            <Campo
              rotulo="Senha"
              type="password"
              autoFocus={!entrada.precisaDoNome}
              value={entrada.senha}
              onChange={(e) => entrada.setSenha(e.target.value)}
            />
          )}
          <Botao
            type="submit"
            aparencia="primario"
            ocupado={entrada.enviando}
            disabled={!entrada.podeEntrar}
          >
            Entrar
          </Botao>
          <Botao type="button" aparencia="fantasma" disabled={entrada.enviando} onClick={cancelar}>
            Cancelar
          </Botao>
        </form>
      ) : (
        <Botao
          aparencia={sala.cheia ? 'secundario' : 'primario'}
          disabled={sala.cheia}
          ocupado={entrada.enviando}
          onClick={clicarEntrar}
        >
          {sala.cheia ? 'cheia' : 'Entrar'}
        </Botao>
      )}
    </li>
  )
}
