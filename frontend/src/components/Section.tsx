import type { ReactNode } from 'react'

interface SectionProps {
  id: string
  title: string
  intro?: ReactNode
  children: ReactNode
}

export function Section({ id, title, intro, children }: SectionProps) {
  return (
    <section id={id} className="section" aria-labelledby={`${id}-title`}>
      <div className="container">
        <h2 id={`${id}-title`} className="section-title">
          {title}
        </h2>
        {intro && <p className="section-intro">{intro}</p>}
        {children}
      </div>
    </section>
  )
}
