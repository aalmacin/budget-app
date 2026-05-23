/* Reports + Settings wireframes */

/* ============ REPORTS / CHARTS ============ */

// A — Spend over time, line
function RepA() {
  return (
    <Phone title="Reports">
      <Col gap={12}>
        <Row gap={6}>
          <Chip>1W</Chip>
          <Chip>1M</Chip>
          <Chip on>3M</Chip>
          <Chip>6M</Chip>
          <Chip>YTD</Chip>
          <Chip>All</Chip>
        </Row>
        <Box h={64} pad={9}>
          <Label>Avg monthly spend</Label>
          <Row style={{ justifyContent: 'space-between' }}>
            <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 600 }}>$3,480</div>
            <Label color={INK}>▼ 8% vs last qtr</Label>
          </Row>
        </Box>
        <ChartArea h={150} label="Spend / month" kind="line" />
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Apr</Label><Label>May</Label><Label>Jun</Label>
        </Row>
        <Divider />
        <Label>Top categories this period</Label>
        <Col gap={5}>
          {[['Groceries', '$2,440', 0.85],
            ['Bills', '$1,820', 0.62],
            ['Kids', '$1,440', 0.50],
            ['Eating out', '$885', 0.32]].map(([n, v, p]) => (
            <Col gap={3} key={n}>
              <Row style={{ justifyContent: 'space-between' }}>
                <div style={{ fontFamily: SANS, fontSize: 12 }}>{n}</div>
                <div style={{ fontFamily: MONO, fontSize: 11 }}>{v}</div>
              </Row>
              <Bar value={p} color={INK} h={4} />
            </Col>
          ))}
        </Col>
      </Col>
    </Phone>
  );
}

// B — Bars by month + cashflow
function RepB() {
  return (
    <Phone title="Cashflow" action={<span style={{ fontFamily: MONO, fontSize: 10, color: INK }}>EXPORT</span>}>
      <Col gap={12}>
        <Row gap={8}>
          <Box h={58} pad={9} style={{ flex: 1 }}>
            <Label>Income</Label>
            <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 500 }}>$18,600</div>
            <Label size={8}>▲ 4.2%</Label>
          </Box>
          <Box h={58} pad={9} style={{ flex: 1 }}>
            <Label>Expense</Label>
            <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 500 }}>$13,920</div>
            <Label size={8}>▼ 1.8%</Label>
          </Box>
          <Box h={58} pad={9} style={{ flex: 1 }}>
            <Label>Net</Label>
            <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 500 }}>+$4,680</div>
            <Label size={8}>saved</Label>
          </Box>
        </Row>
        <ChartArea h={140} kind="bars" label="Mon · 7-day spend" />
        <Row style={{ justifyContent: 'space-between' }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <Label key={d}>{d}</Label>)}
        </Row>
        <Divider />
        <Label>Insights</Label>
        <Col gap={5}>
          {['Saturdays cost you 38% more than weekdays.',
            'Groceries trending down 12% vs last 3 months.',
            'Tax bucket on track — 66% of estimated total.'].map((s, i) => (
            <Box key={i} h={40} pad={9} dashed style={{ justifyContent: 'center' }}>
              <Row gap={8}>
                <div style={{ width: 4, alignSelf: 'stretch', background: INK }} />
                <div style={{ fontFamily: SANS, fontSize: 11, lineHeight: 1.3 }}>{s}</div>
              </Row>
            </Box>
          ))}
        </Col>
      </Col>
    </Phone>
  );
}

