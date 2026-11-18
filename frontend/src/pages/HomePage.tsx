import { Link } from 'react-router'
import { GitHubRepos } from '../components/GitHubRepos'
import { Section } from '../components/Section'
import { SmartLink } from '../components/SmartLink'
import { profile } from '../content/profile'

export default function HomePage() {
  return (
    <>
      <title>{`${profile.name} · ${profile.role}`}</title>

      <section className="hero" aria-labelledby="hero-title">
        <div className="container">
          <p className="eyebrow">
            {profile.role} · {profile.location}
          </p>
          <h1 id="hero-title">{profile.name}</h1>
          <p className="lede">{profile.tagline}</p>
          <div className="actions">
            <Link className="button button-primary" to="/#projects">
              View projects
            </Link>
            <Link className="button" to="/infrastructure">
              How this site runs on Azure
            </Link>
          </div>
        </div>
      </section>

      <Section id="about" title="About">
        <div className="prose">
          {profile.about.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </Section>

      <Section id="skills" title="Skills">
        <div className="skill-groups">
          {profile.skills.map((group) => (
            <div key={group.group} className="skill-group">
              <h3 className="subheading">{group.group}</h3>
              <ul className="chips">
                {group.items.map((item) => (
                  <li key={item} className="chip">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section id="projects" title="Projects">
        <div className="project-list">
          {profile.projects.map((project) => (
            <article key={project.title} className="card project-card">
              <h3>{project.title}</h3>
              <p>{project.summary}</p>
              {project.highlights.length > 0 && (
                <ul className="ticks">
                  {project.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              )}
              <ul className="chips chips-small" aria-label="Technologies">
                {project.stack.map((s) => (
                  <li key={s} className="chip">
                    {s}
                  </li>
                ))}
              </ul>
              {project.links.length > 0 && (
                <p className="project-links">
                  {project.links.map((link) => (
                    <SmartLink key={link.href} href={link.href} className="arrow-link">
                      {link.label}
                    </SmartLink>
                  ))}
                </p>
              )}
            </article>
          ))}
        </div>
        <GitHubRepos />
      </Section>

      {profile.experience.length > 0 && (
        <Section id="experience" title="Experience">
          <ol className="timeline">
            {profile.experience.map((job) => (
              <li key={`${job.organisation}-${job.period}`} className="timeline-item">
                <h3>
                  {job.role} · {job.organisation}
                </h3>
                <p className="muted">{job.period}</p>
                <ul>
                  {job.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section id="contact" title="Contact">
        {profile.email && (
          <p className="contact-line">
            The best way to reach me is email: <a href={`mailto:${profile.email}`}>{profile.email}</a>
          </p>
        )}
        <ul className="link-row">
          {profile.links.map((link) => (
            <li key={link.href}>
              <SmartLink href={link.href} className="arrow-link">
                {link.label}
              </SmartLink>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
