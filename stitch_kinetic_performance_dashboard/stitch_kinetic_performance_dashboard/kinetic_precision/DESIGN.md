---
name: Kinetic Precision
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#b9cac9'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#839493'
  outline-variant: '#3a4a49'
  surface-tint: '#00dddd'
  primary: '#ffffff'
  on-primary: '#003737'
  primary-container: '#00fbfb'
  on-primary-container: '#007070'
  inverse-primary: '#006a6a'
  secondary: '#ffb4aa'
  on-secondary: '#690003'
  secondary-container: '#c5020b'
  on-secondary-container: '#ffd2cc'
  tertiary: '#ffffff'
  on-tertiary: '#002e69'
  tertiary-container: '#d8e2ff'
  on-tertiary-container: '#0060cc'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#00fbfb'
  primary-fixed-dim: '#00dddd'
  on-primary-fixed: '#002020'
  on-primary-fixed-variant: '#004f4f'
  secondary-fixed: '#ffdad5'
  secondary-fixed-dim: '#ffb4aa'
  on-secondary-fixed: '#410001'
  on-secondary-fixed-variant: '#930005'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc6ff'
  on-tertiary-fixed: '#001a41'
  on-tertiary-fixed-variant: '#004493'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-metrics:
    fontFamily: JetBrains Mono
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  data-label:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 16px
  data-value:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 22px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 40px
---

## Brand & Style

The design system is engineered for elite athletes and biomechanics researchers who require instantaneous, high-fidelity data interpretation. The brand personality is **clinical, high-performance, and futuristic**, evoking the feeling of a sophisticated telemetry lab. 

The aesthetic follows a **Minimalist-Tech** movement: it strips away decorative flourishes to prioritize data density and legibility. By utilizing high-contrast accents against a deep, non-distracting void, the UI directs the user’s focus exclusively toward performance metrics and movement analysis. The emotional response should be one of absolute control and scientific accuracy.

## Colors

The palette is anchored in a **Deep Charcoal (#121212)** environment to minimize eye strain during high-intensity training sessions. 

- **Primary (Electric Cyan):** Used strictly for active data streams, "In-Progress" states, and primary calls to action. It represents the "flow" state of the athlete.
- **Secondary (Stark Crimson):** Reserved for critical thresholds, peak stress indicators, and physiological alerts. It is a functional color, never decorative.
- **Neutrals:** A range of grays from Slate (#1A1A1A) for card surfaces to mid-tone grays for secondary labels, ensuring a clear hierarchy of information without overwhelming the user.

## Typography

This design system employs a dual-font strategy to separate narrative UI from technical telemetry.

1.  **Inter (UI & Narrative):** Used for all navigation, headings, and instructional text. It provides a modern, neutral foundation that stays out of the way of the data.
2.  **JetBrains Mono (Data & Metrics):** All numerical values, timestamps, and biomechanical coordinates must use this monospaced face. The fixed character width prevents "jumping" during real-time data updates, ensuring the UI remains stable while metrics fluctuate rapidly.

**Hierarchy Rule:** Use `data-label` in All-Caps with increased tracking (letter-spacing) for small metadata to maintain a "blueprint" aesthetic.

## Layout & Spacing

The layout utilizes a **Fluid-to-Fixed** hybrid model. On mobile, it follows a 4-column grid with 20px side margins. On tablet and desktop, it expands to a 12-column grid.

The rhythm is based on a **4px baseline grid**. Spacing between related data points (e.g., Heart Rate value and its label) should be `xs` (8px), while spacing between distinct data cards should be `lg` (24px) to emphasize the "pod" structure of the interface. 

Maximize whitespace around primary metrics to prevent cognitive overload during movement analysis.

## Elevation & Depth

Depth in this design system is achieved through **Tonal Layering** and **Ghost Outlines** rather than traditional shadows.

- **Base Level:** The background is #121212.
- **Level 1 (Cards/Containers):** Raised elements use #1A1A1A with a subtle 1px border of #2A2A2A to define edges.
- **Level 2 (Modals/Overlays):** Higher-level elements use a slightly lighter gray (#242424) and may include a 10% opacity Cyan glow if they represent an active state.

Avoid soft shadows. Instead, use sharp, 1px "technical" strokes to denote boundaries, reinforcing the precision-tooled nature of the software.

## Shapes

The design system uses an **extreme roundedness** strategy to contrast with the rigid, monospaced data. 

- **Primary Containers:** All cards and large containers must use a corner radius of 24px or larger.
- **Interactive Elements:** Buttons and input fields should be fully pill-shaped.
- **Data Indicators:** Small status dots or "active" pips should be perfect circles.

This high-radius approach softens the "aggressive" dark mode and high-contrast colors, making the professional tool feel sophisticated rather than hostile.

## Components

### Buttons
- **Primary:** Solid Electric Cyan background with black text. Pill-shaped.
- **Secondary:** Ghost style with a 1px Electric Cyan border and Cyan text.
- **Destructive:** 1px Crimson border with Crimson text.

### Data Cards
- Must feature a 24px corner radius.
- Background: #1A1A1A.
- Labels use `data-label` (JetBrains Mono) in secondary gray.
- Primary values use `display-metrics` (JetBrains Mono) in White or Cyan.

### Telemetry Inputs
- Input fields are pill-shaped with #1A1A1A fill. 
- Focus state: 1px Electric Cyan border with a subtle 4px outer glow of the same color.

### Charts & Visualization
- **Lines:** 2px stroke width, Electric Cyan. 
- **Critical Zones:** Fill areas using a Crimson-to-Transparent vertical gradient (low opacity).
- **Grid Lines:** Subdued #2A2A2A dashed lines.

### Chips/Tags
- Small pill-shaped badges for "Live," "Syncing," or "Peak." 
- "Live" indicator must include a pulsing Crimson dot.