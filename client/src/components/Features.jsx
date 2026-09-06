const features = [
  {
    title: 'Scan & Capture',
    description:
      'Capture product images and labels via camera or upload for automated inspection.',
  },
  {
    title: 'OCR & Field Extraction',
    description:
      'Extract statutory declarations from labels using computer vision and OCR technology.',
  },
  {
    title: 'Compliance Rules',
    description:
      'Evaluate declared fields against the Legal Metrology (Packaged Commodities) Rules, 2011.',
  },
  {
    title: 'Evidence & Reports',
    description:
      'Store inspection evidence and generate compliance reports for every scanned product.',
  },
]

function Features() {
  return (
    <section className="mt-10 grid gap-6 sm:grid-cols-2">
      {features.map((feature) => (
        <div
          key={feature.title}
          className="rounded-xl border border-slate-300 bg-white p-6 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-900">
            {feature.title}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{feature.description}</p>
        </div>
      ))}
    </section>
  )
}

export default Features
