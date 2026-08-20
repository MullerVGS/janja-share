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

export function IconeTrocarTela(props: Props) {
  return (
    <Traco {...props}>
      <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
      <path d="M8.5 20.5h7" />
      <path d="M8.5 9h7l-2-2M15.5 12.5h-7l2 2" />
    </Traco>
  )
}

export function IconePararTela(props: Props) {
  return (
    <Traco {...props}>
      <rect x="2.5" y="4" width="19" height="13" rx="2.5" />
      <path d="M8.5 20.5h7" />
      <path d="M9.5 8.5h5v5h-5z" />
    </Traco>
  )
}

export function IconeSom(props: Props) {
  return (
    <Traco {...props}>
      <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
      <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10" />
    </Traco>
  )
}

export function IconeSomMudo(props: Props) {
  return (
    <Traco {...props}>
      <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
      <path d="M16 10l5 4M21 10l-5 4" />
    </Traco>
  )
}

export function IconeTelaCheia(props: Props) {
  return (
    <Traco {...props}>
      <path d="M4 9V4.5h5M20 9V4.5h-5M4 15v4.5h5M20 15v4.5h-5" />
    </Traco>
  )
}

export function IconeSairDaTelaCheia(props: Props) {
  return (
    <Traco {...props}>
      <path d="M9 4.5V9H4.5M15 4.5V9h4.5M9 19.5V15H4.5M15 19.5V15h4.5" />
    </Traco>
  )
}

export function IconeJanelinha(props: Props) {
  return (
    <Traco {...props}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <rect x="12" y="11" width="8" height="6.5" rx="1.5" />
    </Traco>
  )
}

export function IconePixelAPixel(props: Props) {
  return (
    <Traco {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M9.5 3.5v17M15.5 3.5v17M3.5 9.5h17M3.5 15.5h17" />
    </Traco>
  )
}

export function IconeCaber(props: Props) {
  return (
    <Traco {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <rect x="7" y="8.5" width="10" height="7" rx="1" />
    </Traco>
  )
}

export function IconePainel(props: Props) {
  return (
    <Traco {...props}>
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
      <path d="M14.5 4v16" />
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

export function IconeCadeado(props: Props) {
  return (
    <Traco {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
    </Traco>
  )
}