// C — Per-person pie chart + general-expenses toggle (interactive)
function RepC() {
  const [withGeneral, setWithGeneral] = React.useState(false);

  // Personalized only — expenses specifically tagged "for X"
  const PERSONAL = [
    { name: 'Alex', ini: 'A', v: 580, color: INK },
    { name: 'Bea',  ini: 'B', v: 720, color: '#4a4a47' },
    { name: 'Sam',  ini: 'S', v: 420, color: '#7a7a75' },
    { name: 'Mia',  ini: 'M', v: 310, color: '#a0a09a' },
    { name: 'Jo',   ini: 'J', v: 185, color: '#c0c0ba' },
    { name: 'Eli',  ini: 'E', v: 295, color: '#dedeb8' },
  ];
  // With general expenses split by income share (Alex 70% / Bea 30%) added on top
  const GENERAL = { Alex: 1820, Bea: 780 };

  const data = PERSONAL.map(p => ({
    ...p,
    v: p.v + (withGeneral && GENERAL[p.name] ? GENERAL[p.name] : 0),
  }));
  const total = data.reduce((s, p) => s + p.v, 0);
  const parts = data.map(p => p.v / total);

  return (
    <Phone title="Per person" action={<span style={{ fontFamily: MONO, fontSize: 10, color: INK }}>EXPORT</span>}>
      <Col gap={10}>
        <Row gap={6}>
          <Chip on>This month</Chip>
          <Chip>3 mo</Chip>
          <Chip>YTD</Chip>
        </Row>

        {/* General-expenses toggle */}
        <Box h={null} pad={10}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <Col gap={1}>
            <Label color={INK}>Include general expenses</Label>
            <Label size={8}>{withGeneral
              ? 'Shared bills + groceries split by income ratio.'
              : 'Only expenses tagged for a specific person.'}</Label>
          </Col>
          <div onClick={() => setWithGeneral(v => !v)}
            style={{
              width: 32, height: 18, borderRadius: 999,
              background: withGeneral ? INK : SOFT_FILL,
              border: `1px solid ${withGeneral ? INK : SOFT_MUTED}`,
              position: 'relative', flexShrink: 0,
              transition: 'background 0.15s',
            }}>
            <div style={{
              position: 'absolute', top: 1,
              left: withGeneral ? 15 : 1,
              width: 14, height: 14, borderRadius: 14,
              background: '#fff',
              border: `1px solid ${SOFT_MUTED}`,
              transition: 'left 0.15s',
            }} />
          </div>
        </Box>

        {/* Donut */}
        <Row gap={14} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Donut size={150} parts={parts} strokes={data.map(d => d.color)} />
            <Col gap={0} style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
              <Label>Total</Label>
              <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600 }}>
                ${total.toLocaleString()}
              </div>
              <Label size={8}>{withGeneral ? 'incl. shared' : 'personal only'}</Label>
            </Col>
          </div>
        </Row>

        {/* Legend / breakdown */}
        <Col gap={4}>
          {data.map(p => {
            const pct = Math.round((p.v / total) * 100);
            return (
              <Row key={p.name} style={{ justifyContent: 'space-between', padding: '6px 2px', borderBottom: `1px dashed ${SOFT_MUTED}` }}>
                <Row gap={8}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: p.color, border: `1px solid ${SOFT_MUTED}` }} />
                  <Avatar size={16} fill={p.color === INK ? '#fff' : SOFT_FILL}>{p.ini}</Avatar>
                  <div style={{ fontFamily: SANS, fontSize: 12 }}>{p.name}</div>
                </Row>
                <Row gap={10}>
                  <div style={{ fontFamily: MONO, fontSize: 11 }}>${p.v.toLocaleString()}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: MUTED, minWidth: 26, textAlign: 'right' }}>{pct}%</div>
                </Row>
              </Row>
            );
          })}
        </Col>
      </Col>
    </Phone>
  );
}

/* ============ SETTINGS ============ */

// A — Plain list
function SetA() {
  const item = (n, sub, val) => (
    <Row key={n} style={{ justifyContent: 'space-between', padding: '12px 2px', borderBottom: `1px dashed ${SOFT_MUTED}` }}>
      <Col gap={1}>
        <div style={{ fontFamily: SANS, fontSize: 13 }}>{n}</div>
        {sub && <Label size={8}>{sub}</Label>}
      </Col>
      <Row gap={6}>
        {val && <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>{val}</div>}
        <span style={{ color: MUTED }}>›</span>
      </Row>
    </Row>
  );
  return (
    <Phone title="Settings">
      <Col gap={10}>
        <Box h={68} pad={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar size={42}>A</Avatar>
          <Col gap={2}>
            <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500 }}>Alex Rivera</div>
            <Label>alex@household.com</Label>
            <Label size={8} color={INK}>Manage profile →</Label>
          </Col>
        </Box>
        <Label>Household</Label>
        <Col gap={0}>
          {item('Partner', 'Bea Park', 'connected')}
          {item('Shared accounts', '3 linked')}
          {item('Default split', '', '50 / 50')}
        </Col>
        <Label>Money</Label>
        <Col gap={0}>
          {item('Currency', '', 'CAD')}
          {item('Tax profile', 'Sole prop · ON', '31% marg.')}
          {item('GST/HST', 'registered', 'quarterly')}
          {item('Categories', '14 custom')}
          {item('Recurring', '6 active')}
        </Col>
        <Label>App</Label>
        <Col gap={0}>
          {item('Notifications')}
          {item('Face ID')}
          {item('Export data')}
          {item('Sign out', '', '')}
        </Col>
      </Col>
    </Phone>
  );
}

