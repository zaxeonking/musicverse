/**
 * Indeks tab navigasi yang aktif menurut alamat, dengan aturan yang sama seperti NavLink: `/` hanya cocok persis, tab lain
 * cocok untuk alamatnya sendiri dan semua turunannya (`/library` dan `/library/abc`, bukan `/libraryx`). -1 bila tidak ada.
 * Dipakai BottomNav untuk menggeser "lensa kaca" penanda tab aktif.
 */
export function activeNavIndex(pathname: string, paths: readonly string[]): number {
  return paths.findIndex((to) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)))
}
