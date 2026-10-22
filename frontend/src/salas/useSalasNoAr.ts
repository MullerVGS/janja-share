import { useQuery } from '@tanstack/react-query'
import { listarSalas } from '../api/salas'

/**
 * As Salas públicas acordadas, como a coluna de salas as mostra. Uma query só para o saguão e
 * para a sala: a coluna é a mesma nas duas telas, e trocar de uma para a outra não refaz a ida.
 *
 * `refetchOnWindowFocus` liga aqui, na query — não no `QueryClient` global, que fica desligado
 * de propósito para o resto do app (uma sala que sumiu não melhora com insistência; a lista sim).
 */
export function useSalasNoAr() {
  return useQuery({
    queryKey: ['salas'],
    queryFn: listarSalas,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  })
}
