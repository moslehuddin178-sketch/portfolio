import { useId } from 'react'

interface NodeProps {
  x: number
  y: number
  w: number
  h?: number
  title: string
  sub?: string
  azure?: boolean
}

function Node({ x, y, w, h = 64, title, sub, azure }: NodeProps) {
  const cx = x + w / 2
  return (
    <g className={azure ? 'dg-node dg-azure' : 'dg-node'}>
      <rect x={x} y={y} width={w} height={h} rx={10} />
      <text x={cx} y={sub ? y + h / 2 - 4 : y + h / 2 + 5} className="dg-title" textAnchor="middle">
        {title}
      </text>
      {sub && (
        <text x={cx} y={y + h / 2 + 15} className="dg-sub" textAnchor="middle">
          {sub}
        </text>
      )}
    </g>
  )
}

interface EdgeProps {
  from: [number, number]
  to: [number, number]
  deploy?: boolean
  marker: string
}

function Edge({ from, to, deploy, marker }: EdgeProps) {
  return (
    <line
      x1={from[0]}
      y1={from[1]}
      x2={to[0]}
      y2={to[1]}
      className={deploy ? 'dg-edge dg-edge-deploy' : 'dg-edge'}
      markerEnd={`url(#${marker})`}
    />
  )
}

function Label({ x, y, anchor = 'middle', children }: { x: number; y: number; anchor?: 'start' | 'middle' | 'end'; children: string }) {
  return (
    <text x={x} y={y} textAnchor={anchor} className="dg-label">
      {children}
    </text>
  )
}

/**
 * Runtime traffic (solid) and the delivery path (dashed). Coordinates are in a
 * 900×590 viewBox; the wrapper scrolls horizontally on narrow screens.
 */
export function ArchitectureDiagram() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const runtimeArrow = `${uid}-arrow-runtime`
  const deployArrow = `${uid}-arrow-deploy`

  return (
    <figure className="diagram">
      <div className="diagram-scroll">
        <svg
          viewBox="0 0 900 590"
          role="img"
          aria-labelledby={`${uid}-title ${uid}-desc`}
          className="diagram-svg"
        >
          <title id={`${uid}-title`}>Architecture of this portfolio on Azure</title>
          <desc id={`${uid}-desc`}>
            Visitors load the React app from Azure Static Web Apps and call the Go API on Azure Container Apps, which
            reads public repositories from the GitHub REST API and writes logs to Log Analytics. A git push to GitHub
            triggers GitHub Actions, which uploads the frontend build to Static Web Apps, pushes the API image to GitHub
            Container Registry and deploys a new Container Apps revision using OIDC.
          </desc>
          <defs>
            <marker id={runtimeArrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" className="dg-head" />
            </marker>
            <marker id={deployArrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" className="dg-head-deploy" />
            </marker>
          </defs>

          {/* Zones */}
          <g className="dg-zone">
            <rect x={12} y={140} width={876} height={150} rx={14} />
            <text x={872} y={162} textAnchor="end" className="dg-zone-label">
              AZURE · RESOURCE GROUP rg-portfolio
            </text>
          </g>
          <g className="dg-zone">
            <rect x={210} y={340} width={678} height={200} rx={14} />
            <text x={226} y={362} className="dg-zone-label">
              GITHUB
            </text>
          </g>

          {/* Runtime path */}
          <Node x={230} y={24} w={200} title="Visitor’s browser" sub="React SPA" />
          <Node x={660} y={24} w={210} title="GitHub REST API" sub="public repositories" />
          <Node x={40} y={178} w={230} azure title="Static Web Apps" sub="Free plan · custom domain · TLS" />
          <Node x={340} y={178} w={230} azure title="Container Apps" sub="Go API · scales 0 → 1 replica" />
          <Node x={640} y={178} w={230} azure title="Log Analytics" sub="console + system logs" />

          <Edge from={[290, 88]} to={[180, 176]} marker={runtimeArrow} />
          <Label x={222} y={126} anchor="end">
            pages over HTTPS
          </Label>
          <Edge from={[370, 88]} to={[440, 176]} marker={runtimeArrow} />
          <Label x={418} y={126} anchor="start">
            fetch /api/v1/* (CORS)
          </Label>
          <Edge from={[540, 176]} to={[700, 90]} marker={runtimeArrow} />
          <Label x={660} y={134} anchor="start">
            cached 15 min
          </Label>
          <Edge from={[570, 210]} to={[638, 210]} marker={runtimeArrow} />
          <Label x={604} y={202}>
            logs
          </Label>

          {/* Delivery path */}
          <Node x={30} y={390} w={140} title="Developer" sub="git push" />
          <Node x={232} y={390} w={180} title="Repository" sub="main branch" />
          <Node x={446} y={384} w={200} h={76} title="GitHub Actions" sub="test · build · validate" />
          <Node x={680} y={390} w={190} title="Container Registry" sub="ghcr.io · tag = commit SHA" />

          <Edge from={[170, 422]} to={[230, 422]} deploy marker={deployArrow} />
          <Edge from={[412, 422]} to={[444, 422]} deploy marker={deployArrow} />
          <Edge from={[646, 422]} to={[678, 422]} deploy marker={deployArrow} />
          <Edge from={[470, 384]} to={[192, 245]} deploy marker={deployArrow} />
          <Label x={300} y={322} anchor="end">
            upload dist/ (deploy token)
          </Label>
          <Edge from={[546, 384]} to={[472, 245]} deploy marker={deployArrow} />
          <Label x={524} y={322} anchor="start">
            deploy :sha (OIDC)
          </Label>
          <Edge from={[740, 390]} to={[562, 245]} deploy marker={deployArrow} />
          <Label x={668} y={322} anchor="start">
            pull image
          </Label>

          {/* Legend */}
          <g className="dg-legend">
            <line x1={232} y1={566} x2={272} y2={566} className="dg-edge" />
            <text x={280} y={570} className="dg-sub">
              request at runtime
            </text>
            <line x1={430} y1={566} x2={470} y2={566} className="dg-edge dg-edge-deploy" />
            <text x={478} y={570} className="dg-sub">
              delivery on push to main
            </text>
          </g>
        </svg>
      </div>
      <figcaption className="fineprint">
        Solid arrows are what happens when someone visits; dashed arrows are what happens when code is pushed. Every
        Azure resource shown sits in one resource group, so the whole system can be deleted with a single command.
      </figcaption>
    </figure>
  )
}
