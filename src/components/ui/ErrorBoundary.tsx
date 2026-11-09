import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Tampilan saat anak gagal dirender. `null` = bagian itu menghilang diam-diam (deretan Beranda). */
  fallback?: ReactNode | ((reset: () => void) => ReactNode)
  /** Berubah (mis. pindah halaman) = coba render ulang anaknya. */
  resetKey?: string
}

interface State {
  failed: boolean
}

/**
 * Menangkap galat saat render supaya satu komponen yang gagal tidak mematikan seluruh aplikasi (layar kosong / aplikasi
 * tertutup sendiri). Dipakai di sekitar halaman dan di tiap blok Beranda.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }
  private lastKey: string | undefined = this.props.resetKey

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Bagian aplikasi gagal ditampilkan:', error, info.componentStack)
  }

  componentDidUpdate(): void {
    if (this.props.resetKey !== this.lastKey) {
      this.lastKey = this.props.resetKey
      if (this.state.failed) this.setState({ failed: false })
    }
  }

  private reset = () => this.setState({ failed: false })

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    const { fallback } = this.props
    if (fallback === undefined) return null
    return typeof fallback === 'function' ? fallback(this.reset) : fallback
  }
}
