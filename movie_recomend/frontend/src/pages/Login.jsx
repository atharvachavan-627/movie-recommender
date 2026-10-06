import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, LogIn, Mail, ShieldCheck } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const from = location.state?.from?.pathname || "/";
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!form.identifier.trim() || !form.password) {
      setError("Enter your username or email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(form, remember);
      navigate(from, { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to sign in. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth__visual" aria-label="MovieMind recommendation engine">
        <div className="auth__visual-content">
          <Logo light />
          <p className="auth__eyebrow">Your next great watch is closer</p>
          <h1>Find the story that fits your mood.</h1>
          <p>MovieMind blends genre intelligence with the taste of thousands of viewers to make every recommendation feel considered.</p>
          <div className="auth__signal"><ShieldCheck size={18} /> Private account access for your recommendations</div>
        </div>
      </section>
      <section className="auth__panel">
        <div className="auth__form-wrap">
          <div className="auth__form-head">
            <span className="auth__mobile-logo"><Logo /></span>
            <p className="eyebrow">Welcome back</p>
            <h2>Sign in to MovieMind</h2>
            <p>Pick up where your movie search left off.</p>
          </div>
          <form className="auth-form" onSubmit={submit} noValidate>
            {error && <div className="form-alert form-alert--error" role="alert">{error}</div>}
            {notice && <div className="form-alert form-alert--info" role="status">{notice}</div>}
            <label htmlFor="identifier">Email or username</label>
            <div className="auth-input"><Mail size={18} aria-hidden="true" /><input id="identifier" name="identifier" value={form.identifier} onChange={update} autoComplete="username" placeholder="you@example.com" /></div>
            <div className="auth-label-row"><label htmlFor="login-password">Password</label><button type="button" className="text-button" onClick={() => setNotice("Password reset is not enabled in this local demo yet.")}>Forgot password?</button></div>
            <div className="auth-input"><LockKeyhole size={18} aria-hidden="true" /><input id="login-password" name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={update} autoComplete="current-password" placeholder="Enter your password" /><button type="button" className="icon-button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            <label className="check-row"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> <span>Remember me on this device</span></label>
            <button className="btn btn--primary btn--block btn--lg" type="submit" disabled={loading}>{loading ? "Signing in..." : <><LogIn size={18} /> Sign in</>}</button>
          </form>
          <p className="auth__switch">Don't have an account? <Link to="/register">Create one</Link></p>
        </div>
      </section>
    </main>
  );
}
