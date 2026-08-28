import { useState } from 'react';
import { MainLayout } from '../components/MainLayout';
import IndicateurPrixVente from './indicateurPrix';
import IndicateurPrixLocation from './indicateurPrixLocation';

const C = {
  terra:      '#9A421D',
  terraDark:  '#7A3216',
  ink:        '#1A1410',
  inkMuted:   '#7A6E66',
  sandLight:  '#E8DDD0',
  mist:       '#F4F1EC',
};

type Tab = 'vente' | 'location';

export default function IndicateurPrixCombinedPage() {
  const [activeTab, setActiveTab] = useState<Tab>('vente');

  const tabs: { value: Tab; label: string; hint: string }[] = [
    { value: 'vente', label: 'Vente', hint: 'Prix de vente par commune / quartier' },
    { value: 'location', label: 'Location', hint: 'Loyers & nuitées par commune / quartier' },
  ];

  return (
    <MainLayout activeId="indicateurs-prix">
      {/* Barre d'onglets — dans la zone de contenu (jamais sur la sidebar/logo) */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(244,241,236,0.95)', backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${C.sandLight}`,
      }}>
        <div style={{ maxWidth: 1700, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 6 }}>
          {tabs.map(tab => {
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                style={{
                  padding: '13px 24px 11px', background: 'transparent', border: 'none',
                  borderBottom: `3px solid ${active ? C.terra : 'transparent'}`,
                  color: active ? C.terra : C.inkMuted,
                  fontSize: '0.86rem', fontWeight: active ? 700 : 500,
                  cursor: 'pointer', transition: 'all 0.18s ease',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                  <span>{tab.label}</span>
                  {active && <span style={{ fontSize: '0.66rem', fontWeight: 500, opacity: 0.8 }}>{tab.hint}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'location' ? <IndicateurPrixLocation /> : <IndicateurPrixVente />}
    </MainLayout>
  );
}