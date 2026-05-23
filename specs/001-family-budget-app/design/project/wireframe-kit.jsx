/* Wireframe primitives — tidy boxes-and-labels style.
   All components export to window for cross-script access. */

const INK = '#1c1c1a';
const LINE = '#2a2a28';
const MUTED = '#9a9a95';
const SOFT_MUTED = '#c6c6c0';
const SOFT_FILL = '#f0f0ea';
const BG = '#fafaf7';
const ACCENT = 'oklch(0.62 0.06 215)';  /* calm teal-blue */
const ACCENT_SOFT = 'oklch(0.92 0.03 215)';

const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SANS = "'Inter', system-ui, sans-serif";

/* ---------- Phone frame ---------- */
function Phone({ title, action, children, footer, drawerHint }) {
  return (
    <div style={{
      width: 340, height: 700,
      border: `1.5px solid ${LINE}`,
      borderRadius: 36,
      background: '#fff',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 24px 48px -28px rgba(0,0,0,0.18)',
    }}>
      {/* status bar */}
      <div style={{
        height: 26, padding: '0 22px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: 0.5,
      }}>
        <span>9:41</span>
        <span style={{ display: 'flex', gap: 4 }}>
          <span>·· ·</span><span>◐</span><span>▮</span>
        </span>
      </div>
      {/* app bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px 12px',
        borderBottom: `1px dashed ${SOFT_MUTED}`,
      }}>
        <Hamburger />
        <div style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: 1.4,
          textTransform: 'uppercase', color: INK,
        }}>{title}</div>
        <div style={{ width: 22, height: 18, display: 'flex', justifyContent: 'flex-end' }}>
          {action || <span style={{ fontFamily: MONO, fontSize: 14, color: MUTED }}>+</span>}
        </div>
      </div>
      {/* body */}
      <div style={{ flex: 1, padding: 14, overflow: 'hidden', position: 'relative', background: '#fff' }}>
        {children}
      </div>
      {footer}
      {drawerHint && <DrawerHint />}
    </div>
  );
}

const Hamburger = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 18 }}>
    <div style={{ height: 1.5, background: INK }} />
    <div style={{ height: 1.5, background: INK }} />
    <div style={{ height: 1.5, background: INK }} />
  </div>
);

const DrawerHint = () => (
  <div style={{
    position: 'absolute', top: 0, bottom: 0, left: 0, width: 18,
    background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.04) 0 4px, transparent 4px 8px)',
    borderRight: `1px dashed ${SOFT_MUTED}`,
    pointerEvents: 'none',
  }} />
);

/* ---------- Building blocks ---------- */
function Label({ children, color, size = 9, style }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: size, letterSpacing: 0.9,
      textTransform: 'uppercase', color: color || MUTED, ...style,
    }}>{children}</div>
  );
}

function Box({ h, label, children, dashed, fill, accent, style, pad = 10 }) {
  return (
    <div style={{
      border: `${accent ? 1.5 : 1.2}px ${dashed ? 'dashed' : 'solid'} ${accent ? INK : SOFT_MUTED}`,
      borderRadius: 6,
      minHeight: h,
      padding: pad,
      background: fill || 'transparent',
      display: 'flex', flexDirection: 'column', gap: 6,
      ...style,
    }}>
      {label && <Label>{label}</Label>}
      {children}
    </div>
  );
}

function Field({ label, value, placeholder, big }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <Label>{label}</Label>}
      <div style={{
        borderBottom: `1.2px solid ${SOFT_MUTED}`,
        paddingBottom: 6,
        fontFamily: big ? SANS : SANS,
        fontSize: big ? 22 : 14, fontWeight: big ? 500 : 400,
        color: value ? INK : SOFT_MUTED,
        minHeight: big ? 30 : 22,
      }}>{value || placeholder || ''}</div>
    </div>
  );
}

function Chip({ children, on, mono = true, size = 10 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 9px',
      border: `1.2px solid ${on ? INK : SOFT_MUTED}`,
      borderRadius: 999,
      fontFamily: mono ? MONO : SANS,
      fontSize: size,
      textTransform: mono ? 'uppercase' : 'none',
      letterSpacing: mono ? 0.6 : 0,
      color: on ? INK : MUTED,
      background: on ? SOFT_FILL : 'transparent',
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function Bar({ value = 0.5, color, h = 6, track }) {
  return (
    <div style={{
      height: h, background: track || SOFT_FILL, borderRadius: 999,
      border: `1px solid ${SOFT_MUTED}`, overflow: 'hidden',
    }}>
      <div style={{
        width: `${Math.min(value, 1) * 100}%`, height: '100%',
        background: color || INK, borderRadius: 999,
      }} />
    </div>
  );
}

function Row({ children, gap = 8, style }) {
  return <div style={{ display: 'flex', gap, alignItems: 'center', ...style }}>{children}</div>;
}
function Col({ children, gap = 8, style }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap, ...style }}>{children}</div>;
}

