/* Taxes + Budget + Transactions wireframes */

/* ============ TAXES ============ */

// A — Bucket view, set-aside %
function TaxA() {
  return (
    <Phone title="Taxes · 2026">
      <Col gap={12}>
        <Box h={92} pad={12}>
          <Label>Set aside this year</Label>
          <div style={{ fontFamily: SANS, fontSize: 26, fontWeight: 600 }}>$8,420<span style={{ color: MUTED, fontSize: 14 }}> / est. $12,800</span></div>
          <Bar value={0.66} color={INK} />
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>66% saved</Label><Label>$4,380 to go</Label>
          </Row>
        </Box>
        <Label>CRA instalments · self-employed</Label>
        <Col gap={6}>
          {[['Q1', 'Mar 15', '$3,200', 'paid'],
            ['Q2', 'Jun 15', '$3,200', 'due in 9d'],
            ['Q3', 'Sep 15', '$3,200', 'planned'],
            ['Q4', 'Dec 15', '$3,200', 'planned']].map(([q, d, v, s]) => (
            <Box key={q} h={48} pad={9} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Row gap={10}>
                <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500 }}>{q}</div>
                <Col gap={1}>
                  <div style={{ fontFamily: SANS, fontSize: 12 }}>{d}</div>
                  <Label size={8}>{s}</Label>
                </Col>
              </Row>
              <Row gap={8}>
                <div style={{ fontFamily: MONO, fontSize: 12 }}>{v}</div>
                <Squircle size={16} label={s === 'paid' ? '✓' : '→'} />
              </Row>
            </Box>
          ))}
        </Col>
      </Col>
    </Phone>
  );
}

// B — Deductions / write-offs categorization
function TaxB() {
  return (
    <Phone title="Deductions" action={<span style={{ fontFamily: MONO, fontSize: 10, color: INK }}>＋</span>}>
      <Col gap={12}>
        <Row gap={6}>
          <Chip on>2026</Chip>
          <Chip>Q2</Chip>
          <Chip>Alex</Chip>
          <Chip>Bea</Chip>
        </Row>
        <Box h={66} pad={10}>
          <Label>Estimated savings</Label>
          <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 600 }}>$2,920</div>
          <Label size={8}>from $9,420 in deductions · 31% marginal · ON</Label>
        </Box>
        <Label>By category</Label>
        <Col gap={5}>
          {[['Home office · T2125', '$2,400', 18],
            ['Vehicle · business km', '$1,820', 42],
            ['Software & SaaS', '$1,180', 12],
            ['Meals (50%)', '$640', 21],
            ['Tuition · T2202', '$420', 3],
            ['Private health premiums', '$2,960', 11]].map(([n, v, c]) => (
            <Row key={n} style={{ justifyContent: 'space-between', padding: '7px 4px', borderBottom: `1px dashed ${SOFT_MUTED}` }}>
              <Col gap={1}>
                <div style={{ fontFamily: SANS, fontSize: 12 }}>{n}</div>
                <Label size={8}>{c} txns</Label>
              </Col>
              <Row gap={8}>
                <div style={{ fontFamily: MONO, fontSize: 12 }}>{v}</div>
                <span style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>›</span>
              </Row>
            </Row>
          ))}
        </Col>
      </Col>
    </Phone>
  );
}

