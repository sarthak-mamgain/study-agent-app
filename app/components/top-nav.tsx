import Link from 'next/link'

export function TopNav() {
  return (
    <header className="border-b border-white/10 bg-[#07111f]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6 lg:px-8">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-100">
          Study Agent
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-300">
          <Link href="/" className="transition hover:text-white">
            Chat
          </Link>
          <Link href="/dashboard" className="transition hover:text-white">
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  )
}
