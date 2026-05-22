/* Add Expense + Add Income wireframes — with For-whom, essential split, income-% split */

/* ============ ADD EXPENSE ============ */

// A — Big amount + keypad, with essential toggle + "for" row
function ExpA() {
  const Key = ({ children }) => (
    <div style={{
      flex: '1 0 30%', textAlign: 'center', padding: '12px 0',
      border: `1px solid ${SOFT_MUTED}`, borderRadius: 6,
      fontFamily: SANS, fontSize: 16, color: INK, background: '#fff',
    }}>{children}</div>
  );
  return (
    <Phone title="New expense" action={<span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>×</span>}>
      <Col gap={10}>
        <Col gap={2} style={{ alignItems: 'center', padding: '4px 0' }}>
          <Label>Amount</Label>
          <div style={{ fontFamily: SANS, fontSize: 36, fontWeight: 600 }}>$32<span style={{ color: MUTED }}>.00</span></div>
        </Col>
        <Row gap={6} style={{ overflowX: 'auto' }}>
          <Chip on>Music · Mia</Chip>
          <Chip>Groceries</Chip>
          <Chip>Kids</Chip>
          <Chip>Bills</Chip>
          <Chip>Fun</Chip>
        </Row>
        <Row gap={8}>
          <Box h={42} pad={7} style={{ flex: 1, justifyContent: 'center' }}>
            <Label>Paid by</Label>
            <Row gap={4}><Avatar size={14} fill={SOFT_FILL}>B</Avatar><div style={{ fontFamily: SANS, fontSize: 11 }}>Bea</div></Row>
          </Box>
          <Box h={42} pad={7} style={{ flex: 1, justifyContent: 'center' }}>
            <Label>For</Label>
            <Row gap={4}><Avatar size={14} fill={SOFT_FILL}>M</Avatar><div style={{ fontFamily: SANS, fontSize: 11 }}>Mia</div></Row>
          </Box>
        </Row>
        <Box h={null} pad={9}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label color={INK}>Essential</Label>
            <div style={{
              width: 30, height: 16, borderRadius: 999,
              background: INK, position: 'relative',
              border: `1px solid ${INK}`,
            }}>
              <div style={{ position: 'absolute', right: 1, top: 1, width: 12, height: 12, borderRadius: 12, background: '#fff' }} />
            </div>
          </Row>
        </Box>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <Key>1</Key><Key>2</Key><Key>3</Key>
          <Key>4</Key><Key>5</Key><Key>6</Key>
          <Key>7</Key><Key>8</Key><Key>9</Key>
          <Key>.</Key><Key>0</Key><Key>⌫</Key>
        </Row>
        <Box h={42} accent fill={INK} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: '#fff' }}>Save expense</span>
        </Box>
      </Col>
    </Phone>
  );
}