function Avatar({ children, size = 24, fill }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `1.2px solid ${SOFT_MUTED}`, background: fill || '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: MONO, fontSize: size * 0.4, color: INK,
    }}>{children}</div>
  );
}

function Divider({ dashed = true, vertical, label }) {
  if (vertical) return (
    <div style={{ width: 1, alignSelf: 'stretch', borderLeft: `1px ${dashed ? 'dashed' : 'solid'} ${SOFT_MUTED}` }} />
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, borderTop: `1px ${dashed ? 'dashed' : 'solid'} ${SOFT_MUTED}` }} />
      {label && <Label>{label}</Label>}
      {label && <div style={{ flex: 1, borderTop: `1px ${dashed ? 'dashed' : 'solid'} ${SOFT_MUTED}` }} />}
    </div>
  );
}

function Squircle({ size = 36, label, fill }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      border: `1.2px solid ${SOFT_MUTED}`,
      background: fill || SOFT_FILL,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: MONO, fontSize: 9, color: MUTED,
    }}>{label}</div>
  );
}

/* essential / non-essential split bar */
function SplitBar({ essential = 0.7, h = 8, total, eAmount, nAmount }) {
  return (
    <Col gap={3}>
      <div style={{
        display: 'flex', height: h, border: `1px solid ${SOFT_MUTED}`,
        borderRadius: 999, overflow: 'hidden',
      }}>
        <div style={{ width: `${essential * 100}%`, background: INK }} />
        <div style={{ width: `${(1 - essential) * 100}%`,
          background: 'repeating-linear-gradient(45deg, transparent 0 3px, rgba(28,28,26,0.18) 3px 6px)' }} />
      </div>
      {(eAmount || nAmount) && (
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={4}><div style={{ width: 6, height: 6, background: INK }} /><Label size={8}>essential ${eAmount}</Label></Row>
          <Row gap={4}><Label size={8}>${nAmount} non-essential</Label>
            <div style={{ width: 6, height: 6, background: 'repeating-linear-gradient(45deg, transparent 0 2px, rgba(28,28,26,0.4) 2px 4px)', border: `1px solid ${SOFT_MUTED}` }} /></Row>
        </Row>
      )}
    </Col>
  );
}

/* placeholder for charts */
function ChartArea({ h = 100, label = 'chart', kind = 'line' }) {
  const lines = [];
  for (let i = 0; i < 4; i++) {
    lines.push(<div key={i} style={{
      position: 'absolute', left: 0, right: 0, top: `${(i + 1) * 20}%`,
      borderTop: `1px dashed ${SOFT_MUTED}`,
    }} />);
  }
  return (
    <div style={{
      height: h, position: 'relative',
      border: `1.2px solid ${SOFT_MUTED}`, borderRadius: 6,
      background: 'transparent', overflow: 'hidden',
    }}>
      {lines}
      {kind === 'line' && (
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <polyline fill="none" stroke={INK} strokeWidth="1"
            points="0,30 12,28 20,22 32,24 42,16 55,18 68,10 80,14 92,6 100,8" />
          <polyline fill="none" stroke={SOFT_MUTED} strokeWidth="1" strokeDasharray="2 2"
            points="0,34 12,32 20,30 32,28 42,26 55,24 68,22 80,20 92,18 100,16" />
        </svg>
      )}
      {kind === 'bars' && (
        <div style={{ position: 'absolute', inset: 8, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
          {[0.4, 0.7, 0.55, 0.85, 0.6, 0.9, 0.5].map((v, i) => (
            <div key={i} style={{ flex: 1, height: `${v * 100}%`, background: i === 5 ? INK : SOFT_FILL, border: `1px solid ${SOFT_MUTED}` }} />
          ))}
        </div>
      )}
      <Label style={{ position: 'absolute', top: 6, left: 8 }}>{label}</Label>
    </div>
  );
}

/* Donut for ring charts — small inline svg */
function Donut({ size = 90, parts = [0.5, 0.3, 0.2], strokes = [INK, SOFT_MUTED, SOFT_FILL] }) {
  const r = 30, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} style={{ overflow: 'visible' }}>
      <circle cx="40" cy="40" r={r} fill="none" stroke={SOFT_FILL} strokeWidth="10" />
      {parts.map((p, i) => {
        const dash = `${p * c} ${c}`;
        const offset = -acc * c;
        acc += p;
        return <circle key={i} cx="40" cy="40" r={r} fill="none"
          stroke={strokes[i] || SOFT_MUTED} strokeWidth="10"
          strokeDasharray={dash} strokeDashoffset={offset}
          transform="rotate(-90 40 40)" />;
      })}
    </svg>
  );
}

Object.assign(window, {
  INK, LINE, MUTED, SOFT_MUTED, SOFT_FILL, BG, ACCENT, ACCENT_SOFT,
  MONO, SANS,
  Phone, Hamburger, Label, Box, Field, Chip, Bar, Row, Col, Avatar,
  Divider, Squircle, ChartArea, Donut, SplitBar,
});
