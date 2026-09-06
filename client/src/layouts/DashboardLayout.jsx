import DashboardHeader from './DashboardHeader'

function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <DashboardHeader />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-slate-300 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 text-center text-sm text-slate-500">
          Packaged Commodity Compliance System &middot; SIH 2026 Problem
          Statement SIH26034
        </div>
      </footer>
    </div>
  )
}

export default DashboardLayout
