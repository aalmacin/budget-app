/* Hi-fi screens — batch 2: Income, Taxes, Reports, Family, Settings, Login */

const SCREEN_SHELL = {
  background: HIFI.bg, color: HIFI.ink, fontFamily: FONT_SANS,
  position: 'relative', height: '100%', overflow: 'hidden',
};

const ScrollArea = ({ children, top = 60 }) => (
  <div style={{ height: '100%', overflow: 'auto', padding: `${top}px 0 0` }}>{children}</div>
);

/* -------- ADD INCOME -------- */
function ScreenAddIncome() {
  return (
    <div style={SCREEN_SHELL}>
      <ScrollArea top={54}>
        <AppBar
          left={<button style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: 'transparent', color: HIFI.ink, fontFamily: FONT_MONO, fontSize: 16 }}>✕</button>}
          center={<div style={{ fontSize: 14, fontWeight: 500 }}>Log income</div>}
          right={<button style={{ height: 38, padding: '0 14px', borderRadius: 12, border: 'none', background: HIFI.sage, color: '#fff', fontWeight: 500, fontSize: 13 }}>Save</button>}
        />
        <div style={{ padding: '0 18px' }}>
          <div style={{ textAlign: 'center', padding: '10px 0 18px' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: HIFI.muted }}>Net amount</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'center', marginTop: 8 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 14, color: HIFI.muted, marginBottom: 14 }}>$</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 56, fontWeight: 500, letterSpacing: -2.5, lineHeight: 1, color: HIFI.ink }}>4,350</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 28, color: HIFI.faint, lineHeight: 1, alignSelf: 'baseline' }}>.00</span>
            </div>
            <div style={{ fontSize: 11, color: HIFI.muted, marginTop: 8, fontFamily: FONT_MONO }}>after tax · take-home</div>
          </div>

          <div style={{ background: HIFI.surface, borderRadius: 18, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted, marginBottom: 4 }}>Source</div>
            <div style={{ fontSize: 15, color: HIFI.ink, paddingBottom: 12, borderBottom: `1px solid ${HIFI.line}` }}>Acme Corp · payroll</div>
            <div style={{ fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted, margin: '14px 0 8px' }}>Type</div>
            <ChipsRow items={['Salary', 'Contract', 'Self-employed', 'Benefit', 'Refund', 'Gift']} selected="Salary" />
          </div>

          <div style={{ background: HIFI.surface, borderRadius: 18, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted }}>Earner</div>
              <div style={{ fontSize: 10, fontFamily: FONT_MONO, color: HIFI.muted }}>tap to switch</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['Alex', 'A', true, 'sage'], ['Bea', 'B', false, 'sand']].map(([n, ini, on, tone]) => (
                <button key={n} style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 14px', borderRadius: 14, border: 'none',
                  background: on ? HIFI.ink : HIFI.surfaceSoft,
                  color: on ? '#fff' : HIFI.ink2,
                  fontSize: 13, fontWeight: 500,
                }}>
                  <FamilyAvatar initial={ini} size={22} tone={on ? 'paper' : tone} />
                  {n}
                  {on && <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.7, fontFamily: FONT_MONO }}>70%</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Income split impact */}
          <div style={{
            background: HIFI.sage, color: '#fff',
            borderRadius: 18, padding: 16, marginBottom: 12,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -40, right: -30, width: 130, height: 130,
              borderRadius: '50%', background: HIFI.sageMid, opacity: 0.4,
            }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
                  Updates household split
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>auto</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 500, letterSpacing: -0.5 }}>Alex 70%</span>
                <span style={{ fontSize: 13, opacity: 0.65 }}>· Bea 30%</span>
              </div>
              <div style={{ height: 5, display: 'flex', borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.18)' }}>
                <div style={{ width: '70%', background: HIFI.sand }} />
              </div>
              <div style={{ fontSize: 10.5, opacity: 0.75, marginTop: 10 }}>
                Logging this paycheque updates the income-based split used to share household bills.
              </div>
            </div>
          </div>

          <div style={{ background: HIFI.surface, borderRadius: 18, padding: 4, marginBottom: 100 }}>
            {[
              ['Date',      'Jun 15, 2026'],
              ['Account',   'RBC · Joint chequing'],
              ['Recurring', 'Monthly on the 15th'],
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
      </ScrollArea>
    </div>
  );
}

/* -------- TAXES (removed — feature deprecated) -------- */
function _ScreenTaxesDeprecated() {
  const QUARTERS = [
    { q: 'Q1', d: 'Mar 15', v: 3200, status: 'paid' },
    { q: 'Q2', d: 'Jun 15', v: 3200, status: 'due in 9d' },
    { q: 'Q3', d: 'Sep 15', v: 3200, status: 'planned' },
    { q: 'Q4', d: 'Dec 15', v: 3200, status: 'planned' },
  ];
  return (
    <div style={SCREEN_SHELL}>
      <ScrollArea>
        <AppBar
          left={<MenuBtn />}
          center={<div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 500 }}>Taxes · 2026 {Icon.chevDown(14)}</div>}
          right={<IconBtn icon={<span style={{ fontSize: 18, fontFamily: FONT_MONO }}>···</span>} />}
        />
        <div style={{ padding: '0 16px' }}>
          {/* Hero */}
          <div style={{
            background: HIFI.sage, color: '#fff',
            borderRadius: 24, padding: 20, marginBottom: 12,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -50, right: -40, width: 180, height: 180,
              borderRadius: '50%', background: HIFI.sageMid, opacity: 0.35,
            }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
                Set aside this year
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '8px 0 14px' }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 42, fontWeight: 500, letterSpacing: -1.5, lineHeight: 1 }}>$8,420</span>
                <span style={{ fontSize: 13, opacity: 0.7 }}>of $12,800 est.</span>
              </div>
              <HFBar value={0.66} h={5} color={HIFI.sand} track="rgba(255,255,255,0.18)" />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, opacity: 0.72 }}>
                <span>66% saved</span><span>$4,380 to go</span>
              </div>
            </div>
          </div>

          {/* KPI trio */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
            {[
              ['Effective', '24.1%',  'YTD'],
              ['Marginal',  '31%',    'ON · sole prop'],
              ['Saved',     '$2,920', 'from deductions'],
            ].map(([l, v, sub]) => (
              <div key={l} style={{ background: HIFI.surface, borderRadius: 14, padding: 12 }}>
                <div style={{ fontSize: 9.5, fontFamily: FONT_MONO, letterSpacing: 0.8, textTransform: 'uppercase', color: HIFI.muted }}>{l}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 17, fontWeight: 500, letterSpacing: -0.4, color: HIFI.ink, marginTop: 4 }}>{v}</div>
                <div style={{ fontSize: 9.5, color: HIFI.muted, marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* CRA instalments */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>CRA instalments</div>
            <div style={{ fontSize: 11, color: HIFI.muted, fontFamily: FONT_MONO }}>Self-employed</div>
          </div>
          <div style={{ background: HIFI.surface, borderRadius: 22, padding: 4, marginBottom: 16 }}>
            {QUARTERS.map((q, i) => {
              const paid = q.status === 'paid';
              const due = q.status.startsWith('due');
              return (
                <div key={q.q} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 14px',
                  borderBottom: i < QUARTERS.length - 1 ? `1px solid ${HIFI.line}` : 'none',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: paid ? HIFI.sage : due ? HIFI.sand : HIFI.surfaceSoft,
                    color: paid || due ? (paid ? '#fff' : HIFI.ink) : HIFI.muted,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
                  }}>{q.q}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{q.d}</div>
                    <div style={{ fontSize: 10.5, color: due ? HIFI.brick : HIFI.muted, fontFamily: FONT_MONO, marginTop: 2 }}>
                      {q.status.toUpperCase()}
                    </div>
                  </div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: HIFI.ink, fontWeight: 500 }}>${q.v.toLocaleString()}</div>
                </div>
              );
            })}
          </div>

          {/* Deductions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Deductions · 2026</div>
            <div style={{ fontSize: 11, color: HIFI.muted, display: 'flex', alignItems: 'center', gap: 3 }}>See all {Icon.chevRight(12)}</div>
          </div>
          <div style={{ background: HIFI.surface, borderRadius: 22, padding: 4, marginBottom: 120 }}>
            {[
              ['Home office · T2125',    2400, 18],
              ['Vehicle · business km',  1820, 42],
              ['Software & SaaS',        1180, 12],
              ['Private health',         2960, 11],
            ].map(([n, v, c], i, a) => (
              <div key={n} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 14px',
                borderBottom: i < a.length - 1 ? `1px solid ${HIFI.line}` : 'none',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: HIFI.ink }}>{n}</div>
                  <div style={{ fontSize: 10.5, color: HIFI.muted, marginTop: 2, fontFamily: FONT_MONO }}>{c} TXNS</div>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: HIFI.ink }}>${v.toLocaleString()}</div>
                <span style={{ color: HIFI.faint }}>{Icon.chevRight(14)}</span>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/* -------- REPORTS (Essentials) -------- */
function ScreenReports() {
  const TOTAL_ESS = 3720, TOTAL_NON = 1100;
  const REC_ESS = [['Rent', 1950], ['Daycare · Eli', 320], ['Bell internet', 90], ['Rogers · mobile', 95], ['Kumon · Mia', 160]];
  const REC_NON = [['Netflix', 19], ['Spotify Family', 18], ['Disney+', 15], ['Roblox · Sam', 12], ['NYT', 8], ['iCloud', 3]];
  const recEss = REC_ESS.reduce((s, [, v]) => s + v, 0);
  const recNon = REC_NON.reduce((s, [, v]) => s + v, 0);
  return (
    <div style={SCREEN_SHELL}>
      <ScrollArea>
        <AppBar
          left={<MenuBtn />}
          center={<div style={{ fontSize: 15, fontWeight: 500 }}>Reports</div>}
          right={<IconBtn icon={Icon.search(18)} />}
        />
        <div style={{ padding: '0 16px' }}>
          <div style={{ marginBottom: 16 }}>
            <SegControl options={['1W', '1M', '3M', '6M', 'YTD']} value="3M" />
          </div>

          {/* Essentials donut hero */}
          <div style={{ background: HIFI.surface, borderRadius: 22, padding: 18, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ position: 'relative' }}>
                <HFDonut size={116} thickness={14} parts={[TOTAL_ESS / (TOTAL_ESS + TOTAL_NON), TOTAL_NON / (TOTAL_ESS + TOTAL_NON)]} strokes={[HIFI.sage, HIFI.sand]} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 500, color: HIFI.ink, letterSpacing: -0.5 }}>77%</div>
                  <div style={{ fontSize: 9.5, color: HIFI.muted, fontFamily: FONT_MONO }}>essential</div>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted }}>All spending · June</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 22, fontWeight: 500, letterSpacing: -0.5, marginTop: 2 }}>$4,820</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span style={{ width: 10, height: 10, background: HIFI.sage, borderRadius: 2 }} />Essential
                    </span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 12 }}>${TOTAL_ESS.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span style={{ width: 10, height: 10, background: HIFI.sand, borderRadius: 2 }} />Treats
                    </span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 12 }}>${TOTAL_NON.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recurring split */}
          <div style={{ background: HIFI.surface, borderRadius: 22, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Recurring · monthly</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: HIFI.ink2 }}>${(recEss + recNon).toLocaleString()}</div>
            </div>
            <HFSplitBar essential={recEss / (recEss + recNon)} h={12} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: HIFI.muted }}>
              <span><span style={{ fontFamily: FONT_MONO, color: HIFI.ink }}>${recEss.toLocaleString()}</span> essential · {REC_ESS.length}</span>
              <span><span style={{ fontFamily: FONT_MONO, color: HIFI.ink }}>${recNon}</span> treats · {REC_NON.length}</span>
            </div>
          </div>

          {/* Two-column list */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ background: HIFI.surface, borderRadius: 18, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 0.8, textTransform: 'uppercase', color: HIFI.sage }}>● Essential</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11 }}>${recEss}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {REC_ESS.map(([n, v]) => (
                  <div key={n} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11.5, color: HIFI.ink2 }}>{n}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 11 }}>${v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: HIFI.surface, borderRadius: 18, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 0.8, textTransform: 'uppercase', color: HIFI.sand, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, background: HIFI.sand, borderRadius: 2 }} />Treats
                </span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11 }}>${recNon}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {REC_NON.map(([n, v]) => (
                  <div key={n} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11.5, color: HIFI.ink2 }}>{n}</span>
                    <span style={{ fontFamily: FONT_MONO, fontSize: 11 }}>${v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Heads up callout */}
          <div style={{
            background: HIFI.sandSoft, border: `1px solid ${HIFI.sandLight}`,
            borderRadius: 18, padding: '14px 16px', marginBottom: 120,
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: HIFI.sage, flexShrink: 0,
            }}>{Icon.bell(16)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: HIFI.ink, marginBottom: 2 }}>4 overlapping streaming subs</div>
              <div style={{ fontSize: 11.5, color: HIFI.ink2, lineHeight: 1.45 }}>Netflix, Disney+, Prime Video, Crave — review to save up to $52/mo.</div>
            </div>
            <button style={{
              padding: '6px 12px', borderRadius: 999, border: 'none',
              background: HIFI.sage, color: '#fff', fontSize: 11, fontWeight: 500,
            }}>Review</button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/* -------- FAMILY -------- */
