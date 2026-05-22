/* Hi-fi screens — Budget app v1
   Direction: Family-first sage hero + clean card body + bold mono numerals. */

const COMMON_BG = { background: HIFI.bg, color: HIFI.ink, fontFamily: FONT_SANS };

/* -------- Reusable chrome -------- */
function AppBar({ left, center, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', marginBottom: 14 }}>
      {left}
      {center}
      {right}
    </div>
  );
}

function MenuBtn() {
  return (
    <button style={{
      width: 38, height: 38, borderRadius: 12, border: 'none',
      background: HIFI.surface, color: HIFI.ink,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
    }}>{Icon.menu(18)}</button>
  );
}

function IconBtn({ icon, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 38, height: 38, borderRadius: 12, border: 'none',
      background: HIFI.surface, color: HIFI.ink,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
    }}>{icon}</button>
  );
}

function FamilyChip() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: HIFI.surface, padding: '5px 12px 5px 8px', borderRadius: 999,
      boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
    }}>
      {['A','B','S','M','J','E'].map((l, i) => (
        <div key={l} style={{ marginLeft: i ? -8 : 0, zIndex: 10 - i }}>
          <FamilyAvatar initial={l} size={22} tone={i < 2 ? 'sage' : 'sand'} />
        </div>
      ))}
      <span style={{ marginLeft: 6, fontSize: 11, color: HIFI.muted, fontFamily: FONT_MONO }}>6</span>
    </div>
  );
}

function PageTitle({ title, subtitle }) {
  return (
    <div style={{ padding: '0 18px', marginBottom: 16 }}>
      {subtitle && <div style={{ fontSize: 12, color: HIFI.muted, marginBottom: 4 }}>{subtitle}</div>}
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 500, letterSpacing: -0.5, color: HIFI.ink }}>{title}</h1>
    </div>
  );
}

function SegControl({ options, value, onChange, mono = true }) {
  return (
    <div style={{
      display: 'flex', gap: 4, padding: 3,
      background: HIFI.surfaceSoft, borderRadius: 12,
    }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange && onChange(opt)} style={{
          flex: 1, padding: '8px 4px', border: 'none',
          background: opt === value ? HIFI.surface : 'transparent',
          color: opt === value ? HIFI.ink : HIFI.muted,
          fontFamily: mono ? FONT_MONO : FONT_SANS,
          fontSize: mono ? 10 : 12, letterSpacing: mono ? 0.8 : 0,
          textTransform: mono ? 'uppercase' : 'none',
          fontWeight: 500, borderRadius: 9,
          boxShadow: opt === value ? '0 1px 0 rgba(0,0,0,0.04)' : 'none',
          cursor: 'pointer',
        }}>{opt}</button>
      ))}
    </div>
  );
}

function ChipsRow({ items, selected, onSelect, scroll = true }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: scroll ? 'auto' : 'visible', padding: scroll ? '4px 0 2px' : 0 }}>
      {items.map(item => {
        const v = typeof item === 'string' ? item : item.value;
        const label = typeof item === 'string' ? item : item.label;
        const on = v === selected;
        return (
          <button key={v} onClick={() => onSelect && onSelect(v)} style={{
            padding: '7px 14px', border: 'none',
            background: on ? HIFI.ink : HIFI.surface,
            color: on ? '#fff' : HIFI.ink2,
            fontSize: 12, fontWeight: 500,
            borderRadius: 999, whiteSpace: 'nowrap',
            boxShadow: on ? 'none' : '0 1px 0 rgba(0,0,0,0.04)',
            cursor: 'pointer', flexShrink: 0,
          }}>{label}</button>
        );
      })}
    </div>
  );
}

function FAB({ icon = Icon.plus(24), bottom = 28, label }) {
  return (
    <button style={{
      position: 'absolute', right: 20, bottom,
      height: 56, minWidth: 56, padding: label ? '0 22px 0 18px' : 0,
      borderRadius: 28,
      background: HIFI.sage, color: '#fff', border: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      boxShadow: '0 8px 24px -6px rgba(42,61,51,0.45), 0 2px 0 rgba(0,0,0,0.04)',
      cursor: 'pointer',
      fontFamily: FONT_SANS, fontSize: 14, fontWeight: 500,
    }}>
      {icon}{label && <span>{label}</span>}
    </button>
  );
}

