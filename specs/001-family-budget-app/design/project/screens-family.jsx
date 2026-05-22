/* Family / Kids — allowances, chores, limits.
   Designed to scale to any number of kids (4 used as example). */

const KIDS_DEMO = [
  { name: 'Sam', age: 14, allow: 20, balance: 64.50, spent: 12, chores: 4 },
  { name: 'Mia', age: 11, allow: 15, balance: 38.20, spent:  8, chores: 5 },
  { name: 'Jo',  age:  8, allow: 10, balance: 22.00, spent:  5, chores: 3 },
  { name: 'Eli', age:  5, allow:  5, balance:  9.50, spent:  2, chores: 2 },
];

/* A — Allowance dashboard: card per kid, scrolls vertically (any count) */
function FamA() {
  return (
    <Phone title="Family" action={<span style={{ fontFamily: MONO, fontSize: 11 }}>＋</span>}>
      <Col gap={10}>
        <Box h={66} pad={10}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>Kids · {KIDS_DEMO.length}</Label>
            <Label>Total allowance · ${KIDS_DEMO.reduce((s, k) => s + k.allow, 0)}/wk</Label>
          </Row>
          <div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 600 }}>Friday payout · 2d</div>
          <Label size={8}>auto-transfers from joint checking</Label>
        </Box>
        <Col gap={6}>
          {KIDS_DEMO.map(k => (
            <Box key={k.name} h={null} pad={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar size={36} fill={SOFT_FILL}>{k.name[0]}</Avatar>
              <Col gap={2} style={{ flex: 1 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500 }}>{k.name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11 }}>${k.balance.toFixed(2)}</div>
                </Row>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Label size={8}>age {k.age} · ${k.allow}/wk</Label>
                  <Label size={8}>${k.spent} spent this wk</Label>
                </Row>
                <Bar value={k.spent / k.allow} color={INK} h={3} />
              </Col>
              <span style={{ color: MUTED, fontFamily: MONO }}>›</span>
            </Box>
          ))}
        </Col>
        <Row style={{ justifyContent: 'center', padding: 6 }}>
          <Label color={INK}>+ Add a kid</Label>
        </Row>
      </Col>
    </Phone>
  );
}

/* B — Side-by-side kids comparison */
function FamB() {
  return (
    <Phone title="Compare kids">
      <Col gap={10}>
        <Row gap={6}>
          <Chip on>Allowance</Chip>
          <Chip>Spent</Chip>
          <Chip>Saved</Chip>
          <Chip>By cat.</Chip>
        </Row>
        <Box h={null} pad={10}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>This month · all kids</Label>
            <Label>$200 in / $108 out</Label>
          </Row>
        </Box>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {KIDS_DEMO.map(k => (
            <Col key={k.name} gap={4} style={{ alignItems: 'center', padding: '8px 4px', border: `1.2px solid ${SOFT_MUTED}`, borderRadius: 6 }}>
              <Avatar size={28} fill={SOFT_FILL}>{k.name[0]}</Avatar>
              <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 500 }}>{k.name}</div>
              <Label size={8}>age {k.age}</Label>
              <div style={{ width: '100%', borderTop: `1px dashed ${SOFT_MUTED}`, margin: '2px 0' }} />
              <Label size={8}>balance</Label>
              <div style={{ fontFamily: MONO, fontSize: 11 }}>${k.balance.toFixed(0)}</div>
              <Label size={8}>${k.allow}/wk · in</Label>
              <Label size={8}>${k.spent}/wk · out</Label>
            </Col>
          ))}
        </div>
        <Label>Last 4 weeks · spending</Label>
        <Col gap={5}>
          {KIDS_DEMO.map(k => {
            const max = 80;
            const v = k.spent * 4;
            return (
              <Col key={k.name} gap={3}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={6}><Avatar size={14} fill={SOFT_FILL}>{k.name[0]}</Avatar>
                    <div style={{ fontFamily: SANS, fontSize: 11 }}>{k.name}</div></Row>
                  <div style={{ fontFamily: MONO, fontSize: 11 }}>${v}</div>
                </Row>
                <Bar value={v / max} color={INK} h={5} />
              </Col>
            );
          })}
        </Col>
        <Box h={null} pad={9} dashed>
          <Label color={INK}>Heads up</Label>
          <Label size={8}>Sam's weekly limit reached 3 of last 4 weeks.</Label>
        </Box>
      </Col>
    </Phone>
  );
}

