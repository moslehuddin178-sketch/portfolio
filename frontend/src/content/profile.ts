// ─────────────────────────────────────────────────────────────────────────────
// Everything personal on the site lives in this file. Replace each placeholder
// with your own details. Only list projects and experience that are real:
// empty lists simply hide their section.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExternalLink {
  label: string
  href: string
}

export interface Project {
  title: string
  summary: string
  highlights: string[]
  stack: string[]
  links: ExternalLink[]
}

export interface Experience {
  role: string
  organisation: string
  period: string
  points: string[]
}

export interface SkillGroup {
  group: string
  items: string[]
}

export interface Profile {
  name: string
  role: string
  location: string
  tagline: string
  about: string[]
  email: string
  links: ExternalLink[]
  skills: SkillGroup[]
  projects: Project[]
  experience: Experience[]
}

export const profile: Profile = {
  name: 'Mosleh Rupok',
  role: 'Business Information Technology student',
  location: 'Tampere, Finland',
  tagline: 'I build web applications with React, TypeScript and Go, and ship them to Microsoft Azure through automated pipelines.',
  about: [
    // TODO: expand in your own words: the kind of problems you enjoy and what you are looking for next.
    'I study Business Information Technology at LAB University of Applied Sciences and live in Tampere, Finland.',
    'This website is one of my projects. The frontend is React and TypeScript on Azure Static Web Apps, the API is a Go service in a Docker container on Azure Container Apps, and every push to main is tested and deployed by GitHub Actions. The infrastructure page documents exactly how, and shows the live deployment status.',
  ],
  // Shown publicly on the Contact section. Leave empty to show only the links below.
  email: '',
  links: [
    { label: 'GitHub', href: 'https://github.com/moslehuddin178-sketch' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/mosleh-rupok-1b72b63a2/' },
  ],
  // These are the technologies this repository actually uses. Add your others.
  skills: [
    { group: 'Frontend', items: ['React', 'TypeScript', 'Vite', 'Vitest', 'Testing Library', 'CSS'] },
    { group: 'Backend', items: ['Go', 'REST API design', 'net/http', 'Structured logging (slog)'] },
    { group: 'Cloud & DevOps', items: ['Azure Static Web Apps', 'Azure Container Apps', 'Azure Monitor / Log Analytics', 'Docker', 'GitHub Actions', 'OIDC workload identity', 'Azure CLI'] },
  ],
  projects: [
    {
      title: 'Portfolio on Microsoft Azure',
      summary:
        'This site: a React + TypeScript frontend and an optional Go REST API, containerised with Docker and deployed to Azure by a GitHub Actions pipeline.',
      highlights: [
        'Frontend served by Azure Static Web Apps (Free plan) with managed HTTPS, and published to GitHub Pages by the same pipeline.',
        'Go API in a ~4 MB distroless container on Azure Container Apps that scales to zero when idle.',
        'GitHub Actions runs the tests, builds and validates the Docker image, then deploys with OIDC: no Azure passwords stored in GitHub.',
        'Each deploy is verified: the pipeline waits until the live site and API report the new commit SHA.',
      ],
      stack: ['React', 'TypeScript', 'Go', 'Docker', 'GitHub Actions', 'Azure Static Web Apps', 'Azure Container Apps'],
      links: [{ label: 'How it is built and deployed', href: '/infrastructure' }],
    },
    // TODO: add your other real projects here, e.g.
    // {
    //   title: 'Project name',
    //   summary: 'One sentence on what it does and who it is for.',
    //   highlights: ['What you built', 'A measurable result, if you have one'],
    //   stack: ['Tech', 'Used'],
    //   links: [{ label: 'Source', href: 'https://github.com/…' }],
    // },
  ],
  experience: [
    // TODO: add real roles, internships or volunteer work, e.g.
    // { role: 'Software Engineering Intern', organisation: 'Company', period: '2025 – 2026', points: ['What you did'] },
  ],
}

/** True while the template placeholders are still in place. */
export const hasPlaceholders = profile.name === 'Your Name' || profile.email === 'you@example.com'
