/* Login/Signup + Dashboard wireframes */

/* ============ LOGIN / SIGNUP ============ */

// A — Classic stacked email+password
function LoginA() {
  return (
    <Phone title="Sign in">
      <Col gap={18} style={{ marginTop: 20 }}>
        <Col gap={4}>
          <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 600 }}>Welcome back</div>
          <Label>Manage your shared budget</Label>
        </Col>
        <Col gap={14} style={{ marginTop: 8 }}>
          <Field label="Email" placeholder="you@household.com" />
          <Field label="Password" placeholder="••••••••" />
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={6}><Squircle size={14} /><Label>Remember me</Label></Row>
            <Label color={INK}>Forgot?</Label>
          </Row>
        </Col>
        <Box h={42} accent style={{ alignItems: 'center', justifyContent: 'center', background: INK }}>
          <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: '#fff' }}>Sign in</span>
        </Box>
        <Divider label="OR" />
        <Box h={42} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: SANS, fontSize: 13, color: INK }}>Create account</span>
        </Box>
      </Col>
    </Phone>
  );
}

// B — Segmented Sign in / Sign up
function LoginB() {
  return (
    <Phone title="Account">
      <Col gap={18} style={{ marginTop: 12 }}>
        <Row style={{ border: `1.2px solid ${SOFT_MUTED}`, borderRadius: 8, padding: 3 }}>
          <div style={{ flex: 1, padding: '8px 0', textAlign: 'center', background: SOFT_FILL, borderRadius: 6, fontFamily: MONO, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Sign in</div>
          <div style={{ flex: 1, padding: '8px 0', textAlign: 'center', fontFamily: MONO, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: MUTED }}>Sign up</div>
        </Row>
        <Col gap={14} style={{ marginTop: 4 }}>
          <Field label="Email" placeholder="partner@home.com" />
          <Field label="Password" placeholder="••••••••" />
        </Col>
        <Row gap={6}>
          <Squircle size={14} fill={INK} label="✓" />
          <Label>Keep me signed in on this device</Label>
        </Row>
        <Box h={44} accent fill={INK} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: '#fff' }}>Continue →</span>
        </Box>
        <Row style={{ justifyContent: 'center', marginTop: 4 }}>
          <Label>Trouble signing in?</Label>
        </Row>
      </Col>
    </Phone>
  );
}

// C — Family onboarding focused
function LoginC() {
  return (
    <Phone title="Welcome">
      <Col gap={16} style={{ marginTop: 8 }}>
        <Box h={120} dashed style={{ alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <Row gap={0} style={{ alignItems: 'flex-end' }}>
            <Avatar size={42}>A</Avatar>
            <Avatar size={42} fill={SOFT_FILL} style={{ marginLeft: -10 }}>B</Avatar>
            <Avatar size={26} fill={SOFT_FILL} style={{ marginLeft: -6 }}>S</Avatar>
            <Avatar size={26} fill={SOFT_FILL} style={{ marginLeft: -6 }}>M</Avatar>
            <Avatar size={26} fill={SOFT_FILL} style={{ marginLeft: -6 }}>J</Avatar>
            <Avatar size={26} fill={SOFT_FILL} style={{ marginLeft: -6 }}>E</Avatar>
          </Row>
          <Label>One household · everyone in sync</Label>
        </Box>
        <Col gap={2}>
          <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 600 }}>Sign in</div>
          <Label>One login per parent. Kids get view-only profiles.</Label>
        </Col>
        <Col gap={12}>
          <Field label="Email" placeholder="you@household.com" />
          <Field label="Password" placeholder="••••••••" />
        </Col>
        <Box h={42} accent fill={INK} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: SANS, fontSize: 13, fontWeight: 500, color: '#fff' }}>Sign in</span>
        </Box>
        <Row style={{ justifyContent: 'center', gap: 4 }}>
          <Label>New here?</Label>
          <Label color={INK}>Start a household →</Label>
        </Row>
      </Col>
    </Phone>
  );
}

/* ============ DASHBOARD ============ */

// A — Balance-first list
function DashA() {
  return (
    <Phone title="Home" action={<span style={{ fontFamily: MONO, fontSize: 11 }}>JUN</span>}>
      <Col gap={12}>
        <Box h={null} pad={14}>
          <Label>Left to spend · June</Label>
          <div style={{ fontFamily: SANS, fontSize: 30, fontWeight: 600, marginTop: 2 }}>$2,148<span style={{ color: MUTED, fontSize: 16 }}>.32</span></div>
          <Bar value={0.62} />
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>Spent $3,520</Label><Label>Budget $5,668</Label>
          </Row>
          <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <Label color={INK}>essential vs treats</Label>
            <Label size={8}>$2,720 · $800</Label>
          </Row>
          <SplitBar essential={2720 / 3520} h={6} />
        </Box>
        <Row gap={8}>
          <Box h={null} pad={9} style={{ flex: 1 }}>
            <Label>Income · combined</Label>
            <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 500 }}>$8,285</div>
            <Label size={8}>Alex 70 · Bea 30</Label>
          </Box>
          <Box h={null} pad={9} style={{ flex: 1 }}>
            <Label>Tax saved</Label>
            <div style={{ fontFamily: SANS, fontSize: 16, fontWeight: 500 }}>$2,070</div>
            <Label size={8}>25% set aside</Label>
          </Box>
        </Row>
        <Label>Recent activity</Label>
        <Col gap={6}>
          {[['Music · Mia',     '−$32.00', 'Kids · for Mia'],
            ['Salary · Alex',   '+$5,800', 'Income · 70%'],
            ['Diapers · Eli',   '−$28.40', 'Kids · essential'],
            ['Whole Foods',     '−$142.30','Groceries · split']].map(([n, v, c]) => (
            <Row key={n} style={{ justifyContent: 'space-between', padding: '6px 2px', borderBottom: `1px dashed ${SOFT_MUTED}` }}>
              <Col gap={1}>
                <div style={{ fontFamily: SANS, fontSize: 12 }}>{n}</div>
                <Label size={8}>{c}</Label>
              </Col>
              <div style={{ fontFamily: MONO, fontSize: 12 }}>{v}</div>
            </Row>
          ))}
        </Col>
      </Col>
    </Phone>
  );
}

