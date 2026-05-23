/* Hi-fi Dashboard explorations — 3 directions */

const NOW = 'June 2026';

/* ============== DIRECTION A — Calm cards & sage (iOS) ============== */
function DashboardA() {
  return (
    <div style={{
      flex: 1, background: HIFI.bg, color: HIFI.ink, fontFamily: FONT_SANS,
      padding: '60px 18px 0', overflow: 'auto',
    }}>
      {/* App bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <button aria-label="menu" style={{
          width: 38, height: 38, borderRadius: 12, border: 'none',
          background: HIFI.surface, color: HIFI.ink,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
        }}>{Icon.menu(18)}</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: HIFI.ink2 }}>
          {NOW} {Icon.chevDown(14)}
        </div>
        <FamilyAvatar initial="A" size={36} tone="sage" />
      </div>

      {/* Greeting */}
      <div style={{ fontSize: 13, color: HIFI.muted, marginBottom: 4 }}>Welcome back, Alex</div>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: -0.4, color: HIFI.ink, marginBottom: 16 }}>
        Your household
      </h1>

      {/* Hero balance card */}
      <div style={{
        background: HIFI.surface, borderRadius: 22, padding: 18,
        boxShadow: '0 1px 0 rgba(0,0,0,0.03), 0 12px 32px -20px rgba(28,38,34,0.18)',
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted }}>
          Left to spend · June
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '6px 0 14px' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 38, fontWeight: 500, letterSpacing: -1, color: HIFI.ink }}>$2,680</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 20, color: HIFI.faint }}>.42</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: HIFI.muted }}>CAD</span>
        </div>
        <HFBar value={4820 / 7500} h={6} color={HIFI.sage} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: HIFI.muted }}>
          <span>Spent $4,820</span><span>Budget $7,500</span>
        </div>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px dashed ${HIFI.line}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11 }}>
            <span style={{ color: HIFI.ink }}>Essential vs treats</span>
            <span style={{ fontFamily: FONT_MONO, color: HIFI.muted }}>$3,720 · $1,100</span>
          </div>
          <HFSplitBar essential={3720 / 4820} h={8} />
        </div>
      </div>

      {/* Income + Tax cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        <div style={{ background: HIFI.surface, borderRadius: 18, padding: 14 }}>
          <div style={{ fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted }}>Income</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 500, color: HIFI.ink, marginTop: 4 }}>$10,200</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: HIFI.sage, marginTop: 2 }}>
            <span style={{ width: 18, height: 4, background: HIFI.sage, borderRadius: 2 }} />
            <span style={{ width: 8, height: 4, background: HIFI.sand, borderRadius: 2 }} />
            <span style={{ fontSize: 10, color: HIFI.muted, marginLeft: 4 }}>A 70 · B 30</span>
          </div>
        </div>
        <div style={{ background: HIFI.surface, borderRadius: 18, padding: 14 }}>
          <div style={{ fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted }}>Tax bucket</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 500, color: HIFI.ink, marginTop: 4 }}>$2,070</div>
          <div style={{ fontSize: 10, color: HIFI.muted, marginTop: 2 }}>25% set aside</div>
        </div>
      </div>

      {/* Spending donut */}
      <div style={{ background: HIFI.surface, borderRadius: 22, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: HIFI.ink }}>Spending</div>
          <div style={{ fontSize: 11, color: HIFI.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
            See all {Icon.chevRight(12)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <HFDonut size={104} thickness={12} parts={[0.34, 0.22, 0.18, 0.14, 0.12]}
            strokes={[HIFI.sage, HIFI.sand, HIFI.sageMid, HIFI.sageSoft, HIFI.sandLight]} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[['Groceries', 1640, HIFI.sage],
              ['Kids', 1060, HIFI.sand],
              ['Bills', 870, HIFI.sageMid],
              ['Eating out', 675, HIFI.sageSoft],
              ['Other', 575, HIFI.sandLight]].map(([n, v, c]) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: HIFI.ink2 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{n}
                </span>
                <span style={{ fontFamily: FONT_MONO, color: HIFI.ink, fontSize: 11.5 }}>${v.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: HIFI.ink }}>Recent activity</div>
        <div style={{ fontSize: 11, color: HIFI.muted }}>Today</div>
      </div>
      <div style={{ background: HIFI.surface, borderRadius: 22, padding: '4px 14px', marginBottom: 110 }}>
        {[
          ['music',   'Music · Mia',    'Kids · for Mia',         -32.00, 'B'],
          ['cart',    'Whole Foods',    'Groceries · split',     -142.30, 'A'],
          ['baby',    'Diapers',        'Kids · essential · Eli', -28.40, 'B'],
          ['receipt', 'Salary · Alex',  'Income · 70%',          5800.00, 'A'],
        ].map(([icon, name, sub, amt, who], i, arr) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 0',
            borderBottom: i < arr.length - 1 ? `1px solid ${HIFI.line}` : 'none',
          }}>
            <MerchantIcon kind={icon} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: HIFI.ink, fontWeight: 500 }}>{name}</div>
              <div style={{ fontSize: 11, color: HIFI.muted, marginTop: 1 }}>{sub}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: amt > 0 ? HIFI.sage : HIFI.ink }}>
                {amt > 0 ? '+' : '−'}${Math.abs(amt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 10, color: HIFI.muted, marginTop: 1 }}>{who}</div>
            </div>
          </div>
        ))}
      </div>

      {/* FAB */}
      <button aria-label="add" style={{
        position: 'absolute', right: 22, bottom: 50,
        width: 56, height: 56, borderRadius: 28,
        background: HIFI.sage, color: '#fff', border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 24px -6px rgba(42,61,51,0.45), 0 2px 0 rgba(0,0,0,0.04)',
        cursor: 'pointer',
      }}>{Icon.plus(24)}</button>
    </div>
  );
}