// B — Full form: For + Paid-by w/ split rules + essential split slider
function ExpB() {
  return (
    <Phone title="Add expense" action={<span style={{ fontFamily: MONO, fontSize: 10, color: INK }}>SAVE</span>}>
      <Col gap={12} style={{ marginTop: 4 }}>
        <Field label="Amount" value="$ 142.30" big />
        <Field label="Merchant" value="Whole Foods" />
        <Col gap={5}>
          <Label>Category</Label>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Chip on>Groceries</Chip>
            <Chip>Bills</Chip>
            <Chip>Kids</Chip>
            <Chip>Eating</Chip>
            <Chip>Fun</Chip>
          </Row>
        </Col>
        <Col gap={6}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label color={INK}>Essential split</Label>
            <Label>$108 / $34</Label>
          </Row>
          <SplitBar essential={0.76} h={10} eAmount={108} nAmount={34} />
          <Row gap={6} style={{ marginTop: 2 }}>
            <Chip size={9}>100% ess.</Chip>
            <Chip on size={9}>Split</Chip>
            <Chip size={9}>100% treats</Chip>
          </Row>
          <Label size={8}>Drag handle to set how much is essential. Treats count toward "Fun".</Label>
        </Col>
        <Col gap={5}>
          <Label>For</Label>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Chip on>Household</Chip>
            <Chip><Row gap={4}><Avatar size={12}>A</Avatar>Alex</Row></Chip>
            <Chip><Row gap={4}><Avatar size={12} fill={SOFT_FILL}>B</Avatar>Bea</Row></Chip>
            <Chip><Row gap={4}><Avatar size={12} fill={SOFT_FILL}>S</Avatar>Sam</Row></Chip>
            <Chip><Row gap={4}><Avatar size={12} fill={SOFT_FILL}>M</Avatar>Mia</Row></Chip>
            <Chip><Row gap={4}><Avatar size={12} fill={SOFT_FILL}>J</Avatar>Jo</Row></Chip>
            <Chip><Row gap={4}><Avatar size={12} fill={SOFT_FILL}>E</Avatar>Eli</Row></Chip>
          </Row>
        </Col>
        <Col gap={5}>
          <Label>Paid by · split between adults</Label>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Chip>Alex 100%</Chip>
            <Chip>Bea 100%</Chip>
            <Chip>Equal · 50/50</Chip>
            <Chip on>By income · auto</Chip>
          </Row>
          <Box h={null} pad={8} dashed>
            <Row style={{ justifyContent: 'space-between' }}>
              <Label color={INK}>Current ratio</Label>
              <Label>computed monthly</Label>
            </Row>
            <Row style={{ height: 8, border: `1px solid ${SOFT_MUTED}`, borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
              <div style={{ width: '70%', background: INK }} />
              <div style={{ width: '30%', background: SOFT_FILL }} />
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={6}><Avatar size={14}>A</Avatar><div style={{ fontFamily: SANS, fontSize: 11 }}>Alex 70%</div></Row>
              <Row gap={6}><div style={{ fontFamily: SANS, fontSize: 11 }}>Bea 30%</div><Avatar size={14} fill={SOFT_FILL}>B</Avatar></Row>
            </Row>
            <Divider />
            <Row style={{ justifyContent: 'space-between' }}>
              <div style={{ fontFamily: SANS, fontSize: 11 }}>Alex owes</div>
              <div style={{ fontFamily: MONO, fontSize: 11 }}>$99.61</div>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <div style={{ fontFamily: SANS, fontSize: 11 }}>Bea owes</div>
              <div style={{ fontFamily: MONO, fontSize: 11 }}>$42.69</div>
            </Row>
          </Box>
        </Col>
        <Row gap={8}>
          <Col gap={5} style={{ flex: 1 }}>
            <Label>Date</Label>
            <Field value="Jun 18, 2026" />
          </Col>
          <Col gap={5} style={{ flex: 1 }}>
            <Label>Account</Label>
            <Field value="Joint · Chase" />
          </Col>
        </Row>
        <Field label="Notes" placeholder="Optional…" />
      </Col>
    </Phone>
  );
}

// C — Quick-add: family-realistic recurring + subs
function ExpC() {
  const tile = (title, sub, amt, accent) => (
    <Box h={66} pad={9} accent={accent} style={{ justifyContent: 'space-between' }}>
      <Col gap={2}>
        <Label color={accent ? INK : MUTED}>{sub}</Label>
        <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 500 }}>{title}</div>
      </Col>
      <div style={{ fontFamily: MONO, fontSize: 11 }}>{amt}</div>
    </Box>
  );
  return (
    <Phone title="Quick add" action={<span style={{ fontFamily: MONO, fontSize: 11 }}>＋</span>}>
      <Col gap={12}>
        <Row gap={6} style={{ overflowX: 'auto' }}>
          {['Recent', 'Subs', 'Per kid', 'Merchants'].map((t, i) => (
            <Chip key={t} on={i === 0}>{t}</Chip>
          ))}
        </Row>
        <Label>Tap to log again</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {tile('Music lesson', 'Mia · weekly', '$32.00', true)}
          {tile('Diapers · pack', 'Eli · 1–2 wk', '$28.40')}
          {tile('Daycare', 'Eli · M–F', '$72.00')}
          {tile('Soccer · Sam', 'Kids · monthly', '$45.00')}
          {tile('Kids haircut', 'Jo · 6wk', '$24.00')}
          {tile('Whole Foods', 'Groceries · split', '$142.30')}
        </div>
        <Label>Subscriptions · auto-log monthly</Label>
        <Col gap={5}>
          {[['Rogers · mobile',    '$95.00', 'Jun 24', 'shared'],
            ['Bell · internet',    '$89.99', 'Jul 02', 'shared'],
            ['Netflix',            '$18.99', 'Jul 04', 'shared'],
            ['Spotify Family',     '$17.99', 'Jul 08', 'shared'],
            ['Roblox · Sam',       '$11.99', 'Jul 04', 'Sam'],
            ['Kumon · Mia',        '$160.00','Jul 11', 'Mia']].map(([n, v, d, who]) => (
            <Row key={n} style={{ justifyContent: 'space-between', padding: '6px 4px', borderBottom: `1px dashed ${SOFT_MUTED}` }}>
              <Col gap={1}>
                <div style={{ fontFamily: SANS, fontSize: 12 }}>{n}</div>
                <Label size={8}>renews {d} · for {who}</Label>
              </Col>
              <Row gap={8}>
                <div style={{ fontFamily: MONO, fontSize: 11 }}>{v}</div>
                <Squircle size={16} label="✎" />
              </Row>
            </Row>
          ))}
        </Col>
      </Col>
    </Phone>
  );
}

