/* Tabbed wireframe explorer */

const SCREENS = /*EDITMODE-BEGIN*/{
  "showDrawerHint": false,
  "tab": "Login",
  "showNotes": true
}/*EDITMODE-END*/;

const TABS = [
  { id: 'Login',      label: 'Login / Signup',     notes: ['Classic stacked form.', 'Segmented Sign in / Sign up.', 'Couple-onboarding welcome.'],
    options: [LoginA, LoginB, LoginC],
    captions: ['Stacked email + password', 'Segmented control', 'Couple welcome'] },
  { id: 'Dashboard',  label: 'Dashboard',          notes: ['Balance-first, list of recent activity.', 'Spending ring + categories.', 'Couple split — Alex / Bea side by side.'],
    options: [DashA, DashB, DashC],
    captions: ['Balance + activity list', 'Spending ring', 'Couple split'] },
  { id: 'Expense',    label: 'Add expense',        notes: ['Keypad-first — amount is hero.', 'Form-style with all fields visible.', 'Quick-add grid for recents & subscriptions.'],
    options: [ExpA, ExpB, ExpC],
    captions: ['Keypad-first', 'Full form', 'Quick-add + subs'] },
  { id: 'Income',     label: 'Add income',         notes: ['Form with auto tax-bucket slider.', 'Paycheck splitter into buckets.', 'Calendar / recurring focused.'],
    options: [IncA, IncB, IncC],
    captions: ['Form + tax set-aside', 'Paycheck splitter', 'Calendar / recurring'] },
  { id: 'Taxes',      label: 'Taxes',              notes: ['Bucket view — set-aside progress.', 'Deductions by category.', 'Timeline of deadlines.'],
    options: [TaxA, TaxB, TaxC],
    captions: ['Set-aside buckets', 'Deductions list', 'Deadline timeline'] },
  { id: 'Budget',     label: 'Budget overview',    notes: ['Progress bars per category.', 'Envelope grid you assign to.', 'Donut + sortable list.'],
    options: [BudA, BudB, BudC],
    captions: ['Progress bars', 'Envelope grid', 'Donut + list'] },
  { id: 'Transactions', label: 'Transactions',     notes: ['Grouped by date.', 'Search-first with chip filters.', 'Calendar heat-map.'],
    options: [TxA, TxB, TxC],
    captions: ['Grouped by date', 'Search + filters', 'Calendar heat-map'] },
  { id: 'Reports',    label: 'Reports / charts',   notes: ['Spend over time + top categories.', 'Cashflow KPIs + insights.', 'Per-person pie · toggle to include shared bills.', 'Essential vs treats — overall + recurring breakdown.'],
    options: [RepA, RepB, RepC, RepD],
    captions: ['Spend over time', 'Cashflow + insights', 'Per-person pie', 'Essentials breakdown'] },
  { id: 'Settings',   label: 'Settings',           notes: ['Plain grouped list.', 'Card-section layout.', 'Household-first (members, accounts, rules).'],
    options: [SetA, SetB, SetC],
    captions: ['Plain list', 'Card sections', 'Household-first'] },
  { id: 'Family',     label: 'Family / kids',      notes: ['Allowance card per kid · scrolls to any count.', 'Side-by-side comparison across kids.', 'Per-kid drill: limits, savings goal, recent activity.'],
    options: [FamA, FamB, FamC],
    captions: ['Allowance cards', 'Compare kids', 'Per-kid drill'] },
];

function App() {
  const [t, setTweak] = useTweaks(SCREENS);
  const [editOn, setEditOn] = React.useState(false);

  React.useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode') setEditOn(true);
      if (e.data?.type === '__deactivate_edit_mode') setEditOn(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const active = TABS.find(x => x.id === t.tab) || TABS[0];

  return (
    <div style={{ minHeight: '100vh', background: BG, color: INK, fontFamily: SANS }}>
      {/* Header */}
      <header style={{
        padding: '24px 32px 0', display: 'flex',
        flexDirection: 'column', gap: 18,
        position: 'sticky', top: 0, background: BG, zIndex: 5,
        borderBottom: `1px dashed ${SOFT_MUTED}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>
            Budget · wireframes
          </div>
          <Label size={11}>v1 · mobile PWA · CAD · 3 options per screen</Label>
          <div style={{ flex: 1 }} />
          <Label size={10}>{TABS.length} screens · {TABS.length * 3} variations</Label>
        </div>
        <div style={{
          display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 0,
        }}>
          {TABS.map(tab => {
            const on = tab.id === active.id;
            return (
              <button key={tab.id} onClick={() => setTweak('tab', tab.id)}
                style={{
                  appearance: 'none', border: 'none', background: 'transparent',
                  padding: '10px 14px 12px',
                  fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase',
                  color: on ? INK : MUTED,
                  borderBottom: `2px solid ${on ? INK : 'transparent'}`,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  marginBottom: -1,
                }}>
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Content */}
      <main style={{ padding: '28px 32px 80px' }} data-screen-label={active.id}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: SANS, fontSize: 28, fontWeight: 600, letterSpacing: -0.4 }}>
            {active.label}
          </div>
          <Label size={11}>three approaches · pick or mix</Label>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 28,
          maxWidth: 1280,
        }}>
          {active.options.map((Cmp, i) => (
            <figure key={i} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span style={{
                  fontFamily: MONO, fontSize: 11, letterSpacing: 1.2,
                  padding: '3px 7px', border: `1.2px solid ${INK}`, borderRadius: 4,
                }}>{String.fromCharCode(65 + i)}</span>
                <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500 }}>{active.captions[i]}</span>
              </div>
              <div style={{ alignSelf: 'center' }}>
                {React.cloneElement(<Cmp />, { drawerHint: t.showDrawerHint })}
              </div>
              {t.showNotes && (
                <figcaption style={{ fontFamily: SANS, fontSize: 12, color: MUTED, lineHeight: 1.5, maxWidth: 340 }}>
                  {active.notes[i]}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </main>

      {/* Tweaks panel */}
      {editOn && (
        <TweaksPanel title="Tweaks" onClose={() => { setEditOn(false); window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); }}>
          <TweakSection title="View">
            <TweakSelect label="Screen" value={t.tab} options={TABS.map(x => x.id)} onChange={(v) => setTweak('tab', v)} />
            <TweakToggle label="Show notes under each option" value={t.showNotes} onChange={(v) => setTweak('showNotes', v)} />
            <TweakToggle label="Show drawer-peek (hamburger nav)" value={t.showDrawerHint} onChange={(v) => setTweak('showDrawerHint', v)} />
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
}

/* Some phones use drawerHint — re-render with prop. Wrap Phone components to accept it via context too. */
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