// B — Card sections
function SetB() {
  const card = (title, rows) => (
    <Box h={null} pad={10}>
      <Label>{title}</Label>
      {rows.map(([n, v]) => (
        <Row key={n} style={{ justifyContent: 'space-between', padding: '8px 0', borderTop: `1px dashed ${SOFT_MUTED}` }}>
          <div style={{ fontFamily: SANS, fontSize: 12 }}>{n}</div>
          <Row gap={6}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>{v}</div>
            <span style={{ color: MUTED }}>›</span>
          </Row>
        </Row>
      ))}
    </Box>
  );
  return (
    <Phone title="Settings">
      <Col gap={10}>
        <Box h={70} pad={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar size={42}>A</Avatar>
          <Col gap={2} style={{ flex: 1 }}>
            <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500 }}>Alex & Bea</div>
            <Label>household · since 2024</Label>
          </Col>
          <Squircle size={28} label="✎" />
        </Box>
        {card('Account', [['Email', 'alex@household.com'], ['Password', 'change'], ['Sessions', '2 devices']])}
        {card('Partner', [['Bea Park', 'admin'], ['Permissions', 'full'], ['Invite link', 'expires 7d']])}
        {card('Money', [['Currency', 'CAD'], ['Tax profile', 'Sole prop · ON'], ['GST/HST', 'registered'], ['Categories', '14'], ['Pay schedule', '15 / 30']])}
        {card('Notifications', [['Bill due', 'on'], ['Over-budget', 'on'], ['Weekly summary', 'Sun 8am']])}
      </Col>
    </Phone>
  );
}