// B — Ring chart up top
function DashB() {
  return (
    <Phone title="June" action={<span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>···</span>}>
      <Col gap={12} style={{ alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Donut size={140} parts={[0.42, 0.22, 0.15, 0.21]} strokes={[INK, '#555', SOFT_MUTED, SOFT_FILL]} />
          <Col gap={0} style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Label>Spent</Label>
            <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 600 }}>$3,520</div>
            <Label>of $5,668</Label>
          </Col>
        </div>
        <Col gap={6} style={{ width: '100%' }}>
          {[['Groceries', '$820', 0.42, INK],
            ['Bills', '$430', 0.22, '#555'],
            ['Eating out', '$295', 0.15, SOFT_MUTED],
            ['Other', '$410', 0.21, SOFT_FILL]].map(([n, v, , c]) => (
            <Row key={n} style={{ justifyContent: 'space-between' }}>
              <Row gap={8}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c, border: `1px solid ${SOFT_MUTED}` }} />
                <div style={{ fontFamily: SANS, fontSize: 12 }}>{n}</div>
              </Row>
              <div style={{ fontFamily: MONO, fontSize: 11 }}>{v}</div>
            </Row>
          ))}
        </Col>
        <Box h={44} pad={10} style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Col gap={1}><Label>Upcoming bill</Label><div style={{ fontFamily: SANS, fontSize: 12 }}>Rent · Jun 28</div></Col>
          <div style={{ fontFamily: MONO, fontSize: 12 }}>$1,950</div>
        </Box>
      </Col>
    </Phone>
  );
}

// C — Family dashboard (2 adults + kids strip)
function DashC() {
  const KIDS = [['Sam', 'S', 12, 20], ['Mia', 'M', 8, 15], ['Jo', 'J', 4, 10], ['Eli', 'E', 2, 5]];
  return (
    <Phone title="Household">
      <Col gap={10}>
        <Box h={66} pad={10}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Label>Shared pool · June</Label>
            <Label>62% used</Label>
          </Row>
          <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 600 }}>$2,148 left</div>
          <Bar value={0.62} />
        </Box>
        <Label>Adults</Label>
        <Row gap={8}>
          <Box h={92} pad={9} style={{ flex: 1 }}>
            <Row gap={6}><Avatar size={18}>A</Avatar><Label>Alex</Label></Row>
            <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 500 }}>$1,820</div>
            <Label size={8}>spent · 13 txns</Label>
            <Bar value={0.55} color={INK} />
            <Label size={8}>of $3,300 share</Label>
          </Box>
          <Box h={92} pad={9} style={{ flex: 1 }}>
            <Row gap={6}><Avatar size={18} fill={SOFT_FILL}>B</Avatar><Label>Bea</Label></Row>
            <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 500 }}>$1,700</div>
            <Label size={8}>spent · 9 txns</Label>
            <Bar value={0.71} color={INK} />
            <Label size={8}>of $2,368 share</Label>
          </Box>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Kids · 4</Label>
          <Label>allowance · Fri</Label>
        </Row>
        <Box h={null} pad={8}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {KIDS.map(([n, ini, spent, allow]) => (
              <Col key={n} gap={2} style={{ alignItems: 'center' }}>
                <Avatar size={24} fill={SOFT_FILL}>{ini}</Avatar>
                <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 500 }}>{n}</div>
                <div style={{ fontFamily: MONO, fontSize: 9 }}>${spent}/{allow}</div>
                <Bar value={Math.min(spent / allow, 1)} color={INK} h={3} />
              </Col>
            ))}
          </div>
        </Box>
        <Label>This week</Label>
        <Col gap={3}>
          {[['Whole Foods', 'A', '−$62'],
            ['Daycare · Eli', 'B', '−$240'],
            ['Roblox · Sam', 'S', '−$15']].map(([n, who, v]) => (
            <Row key={n} style={{ justifyContent: 'space-between', padding: '5px 2px', borderBottom: `1px dashed ${SOFT_MUTED}` }}>
              <Row gap={6}>
                <Avatar size={14} fill={who === 'A' ? '#fff' : SOFT_FILL}>{who}</Avatar>
                <div style={{ fontFamily: SANS, fontSize: 11 }}>{n}</div>
              </Row>
              <div style={{ fontFamily: MONO, fontSize: 11 }}>{v}</div>
            </Row>
          ))}
        </Col>
      </Col>
    </Phone>
  );
}

Object.assign(window, { LoginA, LoginB, LoginC, DashA, DashB, DashC });