/* ============== DIRECTION B — Editorial typographic (Android) ============== */
function DashboardB() {
  return (
    <div style={{
      flex: 1, background: HIFI.surfaceWarm, color: HIFI.ink, fontFamily: FONT_SANS,
      padding: '54px 24px 0', overflow: 'auto',
    }}>
      {/* Minimal header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
        <button style={{ background: 'none', border: 'none', color: HIFI.ink, padding: 0 }}>{Icon.menu(22)}</button>
        <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: HIFI.ink }}>Budget</div>
        <button style={{ background: 'none', border: 'none', color: HIFI.ink, padding: 0 }}>{Icon.bell(20)}</button>
      </div>

      {/* Big number */}
      <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: HIFI.muted }}>
        Left to spend · June
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12, marginBottom: 14 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 64, fontWeight: 400, letterSpacing: -2.5, lineHeight: 1, color: HIFI.ink }}>
          $2,680
        </span>
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: HIFI.muted, marginBottom: 22 }}>
        <span>of <span style={{ fontFamily: FONT_MONO, color: HIFI.ink2 }}>$7,500</span> budget</span>
        <span style={{ color: HIFI.sage, display: 'flex', alignItems: 'center', gap: 3 }}>
          {Icon.arrowDown(11)} 8% vs May
        </span>
      </div>

      {/* Essential split inline */}
      <div style={{ marginBottom: 28 }}>
        <HFSplitBar essential={3720 / 4820} h={10} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: HIFI.muted }}>
          <span><span style={{ fontFamily: FONT_MONO, color: HIFI.ink }}>$3,720</span> essential</span>
          <span><span style={{ fontFamily: FONT_MONO, color: HIFI.ink }}>$1,100</span> treats</span>
        </div>
      </div>

      <div style={{ height: 1, background: HIFI.line, marginBottom: 22 }} />

      {/* Trio of stats — typographic */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, marginBottom: 26 }}>
        {[
          ['Income',     '$10,200', '+4.2%'],
          ['Tax saved',  '$2,070',  '25%'],
          ['Net',        '+$5,380', 'saved'],
        ].map(([l, v, sub]) => (
          <div key={l}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: HIFI.muted, marginBottom: 6 }}>{l}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 18, color: HIFI.ink, letterSpacing: -0.5 }}>{v}</div>
            <div style={{ fontSize: 10, color: HIFI.muted, marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: HIFI.line, marginBottom: 22 }} />

      {/* Category list — clean type */}
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: HIFI.muted, marginBottom: 12 }}>
        Top categories
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
        {[
          ['Groceries',   1640, 1800, 0.85],
          ['Kids',        1060, 1400, 0.92],
          ['Bills',        870,  900, 1.00],
          ['Eating out',   675,  550, 0.20],
        ].map(([n, v, total, ess]) => (
          <div key={n}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 14, color: HIFI.ink }}>{n}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: HIFI.ink2 }}>
                ${v} <span style={{ color: HIFI.faint }}>/ ${total}</span>
              </span>
            </div>
            <HFSplitBar essential={ess} h={5} />
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: HIFI.line, marginBottom: 22 }} />

      {/* Activity — minimal */}
      <div style={{ fontFamily: FONT_MONO, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: HIFI.muted, marginBottom: 10 }}>
        Today · Jun 18
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 80 }}>
        {[
          ['Music · Mia',    'Kids · for Mia',         -32.00],
          ['Whole Foods',    'Groceries · split',     -142.30],
          ['Diapers',        'Kids · essential · Eli', -28.40],
        ].map(([n, sub, amt], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <div style={{ fontSize: 14, color: HIFI.ink }}>{n}</div>
              <div style={{ fontSize: 11, color: HIFI.muted, marginTop: 2 }}>{sub}</div>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: HIFI.ink }}>
              −${Math.abs(amt).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {/* Small + button */}
      <button aria-label="add" style={{
        position: 'absolute', right: 24, bottom: 40,
        width: 52, height: 52, borderRadius: 26,
        background: HIFI.ink, color: '#fff', border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 10px 28px -8px rgba(28,38,34,0.4)',
      }}>{Icon.plus(22)}</button>
    </div>
  );
}

