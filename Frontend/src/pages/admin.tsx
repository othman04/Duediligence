import { useState, useEffect } from 'react';
import { MainLayout } from '../components/MainLayout';
import { useAuthStore } from '../store/authStore';
import {
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Mail,
  Lock,
  User,
  Users,
  Trash2
} from 'lucide-react';

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  terra:      '#9A421D',
  terraDark:  '#7A3216',
  terraDeep:  '#5C240E',
  terraLight: '#C05A30',
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
  success:    '#2E7D32',
  successBg:  '#E8F5E9',
  error:      '#C62828',
  errorBg:    '#FFEBEE'
};

const ZelligeSVG = () => (
  <svg
    aria-hidden="true"
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.025, pointerEvents: 'none', color: C.terra }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <pattern id="zs-admin" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
        <rect width="40" height="40" fill="none" />
        <rect x="10" y="10" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="0.8" />
        <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="0.5" />
        <line x1="40" y1="0" x2="30" y2="10" stroke="currentColor" strokeWidth="0.5" />
        <line x1="0" y1="40" x2="10" y2="30" stroke="currentColor" strokeWidth="0.5" />
        <line x1="40" y1="40" x2="30" y2="30" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="20" cy="20" r="2" fill="currentColor" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#zs-admin)" />
  </svg>
);

