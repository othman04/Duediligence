import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Mail,
  Calendar,
  Lock
} from 'lucide-react';
import { MainLayout } from '../components/MainLayout';
import { useAuthStore } from '../store/authStore';

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  terra:      '#9A421D',
  terraDark:  '#7A3216',
  terraDeep:  '#5C240E',
  terraLight: '#C05A30',
  terraGlow:  'rgba(154,66,29,0.16)',
  terraMuted: 'rgba(154,66,29,0.08)',
  ink:        '#1A1410',
  inkSoft:    '#3A3028',
  inkMuted:   '#7A6E66',
  sand:       '#D0C0A8',
  sandLight:  '#E8DDD0',
  sandPale:   '#F0EAE2',
  mist:       '#F4F1EC',
  paper:      '#FEFCF8',
  gold:       '#C49A5A',
  emerald:    '#2E7D32',
};

export default function ProfilePage() {
  const { user, changePassword, isLoading } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMsg('Veuillez remplir tous les champs du formulaire.');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('La confirmation du nouveau mot de passe ne correspond pas.');
      return;
    }

    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setSuccessMsg('Votre mot de passe a été modifié avec succès !');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la modification du mot de passe.');
    }
  };

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'superAdmin':
        return { label: 'Super administrateur', color: '#5C240E', bg: 'rgba(154,66,29,0.16)' };
      case 'admin':
        return { label: 'Administrateur', color: '#9A421D', bg: 'rgba(154,66,29,0.1)' };
      default:
        return { label: 'Utilisateur', color: '#2E7D32', bg: 'rgba(46,125,50,0.1)' };
    }
  };

  const roleInfo = getRoleLabel(user?.role);
  const formattedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : 'Récemment';

  return (
    <MainLayout>
      <div style={{ minHeight: '100vh', background: '#F8F6F0', color: C.ink, fontFamily: "'Inter', sans-serif" }}>
        
        {/* ═══════ HEADER ═══════ */}
        <header style={{
          background: 'linear-gradient(135deg, #7A3216 0%, #9A421D 50%, #C05A30 100%)',
          color: '#FEFDFA',
          padding: '2.5rem 2.5rem 2.25rem',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(154,66,29,0.22)'
        }}>
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.05,
            backgroundImage: 'radial-gradient(#FEFDFA 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px', pointerEvents: 'none'
          }} />

          <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 2 }}>
           

            <h1 style={{
              fontFamily: "'Source Serif 4', serif", fontSize: 'clamp(1.8rem, 3.2vw, 2.7rem)',
              fontWeight: 400, lineHeight: 1.15, letterSpacing: '-0.015em', margin: 0, color: '#FEFDFA'
            }}>
              Mon Profil &amp; Sécurité
            </h1>
            
            <p style={{
              fontSize: '0.92rem', color: 'rgba(254,253,250,0.85)', margin: '0.6rem 0 0',
              maxWidth: 680, fontWeight: 300, lineHeight: 1.6
            }}>
              Gérez vos informations personnelles et mettez à jour la sécurité de votre compte en toute simplicité.
            </p>
          </div>
        </header>

        {/* ═══════ CONTENT ═══════ */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '2rem' }}>
          
          {/* ── LEFT CARD: User Info ── */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              background: C.paper,
              border: `1px solid ${C.sand}`,
              borderRadius: 20,
              padding: '2rem',
              boxShadow: '0 8px 30px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center'
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 90,
              height: 90,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${C.terraDeep}, ${C.terra})`,
              color: '#FEFDFA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.2rem',
              fontWeight: 700,
              boxShadow: '0 8px 24px rgba(154,66,29,0.28)',
              marginBottom: '1.25rem',
              border: '4px solid #FEFDFA'
            }}>
              {user?.firstName ? user.firstName[0].toUpperCase() : 'U'}
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: C.ink, margin: '0 0 0.25rem 0' }}>
              {user ? `${user.firstName} ${user.lastName}` : 'Utilisateur Connecté'}
            </h2>

            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0.35rem 0.9rem',
              borderRadius: 20,
              background: roleInfo.bg,
              color: roleInfo.color,
              fontSize: '0.78rem',
              fontWeight: 700,
              marginBottom: '1.75rem'
            }}>
              <Shield size={14} />
              {roleInfo.label}
            </div>

            <div style={{
              width: '100%',
              borderTop: `1px solid ${C.sandLight}`,
              paddingTop: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: C.mist,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.terra
                }}>
                  <Mail size={18} />
                </div>
                <div>
                  <span style={{ fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: C.inkMuted, fontWeight: 600 }}>
                    Adresse Email
                  </span>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, color: C.ink, margin: 0 }}>
                    {user?.email || 'N/A'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: C.mist,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.terra
                }}>
                  <Calendar size={18} />
                </div>
                <div>
                  <span style={{ fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: C.inkMuted, fontWeight: 600 }}>
                    Membre depuis
                  </span>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, color: C.ink, margin: 0 }}>
                    {formattedDate}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: C.mist,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.terra
                }}>
                  <Lock size={18} />
                </div>
                <div>
                  <span style={{ fontSize: '0.73rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: C.inkMuted, fontWeight: 600 }}>
                    Statut de la session
                  </span>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, color: C.emerald, margin: 0 }}>
                    ● Session active &amp; sécurisée
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── RIGHT CARD: Change Password Form ── */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            style={{
              background: C.paper,
              border: `1px solid ${C.sand}`,
              borderRadius: 20,
              padding: '2rem',
              boxShadow: '0 8px 30px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: `linear-gradient(135deg, ${C.terra}, ${C.terraLight})`,
                color: C.paper, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <KeyRound size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: C.ink, margin: 0 }}>
                  Modifier le mot de passe
                </h3>
                <p style={{ fontSize: '0.82rem', color: C.inkMuted, margin: 0 }}>
                  Saisissez votre mot de passe actuel puis définissez votre nouveau secret.
                </p>
              </div>
            </div>

            {/* Success Alert */}
            {successMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                style={{
                  background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 12,
                  padding: '0.85rem 1.1rem', marginBottom: '1.25rem',
                  display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#065F46', fontSize: '0.85rem'
                }}
              >
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <span>{successMsg}</span>
              </motion.div>
            )}

            {/* Error Alert */}
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                style={{
                  background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
                  padding: '0.85rem 1.1rem', marginBottom: '1.25rem',
                  display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#991B1B', fontSize: '0.85rem'
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Field: Mot de passe actuel */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: C.ink, marginBottom: '0.4rem' }}>
                  Mot de passe actuel
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={{
                      width: '100%', padding: '0.75rem 2.6rem 0.75rem 1rem',
                      borderRadius: 10, border: `1px solid ${C.sand}`,
                      background: C.mist, color: C.ink, fontSize: '0.9rem',
                      outline: 'none', transition: 'all 0.15s ease', boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: C.inkMuted, cursor: 'pointer', display: 'flex'
                    }}
                  >
                    {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Field: Nouveau mot de passe */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: C.ink, marginBottom: '0.4rem' }}>
                  Nouveau mot de passe
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Au moins 6 caractères"
                    required
                    style={{
                      width: '100%', padding: '0.75rem 2.6rem 0.75rem 1rem',
                      borderRadius: 10, border: `1px solid ${C.sand}`,
                      background: C.mist, color: C.ink, fontSize: '0.9rem',
                      outline: 'none', transition: 'all 0.15s ease', boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: C.inkMuted, cursor: 'pointer', display: 'flex'
                    }}
                  >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Field: Confirmer nouveau mot de passe */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: C.ink, marginBottom: '0.4rem' }}>
                  Confirmer le nouveau mot de passe
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Répétez le nouveau mot de passe"
                    required
                    style={{
                      width: '100%', padding: '0.75rem 2.6rem 0.75rem 1rem',
                      borderRadius: 10, border: `1px solid ${C.sand}`,
                      background: C.mist, color: C.ink, fontSize: '0.9rem',
                      outline: 'none', transition: 'all 0.15s ease', boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: C.inkMuted, cursor: 'pointer', display: 'flex'
                    }}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.85rem 1.5rem',
                  borderRadius: 12,
                  border: 'none',
                  background: `linear-gradient(135deg, ${C.terraDark}, ${C.terra})`,
                  color: C.paper,
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.7 : 1,
                  boxShadow: '0 4px 18px rgba(154,66,29,0.28)',
                  transition: 'all 0.18s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                {isLoading ? (
                  <span>Modification en cours…</span>
                ) : (
                  <>
                    <KeyRound size={16} />
                    <span>Mettre à jour le mot de passe</span>
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </MainLayout>
  );
}