/* ============== DIRECTION C — Family-first (iOS) ============== */
function DashboardC() {
  const KIDS = [
    { name: 'Sam', age: 14, spent: 18, allow: 20 },
    { name: 'Mia', age: 11, spent: 11, allow: 15 },
    { name: 'Jo',  age:  8, spent:  6, allow: 10 },
    { name: 'Eli', age:  5, spent:  3, allow: 5 },
  ];
  return (
    <div style={{
      flex: 1, background: HIFI.bg, color: HIFI.ink, fontFamily: FONT_SANS,
      padding: '60px 16px 0', overflow: 'auto',
    }}>
      {/* App bar with family chip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: HIFI.surface, color: HIFI.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Icon.menu(18)}</button>
        <div style={{
          display: 'flex', alignItems: 'center', gap: -4,
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
        <button style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: HIFI.surface, color: HIFI.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Icon.bell(18)}</button>
      </div>

      {/* Household pool — sand-toned */}
      <div style={{
        background: HIFI.sage, borderRadius: 22, padding: 18,
        color: '#fff', marginBottom: 12,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -40, right: -30, width: 160, height: 160,
          borderRadius: '50%', background: HIFI.sageMid, opacity: 0.4,
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
            Household pool · June
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '8px 0 14px' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 36, fontWeight: 500, letterSpacing: -1 }}>$2,680</span>
            <span style={{ fontSize: 13, opacity: 0.7 }}>left</span>
          </div>
          <HFBar value={4820 / 7500} h={5} color={HIFI.sand} track="rgba(255,255,255,0.18)" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, opacity: 0.7 }}>
            <span>Spent $4,820</span><span>Budget $7,500</span>
          </div>
        </div>
      </div>

      {/* Adults row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { ini: 'A', name: 'Alex', amt: 2820, share: 70, color: HIFI.sage },
          { ini: 'B', name: 'Bea',  amt: 1200, share: 30, color: HIFI.sand },
        ].map(p => (
          <div key={p.name} style={{ background: HIFI.surface, borderRadius: 18, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <FamilyAvatar initial={p.ini} size={28} tone={p.ini === 'A' ? 'sage' : 'sand'} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: HIFI.ink }}>{p.name}</div>
                <div style={{ fontSize: 9.5, color: HIFI.muted, fontFamily: FONT_MONO }}>{p.share}% share</div>
              </div>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 500, color: HIFI.ink }}>${p.amt}</div>
            <div style={{ fontSize: 10, color: HIFI.muted, marginTop: 2 }}>spent this month</div>
            <div style={{ marginTop: 8 }}>
              <HFBar value={p.amt / 4500} color={p.color} h={4} />
            </div>
          </div>
        ))}
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

      {/* Recent — with member badge */}
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>This week</div>
      <div style={{ background: HIFI.surface, borderRadius: 22, padding: '4px 14px', marginBottom: 110 }}>
        {[
          ['music', 'Music lesson',  'B', 'Mia',   -32.00],
          ['baby',  'Diapers',       'B', 'Eli',   -28.40],
          ['cart',  'Whole Foods',   'A', 'shared',-142.30],
          ['receipt','Soccer dues',  'A', 'Sam',    -45.00],
        ].map(([icon, n, who, forWho, amt], i, arr) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 0',
            borderBottom: i < arr.length - 1 ? `1px solid ${HIFI.line}` : 'none',
          }}>
            <MerchantIcon kind={icon} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: HIFI.ink, fontWeight: 500 }}>{n}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <FamilyAvatar initial={who} size={14} tone={who === 'A' ? 'sage' : 'sand'} />
                <span style={{ fontSize: 10.5, color: HIFI.muted }}>paid · for</span>
                <FamilyAvatar initial={forWho[0].toUpperCase()} size={14} tone={['A','B'].includes(forWho[0]) ? 'sage' : 'sand'} />
                <span style={{ fontSize: 10.5, color: HIFI.muted }}>{forWho}</span>
              </div>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: HIFI.ink }}>−${Math.abs(amt).toFixed(2)}</div>
          </div>
        ))}
      </div>

      {/* FAB */}
      <button aria-label="add" style={{
        position: 'absolute', right: 22, bottom: 50,
        width: 56, height: 56, borderRadius: 28,
        background: HIFI.sage, color: '#fff', border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 24px -6px rgba(42,61,51,0.45)',
      }}>{Icon.plus(24)}</button>
    </div>
  );
}

Object.assign(window, { DashboardA, DashboardB, DashboardC });