/* ============ ADD INCOME ============ */

// A — Single form, with tax handling
function IncA() {
  return (
    <Phone title="Log income" action={<span style={{ fontFamily: MONO, fontSize: 10, color: INK }}>SAVE</span>}>
      <Col gap={14} style={{ marginTop: 4 }}>
        <Field label="Gross amount" value="$ 5,800.00" big />
        <Field label="Source" value="Acme Corp · payroll" />
        <Col gap={6}>
          <Label>Type</Label>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Chip on>T4 employment</Chip>
            <Chip>T4A · contract</Chip>
            <Chip>Self-employed</Chip>
            <Chip>CCB</Chip>
            <Chip>Refund</Chip>
            <Chip>Gift</Chip>
          </Row>
        </Col>
        <Row gap={8}>
          <Col gap={5} style={{ flex: 1 }}>
            <Label>Earner</Label>
            <Row gap={6}>
              <Chip on><Row gap={4}><Avatar size={12}>A</Avatar>Alex</Row></Chip>
              <Chip><Avatar size={12} fill={SOFT_FILL}>B</Avatar></Chip>
            </Row>
          </Col>
          <Col gap={5} style={{ flex: 1 }}>
            <Label>Date</Label>
            <Field value="Jun 15, 2026" />
          </Col>
        </Row>
        <Box h={88} dashed pad={10}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label color={INK}>Set aside for taxes</Label>
            <div style={{ fontFamily: MONO, fontSize: 11 }}>25% · $1,450</div>
          </Row>
          <Bar value={0.25} color={INK} />
          <Label size={8}>Auto-moves to "Tax bucket"</Label>
          <Row gap={6} style={{ marginTop: 4 }}>
            <Squircle size={14} fill={INK} label="✓" />
            <Label>Updates the income-based split automatically</Label>
          </Row>
        </Box>
        <Row gap={6}>
          <Squircle size={16} /><Label>Repeat monthly on the 15th</Label>
        </Row>
      </Col>
    </Phone>
  );
}