// C — Timeline / payment plan
function TaxC() {
  return (
    <Phone title="Tax plan">
      <Col gap={12}>
        <Box h={56} pad={9}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>Effective rate</Label>
            <Label>Marginal 31% · ON</Label>
          </Row>
          <div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 500 }}>24.1%</div>
        </Box>
        <Label>Timeline · next 6 months</Label>
        <div style={{ position: 'relative', paddingLeft: 16 }}>
          <div style={{ position: 'absolute', left: 5, top: 4, bottom: 4, borderLeft: `1px dashed ${SOFT_MUTED}` }} />
          {[['Jun 15', 'Q2 CRA instalment', '$3,200', 'due'],
            ['Jul 31', 'HST/GST remittance · Q2', '$1,240', ''],
            ['Sep 15', 'Q3 CRA instalment', '$3,200', ''],
            ['Dec 15', 'Q4 CRA instalment', '$3,200', ''],
            ['Apr 30', 'T1 personal filing', '—', 'note'],
            ['Jun 15', 'Self-employed filing', '—', 'note']].map(([d, t, v, tag], i) => (
            <Row key={i} style={{ alignItems: 'flex-start', gap: 10, padding: '8px 0', position: 'relative' }}>
              <div style={{ position: 'absolute', left: -16, top: 12, width: 11, height: 11, borderRadius: 11, background: i === 0 ? INK : '#fff', border: `1.2px solid ${INK}` }} />
              <Col gap={2} style={{ flex: 1, paddingLeft: 4 }}>
                <Label color={INK}>{d}</Label>
                <div style={{ fontFamily: SANS, fontSize: 12 }}>{t}</div>
                {tag && <Label size={8} color={INK}>{tag.toUpperCase()}</Label>}
              </Col>
              <div style={{ fontFamily: MONO, fontSize: 12 }}>{v}</div>
            </Row>
          ))}
        </div>
      </Col>
    </Phone>
  );
}

/* ============ BUDGET OVERVIEW ============ */

// A — Progress bars per category + essential split overlay
function BudA() {
  const cat = (n, v, total, essPct, danger) => {
    const p = v / total;
    return (
      <Box h={null} pad={9} key={n}>
        <Row style={{ justifyContent: 'space-between' }}>
          <div style={{ fontFamily: SANS, fontSize: 12 }}>{n}</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: danger ? INK : MUTED }}>
            ${v} <span style={{ color: SOFT_MUTED }}>/ ${total}</span>
          </div>
        </Row>
        <SplitBar essential={essPct} h={8} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Label size={8}>{Math.round(essPct * 100)}% essential</Label>
          <Label size={8}>{Math.round(p * 100)}% of budget used</Label>
        </Row>
      </Box>
    );
  };
  return (
    <Phone title="Budget · June">
      <Col gap={10}>
        <Row gap={6}>
          <Chip on>All</Chip>
          <Chip>Essential</Chip>
          <Chip>Treats</Chip>
          <Chip>Per kid</Chip>
        </Row>
        <Box h={null} pad={9} dashed>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label color={INK}>This month · essential vs treats</Label>
            <Label>$2,720 / $800</Label>
          </Row>
          <SplitBar essential={2720 / 3520} h={10} eAmount={2720} nAmount={800} />
        </Box>
        <Col gap={6}>
          {cat('Groceries',   820, 900, 0.80)}
          {cat('Bills',       430, 600, 1.00)}
          {cat('Kids · all',  480, 700, 0.92)}
          {cat('Eating out',  295, 250, 0.20, true)}
          {cat('Fun',         110, 200, 0.00)}
          {cat('Transport',   220, 400, 0.85)}
        </Col>
      </Col>
    </Phone>
  );
}

// B — Envelope grid
function BudB() {
  const env = (n, v, t) => (
    <Box h={84} pad={9} key={n}>
      <Label>{n}</Label>
      <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 500 }}>${v}</div>
      <Label size={8}>left of ${t}</Label>
      <Bar value={1 - v / t} color={INK} h={4} />
    </Box>
  );
  return (
    <Phone title="Envelopes" action={<span style={{ fontFamily: MONO, fontSize: 11 }}>＋</span>}>
      <Col gap={10}>
        <Box h={50} pad={9}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>Unassigned</Label>
            <div style={{ fontFamily: MONO, fontSize: 12 }}>$240.00</div>
          </Row>
          <Label size={8}>drag onto an envelope to assign</Label>
        </Box>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {env('Groceries', 80, 900)}
          {env('Bills', 170, 600)}
          {env('Eating out', -45, 250)}
          {env('Kids', 220, 700)}
          {env('Fun', 90, 200)}
          {env('Transport', 180, 400)}
        </div>
      </Col>
    </Phone>
  );
}

