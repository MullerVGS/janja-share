import estilos from './Marca.module.css'

export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <span className={[estilos.marca, compacta ? estilos.compacta : ''].filter(Boolean).join(' ')}>
      <span className={estilos.simbolo} aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path d="M9.25 10.25A3.25 3.25 0 0 1 12.5 7h10.25A3.25 3.25 0 0 1 26 10.25v7.5A3.25 3.25 0 0 1 22.75 21H12.5a3.25 3.25 0 0 1-3.25-3.25v-7.5Z" />
          <path d="M6 12.75v7A3.25 3.25 0 0 0 9.25 23h9.5" opacity=".72" />
          <path d="m16.25 12 4 2-4 2v-4Z" fill="currentColor" stroke="none" />
        </svg>
      </span>
      {!compacta && <span className={estilos.nome}>janja-share</span>}
    </span>
  )
}
