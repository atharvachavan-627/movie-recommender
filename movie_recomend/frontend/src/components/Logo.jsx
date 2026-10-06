export default function Logo({ light = false }) {
  return (
    <span className={`logo ${light ? "logo--light" : ""}`}>
      <svg className="logo__mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" />
        <path d="M18 44V20l14 15 14-15v24" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="46" cy="20" r="4" fill="#E5383B" />
      </svg>
      <span className="logo__word">MovieMind</span>
    </span>
  );
}
