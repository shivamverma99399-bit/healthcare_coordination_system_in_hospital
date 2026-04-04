import { Link } from "react-router-dom";


export default function NotFoundPage() {
  return (
    <div className="section-shell py-20">
      <div className="glass-panel p-10 text-center">
        <p className="font-display text-5xl font-bold tracking-tight">404</p>
        <p className="mt-4 text-slate-500">The page you requested is not part of the MEDPULSE flow.</p>
        <Link to="/" className="primary-button mt-6">
          Return home
        </Link>
      </div>
    </div>
  );
}