/* C — Kid spending limits + recent activity (per-kid drill) */
function FamC() {
  const TX = [
    ['Roblox',     'Sam', '−$8.00', 'Tue'],
    ['Ice cream',  'Mia', '−$4.20', 'Tue'],
    ['Book fair',  'Jo',  '−$5.00', 'Mon'],
    ['Lego set · gift', 'Eli', '−$12.00', 'Mon'],
    ['Allowance · Fri', '—', '+$50.00', 'Fri'],
  ];
  return (
    <Phone title="Kid · Sam" action={<span style={{ fontFamily: MONO, fontSize: 10, color: INK }}>EDIT</span>}>
      <Col gap={10}>
        <Row gap={6} style={{ overflowX: 'auto' }}>
          {KIDS_DEMO.map((k, i) => (
            <Chip key={k.name} on={i === 0}>
              <Row gap={4}><Avatar size={12} fill={SOFT_FILL}>{k.name[0]}</Avatar>{k.name}</Row>
            </Chip>
          ))}
        </Row>
        <Box h={78} pad={10}>
          <Label>Balance</Label>
          <div style={{ fontFamily: SANS, fontSize: 24, fontWeight: 600 }}>$64.50</div>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label size={8}>+$20 every Fri</Label>
            <Label size={8}>$12 spent this wk</Label>
          </Row>
        </Box>
        <Row gap={8}>
          <Box h={56} pad={9} style={{ flex: 1 }}>
            <Label>Weekly limit</Label>
            <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500 }}>$25</div>
            <Bar value={12 / 25} color={INK} h={3} />
          </Box>
          <Box h={56} pad={9} style={{ flex: 1 }}>
            <Label>Saving for</Label>
            <div style={{ fontFamily: SANS, fontSize: 12 }}>Switch game</div>
            <Bar value={64.5 / 60} color={INK} h={3} />
          </Box>
        </Row>
        <Label>Rules</Label>
        <Col gap={4}>
          <Row style={{ justifyContent: 'space-between', padding: '6px 2px', borderBottom: `1px dashed ${SOFT_MUTED}` }}>
            <div style={{ fontFamily: SANS, fontSize: 12 }}>Needs approval over</div>
            <div style={{ fontFamily: MONO, fontSize: 11 }}>$10</div>
          </Row>
          <Row style={{ justifyContent: 'space-between', padding: '6px 2px', borderBottom: `1px dashed ${SOFT_MUTED}` }}>
            <div style={{ fontFamily: SANS, fontSize: 12 }}>Categories blocked</div>
            <div style={{ fontFamily: MONO, fontSize: 11 }}>2</div>
          </Row>
        </Col>
        <Label>Recent</Label>
        <Col gap={3}>
          {TX.map(([n, w, v, d], i) => (
            <Row key={i} style={{ justifyContent: 'space-between', padding: '5px 2px', borderBottom: `1px dashed ${SOFT_MUTED}` }}>
              <Col gap={1}>
                <div style={{ fontFamily: SANS, fontSize: 11 }}>{n}</div>
                <Label size={8}>{d} · {w}</Label>
              </Col>
              <div style={{ fontFamily: MONO, fontSize: 11 }}>{v}</div>
            </Row>
          ))}
        </Col>
      </Col>
    </Phone>
  );
}

Object.assign(window, { FamA, FamB, FamC });
