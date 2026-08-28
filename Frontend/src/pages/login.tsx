import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import loginPanel from '../assets/login-panel.png';
import logoOrchid from '../assets/logoOrchidIsland.png';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/analytique', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError('');

    if (!email.trim() || !password) {
      setLocalError('Veuillez renseigner votre adresse email et votre mot de passe.');
      return;
    }

    try {
      await login({ email: email.trim(), password });
      navigate('/analytique', { replace: true });
    } catch {
      // Erreur gérée par le store
    }
  };

  const displayError = localError || error;

  return (
    <main className="login-page">
      {/* ── Panneau visuel gauche ────────────────────────── */}
      <section className="login-visual" aria-label="Présentation d'Orchid Island">
        <img className="login-visual-image" src={loginPanel} alt="Architecture marocaine" />
        <div className="login-visual-overlay" />
        <div className="login-visual-content">
        

          <div className="login-visual-copy">
            <span className="login-eyebrow">Due diligence immobilière</span>
            <h1>Investissez avec une vision plus claire.</h1>
            <p>
              Les données essentielles du marché immobilier marocain, réunies dans un espace simple et sécurisé.
            </p>
          </div>

          <div className="login-visual-footer">
            <span className="login-status-dot" />
            Données fiables · Décisions éclairées
          </div>
        </div>
      </section>

      {/* ── Panneau formulaire droit ─────────────────────── */}
      <section className="login-form-panel">
        <div className="login-mobile-brand">
          <img src={logoOrchid} alt="Orchid Island" />
          <span>Due diligence</span>
        </div>

        <div className="login-card">
          {/* En-tête de la carte avec Logo de la marque */}
          <div className="login-card-header" style={{ textAlign: 'center' }}>
            <div className="login-card-brand" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
              <img
                src={logoOrchid}
                alt="Orchid Island Logo"
                style={{ height: 64, width: 'auto', objectFit: 'contain', marginBottom: 4 }}
              />
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#9a421d', opacity: 0.85 }}>
                Due diligence
              </span>
            </div>
           
       
          </div>
        

          {/* Formulaire de connexion */}
          <form onSubmit={handleSubmit} className="login-form" noValidate>
            {/* Champ Email */}
            <div className="login-field">
              <label htmlFor="email">Adresse email</label>
              <div className="login-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Champ Mot de passe */}
            <div className="login-field">
              <div className="login-input-wrap">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Erreur */}
            {displayError && (
              <div className="login-error" role="alert">
                {displayError}
              </div>
            )}

            {/* Bouton Soumettre */}
            <button className="login-submit" type="submit" disabled={isLoading}>
              {isLoading ? (
                'Connexion en cours…'
              ) : (
                <>
                  Se connecter <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

        
         
        </div>

        {/* Pied de page */}
        <p className="login-legal">© 2026 Orchid Island · Marrakech, Maroc</p>
      </section>
    </main>
  );
}
