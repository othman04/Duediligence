import { useState } from 'react';
import { MainLayout } from '../components/MainLayout';
import { VenteContent } from './analytique';
import { LocationContent } from './locationAnalytique';

const C = {
  terra:      '#9A421D',
  terraLight: '#C05A30',
  terraDeep:  '#5C240E',
  mist:       '#F4F1EC',
  ink:        '#1A1410',
  inkMuted:   '#7A6E66',
  sandLight:  '#E8DDD0',
};

type Tab = 'vente' | 'location';

export default function AnalytiquePage() {
  const [activeTab, setActiveTab] = useState<Tab>('vente');

  const tabs: { value: Tab; label: string; hint: string }[] = [
    { value: 'vente', label: 'Vente', hint: 'Dashboard achat / revente & score IA' },
    { value: 'location', label: 'Location', hint: 'Dashboard loyers & nuitées (parc locatif)' },
  ];

  return (
    <MainLayout activeId="analytique">
      <div style={{ minHeight: '100vh', background: C.mist, fontFamily: "'Inter',sans-serif", color: C.ink }}>

        {/* ── Barre d'onglets Vente / Location ─────────────────────── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'rgba(244,241,236,0.92)', backdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${C.sandLight}`,
        }}>
          <div style={{
            maxWidth: 1440, margin: '0 auto', padding: '0 40px',
            display: 'flex', gap: 6,
          }}>
            {tabs.map((tab) => {
              const active = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  style={{
                    padding: '14px 26px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: `3px solid ${active ? C.terra : 'transparent'}`,
                    color: active ? C.terra : C.inkMuted,
                    fontSize: '0.86rem', fontWeight: active ? 700 : 500,
                    cursor: 'pointer', transition: 'all 0.18s ease',
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                  }}
                >
                  <span>{tab.label}</span>
                  {active && (
                    <span style={{ fontSize: '0.66rem', fontWeight: 500, opacity: 0.8 }}>
                      {tab.hint}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Contenu selon l'onglet ────────────────────────────────── */}
        {activeTab === 'location' ? <LocationContent /> : <VenteContent />}

      </div>
    </MainLayout>
  );
}