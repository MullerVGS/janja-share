import { useState } from 'react'
import { mensagemDoErro } from '../../api/cliente'
import { LIMITE_DO_NOME, type Credenciais } from '../../api/salas'
import { gravarPreferencias, lerPreferencias } from '../../preferencias'
import { useEntradaNaSala } from '../../sala/useEntradaNaSala'
import { Aviso } from '../../ui/Aviso'
import { Botao } from '../../ui/Botao'
import { Campo } from '../../ui/Campo'
import { Dialogo } from '../../ui/Dialogo'
import estilos from './EntradaDaSala.module.css'

interface Props {
  slug: string
  aoEntrar(credenciais: Credenciais): void
  aoVoltar(): void
}

/** Porta para quem abriu o link em outra aba ou navegador e ainda não tem o passe da Sala. */
export function EntradaDaSala({ slug, aoEntrar, aoVoltar }: Props) {
  const [meuNome] = useState(() => lerPreferencias().nome)
  const entrada = useEntradaNaSala({
    slug,
    meuNome,
    nomeSempreEditavel: true,
    aoDefinirNome: (nome) => gravarPreferencias({ nome }),
    aoEntrar,
  })

  return (
    <Dialogo aberto titulo="Entrar na sala" aoFechar={aoVoltar}>
      <form className={estilos.formulario} onSubmit={entrada.enviar} noValidate>
        <p className={estilos.contexto}>
          Você recebeu um link para <strong>#{slug}</strong>. Escolha como vão te ver e, se a sala pedir,
          informe a senha.
        </p>
        {entrada.erro !== null && <Aviso tom="erro">{mensagemDoErro(entrada.erro)}</Aviso>}
        <Campo
          rotulo="Seu nome"
          autoFocus={entrada.nomeLocal.trim() === ''}
          maxLength={LIMITE_DO_NOME}
          placeholder="como os outros vão te ver"
          value={entrada.nomeLocal}
          onChange={(evento) => entrada.setNomeLocal(evento.target.value)}
        />
        <Campo
          rotulo="Senha (opcional)"
          type="password"
          autoFocus={entrada.nomeLocal.trim() !== ''}
          placeholder="deixe em branco se a sala não tiver senha"
          value={entrada.senha}
          onChange={(evento) => entrada.setSenha(evento.target.value)}
        />
        <div className={estilos.acoes}>
          <Botao type="button" aparencia="fantasma" disabled={entrada.enviando} onClick={aoVoltar}>
            Voltar ao saguão
          </Botao>
          <Botao
            type="submit"
            aparencia="primario"
            ocupado={entrada.enviando}
            disabled={!entrada.podeEntrar}
          >
            {entrada.enviando ? 'entrando…' : 'Entrar'}
          </Botao>
        </div>
      </form>
    </Dialogo>
  )
}
