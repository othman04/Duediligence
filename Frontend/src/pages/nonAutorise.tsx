import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../components/MainLayout';

export default function NonAutorisePage() {
  const navigate = useNavigate();
  return (
    <MainLayout>
      <main style={{ minHeight: '72vh', display: 'grid', placeItems: 'center', padding: '2rem', background: '#F4F1EC' }}>
        <section style={{ maxWidth: 520, width: '100%', textAlign: 'center', background: '#FEFCF8', border: '1px solid #E8DDD0', borderRadius: 20, padding: '3rem 2rem', boxShadow: '0 12px 35px rgba(26,20,16,0.08)' }}>
          <div style={{ width: 56, height: 56, margin: '0 auto 1.25rem', borderRadius: 16, display: 'grid', placeItems: 'center', background: 'rgba(196,32,32,0.09)', color: '#C42020' }}><ShieldAlert size={28} /></div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9A421D', marginBottom: 8 }}>Accès restreint</div>
          <h1 style={{ margin: 0, color: '#1A1410', fontFamily: "'Source Serif 4', Georgia, serif", fontSize: '1.7rem' }}>Cette page est réservée au super administrateur.</h1>
          <p style={{ color: '#7A6E66', lineHeight: 1.6, fontSize: '0.9rem', margin: '1rem 0 1.5rem' }}>Votre rôle administrateur ne permet pas d’accéder à l’analytique, à l’historique ni à la gestion des comptes.</p>
          <button type="button" onClick={() => navigate('/home')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 10, padding: '0.75rem 1.1rem', background: '#9A421D', color: '#FEFCF8', fontWeight: 700, cursor: 'pointer' }}><ArrowLeft size={16} /> Retour à l’accueil</button>
        </section>
      </main>
    </MainLayout>
  );
}
