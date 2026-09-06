function Hero() {
  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-8 shadow-sm sm:p-12">
      <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
        SIH 2026 &middot; Problem Statement SIH26034
      </span>
      <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        Packaged Commodity Compliance System
      </h1>
      <p className="mt-4 max-w-3xl text-base text-slate-600">
        An automated inspection platform that verifies packaged commodities
        against the Legal Metrology (Packaged Commodities) Rules, 2011 by
        scanning products, labels, and images to ensure statutory declarations
        such as net quantity, MRP, manufacturer details, and mandatory
        declarations are present and correct.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 7v4a1 1 0 001 1h2.5a1 1 0 001-1V7m-4.5 4a9 9 0 013.7-7.5M21 7v4a1 1 0 01-1 1h-2.5a1 1 0 01-1-1V7m4.5 4a9 9 0 01-3.7-7.5M4.5 11a7.5 7.5 0 1112.9-4.6M12 11v9m0 0l-3-3m3 3l3-3"
            />
          </svg>
          Scan Product
        </button>
        <p className="text-sm text-slate-500">
          Scanning, OCR and compliance verification are coming soon.
        </p>
      </div>
    </section>
  )
}

export default Hero
