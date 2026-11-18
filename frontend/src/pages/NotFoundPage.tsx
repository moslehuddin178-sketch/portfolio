import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <section className="section not-found">
      <title>Page not found</title>
      <div className="container">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p className="lede">That page doesn’t exist. It may have moved.</p>
        <Link className="button button-primary" to="/">
          Back to the home page
        </Link>
      </div>
    </section>
  )
}
