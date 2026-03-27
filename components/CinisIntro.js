'use client'
import { useEffect, useRef } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// GLSL — Flame Fragment Shader
// Ashima Arts simplex noise (public domain) + curl noise + domain warping
// 4-octave fbm with inter-octave rotation, gravity-shaped flame envelope
// ─────────────────────────────────────────────────────────────────────────────
const FLAME_FRAG = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uSpread;
uniform float uCollapse;
uniform float uIntensity;
uniform vec2  uResolution;

// ── Ashima Arts simplex noise (full implementation) ─────────────────────────
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,   // (3.0-sqrt(3.0))/6.0
    0.366025403784439,   // 0.5*(sqrt(3.0)-1.0)
   -0.577350269189626,   // -1.0 + 2.0 * C.x
    0.024390243902439    // 1.0 / 41.0
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x_) - 0.5;
  vec3 ox = floor(x_ + 0.5);
  vec3 a0 = x_ - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x  + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// ── Curl noise (2D) — rotated gradient of snoise for turbulent advection ────
vec2 curlNoise(vec2 p) {
  float eps = 0.01;
  float n1 = snoise(p + vec2(0.0, eps));
  float n2 = snoise(p - vec2(0.0, eps));
  float n3 = snoise(p + vec2(eps, 0.0));
  float n4 = snoise(p - vec2(eps, 0.0));
  float dx = (n1 - n2) / (2.0 * eps);
  float dy = (n3 - n4) / (2.0 * eps);
  return vec2(dx, -dy);
}

// ── 4-octave fbm with inter-octave rotation matrix ─────────────────────────
float fbm4(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  float angle = 0.5;
  mat2 r1 = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
  mat2 r2 = mat2(cos(angle * 1.3), sin(angle * 1.3), -sin(angle * 1.3), cos(angle * 1.3));
  mat2 r3 = mat2(cos(angle * 1.7), sin(angle * 1.7), -sin(angle * 1.7), cos(angle * 1.7));
  v += a * snoise(p);
  p = r1 * p * 2.02; a *= 0.5;
  v += a * snoise(p);
  p = r2 * p * 2.03; a *= 0.5;
  v += a * snoise(p);
  p = r3 * p * 2.01; a *= 0.5;
  v += a * snoise(p);
  return v;
}

// ── Domain-warped fbm with reduced warp amplitudes + faster time terms ──────
float warpedFbm(vec2 p, float t) {
  // First warp pass — moderate displacement
  vec2 q = vec2(
    fbm4(p + vec2(0.0, 0.0)),
    fbm4(p + vec2(5.2, 1.3))
  );
  // Curl advection — visible turbulent swirl
  vec2 curl = curlNoise(p * 1.2 + t * 0.4);
  // Second warp pass — reduced amplitudes to preserve noise structure
  vec2 r = vec2(
    fbm4(p + 2.0 * q + vec2(1.7, 9.2) + curl * 0.35 + vec2(0.0, t * 0.4)),
    fbm4(p + 2.0 * q + vec2(8.3, 2.8) + curl * 0.35 + vec2(0.0, t * 0.35))
  );
  return fbm4(p + 1.8 * r);
}

