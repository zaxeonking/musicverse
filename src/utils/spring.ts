/**
 * Easing pegas (spring) untuk animasi sheet dan umpan balik: kurva `linear()` dari gerak pegas teredam, bukan cubic-bezier
 * yang hanya meniru. Teredam hampir kritis (zeta 0,9): awal cepat, mendarat lembut, lampauan < 0,2%, jadi tidak terasa memantul
 * dan sheet yang menempel di tepi bawah layar tidak membuka celah. Dihitung sekali saat dipakai pertama.
 */
const cache = new Map<string, string>()

export const supportsLinearEasing = (): boolean =>
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('animation-timing-function', 'linear(0, 1)')

/** `omega` = kekakuan (rad/detik), `settle` = detik sampai mengendap, `zeta` = redaman (<1 = melampaui sedikit). */
export function springEasing(fallback: string, zeta = 0.9, omega = 22, settle = 0.5, samples = 36): string {
  if (!supportsLinearEasing()) return fallback
  const key = `${zeta}|${omega}|${settle}|${samples}`
  const hit = cache.get(key)
  if (hit) return hit
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const points: string[] = []
  for (let i = 0; i <= samples; i++) {
    const t = (settle * i) / samples
    const x = 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t))
    points.push(i === samples ? '1' : String(Math.round(x * 10000) / 10000))
  }
  const easing = `linear(${points.join(', ')})`
  cache.set(key, easing)
  return easing
}