// C — Donut + sortable list
function BudC() {
  return (
    <Phone title="Categories">
      <Col gap={12}>
        <Row gap={14} style={{ alignItems: 'center' }}>
          <Donut size={110} parts={[0.42, 0.22, 0.15, 0.21]} strokes={[INK, '#555', SOFT_MUTED, SOFT_FILL]} />
          <Col gap={4} style={{ flex: 1 }}>
            <Label>This month</Label>
            <div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 600 }}>$3,520</div>
            <Label size={8}>62% of $5,668</Label>
            <Row gap={6} style={{ marginTop: 4 }}>
              <Chip on size={9}>Spent</Chip>
              <Chip size={9}>Budget</Chip>
            </Row>
          </Col>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Category</Label>
          <Label>Spent · Left</Label>
        </Row>
        <Col gap={5}>
          {[['Groceries', 820, 80],
            ['Bills', 430, 170],
            ['Eating out', 295, -45],
            ['Kids', 480, 220],
            ['Fun', 110, 90],
            ['Transport', 220, 180]].map(([n, s, l]) => (
            <Row key={n} style={{ justifyContent: 'space-between', padding: '6px 2px', borderBottom: `1px dashed ${SOFT_MUTED}` }}>
              <Row gap={8}>
                <Squircle size={20} />
                <div style={{ fontFamily: SANS, fontSize: 12 }}>{n}</div>
              </Row>
              <Row gap={10}>
                <div style={{ fontFamily: MONO, fontSize: 11 }}>${s}</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: l < 0 ? INK : MUTED, minWidth: 36, textAlign: 'right' }}>
                  {l < 0 ? '−' : ''}${Math.abs(l)}
                </div>
              </Row>
            </Row>
          ))}
        </Col>
      </Col>
    </Phone>
  );
}

/* ============ TRANSACTIONS ============ */

// A — Grouped by date
function TxA() {
  const tx = (n, c, who, v, forWho) => (
    <Row key={n + v} style={{ justifyContent: 'space-between', padding: '7px 4px', borderBottom: `1px dashed ${SOFT_MUTED}` }}>
      <Row gap={8}>
        <Avatar size={18} fill={who === 'B' ? SOFT_FILL : '#fff'}>{who}</Avatar>
        <Col gap={1}>
          <div style={{ fontFamily: SANS, fontSize: 12 }}>{n}</div>
          <Row gap={4}>
            <Label size={8}>{c}</Label>
            {forWho && <>
              <Label size={8}>·</Label>
              <Label size={8} color={INK}>for {forWho}</Label>
            </>}
          </Row>
        </Col>
      </Row>
      <div style={{ fontFamily: MONO, fontSize: 12 }}>{v}</div>
    </Row>
  );
  return (
    <Phone title="Transactions" action={<span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>⌕</span>}>
      <Col gap={10}>
        <Row gap={6} style={{ overflowX: 'auto' }}>
          {['All', 'Income', 'Essential', 'Treats', 'Per kid', 'Subs'].map((t, i) => (
            <Chip key={t} on={i === 0}>{t}</Chip>
          ))}
        </Row>
        <Label>Today · Jun 18</Label>
        <Col gap={2}>
          {tx('Music lesson', 'Kids', 'B', '−$32.00', 'Mia')}
          {tx('Diapers · pack', 'Kids', 'B', '−$28.40', 'Eli')}
          {tx('Whole Foods', 'Groceries · split', 'A', '−$142.30', 'household')}
        </Col>
        <Label>Yesterday</Label>
        <Col gap={2}>
          {tx('Salary · Alex', 'Income · 70%', 'A', '+$5,800.00')}
          {tx('Daycare', 'Kids', 'B', '−$72.00', 'Eli')}
          {tx('Soccer dues', 'Kids', 'A', '−$45.00', 'Sam')}
        </Col>
        <Label>Jun 15</Label>
        <Col gap={2}>
          {tx('Kumon', 'Subs · monthly', 'B', '−$160.00', 'Mia')}
          {tx('Rogers', 'Bills', 'A', '−$95.00', 'household')}
          {tx('Kids haircut', 'Kids', 'B', '−$24.00', 'Jo')}
        </Col>
      </Col>
    </Phone>
  );
}