// ── Color ramp: density + vertical position → flame color ───────────────────
vec4 flameColor(float d, float y) {
  vec3 deepRed  = vec3(0.353, 0.031, 0.0);    // #5A0800
  vec3 ember    = vec3(0.910, 0.196, 0.102);   // #E8321A
  vec3 hotPool  = vec3(1.000, 0.400, 0.267);   // #FF6644
  vec3 orange   = vec3(1.000, 0.549, 0.0);     // #FF8C00
  vec3 yellow   = vec3(1.000, 0.878, 0.251);   // #FFE040
  vec3 whiteHot = vec3(1.000, 0.992, 0.878);   // #FFFDE0

  // Vertical bias: hotter near ceiling
  float vertBias = 1.0 + (1.0 - y) * 0.25;
  float dd = clamp(d * vertBias, 0.0, 1.0);

  vec3 col;
  float alpha;
  if (dd <= 0.05) {
    alpha = smoothstep(0.0, 0.05, dd);
    col = deepRed;
  } else if (dd <= 0.20) {
    col = mix(deepRed, ember, (dd - 0.05) / 0.15);
    alpha = 1.0;
  } else if (dd <= 0.38) {
    col = mix(ember, hotPool, (dd - 0.20) / 0.18);
    alpha = 1.0;
  } else if (dd <= 0.55) {
    col = mix(hotPool, orange, (dd - 0.38) / 0.17);
    alpha = 1.0;
  } else if (dd <= 0.72) {
    col = mix(orange, yellow, (dd - 0.55) / 0.17);
    alpha = 1.0;
  } else if (dd <= 0.88) {
    col = mix(yellow, whiteHot, (dd - 0.72) / 0.16);
    alpha = 1.0;
  } else {
    col = whiteHot;
    alpha = 1.0;
  }
  return vec4(col, alpha);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  // y=0 bottom of screen, y=1 top of screen in GL
  // flameY: 0 at ceiling (top), 1 at floor (bottom)
  float flameY = 1.0 - uv.y;

  // ── Collapse vortex ────────────────────────────────────────────────────────
  vec2 center = vec2(0.5, 0.5);
  float dist = length(uv - center);
  float vortexStrength = uCollapse * uCollapse * 3.5;
  float vAngle = vortexStrength * dist * 6.2831 * 0.5;
  mat2 spin = mat2(cos(vAngle), -sin(vAngle), sin(vAngle), cos(vAngle));
  vec2 flameUV = center + spin * (uv - center) * (1.0 - uCollapse * 0.92);
  flameY = 1.0 - flameUV.y;

  // ── Time ───────────────────────────────────────────────────────────────────
  float t = uTime * 0.65;

  // ── Lateral spread mask — controls fire width from center outward ─────────
  float cx = abs(flameUV.x - 0.5) * 2.0;  // 0 at center, 1 at edges
  float spreadMask = smoothstep(uSpread + 0.02, max(uSpread - 0.3, 0.0), cx);

  // ── Tongue height noise — low-freq, varies which columns reach further ────
  float tongueNoise = fbm4(vec2(flameUV.x * 5.0 + t * 0.15, t * 0.4)) * 0.5 + 0.5;
  tongueNoise = 0.4 + tongueNoise * 0.6;  // range 0.4–1.0

  // ── Hard ceiling constraint — flame hangs DOWN from top edge only ─────────
  // maxReach: how far down (in flameY) flame can extend
  // Varies per column (tongue noise) and per lateral position
  float maxReach = 0.50 * tongueNoise * (1.0 - 0.35 * cx * cx);
  float falloff = 1.0 - smoothstep(0.0, maxReach, flameY);
  // Sharp gravity pull — accelerates at tips for pointed flame tongues
  falloff = pow(falloff, 1.8 + flameY * 2.0);

  // Hard kill: absolutely zero below 55% from ceiling
  falloff *= step(flameY, 0.55);

  // ── Primary noise field with domain warping ────────────────────────────────
  vec2 p = vec2(flameUV.x * 2.8, flameY * 3.5 - t * 0.85);
  float noise = warpedFbm(p, t);
  noise = noise * 0.5 + 0.5;

  // ── Contrast amplification — stretch mid-range to fill full [0,1] ─────────
  noise = smoothstep(0.18, 0.82, noise);

  // ── High-frequency flicker — visible turbulence on every frame ────────────
  float flicker = snoise(vec2(flameUV.x * 9.0, flameY * 7.0 - t * 3.0)) * 0.12;
  float flicker2 = snoise(vec2(flameUV.x * 14.0 + 3.7, flameY * 11.0 - t * 4.5)) * 0.06;
  noise = clamp(noise + flicker + flicker2, 0.0, 1.0);

  // ── Ceiling boost — white-hot core at top 8% of flame ─────────────────────
  float ceilingBoost = smoothstep(0.10, 0.0, flameY) * 0.35;

  // ── Final density ──────────────────────────────────────────────────────────
  float density = (noise + ceilingBoost) * falloff * spreadMask * uIntensity;
  // Power curve to lift structure into visible color ramp bands
  density = pow(clamp(density, 0.0, 1.0), 0.72);

  // ── Collapse concentrates density toward center ────────────────────────────
  if (uCollapse > 0.0) {
    float collapseFocus = smoothstep(0.0, 0.6 - uCollapse * 0.55, dist);
    density *= mix(1.0, collapseFocus * 2.5, uCollapse);
    density = clamp(density, 0.0, 1.0);
  }

  // ── Sub-surface glow layer ─────────────────────────────────────────────────
  float glow = fbm4(p * 0.5 + vec2(0.0, t * 0.3)) * 0.5 + 0.5;
  float glowMask = falloff * spreadMask * glow * 0.25 * uIntensity;
  vec3 glowCol = vec3(1.0, 0.45, 0.1) * glowMask;

  // ── Color output ───────────────────────────────────────────────────────────
  vec4 flame = flameColor(density, flameY);
  vec3 finalCol = flame.rgb + glowCol;
  float finalAlpha = flame.a + glowMask * 0.4;

  // Collapse fade
  if (uCollapse > 0.85) {
    finalAlpha *= 1.0 - smoothstep(0.85, 1.0, uCollapse);
  }

  gl_FragColor = vec4(finalCol, finalAlpha);
}
`

const FLAME_VERT = /* glsl */ `
void main() {
  gl_Position = vec4(position, 1.0);
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Cinis Mark SVG polygon data (exact points — do not alter)
// ─────────────────────────────────────────────────────────────────────────────
const MARK_POLYGONS = [
  { points: '32,4 54,16 54,42 32,54 10,42 10,16',   fill: '#FF6644',  opacity: 1 },
  { points: '32,7 51,18 51,40 32,52 13,40 13,18',   fill: '#120704',  opacity: 1 },
  { points: '32,14 46,22 46,40 32,48 18,40 18,22',  fill: '#5A1005',  opacity: 1 },
  { points: '32,20 42,26 42,40 32,45 22,40 22,26',  fill: '#A82010',  opacity: 1 },
  { points: '32,26 38,29 38,40 32,43 26,40 26,29',  fill: '#E8321A',  opacity: 1 },
  { points: '32,29 45,40 40,43 32,47 24,43 19,40',  fill: '#FF6644',  opacity: 0.92 },
  { points: '32,33 41,40 38,42 32,45 26,42 23,40',  fill: '#FFD0C0',  opacity: 0.76 },
  { points: '32,36 37,40 36,41 32,43 28,41 27,40',  fill: '#FFF0EB',  opacity: 0.60 },
]

// Outer hex polyline for stroke-dash trace
const HEX_POINTS = '32,2 56,15 56,43 32,56 8,43 8,15'

// Compute hex perimeter for stroke-dasharray
function hexPerimeter() {
  const pts = HEX_POINTS.split(' ').map(p => p.split(',').map(Number))
  let len = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    len += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return len
}

// Compute position along hex perimeter at progress t ∈ [0,1]
function hexPointAtProgress(t) {
  const pts = HEX_POINTS.split(' ').map(p => p.split(',').map(Number))
  const perim = hexPerimeter()
  let target = t * perim
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (target <= segLen) {
      const frac = target / segLen
      return { x: a[0] + (b[0] - a[0]) * frac, y: a[1] + (b[1] - a[1]) * frac }
    }
    target -= segLen
  }
  return { x: pts[0][0], y: pts[0][1] }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CinisIntro({ onComplete, navLogoRef }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const svgRef = useRef(null)
  const burstRef = useRef(null)
  const flashRef = useRef(null)
  const tracerRef = useRef(null)
  const rafRef = useRef(null)
  const rendererRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('cinis_intro_v2')) {
      onComplete?.()
      return
    }

    const W = window.innerWidth
    const H = window.innerHeight
    const isMobile = /Mobile|Android|iPhone/i.test(navigator.userAgent) && window.screen.width < 768
    const lowEnd = (navigator.hardwareConcurrency || 4) <= 2 || isMobile

    Promise.all([
      import('three'),
      import('gsap'),
    ]).then(([THREE, gsapModule]) => {
      const gsap = gsapModule.gsap || gsapModule.default || gsapModule
      const container = containerRef.current
      if (!container) return

      const burst = burstRef.current
      const flash = flashRef.current
      const svg = svgRef.current
      const hexLine = svg.querySelector('#hex-trace')
      const logoLayers = svg.querySelectorAll('.logo-layer')
      const tracer = tracerRef.current
      const perim = hexPerimeter()

      // ── Initial states ──────────────────────────────────────────────────
      gsap.set(svg, { opacity: 0 })
      gsap.set(logoLayers, { opacity: 0 })
      gsap.set(hexLine, { strokeDasharray: perim, strokeDashoffset: perim, opacity: 1 })
      gsap.set(burst, { opacity: 0, scale: 0.01 })
      gsap.set(flash, { opacity: 0, scale: 0 })
      gsap.set(tracer, { opacity: 0 })
      gsap.set(container, { opacity: 1 })

      // ── Three.js setup ──────────────────────────────────────────────────
      let flameActive = false
      let startTime = 0
      let renderer, scene, camera, uniforms, geo, mat

      if (!lowEnd) {
        renderer = new THREE.WebGLRenderer({
          canvas: canvasRef.current,
          alpha: true,
          antialias: false,
        })
        const DPR = Math.min(window.devicePixelRatio || 1, 2)
        renderer.setPixelRatio(DPR)
        renderer.setSize(W, H)
        rendererRef.current = renderer

        scene = new THREE.Scene()
        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

        uniforms = {
          uTime:       { value: 0 },
          uSpread:     { value: 0 },
          uCollapse:   { value: 0 },
          uIntensity:  { value: 0 },
          uResolution: { value: new THREE.Vector2(W * DPR, H * DPR) },
        }

        mat = new THREE.ShaderMaterial({
          vertexShader: FLAME_VERT,
          fragmentShader: FLAME_FRAG,
          uniforms,
          transparent: true,
          depthWrite: false,
        })

        geo = new THREE.PlaneGeometry(2, 2)
        const mesh = new THREE.Mesh(geo, mat)
        scene.add(mesh)

        const tick = () => {
          rafRef.current = requestAnimationFrame(tick)
          if (!flameActive) return
          uniforms.uTime.value = (performance.now() - startTime) * 0.001
          renderer.render(scene, camera)
        }
        rafRef.current = requestAnimationFrame(tick)
      }

      // ── Dispose Three.js resources ──────────────────────────────────────
      function disposeThree() {
        flameActive = false
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        if (geo) geo.dispose()
        if (mat) mat.dispose()
        if (rendererRef.current) {
          rendererRef.current.dispose()
          rendererRef.current = null
        }
        // Remove canvas from DOM
        const c = canvasRef.current
        if (c && c.parentNode) c.style.display = 'none'
      }

      // ── Compute nav target for float-to-nav ────────────────────────────
      function getNavTarget() {
        if (navLogoRef && navLogoRef.current) {
          const rect = navLogoRef.current.getBoundingClientRect()
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, scale: rect.width / 80 }
        }
        // Fallback: nav-logo class in DOM
        const navLogo = document.querySelector('.nav-logo')
        if (navLogo) {
          const rect = navLogo.getBoundingClientRect()
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, scale: rect.width / 80 }
        }
        // Default fallback
        return { x: 32, y: 30, scale: 0.22 }
      }

      // ── GSAP master timeline ────────────────────────────────────────────
      const tl = gsap.timeline({
        onComplete: () => {
          sessionStorage.setItem('cinis_intro_v2', '1')
          onComplete?.()
          setTimeout(() => {
            if (container) container.style.display = 'none'
          }, 50)
        }
      })

      if (lowEnd) {
        // ── LOW-END: Skip to Phase 5 ────────────────────────────────────
        tl.set(container, { background: '#000' })
          .set(svg, {
            opacity: 1,
            position: 'fixed',
            left: '50%',
            top: '50%',
            xPercent: -50,
            yPercent: -50,
            scale: 1,
          })
          .to(hexLine, { strokeDashoffset: 0, duration: 0.55, ease: 'power2.inOut' })
          .to(logoLayers, { opacity: (i) => MARK_POLYGONS[i].opacity, stagger: 0.058, duration: 0.15 })
          .to({}, { duration: 0.3 })
          .to(container, { opacity: 0, duration: 0.4 })

      } else {
        // ── PHASE 1: Black silence (t=0.00 – 0.30) ─────────────────────
        tl.to({}, { duration: 0.30 })

        // ── PHASE 2: Burst detonation (t=0.30 – 0.85) ──────────────────
          .call(() => {
            gsap.set(burst, { opacity: 1, scale: 0.01 })
          })
          .to(burst, {
            scale: 3.5,
            duration: 0.45,
            ease: 'power4.out',
          })
          .to(burst, {
            opacity: 0,
            duration: 0.35,
            ease: 'power2.in',
          }, '-=0.30')

        // ── PHASE 3: Ceiling fire spreads (t=0.55 – 1.85) ──────────────
          .call(() => {
            flameActive = true
            startTime = performance.now()
            uniforms.uIntensity.value = 0.0
          }, null, 0.55)
          .to(uniforms.uIntensity, {
            value: 1.0,
            duration: 0.35,
            ease: 'power2.out',
          }, 0.55)
          .to(uniforms.uSpread, {
            value: 1.0,
            duration: 1.2,
            ease: 'power2.out',
          }, 0.55)
          // Hold at full spread
          .to({}, { duration: 0.05 }, 1.85)

        // ── PHASE 4: Collapse vortex (t=2.40 – 2.95) ───────────────────
          .to(uniforms.uCollapse, {
            value: 1.0,
            duration: 0.55,
            ease: 'power3.in',
          }, 2.40)
          // Canvas opacity fades as collapse completes
          .to(canvasRef.current, {
            opacity: 0,
            duration: 0.25,
            ease: 'none',
          }, 2.70)
          // Percussive flash at collapse peak
          .call(() => {
            gsap.set(flash, { opacity: 0.92, scale: 0 })
            gsap.to(flash, {
              scale: 1.8,
              duration: 0.04,
              ease: 'power4.out',
              onComplete: () => {
                gsap.to(flash, {
                  scale: 0,
                  opacity: 0,
                  duration: 0.04,
                  ease: 'power2.in',
                })
              }
            })
            // Dispose Three.js
            disposeThree()
          }, null, 2.95)

        // ── PHASE 5: Logo formation (t=3.05 – 4.11) ────────────────────
          // Logo appears at center
          .call(() => {
            gsap.set(svg, {
              opacity: 1,
              position: 'fixed',
              left: '50%',
              top: '50%',
              xPercent: -50,
              yPercent: -50,
              scale: 1,
              filter: 'none',
            })
            gsap.set(tracer, { opacity: 1 })
          }, null, 3.05)
          // Hex outline traces with traveling light
          .to(hexLine, {
            strokeDashoffset: 0,
            duration: 0.55,
            ease: 'power2.inOut',
            onUpdate: function() {
              const progress = this.progress()
              const pt = hexPointAtProgress(progress)
              if (tracer) {
                tracer.setAttribute('cx', pt.x)
                tracer.setAttribute('cy', pt.y)
              }
            },
          }, 3.10)
          .to(tracer, { opacity: 0, duration: 0.1 }, 3.60)
          // Fill layers stagger in (8 × 58ms = 0.46s)
          .to(logoLayers, {
            opacity: (i) => MARK_POLYGONS[i].opacity,
            duration: 0.12,
            stagger: 0.058,
            ease: 'power1.out',
          }, 3.65)
          // Glow pulse
          .to(svg, {
            filter: 'drop-shadow(0 0 28px rgba(255,102,68,0.9))',
            duration: 0.25,
            ease: 'power2.out',
          }, 4.11)
          .to(svg, {
            filter: 'drop-shadow(0 0 8px rgba(255,102,68,0.3))',
            duration: 0.25,
            ease: 'power2.inOut',
          }, 4.36)

        // ── PHASE 6: Float to nav + page reveal (t=4.40 – 5.60) ────────
          .call(() => {
            const target = getNavTarget()
            gsap.to(svg, {
              left: target.x,
              top: target.y,
              xPercent: -50,
              yPercent: -50,
              scale: target.scale,
              duration: 0.95,
              ease: 'power2.inOut',
            })
          }, null, 4.40)
          // Background transitions black → Coal
          .to(container, {
            background: '#211A14',
            duration: 0.6,
            ease: 'none',
          }, 4.65)
          // Final fade out of overlay
          .to(container, {
            opacity: 0,
            duration: 0.35,
            ease: 'power2.inOut',
          }, 5.25)
      }
    }).catch(err => {
      console.error('CinisIntro: failed to load deps', err)
      onComplete?.()
    })

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000',
        overflow: 'hidden',
        pointerEvents: 'all',
      }}
    >
      {/* Three.js flame canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />

      {/* Burst radial overlay — Phase 2 detonation */}
      <div
        ref={burstRef}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100vmax',
          height: '100vmax',
          borderRadius: '50%',
          background: `radial-gradient(circle,
            rgba(255,253,224,1) 0%,
            #FFE040 12%,
            #FF8C00 28%,
            #FF6644 44%,
            #E8321A 62%,
            #5A0800 78%,
            #000 100%
          )`,
          pointerEvents: 'none',
          transformOrigin: 'center center',
        }}
      />

      {/* Percussive flash — Phase 4 collapse peak */}
      <div
        ref={flashRef}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100vmax',
          height: '100vmax',
          borderRadius: '50%',
          background: `radial-gradient(circle,
            rgba(255,220,120,0.92) 0%,
            rgba(255,180,80,0.5) 40%,
            transparent 70%
          )`,
          pointerEvents: 'none',
          transformOrigin: 'center center',
        }}
      />

      {/* SVG Logo — animated mark */}
      <svg
        ref={svgRef}
        width="80"
        height="80"
        viewBox="0 0 64 64"
        fill="none"
        style={{
          position: 'fixed',
          transformOrigin: 'center center',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {/* Traveling light point */}
        <circle
          ref={tracerRef}
          cx="32"
          cy="2"
          r="3"
          fill="#FFE040"
          style={{ filter: 'blur(1px)' }}
        />

        {/* Hex outline trace */}
        <polygon
          id="hex-trace"
          points={HEX_POINTS}
          fill="none"
          stroke="#FF6644"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Logo fill layers — staggered opacity */}
        {MARK_POLYGONS.map((p, i) => (
          <polygon
            key={i}
            className="logo-layer"
            points={p.points}
            fill={p.fill}
            opacity={0}
          />
        ))}
      </svg>
    </div>
  )
}