// C — Family / household — scales to many kids
function SetC() {
  const KIDS = [
    ['Sam', 14, 20],
    ['Mia', 11, 15],
    ['Jo',  8,  10],
    ['Eli', 5,  5],
  ];
  return (
    <Phone title="Household">
      <Col gap={12}>
        <Box h={null} pad={10}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>Adults · 2</Label>
            <Label color={INK}>+ Add</Label>
          </Row>
          <Row gap={10} style={{ marginTop: 6 }}>
            <Row gap={8} style={{ flex: 1, padding: '4px 0' }}>
              <Avatar size={32}>A</Avatar>
              <Col gap={1}>
                <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 500 }}>Alex</div>
                <Label size={8}>admin · 50%</Label>
              </Col>
            </Row>
            <Row gap={8} style={{ flex: 1, padding: '4px 0' }}>
              <Avatar size={32} fill={SOFT_FILL}>B</Avatar>
              <Col gap={1}>
                <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 500 }}>Bea</div>
                <Label size={8}>admin · 50%</Label>
              </Col>
            </Row>
          </Row>
        </Box>
        <Box h={null} pad={10}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>Kids · {KIDS.length}</Label>
            <Label color={INK}>+ Add</Label>
          </Row>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6 }}>
            {KIDS.map(([n, age, wk]) => (
              <Col key={n} gap={3} style={{ alignItems: 'center', padding: '4px 2px', border: `1px dashed ${SOFT_MUTED}`, borderRadius: 6 }}>
                <Avatar size={30} fill={SOFT_FILL}>{n[0]}</Avatar>
                <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500 }}>{n}</div>
                <Label size={8}>age {age}</Label>
                <div style={{ fontFamily: MONO, fontSize: 9 }}>${wk}/wk</div>
              </Col>
            ))}
          </div>
          <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <Label size={8}>view-only · allowance auto-pays Fri</Label>
            <Label size={8} color={INK}>Manage →</Label>
          </Row>
        </Box>
        <Label>Shared</Label>
        <Col gap={6}>
          {[['Joint chequing', 'RBC · ••4821'],
            ['Joint savings', 'EQ Bank HISA · ••0930'],
            ['Tax bucket', 'Wealthsimple Cash · auto'],
            ['Kids · RESP', 'Questrade · ••1147']].map(([n, s]) => (
            <Box key={n} h={48} pad={9} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Col gap={1}>
                <div style={{ fontFamily: SANS, fontSize: 12 }}>{n}</div>
                <Label size={8}>{s}</Label>
              </Col>
              <Squircle size={20} label="✎" />
            </Box>
          ))}
        </Col>
        <Label>Rules</Label>
        <Col gap={5}>
          {[['Default split', 'by income · auto'],
            ['Approval over', '$500'],
            ['Auto-categorize', 'on'],
            ['Essential rule', 'Groceries · 80% by default']].map(([n, v]) => (
            <Row key={n} style={{ justifyContent: 'space-between', padding: '7px 2px', borderBottom: `1px dashed ${SOFT_MUTED}` }}>
              <div style={{ fontFamily: SANS, fontSize: 12 }}>{n}</div>
              <div style={{ fontFamily: MONO, fontSize: 11 }}>{v}</div>
            </Row>
          ))}
        </Col>
        <Box h={null} pad={9} dashed>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label color={INK}>Income-based split</Label>
            <Label color={INK}>edit →</Label>
          </Row>
          <Label size={8}>Recomputed monthly from each adult's net income.</Label>
          <Row gap={8} style={{ marginTop: 6, alignItems: 'center' }}>
            <Col gap={1} style={{ flex: 1 }}>
              <Row gap={4}><Avatar size={14}>A</Avatar><Label>Alex · net</Label></Row>
              <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500 }}>$5,800/mo</div>
            </Col>
            <Col gap={1} style={{ flex: 1, alignItems: 'flex-end' }}>
              <Row gap={4}><Label>Bea · net</Label><Avatar size={14} fill={SOFT_FILL}>B</Avatar></Row>
              <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500 }}>$2,485/mo</div>
            </Col>
          </Row>
          <Row style={{ height: 10, border: `1px solid ${SOFT_MUTED}`, borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
            <div style={{ width: '70%', background: INK }} />
            <div style={{ width: '30%', background: SOFT_FILL }} />
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label size={8}>Alex pays 70%</Label>
            <Label size={8}>Bea pays 30%</Label>
          </Row>
          <Divider />
          <Label color={INK}>Recent recalculations</Label>
          <Col gap={3}>
            {[['Jun 01', '70 / 30', '$8,285 total'],
              ['May 01', '69 / 31', '$8,140 total'],
              ['Apr 01', '66 / 34', '$7,920 total']].map(([d, r, t]) => (
              <Row key={d} style={{ justifyContent: 'space-between' }}>
                <Label>{d}</Label>
                <div style={{ fontFamily: MONO, fontSize: 10 }}>{r}</div>
                <Label>{t}</Label>
              </Row>
            ))}
          </Col>
          <Row gap={6} style={{ marginTop: 4 }}>
            <Chip on size={9}>Auto · monthly</Chip>
            <Chip size={9}>Lock manually</Chip>
            <Chip size={9}>Equal 50/50</Chip>
          </Row>
        </Box>
        <Row style={{ justifyContent: 'center', paddingTop: 4 }}>
          <Label color={INK}>+ Add account</Label>
        </Row>
      </Col>
    </Phone>
  );
}