function ActivityRow({ icon, name, paidBy, forWho, amount, sub, last }) {
  const isIncome = amount > 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 0',
      borderBottom: last ? 'none' : `1px solid ${HIFI.line}`,
    }}>
      <MerchantIcon kind={icon} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: HIFI.ink, fontWeight: 500 }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
          {paidBy && <FamilyAvatar initial={paidBy} size={14} tone={['A','B'].includes(paidBy) ? 'sage' : 'sand'} />}
          {sub && <span style={{ fontSize: 10.5, color: HIFI.muted }}>{sub}</span>}
          {forWho && (
            <>
              <span style={{ fontSize: 10.5, color: HIFI.faint }}>·</span>
              <span style={{ fontSize: 10.5, color: HIFI.muted }}>for</span>
              <FamilyAvatar initial={forWho[0]} size={14} tone={['A','B'].includes(forWho[0]) ? 'sage' : 'sand'} />
              <span style={{ fontSize: 10.5, color: HIFI.muted }}>{forWho}</span>
            </>
          )}
        </div>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: isIncome ? HIFI.sage : HIFI.ink }}>
        {isIncome ? '+' : '−'}${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
}

/* -------- DASHBOARD -------- */
function ScreenDashboard() {
  const KIDS = [
    { name: 'Sam', age: 14, spent: 18, allow: 20 },
    { name: 'Mia', age: 11, spent: 11, allow: 15 },
    { name: 'Jo',  age:  8, spent:  6, allow: 10 },
    { name: 'Eli', age:  5, spent:  3, allow: 5 },
  ];
  return (
    <div style={{ ...COMMON_BG, position: 'relative', height: '100%', overflow: 'hidden' }}>
      <div style={{ height: '100%', overflow: 'auto', padding: '60px 0 0' }}>
      <AppBar
        left={<MenuBtn />}
        center={<FamilyChip />}
        right={<IconBtn icon={Icon.bell(18)} />}
      />
      <PageTitle subtitle="Welcome back, Alex" title="Your household" />

      <div style={{ padding: '0 16px' }}>
        {/* Hero — sage filled */}
        <div style={{
          background: HIFI.sage, borderRadius: 24, padding: 20,
          color: '#fff', marginBottom: 12,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -50, right: -40, width: 180, height: 180,
            borderRadius: '50%', background: HIFI.sageMid, opacity: 0.35,
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
              Left to spend · June
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '8px 0 14px' }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 44, fontWeight: 500, letterSpacing: -1.5, lineHeight: 1 }}>$2,680</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 22, color: 'rgba(255,255,255,0.5)' }}>.42</span>
              <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'rgba(255,255,255,0.55)', fontFamily: FONT_MONO }}>CAD</span>
            </div>
            <HFBar value={4820 / 7500} h={5} color={HIFI.sand} track="rgba(255,255,255,0.18)" />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, opacity: 0.72 }}>
              <span>Spent $4,820</span><span>of $7,500</span>
            </div>
          </div>
        </div>

        {/* Two stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: HIFI.surface, borderRadius: 18, padding: 14 }}>
            <div style={{ fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted }}>Income</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 500, color: HIFI.ink, marginTop: 4, letterSpacing: -0.5 }}>$10,200</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 6 }}>
              <span style={{ width: 22, height: 4, background: HIFI.sage, borderRadius: 2 }} />
              <span style={{ width: 10, height: 4, background: HIFI.sand, borderRadius: 2 }} />
              <span style={{ fontSize: 9.5, color: HIFI.muted, marginLeft: 4, fontFamily: FONT_MONO }}>A 70 · B 30</span>
            </div>
          </div>
          <div style={{ background: HIFI.surface, borderRadius: 18, padding: 14 }}>
            <div style={{ fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted }}>Tax bucket</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 500, color: HIFI.ink, marginTop: 4, letterSpacing: -0.5 }}>$2,070</div>
            <div style={{ fontSize: 9.5, color: HIFI.muted, marginTop: 6, fontFamily: FONT_MONO }}>25% · CRA Q2 in 9d</div>
          </div>
        </div>

        {/* Essential vs treats card */}
        <div style={{ background: HIFI.surface, borderRadius: 18, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Essential vs treats</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: HIFI.muted }}>$3,720 · $1,100</div>
          </div>
          <HFSplitBar essential={3720 / 4820} h={10} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: HIFI.muted }}>
            <span>77% essential</span>
            <span>▼ 3% vs last month</span>
          </div>
        </div>

        {/* Kids strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>Kids · 4</div>
          <div style={{ fontSize: 11, color: HIFI.muted, fontFamily: FONT_MONO }}>Allowance · Fri</div>
        </div>
        <div style={{
          background: HIFI.surface, borderRadius: 22, padding: '14px 8px', marginBottom: 16,
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4,
        }}>
          {KIDS.map(k => (
            <div key={k.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 2px' }}>
              <FamilyAvatar initial={k.name[0]} size={36} tone="sand" />
              <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2 }}>{k.name}</div>
              <div style={{ fontSize: 9, color: HIFI.muted, fontFamily: FONT_MONO }}>age {k.age}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: HIFI.ink }}>${k.spent}<span style={{ color: HIFI.faint }}>/{k.allow}</span></div>
              <div style={{ width: '70%', marginTop: 2 }}>
                <HFBar value={k.spent / k.allow} h={3} color={HIFI.sage} track={HIFI.surfaceSoft} />
              </div>
            </div>
          ))}
        </div>

        {/* Recent activity */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>This week</div>
          <div style={{ fontSize: 11, color: HIFI.muted, display: 'flex', alignItems: 'center', gap: 3 }}>See all {Icon.chevRight(12)}</div>
        </div>
        <div style={{ background: HIFI.surface, borderRadius: 22, padding: '4px 14px', marginBottom: 110 }}>
          <ActivityRow icon="music" name="Music lesson" paidBy="B" forWho="Mia" amount={-32} sub="paid" />
          <ActivityRow icon="baby" name="Diapers · pack" paidBy="B" forWho="Eli" amount={-28.40} sub="paid" />
          <ActivityRow icon="cart" name="Whole Foods" paidBy="A" forWho="Household" amount={-142.30} sub="paid" />
          <ActivityRow icon="receipt" name="Salary · Alex" paidBy="A" amount={5800} sub="Income · 70%" last />
        </div>
      </div>
      </div>
      <FAB />
    </div>
  );
}

