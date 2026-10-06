import { Link } from "react-router-dom";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__grid">
        <div className="footer__about">
          <Logo />
          <p>
            A hybrid movie recommendation system built as a Data Warehousing and Mining mini-project.
            It blends content-based and collaborative filtering on the MovieLens 25M dataset.
          </p>
        </div>
        <div>
          <h4>Product</h4>
          <Link to="/explore">Explore movies</Link>
          <Link to="/recommend">Get recommendations</Link>
          <Link to="/analytics">Analytics</Link>
        </div>
        <div>
          <h4>Learn</h4>
          <Link to="/how-it-works">How it works</Link>
          <Link to="/#methods">Recommendation methods</Link>
        </div>
        <div>
          <h4>Built with</h4>
          <span>React, Vite, Recharts</span>
          <span>FastAPI, Pandas, scikit-learn</span>
          <span>SciPy sparse matrices</span>
        </div>
      </div>
      <div className="container footer__bar">
        <span>MovieMind, DWM mini-project</span>
        <span>Dataset: Kaggle MovieLens 25M</span>
      </div>
    </footer>
  );
}
