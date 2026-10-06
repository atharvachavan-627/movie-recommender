import { pct } from "../utils/movies";

export default function ScoreBar({ label, value, tone, strong = false }) {
  return (
    <div className={`score ${strong ? "score--strong" : ""}`}>
      <div className="score__row">
        <span className={`score__label tone-${tone}`}>{label}</span>
        <span className="score__value">{pct(value)}</span>
      </div>
      <div className="score__track">
        <div className={`score__fill fill-${tone}`} style={{ width: pct(value) }} />
      </div>
    </div>
  );
}