/* -------- ADD EXPENSE -------- */
function ScreenAddExpense() {
  return (
    <div style={{ ...COMMON_BG, position: 'relative', height: '100%', overflow: 'hidden' }}>
      <div style={{ height: '100%', overflow: 'auto', padding: '54px 0 0' }}>
      <AppBar
        left={<button style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: 'transparent', color: HIFI.ink, fontFamily: FONT_MONO, fontSize: 16 }}>✕</button>}
        center={<div style={{ fontSize: 14, fontWeight: 500 }}>New expense</div>}
        right={<button style={{ height: 38, padding: '0 14px', borderRadius: 12, border: 'none', background: HIFI.sage, color: '#fff', fontWeight: 500, fontSize: 13 }}>Save</button>}
      />

      <div style={{ padding: '0 18px' }}>
        {/* Amount hero */}
        <div style={{ textAlign: 'center', padding: '10px 0 18px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: HIFI.muted }}>Amount</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'center', marginTop: 8 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: HIFI.muted, marginBottom: 14 }}>$</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 56, fontWeight: 500, letterSpacing: -2.5, lineHeight: 1, color: HIFI.ink }}>142</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 28, color: HIFI.faint, lineHeight: 1, alignSelf: 'baseline' }}>.30</span>
          </div>
        </div>

        {/* Merchant + Category */}
        <div style={{ background: HIFI.surface, borderRadius: 18, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted, marginBottom: 4 }}>Merchant</div>
          <div style={{ fontSize: 15, color: HIFI.ink, paddingBottom: 12, borderBottom: `1px solid ${HIFI.line}` }}>Whole Foods</div>
          <div style={{ fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted, margin: '14px 0 8px' }}>Category</div>
          <ChipsRow items={['Groceries', 'Bills', 'Kids', 'Eating', 'Fun', 'Transport']} selected="Groceries" />
        </div>

        {/* Essential split */}
        <div style={{ background: HIFI.surface, borderRadius: 18, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Essential split</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: HIFI.ink2 }}>$108 · $34</div>
          </div>
          <div style={{ fontSize: 11, color: HIFI.muted, marginBottom: 10 }}>Drag to split the bill. Treats roll into "Fun".</div>
          {/* Slider visual */}
          <div style={{ position: 'relative', height: 16, marginBottom: 10 }}>
            <div style={{ position: 'absolute', inset: '5px 0' }}>
              <HFSplitBar essential={108 / 142} h={6} />
            </div>
            <div style={{
              position: 'absolute', left: `${(108 / 142) * 100}%`,
              top: 0, width: 16, height: 16, borderRadius: 8,
              background: '#fff', border: `2px solid ${HIFI.sage}`,
              transform: 'translateX(-50%)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: HIFI.muted }}>
            <span>76% essential</span><span>24% treats</span>
          </div>
        </div>

        {/* For */}
        <div style={{ background: HIFI.surface, borderRadius: 18, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted, marginBottom: 10 }}>For whom</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[['Household', null, true], ['Alex', 'A', false], ['Bea', 'B', false], ['Sam', 'S', false], ['Mia', 'M', false], ['Jo', 'J', false], ['Eli', 'E', false]].map(([n, ini, on]) => (
              <button key={n} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 999, border: 'none',
                background: on ? HIFI.ink : HIFI.surfaceSoft,
                color: on ? '#fff' : HIFI.ink2,
                fontSize: 12, fontWeight: 500,
              }}>
                {ini && <FamilyAvatar initial={ini} size={16} tone={on ? 'paper' : (['A','B'].includes(ini) ? 'sage' : 'sand')} />}
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Paid by — income split */}
        <div style={{ background: HIFI.surface, borderRadius: 18, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted }}>Paid by · split</div>
            <div style={{ fontSize: 10, fontFamily: FONT_MONO, color: HIFI.sage, letterSpacing: 0.5 }}>BY INCOME · AUTO</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {['Alex 100%', 'Bea 100%', 'Equal 50/50', 'By income'].map((label, i) => (
              <button key={label} style={{
                padding: '7px 12px', borderRadius: 999, border: 'none',
                background: i === 3 ? HIFI.ink : HIFI.surfaceSoft,
                color: i === 3 ? '#fff' : HIFI.ink2,
                fontSize: 12, fontWeight: 500,
              }}>{label}</button>
            ))}
          </div>
          <div style={{ background: HIFI.surfaceSoft, borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FamilyAvatar initial="A" size={18} tone="sage" />
                <span style={{ fontSize: 12 }}>Alex owes</span>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: HIFI.ink, fontWeight: 500 }}>$99.61</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <FamilyAvatar initial="B" size={18} tone="sand" />
                <span style={{ fontSize: 12 }}>Bea owes</span>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: HIFI.ink, fontWeight: 500 }}>$42.69</div>
            </div>
          </div>
        </div>

        {/* Date / Account / Notes */}
        <div style={{ background: HIFI.surface, borderRadius: 18, padding: 4, marginBottom: 120 }}>
          {[
            ['Date',    'Jun 18, 2026'],
            ['Account', 'RBC · Joint chequing'],
            ['Notes',   'Weekly grocery run + treats'],
          ].map(([l, v], i, a) => (
            <div key={l} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '14px 12px',
              borderBottom: i < a.length - 1 ? `1px solid ${HIFI.line}` : 'none',
            }}>
              <div style={{ fontSize: 13, color: HIFI.muted }}>{l}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: HIFI.ink }}>{v}</span>
                {Icon.chevRight(14)}
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

