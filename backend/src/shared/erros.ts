import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { Response } from 'express'

/** Toda resposta de erro documentada em docs/CONTRATO-API.md tem a forma { erro: "<codigo>" }. */
export class ErroApi extends HttpException {
  constructor(status: HttpStatus, erro: string) {
    super({ erro }, status)
  }
}

/** Nome de uma pessoa (o "seu nome" de quem cria ou entra numa sala) — não confundir com NomeDaSalaInvalido. */
export class NomeInvalido extends ErroApi {
  constructor() {
    super(HttpStatus.BAD_REQUEST, 'nome_invalido')
  }
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

/**
 * O link trazia a assinatura de uma Sala fixa, mas o prazo dela passou: a Sala não volta por ele.
 * Código próprio (não sala_nao_existe) para o app dizer "expirou" e oferecer criar de novo.
 */
export class SalaExpirada extends ErroApi {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'sala_expirada')
  }
}

/** O link trazia uma assinatura que não confere — adulterada, cortada ou de outro slug. */
export class AssinaturaInvalida extends ErroApi {
  constructor() {
    super(HttpStatus.NOT_FOUND, 'assinatura_invalida')
  }
}

/** Só quem está dentro da Sala muda nome e visibilidade: a Sala não tem dono (ADR 0013). */
export class ForaDaSala extends ErroApi {
  constructor() {
    super(HttpStatus.FORBIDDEN, 'fora_da_sala')
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

/**
 * Teto das Salas adormecidas: uma Sala fixa nova (ou trazida de volta pelo link) não cabe.
 * Código próprio porque a saída é outra — a efêmera continua podendo nascer.
 */
export class MuitasGuardadas extends ErroApi {
  constructor() {
    super(HttpStatus.TOO_MANY_REQUESTS, 'muitas_guardadas')
  }
}

/** Freio (shared/freio.ts) estourado: criar ou entrar demais num intervalo curto. */
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

/** Formato único { erro } para toda resposta HttpException — inclusive as que o Nest gera sozinho (ValidationPipe, rota inexistente). */
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
