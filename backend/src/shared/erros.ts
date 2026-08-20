import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { Response } from 'express'

/** Toda resposta de erro documentada em docs/CONTRATO-API.md tem a forma { erro: "<codigo>" }. */
export class ErroApi extends HttpException {
  constructor(status: HttpStatus, erro: string) {
    super({ erro }, status)
  }
}

// As quatro classes de convite abaixo (e erroDoEstado) são legado do módulo `convites/`, que
// este esforço substitui por completo — saem daqui no mesmo commit que apaga `convites/`
// (senão o typecheck quebra antes da hora).
export class ConviteInvalido extends ErroApi {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'convite_invalido')
  }
}

export class ConviteExpirado extends ErroApi {
  constructor() {
    super(HttpStatus.GONE, 'convite_expirado')
  }
}

export class ConviteEsgotado extends ErroApi {
  constructor() {
    super(HttpStatus.GONE, 'convite_esgotado')
  }
}

export class ConviteRevogado extends ErroApi {
  constructor() {
    super(HttpStatus.GONE, 'convite_revogado')
  }
}

/** Nome de uma pessoa (o "seu nome" de quem cria ou entra numa sala) — não confundir com NomeDaSalaInvalido. */
export class NomeInvalido extends ErroApi {
  constructor() {
    super(HttpStatus.BAD_REQUEST, 'nome_invalido')
  }
}

/** Traduz o estado calculado em estado-convite.ts para a exceção de contrato correspondente. */
export function erroDoEstado(estado: 'expirado' | 'revogado' | 'esgotado'): ErroApi {
  if (estado === 'expirado') return new ConviteExpirado()
  if (estado === 'revogado') return new ConviteRevogado()
  return new ConviteEsgotado()
}

/**
 * Nome da sala. Código próprio (não nome_invalido): um nome só de emoji ou pontuação passa no
 * teste de 1..40 caracteres mas produz um slug vazio — a frase de nome_invalido ("1 a 40
 * caracteres") seria uma mentira nesse caso.
 */
export class NomeDaSalaInvalido extends ErroApi {
  constructor() {
    super(HttpStatus.BAD_REQUEST, 'nome_da_sala_invalido')
  }
}

export class SalaExiste extends ErroApi {
  constructor() {
    super(HttpStatus.CONFLICT, 'sala_existe')
  }
}

export class SalaNaoExiste extends ErroApi {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'sala_nao_existe')
  }
}

export class SenhaIncorreta extends ErroApi {
  constructor() {
    super(HttpStatus.UNAUTHORIZED, 'senha_incorreta')
  }
}

export class SalaCheia extends ErroApi {
  constructor() {
    super(HttpStatus.CONFLICT, 'sala_cheia')
  }
}

export class MuitasSalas extends ErroApi {
  constructor() {
    super(HttpStatus.TOO_MANY_REQUESTS, 'muitas_salas')
  }
}

/** Freio (shared/freio.ts) estourado: criar, entrar ou tentativa de senha demais num intervalo curto. */
export class Espere extends ErroApi {
  constructor() {
    super(HttpStatus.TOO_MANY_REQUESTS, 'espere')
  }
}

/** SFU fora do ar. Devolver lista vazia em vez disto mentiria "não há salas" (contrato). */
export class SfuIndisponivel extends ErroApi {
  constructor() {
    super(HttpStatus.SERVICE_UNAVAILABLE, 'sfu_indisponivel')
  }
}

/** Formato único { erro } para toda resposta HttpException — inclusive as que o Nest gera sozinho (ValidationPipe, guardas). */
@Catch(HttpException)
export class ErroApiFilter implements ExceptionFilter {
  catch(ex: HttpException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()
    const status = ex.getStatus()
    const corpo = ex.getResponse()
    if (typeof corpo === 'object' && corpo !== null && 'erro' in corpo) {
      res.status(status).json(corpo)
      return
    }
    // Sem `erro` explícito: veio do ValidationPipe ou de uma exceção padrão do Nest (rota
    // inexistente vira NotFoundException sozinha). Não repassamos `message`/`statusCode` crus.
    const codigo =
      status === HttpStatus.BAD_REQUEST ? 'validacao'
      : status === HttpStatus.NOT_FOUND ? 'nao_encontrado'
      : 'erro'
    res.status(status).json({ erro: codigo })
  }
}

/** Fallback para qualquer exceção que não seja HttpException — bug genuíno, nunca vaza detalhe interno. */
@Catch()
export class ErroInternoFilter implements ExceptionFilter {
  catch(ex: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()
    console.error('[ErroInternoFilter] erro não tratado:', ex)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ erro: 'erro_interno' })
  }
}