/* -------- TRANSACTIONS -------- */
function ScreenTransactions() {
  return (
    <div style={{ ...COMMON_BG, position: 'relative', height: '100%', overflow: 'hidden' }}>
      <div style={{ height: '100%', overflow: 'auto', padding: '60px 0 0' }}>
      <AppBar
        left={<MenuBtn />}
        center={<div style={{ fontSize: 15, fontWeight: 500 }}>Transactions</div>}
        right={<IconBtn icon={Icon.search(18)} />}
      />

      <div style={{ padding: '0 16px' }}>
        {/* Summary card */}
        <div style={{ background: HIFI.surface, borderRadius: 18, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted }}>June · so far</div>
            <div style={{ fontSize: 11, color: HIFI.muted, fontFamily: FONT_MONO }}>32 txns</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 24, fontWeight: 500, letterSpacing: -0.5 }}>−$4,820</div>
              <div style={{ fontSize: 10.5, color: HIFI.muted }}>spent</div>
            </div>
            <div style={{ width: 1, alignSelf: 'stretch', background: HIFI.line }} />
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 500, color: HIFI.sage }}>+$10,200</div>
              <div style={{ fontSize: 10.5, color: HIFI.muted }}>income</div>
            </div>
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ marginBottom: 16 }}>
          <ChipsRow items={['All', 'Essential', 'Treats', 'Per kid', 'Subs', 'Income']} selected="All" />
        </div>

        {/* Today */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 1.2, textTransform: 'uppercase', color: HIFI.muted }}>Today · Jun 18</div>
          <div style={{ fontSize: 11, color: HIFI.muted, fontFamily: FONT_MONO }}>−$202.70</div>
        </div>
        <div style={{ background: HIFI.surface, borderRadius: 22, padding: '4px 14px', marginBottom: 14 }}>
          <ActivityRow icon="music" name="Music lesson" paidBy="B" forWho="Mia" amount={-32} sub="paid" />
          <ActivityRow icon="cart" name="Whole Foods" paidBy="A" forWho="Household" amount={-142.30} sub="paid" />
          <ActivityRow icon="baby" name="Diapers · pack" paidBy="B" forWho="Eli" amount={-28.40} sub="paid" last />
        </div>

        {/* Yesterday */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 1.2, textTransform: 'uppercase', color: HIFI.muted }}>Yesterday</div>
          <div style={{ fontSize: 11, color: HIFI.muted, fontFamily: FONT_MONO }}>+$5,683.00</div>
        </div>
        <div style={{ background: HIFI.surface, borderRadius: 22, padding: '4px 14px', marginBottom: 14 }}>
          <ActivityRow icon="receipt" name="Salary · Alex" paidBy="A" amount={5800} sub="Income · 70%" />
          <ActivityRow icon="receipt" name="Daycare" paidBy="B" forWho="Eli" amount={-72} sub="paid" />
          <ActivityRow icon="receipt" name="Soccer dues" paidBy="A" forWho="Sam" amount={-45} sub="paid" last />
        </div>

        {/* Earlier */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px', marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 1.2, textTransform: 'uppercase', color: HIFI.muted }}>Mon · Jun 15</div>
          <div style={{ fontSize: 11, color: HIFI.muted, fontFamily: FONT_MONO }}>−$279.00</div>
        </div>
        <div style={{ background: HIFI.surface, borderRadius: 22, padding: '4px 14px', marginBottom: 120 }}>
          <ActivityRow icon="music" name="Kumon" paidBy="B" forWho="Mia" amount={-160} sub="Subs · monthly" />
          <ActivityRow icon="receipt" name="Rogers" paidBy="A" forWho="Household" amount={-95} sub="Bills · auto" />
          <ActivityRow icon="receipt" name="Kids haircut" paidBy="B" forWho="Jo" amount={-24} sub="paid" last />
        </div>
      </div>
      </div>
      <FAB label="Add" />
    </div>
  );
}

