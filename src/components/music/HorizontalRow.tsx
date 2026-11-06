import type { ReactNode } from 'react'

export default function HorizontalRow({ children }: { children: ReactNode }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:gap-4 sm:px-6 lg:-mx-8 lg:px-8">
      {children}
    </div>
  )
}
