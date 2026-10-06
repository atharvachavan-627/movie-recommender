import { Link } from "react-router-dom";
import { ArrowRight, FileText, Layers, Users, Shuffle, Info } from "lucide-react";

const SECTIONS = [
  {
    icon: FileText, tone: "star", title: "1. Data cleaning and transformation",
    items: [
      ["Dataset", "MovieLens 25M, loaded from movies.csv and ratings.csv."],
      ["Cleaning", "Missing genres and the placeholder (no genres listed) are normalized."],
      ["Feature extraction", "Release year is parsed from the movie title with a regular expression."],
      ["Memory", "IDs are cast to int32 and ratings to float32 so 25 million rows stay manageable."],
    ],
  },
  {
    icon: Layers, tone: "content", title: "2. Content-based genre mining",
    items: [
      ["TF-IDF vectors", "Each movie's genres become a weighted vector in a shared vocabulary."],
      ["Cosine similarity", "Two movies are compared by the angle between their vectors."],
    ],
    formula: "Cosine Similarity(A, B) = (A . B) / (||A|| x ||B||)",
  },
  {
    icon: Users, tone: "collab", title: "3. Item-item collaborative filtering",
    items: [
      ["Sparse matrix", "User ratings are stored in a SciPy CSR user-movie matrix."],
      ["Pruning", "Movies with enough ratings and the most active users are kept to reduce noise."],
      ["Similarity", "Item vectors are L2-normalized and their dot products give item-item similarity."],
    ],
  },
  {
    icon: Shuffle, tone: "hybrid", title: "4. Hybrid weighted combination",
    items: [
      ["Normalization", "Content and collaborative scores are min-max scaled to the 0 to 1 range."],
      ["Blending", "The two scores are combined linearly using the chosen weights."],
    ],
    formula: "Hybrid Score = 0.4 x Content Score + 0.6 x Collaborative Score",
  },
];

export default function HowItWorks() {
  return (
    <div className="container page page--narrow">
      <header className="page__head">
        <h1>How MovieMind works</h1>
        <p>A look at the data mining pipeline behind every recommendation, from raw CSV files to a ranked list.</p>
      </header>

      <div className="doc">
        {SECTIONS.map((s) => (
          <section key={s.title} className="card doc__block">
            <h2 className="doc__title"><span className={`doc__icon bg-${s.tone}`}><s.icon size={18} /></span>{s.title}</h2>
            <dl className="doc__list">
              {s.items.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
            </dl>
            {s.formula && <code className="formula">{s.formula}</code>}
          </section>
        ))}

        <aside className="note">
          <Info size={20} />
          <p>
            The 0.4 and 0.6 weights are an initial baseline, not a proven optimum. You can change them on any
            recommendation page to see how the ranking responds.
          </p>
        </aside>

        <div className="center">
          <Link to="/recommend" className="btn btn--primary btn--lg">Try it on a movie <ArrowRight size={18} /></Link>
        </div>
      </div>
    </div>
  );
}