/* -------- BUDGET OVERVIEW -------- */
function ScreenBudget() {
  const CATS = [
    { name: 'Groceries',   spent: 1640, total: 1800, ess: 0.80, icon: 'cart' },
    { name: 'Kids · all',  spent: 1060, total: 1400, ess: 0.92, icon: 'baby' },
    { name: 'Bills',       spent:  870, total:  900, ess: 1.00, icon: 'home' },
    { name: 'Eating out',  spent:  675, total:  550, ess: 0.20, icon: 'receipt', over: true },
    { name: 'Music · Mia', spent:  128, total:  140, ess: 1.00, icon: 'music' },
    { name: 'Transport',   spent:  340, total:  600, ess: 0.85, icon: 'receipt' },
    { name: 'Fun',         spent:  107, total:  200, ess: 0.00, icon: 'receipt' },
  ];
  return (
    <div style={{ ...COMMON_BG, position: 'relative', height: '100%', overflow: 'hidden' }}>
      <div style={{ height: '100%', overflow: 'auto', padding: '60px 0 0' }}>
      <AppBar
        left={<MenuBtn />}
        center={<div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 500 }}>June 2026 {Icon.chevDown(14)}</div>}
        right={<IconBtn icon={Icon.search(18)} />}
      />
      <PageTitle title="Budget" subtitle="$4,820 of $7,500 spent" />

      <div style={{ padding: '0 16px' }}>
        {/* Essentials donut */}
        <div style={{
          background: HIFI.surface, borderRadius: 22, padding: 16, marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ position: 'relative' }}>
            <HFDonut size={104} thickness={14} parts={[0.77, 0.23]} strokes={[HIFI.sage, HIFI.sand]} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 18, fontWeight: 500, color: HIFI.ink }}>77%</div>
              <div style={{ fontSize: 9.5, color: HIFI.muted, fontFamily: FONT_MONO }}>essential</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, background: HIFI.sage, borderRadius: 2 }} />
                  <span style={{ fontSize: 12 }}>Essential</span>
                </div>
                <span style={{ fontFamily: FONT_MONO, fontSize: 12 }}>$3,720</span>
              </div>
              <div style={{ fontSize: 10.5, color: HIFI.muted, marginLeft: 16 }}>rent, groceries, daycare…</div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, background: HIFI.sand, borderRadius: 2 }} />
                  <span style={{ fontSize: 12 }}>Treats</span>
                </div>
                <span style={{ fontFamily: FONT_MONO, fontSize: 12 }}>$1,100</span>
              </div>
              <div style={{ fontSize: 10.5, color: HIFI.muted, marginLeft: 16 }}>dining, streaming, fun</div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <SegControl options={['All', 'Essential', 'Treats', 'Per kid']} value="All" />
        </div>

        {/* Category list */}
        <div style={{ background: HIFI.surface, borderRadius: 22, padding: 4, marginBottom: 120 }}>
          {CATS.map((c, i) => {
            const p = c.spent / c.total;
            return (
              <div key={c.name} style={{
                padding: '14px 14px',
                borderBottom: i < CATS.length - 1 ? `1px solid ${HIFI.line}` : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <MerchantIcon kind={c.icon} size={32} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                      <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: c.over ? HIFI.brick : HIFI.ink2 }}>
                        ${c.spent} <span style={{ color: HIFI.faint }}>/ ${c.total}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ fontSize: 10.5, color: HIFI.muted }}>{Math.round(c.ess * 100)}% essential</span>
                      {c.over && (
                        <span style={{ fontSize: 10, color: HIFI.brick, background: 'rgba(168,83,63,0.1)', padding: '1px 6px', borderRadius: 999, fontFamily: FONT_MONO, letterSpacing: 0.5 }}>OVER</span>
                      )}
                    </div>
                  </div>
                </div>
                <HFSplitBar essential={c.ess} h={6} />
              </div>
            );
          })}
        </div>
      </div>
      </div>
      <FAB />
    </div>
  );
}

Object.assign(window, {
  ScreenDashboard, ScreenAddExpense, ScreenTransactions, ScreenBudget,
  AppBar, MenuBtn, IconBtn, FamilyChip, PageTitle, SegControl, ChipsRow, FAB, ActivityRow,
});
