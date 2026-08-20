import type { ReactNode } from 'react'

interface Props {
  tamanho?: number
}

/** Ícones de traço, herdando `currentColor` — a cor vem sempre do estado do botão. */
function Traco({ tamanho = 20, children }: Props & { children: ReactNode }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function IconeMicrofone(props: Props) {
  return (
    <Traco {...props}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" />
    </Traco>
  )
}

export function IconeMicrofoneMudo(props: Props) {
  return (
    <Traco {...props}>
      <path d="M9 5a3 3 0 0 1 6 0v5M9 10v.5a3 3 0 0 0 4.6 2.5" />
      <path d="M5 11a7 7 0 0 0 10.5 6M19 11v.5M12 18v3.5" />
      <path d="M3.5 3.5l17 17" />
    </Traco>
  )
}

export function IconeCamera(props: Props) {
  return (
    <Traco {...props}>
      <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
      <path d="M15.5 11l6-3.2v8.4l-6-3.2z" />
    </Traco>
  )
}

export function IconeCameraFechada(props: Props) {
  return (
    <Traco {...props}>
      <path d="M15.5 9.5V8.5A2.5 2.5 0 0 0 13 6H6.5M2.6 6.6A2.5 2.5 0 0 0 2.5 8.5v7A2.5 2.5 0 0 0 5 18h8a2.5 2.5 0 0 0 2.4-1.8" />
      <path d="M15.5 11l6-3.2v8.4l-3-1.6" />
      <path d="M3.5 3.5l17 17" />
    </Traco>
  )
}

export function IconeTela(props: Props) {
  return (
    <Traco {...props}>
      <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
      <path d="M8.5 20.5h7M12 10.5V14M12 10.5l-2 2M12 10.5l2 2" transform="rotate(180 12 12.25)" />
    </Traco>
  )
}

export function IconeSair(props: Props) {
  return (
    <Traco {...props}>
      <path d="M15 4.5h3.5A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5H15" />
      <path d="M10 8l-4 4 4 4M6 12h9" />
    </Traco>
  )
}

export function IconeChat(props: Props) {
  return (
    <Traco {...props}>
      <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-8l-5 4v-4H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5z" />
    </Traco>
  )
}

export function IconeAjustes(props: Props) {
  return (
    <Traco {...props}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="8" cy="17" r="2.2" />
    </Traco>
  )
}

export function IconeFixar(props: Props) {
  return (
    <Traco {...props}>
      <path d="M9 3.5h6l-.8 5.2 3.3 3.3H6.5l3.3-3.3z" />
      <path d="M12 12v8.5" />
    </Traco>
  )
}

export function IconeCopiar(props: Props) {
  return (
    <Traco {...props}>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M4.5 15.5A1.5 1.5 0 0 1 3.5 14V5A1.5 1.5 0 0 1 5 3.5h9a1.5 1.5 0 0 1 1.5 1.5" />
    </Traco>
  )
}

export function IconeCerto(props: Props) {
  return (
    <Traco {...props}>
      <path d="M4.5 12.5l5 5 10-11" />
    </Traco>
  )
}
