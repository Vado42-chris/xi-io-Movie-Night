/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
    /* Tones that arrive at runtime — from the surface registry, the desktop
       suites, insight records and roadmap records — are invisible to the content
       scanner. Interpolating them into class names silently produced nothing.
       They are declared here instead, so the class the code asks for exists. */
    safelist: [
      {
        pattern:
          /^(bg|text|border|ring|shadow|from|to|via)-(indigo|blue|rose|neutral|emerald|amber|red|green|purple|cyan|orange|violet|pink|sky|teal|yellow|slate|zinc)-(300|400|500|600|700)(\/(5|10|20|30|40|50|60|70|80|90))?$/,
      },
      { pattern: /^shadow-(sm|md|lg|xl|2xl|none)$/ },
    ],
  theme: {
  	extend: {
  		borderRadius: {
  			/* All three steps collapse onto the one token. The old calc()
  			   offsets subtracted pixels from it, so a token of zero produced
  			   negative radii — meaning the square-corner rule silently failed
  			   to reach the two smaller steps. */
  			lg: 'var(--radius)',
  			md: 'var(--radius)',
  			sm: 'var(--radius)'
  		},
  		colors: {
  			/* ── THE BRAND OWNS THE HUE; THE LADDER OWNS THE STEP ────────────────
  			 *
  			 * This is the one declaration that makes "core brown" true across the
  			 * whole estate, and it was missing.
  			 *
  			 * index.css declares the brand's neutral axis at HUE 25 — warm brown —
  			 * and says so in its own words: "the neutral axis is declared at hue 25
  			 * rather than 0. That is the whole change." Every rung of the luminance
  			 * ladder, every border, `--muted` and the field itself carry hue 25.
  			 *
  			 * Tailwind's `neutral` scale carries hue 0 — a PURE COOL GREY. And the
  			 * estate draws from it in 9,555 places across 705 files, including the
  			 * design-system primitives themselves (SystemComponents, SystemContent)
  			 * and one literal `#0d1117`. So a column header sat on a cool grey while
  			 * the surface behind it was warm brown, and the two neutrals read as two
  			 * different materials in one pane. That is exactly the inconsistency
  			 * that shows up the moment you switch to White Label: the knockout
  			 * cannot clear a leak that was never a token to begin with.
  			 *
  			 * ── WHAT THIS CHANGES, AND WHAT IT DELIBERATELY DOES NOT ────────────
  			 *
  			 * HUE AND SATURATION ONLY. Every lightness below is byte-for-byte the
  			 * value Tailwind ships, so every contrast ratio in the estate is
  			 * preserved exactly — this is a CHROMA change and not a contrast change,
  			 * which is the same rule index.css states for the ladder. What moves is
  			 * which family the greys belong to; what does not move is how far apart
  			 * any two of them are to the eye.
  			 *
  			 * It is not a safelist and not a `[class*=]` selector. It is the same
  			 * move that already squares the whole shadcn family through --radius:
  			 * one declaration, so a surface added next month is tinted on the day it
  			 * lands instead of on the day somebody remembers to convert it.
  			 *
  			 * CONTRAST IS NOT FIXED HERE and is not claimed to be. The ink rungs in
  			 * use — 400 at 63.9%, 500 at 45.1%, 600 at 32.2% — sit below the ink
  			 * floor the estate measured for itself (--muted-foreground, 69%). That
  			 * is a USAGE debt at the call sites, not a scale value, and lifting these
  			 * rungs would break the 114 places that use them as surfaces. */
  			neutral: {
  				50: 'hsl(25 16% 98%)',
  				100: 'hsl(25 16% 96.1%)',
  				200: 'hsl(25 16% 89.8%)',
  				300: 'hsl(25 16% 83.1%)',
  				400: 'hsl(25 16% 63.9%)',
  				500: 'hsl(25 16% 45.1%)',
  				600: 'hsl(25 16% 32.2%)',
  				700: 'hsl(25 16% 25.1%)',
  				800: 'hsl(25 16% 14.9%)',
  				900: 'hsl(25 16% 9%)',
  				950: 'hsl(25 16% 3.9%)',
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			status: 'hsl(var(--color-status))',
  			'surface-frame': 'hsl(var(--surface-frame))',
  			'surface-content': 'hsl(var(--surface-content))',
  			'surface-panel': 'hsl(var(--surface-panel))',
  			'surface-raised': 'hsl(var(--surface-raised))',
  			'surface-overlay': 'hsl(var(--surface-overlay))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
  		/* The motion contract, taken from the background tempo. The cogwheel's
  		   parallax settles on an exponential with a time constant of ~0.83s
  		   (see src/lib/motion.js), and these are that settle subdivided.
  		   Nothing is instant — a surface that arrives in one frame reads as a
  		   glitch, and one that arrives sooner than the background moves reads
  		   as jarring. Mirrored in index.css and src/lib/motion.js. */
  		transitionDuration: {
  			instant: '120ms',
  			quick: '200ms',
  			base: '320ms',
  			settle: '480ms',
  			deliberate: '720ms'
  		},
  		transitionTimingFunction: {
  			'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
  			'in-out-soft': 'cubic-bezier(0.65, 0, 0.35, 1)'
  		},
  		fontFamily: {
  			heading: 'var(--font-heading)',
  			body: 'var(--font-body)',
  			display: 'var(--font-display)',
  			sans: 'var(--font-body)',
  			mono: 'var(--font-mono)'
  		},
  		zIndex: {
  			auto: 'auto',
  			0: '0',
  			10: 'var(--z-content)',
  			20: 'var(--z-widget)',
  			30: 'var(--z-window)',
  			40: 'var(--z-overlay)',
  			50: 'var(--z-panel)',
  			/* The numeric entries above are ALIASES of the bands below, not a
  			   second scale. z-50 and z-panel are one declaration reached two
  			   ways, and that holds only while each numeric entry points at the
  			   BAND TOKEN — which is why none of them holds a value of its own
  			   and none can drift away from the band it names. Repoint one at a
  			   bare number and it stops being an alias and starts being a second
  			   value for it. guard-layer-band.mjs checks exactly that, so the two
  			   spellings cannot come apart. */
  			content: 'var(--z-content)',
  			widget: 'var(--z-widget)',
  			pinned: 'var(--z-pinned)',
  			subterranean: 'var(--z-subterranean)',
  			window: 'var(--z-window)',
  			overlay: 'var(--z-overlay)',
  			panel: 'var(--z-panel)',
  			popover: 'var(--z-popover)',
  			modal: 'var(--z-modal)',
  			inspector: 'var(--z-inspector)',
  			toast: 'var(--z-toast)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}