// B — Multi-source split (paycheck breakdown)
function IncB() {
  return (
    <Phone title="Paycheck">
      <Col gap={12}>
        <Field label="Gross" value="$ 5,800.00" big />
        <Label>Split into buckets</Label>
        <Col gap={6}>
          {[['Take-home', '60%', '$3,480', INK],
            ['Tax bucket', '25%', '$1,450', '#555'],
            ['TFSA · savings', '10%', '$580', SOFT_MUTED],
            ['Kids · RESP', '5%', '$290', SOFT_FILL]].map(([n, p, v, c]) => (
            <Box key={n} h={null} pad={8}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row gap={6}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: c, border: `1px solid ${SOFT_MUTED}` }} />
                  <div style={{ fontFamily: SANS, fontSize: 12 }}>{n}</div>
                </Row>
                <Row gap={8}>
                  <Label>{p}</Label>
                  <div style={{ fontFamily: MONO, fontSize: 11 }}>{v}</div>
                </Row>
              </Row>
              <Bar value={parseFloat(p) / 100} color={c === SOFT_FILL ? SOFT_MUTED : c} />
            </Box>
          ))}
        </Col>
        <Row style={{ justifyContent: 'center' }}>
          <Label color={INK}>+ Add bucket</Label>
        </Row>
        <Box h={42} accent fill={INK} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: '#fff' }}>Save & distribute</span>
        </Box>
      </Col>
    </Phone>
  );
}

// C — Calendar / recurring focused
function IncC() {
  const cell = (n, dot) => (
    <div style={{
      aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: MONO, fontSize: 10, color: n ? INK : 'transparent',
      border: `1px solid ${SOFT_MUTED}`,
      position: 'relative',
      background: dot ? SOFT_FILL : '#fff',
    }}>
      {n}
      {dot && <div style={{ position: 'absolute', bottom: 3, width: 5, height: 5, borderRadius: 5, background: INK }} />}
    </div>
  );
  const days = [];
  for (let i = 1; i <= 30; i++) days.push(cell(i, [1, 15, 28].includes(i)));
  return (
    <Phone title="Income · June">
      <Col gap={10}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>← May</Label>
          <Label color={INK}>June 2026</Label>
          <Label>Jul →</Label>
        </Row>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {['S','M','T','W','T','F','S'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontFamily: MONO, fontSize: 9, color: MUTED, padding: 2 }}>{d}</div>
          ))}
          {days}
        </div>
        <Label>Upcoming income</Label>
        <Col gap={5}>
          {[['Jun 28', 'Alex · payroll',    '$5,800', '70%'],
            ['Jun 30', 'Bea · freelance',   '$2,485', '30%'],
            ['Jul 01', 'Rental income',     '$1,850', 'shared']].map(([d, n, v, share]) => (
            <Row key={n} style={{ justifyContent: 'space-between', padding: '6px 2px', borderBottom: `1px dashed ${SOFT_MUTED}` }}>
              <Col gap={1}>
                <Label>{d}</Label>
                <div style={{ fontFamily: SANS, fontSize: 12 }}>{n}</div>
                <Label size={8}>contributes {share}</Label>
              </Col>
              <div style={{ fontFamily: MONO, fontSize: 12 }}>+{v}</div>
            </Row>
          ))}
        </Col>
        <Box h={null} pad={10} dashed>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label color={INK}>Household split · by income</Label>
            <Label color={INK}>auto · this month</Label>
          </Row>
          <Row style={{ height: 8, border: `1px solid ${SOFT_MUTED}`, borderRadius: 2, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ width: '70%', background: INK }} />
            <div style={{ width: '30%', background: SOFT_FILL }} />
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label size={8}>Alex 70%</Label>
            <Label size={8}>Bea 30%</Label>
          </Row>
          <Label size={8}>Updates whenever an income source is added or removed.</Label>
        </Box>
      </Col>
    </Phone>
  );
}

Object.assign(window, { ExpA, ExpB, ExpC, IncA, IncB, IncC });
