import { Link } from "react-router-dom";
import { 
  Compass, 
  Star, 
  Sparkles, 
  Users, 
  Sliders, 
  ArrowRight, 
  Film, 
  Layers,
  CheckCircle2,
  Heart
} from "lucide-react";

export default function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: Compass,
      title: "Explore the Movie Catalog",
      desc: "Browse thousands of movies across 19 genres, from Hollywood classics to modern indie releases. Search by title, filter by genre, and discover details on any film."
    },
    {
      num: "02",
      icon: Star,
      title: "Rate Movies You Enjoy",
      desc: "Give star ratings to movies you have watched. Your ratings help MovieMind understand your unique cinematic tastes and specific genre preferences."
    },
    {
      num: "03",
      icon: Sparkles,
      title: "MovieMind Learns Your Preferences",
      desc: "Our recommendation engine analyzes your ratings to build a personalized profile, identifying thematic elements and genre blends that resonate most with you."
    },
    {
      num: "04",
      icon: Users,
      title: "Smart Similarity Matching",
      desc: "We look for patterns across millions of film enthusiast ratings to identify titles frequently enjoyed by viewers with similar tastes to yours."
    },
    {
      num: "05",
      icon: Sliders,
      title: "Personalized Hybrid Recommendations",
      desc: "You receive tailored recommendations combining story attributes with community ratings. Fine-tune recommendations on the fly using simple balance sliders."
    }
  ];

  return (
    <div className="container page page--narrow">
      <header className="page__head page__head--center">
        <span className="badge badge--brand" style={{ marginBottom: "8px" }}>DISCOVERY ENGINE</span>
        <h1>How MovieMind Works</h1>
        <p>A simple, transparent look at how MovieMind learns what you love and delivers tailored movie suggestions.</p>
      </header>

      {/* 5 Easy Steps */}
      <div className="how-steps-list">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.num} className="card how-step-card">
              <div className="how-step-num">{s.num}</div>
              <div className="how-step-icon-wrap">
                <Icon size={24} />
              </div>
              <div className="how-step-body">
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Pillars Explained Simply */}
      <section className="card how-comparison-card">
        <h2>The Two Pillars of Recommendation</h2>
        <p className="muted" style={{ marginBottom: "20px" }}>
          MovieMind blends two complementary techniques to give you balanced, serendipitous suggestions.
        </p>

        <div className="how-pillars-grid">
          {/* Pillar 1 */}
          <div className="how-pillar">
            <div className="how-pillar-badge bg-content">
              <Film size={20} />
            </div>
            <h3>Content Matching</h3>
            <p>
              <strong>What it does:</strong> Finds movies with similar genres, themes, and attributes to the ones you like.
            </p>
            <div className="how-pillar-example">
              <em>Example: If you loved "Inception", it suggests mind-bending Sci-Fi thrillers like "Interstellar" and "The Matrix".</em>
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="how-pillar">
            <div className="how-pillar-badge bg-collab">
              <Users size={20} />
            </div>
            <h3>Community Wisdom</h3>
            <p>
              <strong>What it does:</strong> Identifies movies frequently co-rated and loved together by people who share your tastes.
            </p>
            <div className="how-pillar-example">
              <em>Example: Discovers surprising gems in other genres that audiences with your viewing habits also rated 5 stars.</em>
            </div>
          </div>
        </div>

        <div className="how-blending-box">
          <Heart size={20} className="text-brand" />
          <span>
            <strong>The Hybrid Difference:</strong> By blending content attributes and community ratings, MovieMind prevents recommendation bubbles while still keeping every recommendation highly relevant.
          </span>
        </div>
      </section>

      {/* Call to Action */}
      <div className="center" style={{ gap: "12px", marginTop: "32px", marginBottom: "40px" }}>
        <Link to="/recommend" className="btn btn--primary btn--lg">
          <span>Get Recommendations</span>
          <ArrowRight size={18} />
        </Link>
        <Link to="/explore" className="btn btn--secondary btn--lg">
          <span>Explore Movies</span>
        </Link>
      </div>
    </div>
  );
}