// D — Essentials breakdown + recurring essential vs non-essential
function RepD() {
  const TOTAL_ESS = 2720, TOTAL_NON = 800;
  const REC_ESS = [
    ['Rent',         1950],
    ['Daycare · Eli', 320],
    ['Bell internet',  90],
    ['Rogers · mobile', 95],
    ['Kumon · Mia',   160],
  ];
  const REC_NON = [
    ['Netflix',         19],
    ['Spotify Family',  18],
    ['Disney+',         15],
    ['Roblox · Sam',    12],
    ['NYT',              8],
    ['iCloud 200GB',     3],
  ];
  const recEssTotal = REC_ESS.reduce((s, [, v]) => s + v, 0);
  const recNonTotal = REC_NON.reduce((s, [, v]) => s + v, 0);

  return (
    <Phone title="Essentials" action={<span style={{ fontFamily: MONO, fontSize: 10, color: INK }}>EXPORT</span>}>
      <Col gap={10}>
        <Row gap={6}>
          <Chip on>This month</Chip>
          <Chip>3 mo</Chip>
          <Chip>YTD</Chip>
        </Row>

        {/* Overall donut */}
        <Box h={null} pad={10}>
          <Row gap={12} style={{ alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Donut size={100} parts={[TOTAL_ESS / (TOTAL_ESS + TOTAL_NON), TOTAL_NON / (TOTAL_ESS + TOTAL_NON)]} strokes={[INK, SOFT_FILL]} />
              <Col gap={0} style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600 }}>77%</div>
                <Label size={8}>essential</Label>
              </Col>
            </div>
            <Col gap={6} style={{ flex: 1 }}>
              <Label>All spending · June</Label>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row gap={6}><div style={{ width: 10, height: 10, background: INK }} /><div style={{ fontFamily: SANS, fontSize: 11 }}>Essential</div></Row>
                <div style={{ fontFamily: MONO, fontSize: 11 }}>${TOTAL_ESS.toLocaleString()}</div>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row gap={6}>
                  <div style={{ width: 10, height: 10, background: 'repeating-linear-gradient(45deg, transparent 0 2px, rgba(28,28,26,0.4) 2px 4px)', border: `1px solid ${SOFT_MUTED}` }} />
                  <div style={{ fontFamily: SANS, fontSize: 11 }}>Non-essential</div>
                </Row>
                <div style={{ fontFamily: MONO, fontSize: 11 }}>${TOTAL_NON.toLocaleString()}</div>
              </Row>
              <Label size={8}>▼ 3% non-ess. vs last month</Label>
            </Col>
          </Row>
        </Box>

        {/* Recurring split */}
        <Box h={null} pad={10}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label color={INK}>Recurring · monthly</Label>
            <Label>${(recEssTotal + recNonTotal).toLocaleString()} total</Label>
          </Row>
          <SplitBar essential={recEssTotal / (recEssTotal + recNonTotal)} h={12}
            eAmount={recEssTotal} nAmount={recNonTotal} />
          <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <Label size={8}>{REC_ESS.length} essential · {REC_NON.length} treats</Label>
            <Label size={8}>{Math.round(recNonTotal / (recEssTotal + recNonTotal) * 100)}% on treats</Label>
          </Row>
        </Box>

        {/* Two columns: essential recurring vs non-essential recurring */}
        <Row gap={8} style={{ alignItems: 'flex-start' }}>
          <Box h={null} pad={9} style={{ flex: 1 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Label color={INK}>● Essential</Label>
              <div style={{ fontFamily: MONO, fontSize: 10 }}>${recEssTotal}</div>
            </Row>
            <Col gap={3} style={{ marginTop: 4 }}>
              {REC_ESS.map(([n, v]) => (
                <Row key={n} style={{ justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: SANS, fontSize: 10.5 }}>{n}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10 }}>${v}</div>
                </Row>
              ))}
            </Col>
          </Box>
          <Box h={null} pad={9} style={{ flex: 1 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={4}>
                <div style={{ width: 8, height: 8, background: 'repeating-linear-gradient(45deg, transparent 0 2px, rgba(28,28,26,0.4) 2px 4px)', border: `1px solid ${SOFT_MUTED}` }} />
                <Label color={INK}>Treats</Label>
              </Row>
              <div style={{ fontFamily: MONO, fontSize: 10 }}>${recNonTotal}</div>
            </Row>
            <Col gap={3} style={{ marginTop: 4 }}>
              {REC_NON.map(([n, v]) => (
                <Row key={n} style={{ justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: SANS, fontSize: 10.5 }}>{n}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10 }}>${v}</div>
                </Row>
              ))}
            </Col>
          </Box>
        </Row>

        <Box h={null} pad={9} dashed>
          <Label color={INK}>Heads up</Label>
          <Label size={8}>4 overlapping streaming subs · review to save $52/mo.</Label>
        </Box>
      </Col>
    </Phone>
  );
}

Object.assign(window, { RepA, RepB, RepC, RepD, SetA, SetB, SetC });
