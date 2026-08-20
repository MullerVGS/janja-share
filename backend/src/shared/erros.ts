import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { Response } from 'express'

/** Toda resposta de erro documentada em docs/CONTRATO-API.md tem a forma { erro: "<codigo>" }. */
export class ErroApi extends HttpException {
  constructor(status: HttpStatus, erro: string) {
    super({ erro }, status)
  }
}

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
    // Sem `erro` explícito: veio do ValidationPipe ou de uma exceção padrão do Nest (ex.: a
    // guarda de admin lança NotFoundException()). Não repassamos `message`/`statusCode` crus.
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