// B — Search-first with filters
function TxB() {
  return (
    <Phone title="Search" action={<span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>⌄</span>}>
      <Col gap={12}>
        <Box h={42} pad={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: MUTED }}>⌕</span>
          <div style={{ fontFamily: SANS, fontSize: 13 }}>loblaws</div>
        </Box>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <Chip on>Last 30d</Chip>
          <Chip>Groceries</Chip>
          <Chip>Alex</Chip>
          <Chip>{'>'}$20</Chip>
          <Chip>+ filter</Chip>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>14 results</Label>
          <Label>Total · $612.40</Label>
        </Row>
        <Col gap={4}>
          {[['Jun 18', '$48.20'],
            ['Jun 11', '$62.10'],
            ['Jun 04', '$41.30'],
            ['May 28', '$58.90'],
            ['May 21', '$36.40'],
            ['May 14', '$44.20'],
            ['May 07', '$51.10']].map(([d, v]) => (
            <Row key={d} style={{ justifyContent: 'space-between', padding: '7px 4px', borderBottom: `1px dashed ${SOFT_MUTED}` }}>
              <Row gap={8}>
                <Squircle size={20} label="LB" />
                <Col gap={1}>
                  <div style={{ fontFamily: SANS, fontSize: 12 }}>Loblaws</div>
                  <Label size={8}>{d} · groceries</Label>
                </Col>
              </Row>
              <div style={{ fontFamily: MONO, fontSize: 12 }}>−{v}</div>
            </Row>
          ))}
        </Col>
      </Col>
    </Phone>
  );
}

// C — Calendar heat / dot view
function TxC() {
  const cells = [];
  for (let i = 1; i <= 30; i++) {
    const intensity = [0, 0.1, 0.25, 0.45, 0.7][Math.floor(Math.random() * 5)];
    cells.push(
      <div key={i} style={{
        aspectRatio: '1', border: `1px solid ${SOFT_MUTED}`,
        background: intensity ? `rgba(28,28,26,${intensity})` : '#fff',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start',
        padding: 3,
        fontFamily: MONO, fontSize: 8,
        color: intensity > 0.4 ? '#fff' : MUTED,
      }}>{i}</div>
    );
  }
  return (
    <Phone title="Activity">
      <Col gap={10}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>June 2026</Label>
          <Row gap={6}>
            <Label>less</Label>
            {[0.1, 0.25, 0.45, 0.7].map(i => (
              <div key={i} style={{ width: 10, height: 10, background: `rgba(28,28,26,${i})`, border: `1px solid ${SOFT_MUTED}` }} />
            ))}
            <Label>more</Label>
          </Row>
        </Row>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {['S','M','T','W','T','F','S'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontFamily: MONO, fontSize: 9, color: MUTED, padding: 2 }}>{d}</div>
          ))}
          {cells}
        </div>
        <Box h={62} pad={9}>
          <Label>Wed · Jun 18 · selected</Label>
          <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
            <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500 }}>4 transactions</div>
            <div style={{ fontFamily: MONO, fontSize: 12 }}>−$182.60</div>
          </Row>
        </Box>
        <Col gap={3}>
          {[['Whole Foods', 'A', '−$62.40'],
            ['Coffee', 'B', '−$5.40'],
            ['Gas', 'A', '−$42.10'],
            ['Daycare', 'B', '−$72.70']].map(([n, w, v]) => (
            <Row key={n} style={{ justifyContent: 'space-between', padding: '5px 2px', borderBottom: `1px dashed ${SOFT_MUTED}` }}>
              <Row gap={6}><Avatar size={14} fill={w === 'B' ? SOFT_FILL : '#fff'}>{w}</Avatar>
                <div style={{ fontFamily: SANS, fontSize: 11 }}>{n}</div></Row>
              <div style={{ fontFamily: MONO, fontSize: 11 }}>{v}</div>
            </Row>
          ))}
        </Col>
      </Col>
    </Phone>
  );
}

Object.assign(window, { TaxA, TaxB, TaxC, BudA, BudB, BudC, TxA, TxB, TxC });