function ScreenFamily() {
  const KIDS = [
    { name: 'Sam', age: 14, spent: 248, budget: 300, top: 'Soccer · $45',     last: 'Sat',  icon: 'receipt' },
    { name: 'Mia', age: 11, spent: 312, budget: 320, top: 'Kumon · $160',     last: 'Mon',  icon: 'music' },
    { name: 'Jo',  age:  8, spent: 164, budget: 220, top: 'Haircut · $24',    last: 'Thu',  icon: 'receipt' },
    { name: 'Eli', age:  5, spent: 410, budget: 560, top: 'Daycare · $72',    last: 'Today',icon: 'baby' },
  ];
  const totalSpent = KIDS.reduce((s, k) => s + k.spent, 0);
  const totalBudget = KIDS.reduce((s, k) => s + k.budget, 0);
  return (
    <div style={SCREEN_SHELL}>
      <ScrollArea>
        <AppBar
          left={<MenuBtn />}
          center={<div style={{ fontSize: 15, fontWeight: 500 }}>Family</div>}
          right={<IconBtn icon={Icon.plus(18)} />}
        />
        <div style={{ padding: '0 16px' }}>
          {/* Spent-on-kids hero */}
          <div style={{
            background: HIFI.sage, color: '#fff',
            borderRadius: 24, padding: 20, marginBottom: 14,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -50, right: -40, width: 180, height: 180,
              borderRadius: '50%', background: HIFI.sageMid, opacity: 0.35,
            }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)' }}>
                  Spent on kids · June
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: FONT_MONO }}>4 kids</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 42, fontWeight: 500, letterSpacing: -1.5, lineHeight: 1 }}>${totalSpent.toLocaleString()}</span>
                <span style={{ fontSize: 13, opacity: 0.7 }}>of ${totalBudget.toLocaleString()} planned</span>
              </div>
              <HFBar value={totalSpent / totalBudget} h={5} color={HIFI.sand} track="rgba(255,255,255,0.18)" />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, opacity: 0.72 }}>
                <span>{Math.round((totalSpent / totalBudget) * 100)}% used</span>
                <span>${(totalBudget - totalSpent).toLocaleString()} left</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ marginBottom: 12 }}>
            <SegControl options={['All', 'This week', 'June', 'YTD']} value="June" />
          </div>

          {/* Per-kid cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 120 }}>
            {KIDS.map(k => {
              const p = k.spent / k.budget;
              return (
                <div key={k.name} style={{
                  background: HIFI.surface, borderRadius: 20, padding: 14,
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <FamilyAvatar initial={k.name[0]} size={48} tone="sand" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 15, fontWeight: 500 }}>{k.name}<span style={{ fontSize: 10.5, color: HIFI.muted, fontFamily: FONT_MONO, marginLeft: 8 }}>AGE {k.age}</span></div>
                      <div style={{ fontFamily: FONT_MONO, fontSize: 14, color: HIFI.ink, fontWeight: 500 }}>
                        ${k.spent}<span style={{ color: HIFI.faint }}> / ${k.budget}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <HFBar value={p} h={4} color={HIFI.sage} track={HIFI.surfaceSoft} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
                      <div style={{ fontSize: 10.5, color: HIFI.muted, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ color: HIFI.sage }}>●</span>
                        <span>Top: {k.top}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: HIFI.muted, fontFamily: FONT_MONO }}>{k.last.toUpperCase()}</div>
                    </div>
                  </div>
                  <span style={{ color: HIFI.faint }}>{Icon.chevRight(14)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/* -------- SETTINGS / HOUSEHOLD -------- */
function ScreenSettings() {
  const KIDS = [['Sam', 14, 248], ['Mia', 11, 312], ['Jo', 8, 164], ['Eli', 5, 410]];
  return (
    <div style={SCREEN_SHELL}>
      <ScrollArea>
        <AppBar
          left={<MenuBtn />}
          center={<div style={{ fontSize: 15, fontWeight: 500 }}>Household</div>}
          right={<IconBtn icon={<span style={{ fontFamily: FONT_MONO, fontSize: 13 }}>✎</span>} />}
        />
        <div style={{ padding: '0 16px' }}>
          {/* Adults */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted }}>Adults · 2</div>
            <div style={{ fontSize: 11, color: HIFI.sage, fontWeight: 500 }}>+ Add</div>
          </div>
          <div style={{ background: HIFI.surface, borderRadius: 22, padding: 14, marginBottom: 14, display: 'flex', gap: 10 }}>
            {[['Alex', 'A', 'sage', 'admin'], ['Bea', 'B', 'sand', 'admin']].map(([n, ini, tone, role]) => (
              <div key={n} style={{
                flex: 1, padding: 14, borderRadius: 14, background: HIFI.surfaceSoft,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <FamilyAvatar initial={ini} size={36} tone={tone} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{n}</div>
                  <div style={{ fontSize: 10.5, color: HIFI.muted, fontFamily: FONT_MONO, textTransform: 'uppercase', letterSpacing: 0.6 }}>{role}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Kids */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted }}>Kids · {KIDS.length}</div>
            <div style={{ fontSize: 11, color: HIFI.sage, fontWeight: 500 }}>+ Add</div>
          </div>
          <div style={{
            background: HIFI.surface, borderRadius: 22, padding: 14, marginBottom: 14,
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
          }}>
            {KIDS.map(([n, age, spent]) => (
              <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 2px' }}>
                <FamilyAvatar initial={n[0]} size={40} tone="sand" />
                <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>{n}</div>
                <div style={{ fontSize: 9.5, color: HIFI.muted, fontFamily: FONT_MONO }}>age {age}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 10, color: HIFI.ink }}>${spent}/mo</div>
              </div>
            ))}
          </div>

          {/* Income-based split rule */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted }}>Income-based split</div>
            <div style={{ fontSize: 11, color: HIFI.muted }}>auto · monthly</div>
          </div>
          <div style={{ background: HIFI.surface, borderRadius: 22, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, color: HIFI.muted, marginBottom: 12 }}>
              Recomputed monthly from each adult's net income.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <FamilyAvatar initial="A" size={18} tone="sage" />
                  <span style={{ fontSize: 11, color: HIFI.muted }}>Alex · net</span>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 500, letterSpacing: -0.3 }}>$5,800/mo</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: 11, color: HIFI.muted }}>Bea · net</span>
                  <FamilyAvatar initial="B" size={18} tone="sand" />
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 16, fontWeight: 500, letterSpacing: -0.3 }}>$2,485/mo</div>
              </div>
            </div>
            <div style={{ height: 10, display: 'flex', borderRadius: 999, overflow: 'hidden', marginTop: 12 }}>
              <div style={{ width: '70%', background: HIFI.sage }} />
              <div style={{ width: '30%', background: HIFI.sand }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10.5, color: HIFI.muted, fontFamily: FONT_MONO }}>
              <span>ALEX 70%</span><span>BEA 30%</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              {['Auto · monthly', 'Lock', 'Equal'].map((l, i) => (
                <button key={l} style={{
                  flex: 1, padding: '8px 0', borderRadius: 10, border: 'none',
                  background: i === 0 ? HIFI.ink : HIFI.surfaceSoft,
                  color: i === 0 ? '#fff' : HIFI.ink2,
                  fontSize: 11, fontWeight: 500, fontFamily: FONT_SANS,
                }}>{l}</button>
              ))}
            </div>
          </div>

          {/* Shared accounts */}
          <div style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted, marginBottom: 8 }}>Shared</div>
          <div style={{ background: HIFI.surface, borderRadius: 22, padding: 4, marginBottom: 14 }}>
            {[
              ['Joint chequing',  'RBC · ••4821'],
              ['Joint savings',   'EQ Bank HISA · ••0930'],
              ['Tax bucket',      'Wealthsimple Cash · auto'],
              ['Kids · RESP',     'Questrade · ••1147'],
            ].map(([n, s], i, a) => (
              <div key={n} style={{
                display: 'flex', alignItems: 'center',
                padding: '13px 14px',
                borderBottom: i < a.length - 1 ? `1px solid ${HIFI.line}` : 'none',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: HIFI.ink }}>{n}</div>
                  <div style={{ fontSize: 10.5, color: HIFI.muted, marginTop: 2 }}>{s}</div>
                </div>
                <span style={{ color: HIFI.faint }}>{Icon.chevRight(14)}</span>
              </div>
            ))}
          </div>

          {/* Rules */}
          <div style={{ fontSize: 11, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted, marginBottom: 8 }}>Rules</div>
          <div style={{ background: HIFI.surface, borderRadius: 22, padding: 4, marginBottom: 120 }}>
            {[
              ['Default split',    'by income · auto'],
              ['Approval over',    '$500'],
              ['Auto-categorize',  'on'],
              ['Essential rule',   'Groceries · 80% default'],
              ['Currency',         'CAD'],
            ].map(([n, v], i, a) => (
              <div key={n} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '13px 14px',
                borderBottom: i < a.length - 1 ? `1px solid ${HIFI.line}` : 'none',
              }}>
                <div style={{ fontSize: 13, color: HIFI.ink }}>{n}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: HIFI.muted }}>{v}</span>
                  {Icon.chevRight(14)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/* -------- QUICK ADD -------- */
function ScreenQuickAdd() {
  const RECENTS = [
    { name: 'Music lesson',    sub: 'Mia · weekly',      amt: 32.00,  icon: 'music',   accent: true,  kid: 'M' },
    { name: 'Diapers · pack',  sub: 'Eli · 1–2 wk',      amt: 28.40,  icon: 'baby',                   kid: 'E' },
    { name: 'Daycare',         sub: 'Eli · M–F',         amt: 72.00,  icon: 'baby',                   kid: 'E' },
    { name: 'Soccer · Sam',    sub: 'Kids · monthly',    amt: 45.00,  icon: 'receipt',                kid: 'S' },
    { name: 'Kids haircut',    sub: 'Jo · 6wk',          amt: 24.00,  icon: 'receipt',                kid: 'J' },
    { name: 'Whole Foods',     sub: 'Groceries · split', amt: 142.30, icon: 'cart' },
  ];
  const SUBS = [
    { n: 'Rogers · mobile', v: 95.00,  d: 'Jun 24', who: 'Household', tone: 'sage' },
    { n: 'Bell · internet', v: 89.99,  d: 'Jul 02', who: 'Household', tone: 'sage' },
    { n: 'Netflix',         v: 18.99,  d: 'Jul 04', who: 'Household', tone: 'sand' },
    { n: 'Spotify Family',  v: 17.99,  d: 'Jul 08', who: 'Household', tone: 'sand' },
    { n: 'Roblox · Sam',    v: 11.99,  d: 'Jul 04', who: 'Sam',       tone: 'sand', kid: 'S' },
    { n: 'Kumon · Mia',     v: 160.00, d: 'Jul 11', who: 'Mia',       tone: 'sage', kid: 'M' },
  ];
  const subsTotal = SUBS.reduce((s, x) => s + x.v, 0);

  return (
    <div style={SCREEN_SHELL}>
      <ScrollArea top={54}>
        <AppBar
          left={<button style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: 'transparent', color: HIFI.ink, fontFamily: FONT_MONO, fontSize: 16 }}>✕</button>}
          center={<div style={{ fontSize: 14, fontWeight: 500 }}>Quick add</div>}
          right={<IconBtn icon={Icon.plus(18)} />}
        />

        <div style={{ padding: '0 16px' }}>
          {/* Filter chips */}
          <div style={{ marginBottom: 14 }}>
            <ChipsRow items={['Recent', 'Subs', 'Per kid', 'Merchants', 'Categories']} selected="Recent" />
          </div>

          {/* Tap to log again */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Tap to log again</div>
            <div style={{ fontSize: 11, color: HIFI.muted, fontFamily: FONT_MONO }}>6 RECENTS</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
            {RECENTS.map((r, i) => {
              const filled = r.accent;
              const cardBg = filled ? HIFI.sage : HIFI.surface;
              const fg = filled ? '#fff' : HIFI.ink;
              const subFg = filled ? 'rgba(255,255,255,0.7)' : HIFI.muted;
              return (
                <button key={i} style={{
                  background: cardBg, color: fg, border: 'none', textAlign: 'left',
                  borderRadius: 18, padding: 14,
                  display: 'flex', flexDirection: 'column', gap: 8, minHeight: 116,
                  boxShadow: filled ? '0 6px 18px -8px rgba(42,61,51,0.4)' : '0 1px 0 rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {filled && (
                    <div style={{
                      position: 'absolute', top: -30, right: -30, width: 90, height: 90,
                      borderRadius: '50%', background: HIFI.sageMid, opacity: 0.4,
                    }} />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 9,
                      background: filled ? 'rgba(255,255,255,0.16)' : HIFI.surfaceSoft,
                      color: filled ? '#fff' : HIFI.ink2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{Icon[r.icon] ? Icon[r.icon](16) : Icon.receipt(16)}</div>
                    {r.kid && <FamilyAvatar initial={r.kid} size={20} tone={filled ? 'paper' : 'sand'} />}
                  </div>
                  <div style={{ position: 'relative', marginTop: 'auto' }}>
                    <div style={{ fontSize: 9.5, fontFamily: FONT_MONO, letterSpacing: 0.8, textTransform: 'uppercase', color: subFg, marginBottom: 3 }}>{r.sub}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{r.name}</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 500, letterSpacing: -0.3 }}>
                      ${r.amt.toFixed(2)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Subscriptions header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Subscriptions</div>
              <div style={{ fontSize: 10.5, color: HIFI.muted, marginTop: 2 }}>Auto-log monthly · tap to edit</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 500, letterSpacing: -0.3 }}>${subsTotal.toFixed(2)}</div>
              <div style={{ fontSize: 10, color: HIFI.muted, fontFamily: FONT_MONO, letterSpacing: 0.5 }}>/MO · {SUBS.length}</div>
            </div>
          </div>

          {/* Subs list */}
          <div style={{ background: HIFI.surface, borderRadius: 22, padding: 4, marginBottom: 14 }}>
            {SUBS.map((s, i) => (
              <div key={s.n} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 14px',
                borderBottom: i < SUBS.length - 1 ? `1px solid ${HIFI.line}` : 'none',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: s.tone === 'sage' ? 'rgba(42,61,51,0.08)' : 'rgba(200,168,122,0.18)',
                  color: s.tone === 'sage' ? HIFI.sage : HIFI.ink2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: FONT_MONO, fontSize: 12, fontWeight: 600,
                }}>{s.n.split(' ')[0].slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: HIFI.ink, fontWeight: 500 }}>{s.n}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                    <span style={{ fontSize: 10.5, color: HIFI.muted, fontFamily: FONT_MONO }}>RENEWS {s.d.toUpperCase()}</span>
                    <span style={{ fontSize: 10.5, color: HIFI.faint }}>·</span>
                    {s.kid
                      ? <><FamilyAvatar initial={s.kid} size={13} tone="sand" /><span style={{ fontSize: 10.5, color: HIFI.muted }}>{s.who}</span></>
                      : <span style={{ fontSize: 10.5, color: HIFI.muted }}>{s.who}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 500 }}>${s.v.toFixed(2)}</div>
                  <button style={{
                    width: 26, height: 26, borderRadius: 8, border: 'none',
                    background: HIFI.surfaceSoft, color: HIFI.ink2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: FONT_MONO, fontSize: 12, cursor: 'pointer',
                  }}>✎</button>
                </div>
              </div>
            ))}
          </div>

          {/* Sub-savings callout */}
          <div style={{
            background: HIFI.sandSoft, border: `1px solid ${HIFI.sandLight}`,
            borderRadius: 18, padding: '14px 16px', marginBottom: 120,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: HIFI.sage, flexShrink: 0,
            }}>{Icon.bell(16)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: HIFI.ink }}>Bundle Netflix + Disney+</div>
              <div style={{ fontSize: 11, color: HIFI.muted, marginTop: 2 }}>Save ~$8/mo on annual plans</div>
            </div>
            <span style={{ color: HIFI.faint }}>{Icon.chevRight(14)}</span>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

