/**
 * Inline SVG icon set lifted from
 * `specs/001-family-budget-app/design/project/hifi-shared.jsx`. All icons
 * render with currentColor stroke so they inherit text color.
 *
 * Each function takes a size in px (default 20) and returns ReactNode.
 */
import type { ReactNode } from "react";

const baseStroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const Icon = {
  menu(size = 20): ReactNode {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...baseStroke} strokeWidth={1.6}>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    );
  },
  chevDown(size = 14): ReactNode {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...baseStroke} strokeWidth={1.8}>
        <path d="M6 9l6 6 6-6" />
      </svg>
    );
  },
  chevRight(size = 16): ReactNode {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...baseStroke} strokeWidth={1.6}>
        <path d="M9 6l6 6-6 6" />
      </svg>
    );
  },
  plus(size = 20): ReactNode {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...baseStroke} strokeWidth={1.8}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  },
  search(size = 18): ReactNode {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...baseStroke} strokeWidth={1.6}>
        <circle cx={11} cy={11} r={7} />
        <path d="M20 20l-3.5-3.5" />
      </svg>
    );
  },
  bell(size = 18): ReactNode {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...baseStroke} strokeWidth={1.6}>
        <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
    );
  },
  cart(size = 18): ReactNode {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...baseStroke} strokeWidth={1.5}>
        <path d="M3 5h2l2.5 11h11l2-8H7" />
        <circle cx={9} cy={20} r={1.4} />
        <circle cx={18} cy={20} r={1.4} />
      </svg>
    );
  },
  home(size = 18): ReactNode {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...baseStroke} strokeWidth={1.5}>
        <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-8z" />
      </svg>
    );
  },
  music(size = 18): ReactNode {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...baseStroke} strokeWidth={1.5}>
        <path d="M9 18V6l11-2v12" />
        <circle cx={7} cy={18} r={2} />
        <circle cx={18} cy={16} r={2} />
      </svg>
    );
  },
  baby(size = 18): ReactNode {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...baseStroke} strokeWidth={1.5}>
        <circle cx={12} cy={9} r={5} />
        <path d="M9 10a1 1 0 1 0 .01 0M15 10a1 1 0 1 0 .01 0M10 13c1 1 3 1 4 0" />
        <path d="M7 19c1.5-2 8-2 10 0" />
      </svg>
    );
  },
  receipt(size = 18): ReactNode {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...baseStroke} strokeWidth={1.5}>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    );
  },
  close(size = 18): ReactNode {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...baseStroke} strokeWidth={1.8}>
        <path d="M6 6l12 12M18 6l-6 12" />
      </svg>
    );
  },
  pencil(size = 16): ReactNode {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...baseStroke} strokeWidth={1.6}>
        <path d="M4 20h4l11-11-4-4L4 16v4z" />
      </svg>
    );
  },
};
