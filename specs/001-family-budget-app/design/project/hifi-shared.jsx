/* Hi-fi shared design tokens & primitives — Budget app v1
   Palette: Sage & warm sand. Type: Geist + Geist Mono numerals. */

const HIFI = {
  bg:          '#f4f0e6',   // warm sand canvas
  surface:     '#ffffff',
  surfaceWarm: '#faf6ec',
  surfaceSoft: '#efe8d6',   // tinted card
  ink:         '#1c2622',   // deep sage-black
  ink2:        '#3a4843',
  muted:       '#7d8079',   // warm grey
  faint:       '#a8a89e',
  line:        '#e6dfcc',
  sage:        '#2a3d33',   // primary
  sageMid:     '#4a6151',
  sageSoft:    '#8aa898',
  sand:        '#c8a87a',   // warm accent
  sandLight:   '#e6d4b3',
  sandSoft:    '#f2ead8',
  brick:       '#a8533f',   // warning
  pos:         '#2a3d33',
  ringBg:      '#ece5d2',
};

const FONT_SANS = "'Geist', system-ui, sans-serif";
const FONT_MONO = "'Geist Mono', ui-monospace, monospace";

/* ----- icons (inline SVG, line-style, currentColor) ----- */
const Icon = {
  menu: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  chevDown: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
  chevRight: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  plus: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  search: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  bell: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  ),
  arrowUp: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 14l5-5 5 5" />
    </svg>
  ),
  arrowDown: (s = 12) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10l5 5 5-5" />
    </svg>
  ),
  cart: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h2l2.5 11h11l2-8H7" />
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
    </svg>
  ),
  home: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8z" />
    </svg>
  ),
  music: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V6l11-2v12" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="16" r="2" />
    </svg>
  ),
  baby: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="5" />
      <path d="M9 10a1 1 0 1 0 .01 0M15 10a1 1 0 1 0 .01 0M10 13c1 1 3 1 4 0" />
      <path d="M7 19c1.5-2 8-2 10 0" />
    </svg>
  ),
  receipt: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  ),
};

/* ----- shared bits ----- */
function FamilyAvatar({ initial, size = 28, tone = 'sand', ring }) {
  const palette = {
    sage:  { bg: HIFI.sage,     fg: '#fff' },
    sand:  { bg: HIFI.sand,     fg: '#1c1410' },
    soft:  { bg: HIFI.sandSoft, fg: HIFI.ink },
    paper: { bg: '#fff',        fg: HIFI.ink },
  }[tone];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: palette.bg, color: palette.fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: FONT_SANS, fontWeight: 600, fontSize: size * 0.42,
      letterSpacing: -0.2,
      boxShadow: ring ? `0 0 0 2px ${HIFI.bg}, 0 0 0 3.5px ${HIFI.sage}` : 'none',
      flexShrink: 0,
    }}>{initial}</div>
  );
}

function MerchantIcon({ kind, size = 36 }) {
  const ic = Icon[kind] || Icon.receipt;
  return (
    <div style={{
      width: size, height: size, borderRadius: 12,
      background: HIFI.surfaceSoft, color: HIFI.sage,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>{ic(size * 0.5)}</div>
  );
}

function HFBar({ value = 0.5, color = HIFI.sage, track = HIFI.ringBg, h = 6, radius = 999 }) {
  return (
    <div style={{ height: h, background: track, borderRadius: radius, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(value, 1) * 100}%`, height: '100%', background: color, borderRadius: radius }} />
    </div>
  );
}

function HFSplitBar({ essential = 0.77, h = 8 }) {
  return (
    <div style={{ height: h, display: 'flex', borderRadius: 999, overflow: 'hidden', background: HIFI.ringBg }}>
      <div style={{ width: `${essential * 100}%`, background: HIFI.sage }} />
      <div style={{ width: `${(1 - essential) * 100}%`,
        background: `repeating-linear-gradient(45deg, ${HIFI.sandLight} 0 4px, ${HIFI.sandSoft} 4px 8px)` }} />
    </div>
  );
}

function HFDonut({ size = 120, parts = [0.5, 0.3, 0.2], strokes = [HIFI.sage, HIFI.sand, HIFI.sageSoft], track = HIFI.ringBg, thickness = 14 }) {
  const r = 36, c = 2 * Math.PI * r; let acc = 0;
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} style={{ overflow: 'visible' }}>
      <circle cx="40" cy="40" r={r} fill="none" stroke={track} strokeWidth={thickness} />
      {parts.map((p, i) => {
        const dash = `${p * c} ${c}`;
        const offset = -acc * c;
        acc += p;
        return <circle key={i} cx="40" cy="40" r={r} fill="none"
          stroke={strokes[i] || HIFI.sageSoft} strokeWidth={thickness}
          strokeDasharray={dash} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 40 40)" />;
      })}
    </svg>
  );
}

Object.assign(window, { HIFI, FONT_SANS, FONT_MONO, Icon, FamilyAvatar, MerchantIcon, HFBar, HFSplitBar, HFDonut });