/* -------- LOGIN -------- */
function ScreenLogin() {
  return (
    <div style={{ ...SCREEN_SHELL, background: HIFI.bg }}>
      <div style={{ height: '100%', overflow: 'auto', padding: '54px 0 40px', display: 'flex', flexDirection: 'column' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', padding: '14px 0 28px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: HIFI.sage, fontWeight: 500 }}>Budget</div>
        </div>

        {/* Family avatars */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', marginBottom: 36 }}>
          <FamilyAvatar initial="A" size={56} tone="sage" />
          <div style={{ marginLeft: -10 }}><FamilyAvatar initial="B" size={56} tone="sand" /></div>
          {['S','M','J','E'].map((l, i) => (
            <div key={l} style={{ marginLeft: -8 }}>
              <FamilyAvatar initial={l} size={32} tone="sand" />
            </div>
          ))}
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', padding: '0 28px', marginBottom: 36 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 500, letterSpacing: -0.6, color: HIFI.ink }}>Welcome back</h1>
          <div style={{ marginTop: 6, fontSize: 13, color: HIFI.muted, lineHeight: 1.5 }}>
            Sign in to your household.<br />Kids get view-only profiles.
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: '0 24px', flex: 1 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted, marginBottom: 6 }}>Email</div>
            <div style={{
              background: HIFI.surface, borderRadius: 14, padding: '14px 16px',
              fontSize: 14, color: HIFI.ink,
              boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
            }}>alex@household.com</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 1, textTransform: 'uppercase', color: HIFI.muted }}>Password</div>
              <div style={{ fontSize: 11, color: HIFI.sage, fontWeight: 500 }}>Forgot?</div>
            </div>
            <div style={{
              background: HIFI.surface, borderRadius: 14, padding: '14px 16px',
              fontSize: 14, color: HIFI.ink,
              boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
              letterSpacing: 4,
            }}>••••••••••</div>
          </div>

          <button style={{
            width: '100%', height: 52, borderRadius: 14, border: 'none',
            background: HIFI.sage, color: '#fff',
            fontFamily: FONT_SANS, fontSize: 15, fontWeight: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: '0 8px 24px -8px rgba(42,61,51,0.4)',
            marginBottom: 14,
          }}>Sign in →</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: HIFI.muted, fontSize: 10, fontFamily: FONT_MONO, letterSpacing: 1, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 1, background: HIFI.line }} />
            OR
            <div style={{ flex: 1, height: 1, background: HIFI.line }} />
          </div>

          <button style={{
            width: '100%', height: 48, borderRadius: 14,
            border: `1px solid ${HIFI.line}`,
            background: HIFI.surface, color: HIFI.ink,
            fontFamily: FONT_SANS, fontSize: 14, fontWeight: 500,
          }}>Start a household</button>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 10.5, color: HIFI.muted, padding: '24px 24px 0' }}>
          Secured by Supabase · Canada 🇨🇦
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  ScreenAddIncome, ScreenReports, ScreenFamily, ScreenSettings, ScreenLogin, ScreenQuickAdd,
});