export default function AdminPage() {
  const { createAdminUser, fetchUsers, deleteAdminUser, user: currentUser } = useAuthStore();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'admin' as 'admin' | 'superAdmin',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Liste des administrateurs
  const [createdAdmins, setCreatedAdmins] = useState<Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    date: string;
  }>>([]);

  useEffect(() => {
    let isMounted = true;
    const loadUsers = async () => {
      try {
        const users = await fetchUsers();
        if (isMounted && users && users.length > 0) {
          const formatted = users.map((u: any) => ({
            id: u._id || u.id || Math.random().toString(),
            firstName: u.firstName || 'Utilisateur',
            lastName: u.lastName || '',
            email: u.email || '',
            role: u.role || 'admin',
            date: u.created_at ? new Date(u.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
          }));
          setCreatedAdmins(formatted);
        }
      } catch (err) {
        console.error("Impossible de charger les utilisateurs du backend:", err);
      }
    };
    loadUsers();
    return () => { isMounted = false; };
  }, [fetchUsers]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    // Validation des champs
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.password) {
      setErrorMessage('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    if (formData.password.length < 6) {
      setErrorMessage('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setIsSubmitting(true);

    try {
      const newCreatedUser = await createAdminUser({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        password: formData.password,
        role: formData.role
      });

      const newAdminItem = {
        id: newCreatedUser._id || Date.now().toString(),
        firstName: newCreatedUser.firstName || formData.firstName,
        lastName: newCreatedUser.lastName || formData.lastName,
        email: newCreatedUser.email || formData.email,
        role: newCreatedUser.role,
        date: newCreatedUser.created_at ? new Date(newCreatedUser.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      };

      setCreatedAdmins([newAdminItem, ...createdAdmins]);
      setSuccessMessage(`Le compte ${formData.role === 'superAdmin' ? 'super administrateur' : 'administrateur'} de ${formData.firstName} ${formData.lastName} a été créé avec succès.`);

      // Réinitialiser le formulaire
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'admin',
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de la création de l\'administrateur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAdmin = async (id: string, name: string) => {
    if (currentUser?._id === id) {
      setErrorMessage("Vous ne pouvez pas supprimer votre propre compte connecté.");
      return;
    }

    if (!window.confirm(`Voulez-vous vraiment supprimer l'administrateur "${name}" ?`)) {
      return;
    }

    setDeletingId(id);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await deleteAdminUser(id);
      setCreatedAdmins(prev => prev.filter(a => a.id !== id));
      setSuccessMessage(`L'administrateur "${name}" a été supprimé avec succès.`);
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de la suppression.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <MainLayout activeId="admin">
      {/* ═══════ ELEGANT TERRACOTTA & WARM GOLD HEADER ═══════ */}
      <header style={{
        background: 'linear-gradient(135deg, #7A3216 0%, #9A421D 50%, #C05A30 100%)',
        color: '#FEFDFA',
        padding: '2.5rem 3rem 2.25rem',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(154,66,29,0.22)'
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.05,
          backgroundImage: 'radial-gradient(#FEFDFA 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px', pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', top: -100, right: -50, width: 450, height: 450,
          background: 'radial-gradient(circle, rgba(254,253,250,0.18) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
          
            <h1 style={{
              fontFamily: "'Source Serif 4', Georgia, serif",
              fontSize: 'clamp(1.8rem, 2.5vw, 2.3rem)',
              fontWeight: 400, color: '#FEFDFA', margin: '0 0 0.4rem 0',
              lineHeight: 1.15
            }}>
              Administration des Accès
            </h1>
            <p style={{
              fontSize: '0.88rem', color: 'rgba(254,253,250,0.85)',
              margin: 0, maxWidth: 640, lineHeight: 1.5
            }}>
              Créez, gérez et sécurisez les comptes d'accès administrateurs autorisés sur la plateforme.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              padding: '0.75rem 1.25rem', borderRadius: 14,
              background: 'rgba(254,253,250,0.12)', backdropFilter: 'blur(6px)',
              border: '1px solid rgba(254,253,250,0.2)', textAlign: 'right'
            }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(254,253,250,0.75)' }}>
                Comptes Actifs
              </div>
              <div style={{ fontFamily: "'Source Serif 4', serif", fontSize: '1.4rem', fontWeight: 600, color: '#FEFDFA' }}>
                {createdAdmins.length} administrateur{createdAdmins.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main style={{ minHeight: '80vh', background: C.paper, color: C.ink, fontFamily: "'Inter', sans-serif", position: 'relative' }}>
        <ZelligeSVG />

        <div style={{ maxWidth: '100%', padding: '2rem 3rem 4rem' }}>

          {/* Main Content Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '2rem', alignItems: 'start' }}>
            
            {/* Form Box */}
            <div style={{
              background: C.paper, border: `1px solid ${C.sand}`, borderRadius: 18,
              padding: '2rem', boxShadow: '0 6px 24px rgba(26,20,16,0.04)', position: 'relative'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem', borderBottom: `1px solid ${C.sandLight}`, paddingBottom: '1rem' }}>
                <UserPlus size={20} style={{ color: C.terra }} />
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: C.ink, margin: 0 }}>
                  Créer un compte d’administration
                </h2>
              </div>

              {/* Alert Notifications */}
              {successMessage && (
                <div style={{
                  background: C.successBg, border: `1px solid ${C.success}`, borderRadius: 10,
                  padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.65rem',
                  color: C.success, fontSize: '0.85rem', fontWeight: 500
                }}>
                  <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                  <span>{successMessage}</span>
                </div>

              )}

              {errorMessage && (
                <div style={{
                  background: C.errorBg, border: `1px solid ${C.error}`, borderRadius: 10,
                  padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.65rem',
                  color: C.error, fontSize: '0.85rem', fontWeight: 500
                }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: C.inkSoft, marginBottom: '0.4rem' }}>
                    Rôle d’accès <span style={{ color: C.terra }}>*</span>
                  </label>
                  <select value={formData.role} onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'admin' | 'superAdmin' }))} style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: 8, border: `1px solid ${C.sand}`, background: C.mist, fontSize: '0.875rem', color: C.ink, outline: 'none' }}>
                    <option value="admin">Administrateur — outils métier uniquement</option>
                    <option value="superAdmin">Super administrateur — accès complet</option>
                  </select>
                  <p style={{ fontSize: '0.7rem', lineHeight: 1.4, color: C.inkMuted, margin: '0.4rem 0 0' }}>Seul un super administrateur peut créer ces comptes.</p>
                </div>
                
                {/* Nom & Prénom */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: C.inkSoft, marginBottom: '0.4rem' }}>
                      Prénom <span style={{ color: C.terra }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.inkMuted }} />
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        placeholder="Prénom"
                        required
                        style={{
                          width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.25rem',
                          borderRadius: 8, border: `1px solid ${C.sand}`, background: C.mist,
                          fontSize: '0.875rem', color: C.ink, outline: 'none', transition: 'border-color 0.2s'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: C.inkSoft, marginBottom: '0.4rem' }}>
                      Nom <span style={{ color: C.terra }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.inkMuted }} />
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        placeholder="Nom"
                        required
                        style={{
                          width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.25rem',
                          borderRadius: 8, border: `1px solid ${C.sand}`, background: C.mist,
                          fontSize: '0.875rem', color: C.ink, outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: C.inkSoft, marginBottom: '0.4rem' }}>
                    Adresse Email <span style={{ color: C.terra }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.inkMuted }} />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="exemple@orchid-island.ma"
                      required
                      style={{
                        width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.25rem',
                        borderRadius: 8, border: `1px solid ${C.sand}`, background: C.mist,
                        fontSize: '0.875rem', color: C.ink, outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Mot de passe & Confirmation */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: C.inkSoft, marginBottom: '0.4rem' }}>
                      Mot de passe <span style={{ color: C.terra }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.inkMuted }} />
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        required
                        style={{
                          width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.25rem',
                          borderRadius: 8, border: `1px solid ${C.sand}`, background: C.mist,
                          fontSize: '0.875rem', color: C.ink, outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: C.inkSoft, marginBottom: '0.4rem' }}>
                      Confirmation <span style={{ color: C.terra }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.inkMuted }} />
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        placeholder="••••••••"
                        required
                        style={{
                          width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.25rem',
                          borderRadius: 8, border: `1px solid ${C.sand}`, background: C.mist,
                          fontSize: '0.875rem', color: C.ink, outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    marginTop: '0.75rem', width: '100%', padding: '0.85rem',
                    borderRadius: 10, border: 'none',
                    background: `linear-gradient(135deg, ${C.terraDeep}, ${C.terra})`,
                    color: C.paper, fontSize: '0.875rem', fontWeight: 700,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(154,66,29,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    transition: 'all 0.2s'
                  }}
                >
                  {isSubmitting ? (
                    <span>Création en cours...</span>
                  ) : (
                    <span>Créer l'administrateur</span>
                  )}
                </button>
              </form>
            </div>

            {/* Existing Administrators List */}
            <div style={{
              background: C.paper, border: `1px solid ${C.sand}`, borderRadius: 18,
              padding: '2rem', boxShadow: '0 6px 24px rgba(26,20,16,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: `1px solid ${C.sandLight}`, paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Users size={20} style={{ color: C.terra }} />
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: C.ink, margin: 0 }}>
                    Administrateurs récents
                  </h2>
                </div>
                <span style={{ fontSize: '0.72rem', background: C.sandPale, padding: '0.2rem 0.6rem', borderRadius: 12, color: C.terra, fontWeight: 700 }}>
                  {createdAdmins.length} comptes
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {createdAdmins.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: C.inkMuted, textAlign: 'center', padding: '1.5rem 0' }}>
                    Aucun administrateur trouvé.
                  </div>
                ) : (
                  createdAdmins.map((adm) => (
                    <div key={adm.id} style={{
                      padding: '0.95rem 1.1rem', borderRadius: 12, border: `1px solid ${C.sandLight}`,
                      background: C.mist, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                          background: `linear-gradient(135deg, ${C.terra}, ${C.terraLight})`,
                          color: C.paper, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: '0.85rem'
                        }}>
                          {adm.firstName[0]}{adm.lastName ? adm.lastName[0] : ''}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {adm.firstName} {adm.lastName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: C.inkMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {adm.email}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                            padding: '0.2rem 0.55rem', borderRadius: 6,
                            background: 'rgba(154,66,29,0.12)',
                            color: C.terra
                          }}>
                            {adm.role}
                          </span>
                          <div style={{ fontSize: '0.68rem', color: C.inkMuted, marginTop: 4 }}>
                            {adm.date}
                          </div>
                        </div>

                        {/* Bouton Supprimer */}
                        <button
                          type="button"
                          onClick={() => handleDeleteAdmin(adm.id, `${adm.firstName} ${adm.lastName}`.trim())}
                          disabled={deletingId === adm.id}
                          title="Supprimer cet administrateur"
                          style={{
                            width: 32, height: 32, borderRadius: 8,
                            border: `1px solid ${C.sandLight}`, background: C.paper,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: C.error, cursor: 'pointer', transition: 'all 0.18s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = C.errorBg;
                            e.currentTarget.style.borderColor = C.error;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = C.paper;
                            e.currentTarget.style.borderColor = C.sandLight;
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </MainLayout>
  );
}
