import { useState } from "react";
import { Check, Eye, EyeOff, LockKeyhole, UserPlus, Mail, UserRound } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

const initialForm = { name: "", email: "", username: "", password: "", confirmPassword: "" };

function passwordScore(password) {
  return [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /\d/.test(password)].filter(Boolean).length;
}

export default function Register() {
  const { isAuthenticated, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const score = passwordScore(form.password);
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim() || !form.username.trim() || !form.password) {
      setError("Complete every field to create your account.");
      return;
    }
    if (score < 4) {
      setError("Use at least 8 characters with uppercase, lowercase, and a number.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await register({ name: form.name, email: form.email, username: form.username, password: form.password });
      navigate("/", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to create your account. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page auth-page--register">
      <section className="auth__visual" aria-label="MovieMind recommendation engine">
        <div className="auth__visual-content">
          <Logo light />
          <p className="auth__eyebrow">A smarter way to browse</p>
          <h1>Keep your taste in the picture.</h1>
          <p>Build a personal doorway into MovieLens: explore, compare, and return to recommendations shaped around what you enjoy.</p>
          <div className="auth__signal"><Check size={18} /> Securely hashed passwords, private profile data</div>
        </div>
      </section>
      <section className="auth__panel">
        <div className="auth__form-wrap">
          <div className="auth__form-head"><span className="auth__mobile-logo"><Logo /></span><p className="eyebrow">Join MovieMind</p><h2>Create your account</h2><p>One account for every recommendation rabbit hole.</p></div>
          <form className="auth-form" onSubmit={submit} noValidate>
            {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}
            <label htmlFor="name">Name</label>
            <div className="auth-input"><UserRound size={18} aria-hidden="true" /><input id="name" name="name" value={form.name} onChange={update} autoComplete="name" placeholder="Alex Morgan" /></div>
            <label htmlFor="email">Email</label>
            <div className="auth-input"><Mail size={18} aria-hidden="true" /><input id="email" name="email" type="email" value={form.email} onChange={update} autoComplete="email" placeholder="you@example.com" /></div>
            <label htmlFor="username">Username</label>
            <div className="auth-input"><UserPlus size={18} aria-hidden="true" /><input id="username" name="username" value={form.username} onChange={update} autoComplete="username" placeholder="alex_morgan" /></div>
            <label htmlFor="register-password">Password</label>
            <div className="auth-input"><LockKeyhole size={18} aria-hidden="true" /><input id="register-password" name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={update} autoComplete="new-password" placeholder="Create a strong password" /><button type="button" className="icon-button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            <div className="password-meter" aria-live="polite"><span className={`password-meter__bar password-meter__bar--${score}`} /><small>{score === 4 ? "Strong password" : "Use 8+ chars, uppercase, lowercase, and a number"}</small></div>
            <label htmlFor="confirm-password">Confirm password</label>
            <div className="auth-input"><LockKeyhole size={18} aria-hidden="true" /><input id="confirm-password" name="confirmPassword" type={showConfirm ? "text" : "password"} value={form.confirmPassword} onChange={update} autoComplete="new-password" placeholder="Repeat your password" /><button type="button" className="icon-button" onClick={() => setShowConfirm((visible) => !visible)} aria-label={showConfirm ? "Hide password" : "Show password"}>{showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            <button className="btn btn--primary btn--block btn--lg" type="submit" disabled={loading}>{loading ? "Creating account..." : <><UserPlus size={18} /> Create account</>}</button>
          </form>
          <p className="auth__switch">Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </section>
    </main>
  );
}
