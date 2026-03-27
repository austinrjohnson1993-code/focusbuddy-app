'use client'
import { useEffect, useRef } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// GLSL — Flame Fragment Shader
// Simplex noise: Ashima Arts (public domain)
// ─────────────────────────────────────────────────────────────────────────────
const FLAME_FRAG = `
precision highp float;
uniform float uTime;
uniform float uSpread;
uniform vec2  uResolution;

// ── Ashima simplex noise ──────────────────────────────────────────────────
vec3 mod289(vec3 x){return x - floor(x*(1./289.))*289.;}
vec2 mod289(vec2 x){return x - floor(x*(1./289.))*289.;}
vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.,0.) : vec2(0.,1.);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.,i1.y,1.)) + i.x + vec3(0.,i1.x,1.));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.);
  m = m*m; m = m*m;
  vec3 x = 2.*fract(p * C.www) - 1.;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314*(a0*a0+h*h);
  vec3 g;
  g.x  = a0.x *x0.x  + h.x *x0.y;
  g.yz = a0.yz*x12.xz + h.yz*x12.yw;
  return 130. * dot(m, g);
}

// ── Fractal Brownian Motion (3 octaves) ───────────────────────────────────
float fbm(vec2 p){
  float v = 0., a = 0.5;
  mat2 rot = mat2(cos(0.5),sin(0.5),-sin(0.5),cos(0.5));
  for(int i=0;i<3;i++){
    v += a * snoise(p);
    p  = rot * p * 2.1;
    a *= 0.5;
  }
  return v;
}

// ── Color ramp: density → flame color ────────────────────────────────────
vec4 flameColor(float d){
  vec3 c0 = vec3(0.);                      // 0.0 → transparent
  vec3 c1 = vec3(0.91, 0.20, 0.10);        // 0.2 → #E8321A
  vec3 c2 = vec3(1.00, 0.40, 0.27);        // 0.5 → #FF6644
  vec3 c3 = vec3(1.00, 0.55, 0.00);        // 0.7 → #FF8C00
  vec3 c4 = vec3(1.00, 0.88, 0.25);        // 0.9 → #FFE040
  vec3 c5 = vec3(1.00, 0.99, 0.88);        // 1.0 → #FFFDE0

  vec3 col;
  float alpha;
  if(d < 0.2){
    float t = d / 0.2;
    col = mix(c0, c1, t);
    alpha = t;
  } else if(d < 0.5){
    col = mix(c1, c2, (d-0.2)/0.3);
    alpha = 1.;
  } else if(d < 0.7){
    col = mix(c2, c3, (d-0.5)/0.2);
    alpha = 1.;
  } else if(d < 0.9){
    col = mix(c3, c4, (d-0.7)/0.2);
    alpha = 1.;
  } else {
    col = mix(c4, c5, (d-0.9)/0.1);
    alpha = 1.;
  }
  return vec4(col, alpha);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uResolution;
  // y=0 bottom, y=1 top — flip so flame hangs DOWN from top
  float yFlip = 1. - uv.y;

  // Lateral spread mask — flames grow from center outward
  float cx = abs(uv.x - 0.5) * 2.;               // 0 at center, 1 at edges
  float spreadMask = smoothstep(uSpread, uSpread - 0.3, cx);
  spreadMask = clamp(spreadMask, 0., 1.);

  // Flame height envelope: tall at center, shorter toward edges
  float heightEnv = 1. - 0.4 * cx * cx;

  // Warp UV for turbulent tongues
  vec2 p = vec2(uv.x * 2.5, yFlip * 2.0 - uTime * 0.9);
  float warp = fbm(p * 1.2 + vec2(0., uTime * 0.4));
  vec2 warped = p + vec2(warp * 0.35, warp * 0.2);

  // Flame density field
  float noise = fbm(warped + vec2(uTime * 0.15, 0.));
  noise = noise * 0.5 + 0.5;  // remap to [0,1]

  // Downward falloff — flame fades to nothing by 55% screen height from top
  float maxReach = 0.55 * heightEnv;
  float falloff = 1. - smoothstep(0., maxReach, yFlip);
  falloff = pow(falloff, 1.6);

  float density = noise * falloff * spreadMask;
  density = clamp(density, 0., 1.);

  // Sub-surface glow layer
  float glow = fbm(p * 0.6 + vec2(0., uTime * 0.25)) * 0.5 + 0.5;
  float glowMask = falloff * spreadMask * glow * 0.35;
  vec3 glowCol = vec3(1.0, 0.45, 0.1) * glowMask;

  vec4 flame = flameColor(density);
  vec3 final = flame.rgb + glowCol;

  gl_FragColor = vec4(final, flame.a + glowMask * 0.5);
}
`

const FLAME_VERT = `
void main(){
  gl_Position = vec4(position, 1.0);
}
`

// ─────────────────────────────────────────────────────────────────────────────
// Cinis Mark SVG paths (same geometry as dashboard.js)
// ─────────────────────────────────────────────────────────────────────────────
const MARK_POLYGONS = [
  { points: '32,2 56,15 56,43 32,56 8,43 8,15', fill: 'none', stroke: '#FF6644', strokeWidth: 1.1, opacity: 0.45, layer: 0 },
  { points: '32,4 54,16 54,42 32,54 10,42 10,16',   fill: '#FF6644',  layer: 1 },
  { points: '32,7 51,18 51,40 32,52 13,40 13,18',   fill: '#120704',  layer: 2 },
  { points: '32,14 46,22 46,40 32,48 18,40 18,22',  fill: '#5A1005',  layer: 3 },
  { points: '32,20 42,26 42,40 32,45 22,40 22,26',  fill: '#A82010',  layer: 4 },
  { points: '32,26 38,29 38,40 32,43 26,40 26,29',  fill: '#E8321A',  layer: 5 },
  { points: '32,29 45,40 40,43 32,47 24,43 19,40',  fill: '#FF6644',  opacity: 0.92, layer: 6 },
  { points: '32,33 41,40 38,42 32,45 26,42 23,40',  fill: '#FFD0C0',  opacity: 0.76, layer: 7 },
  { points: '32,36 37,40 36,41 32,43 28,41 27,40',  fill: '#FFF0EB',  opacity: 0.60, layer: 8 },
]

// Outer hex as a polyline for the stroke-dash trace
const HEX_POINTS = '32,2 56,15 56,43 32,56 8,43 8,15'

// ─────────────────────────────────────────────────────────────────────────────
// Utility: parse polygon points → SVG path perimeter length
// ─────────────────────────────────────────────────────────────────────────────
function hexPerimeter() {
  const pts = HEX_POINTS.split(' ').map(p => p.split(',').map(Number))
  let len = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length]
    len += Math.hypot(b[0] - a[0], b[1] - a[1])
  }
  return len
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CinisIntro({ onComplete }) {
  const containerRef = useRef(null)
  const canvasRef    = useRef(null)   // Three.js canvas (flame)
  const svgRef       = useRef(null)   // SVG overlay (logo)
  const burstRef     = useRef(null)   // burst div
  const rafRef       = useRef(null)
  const rendererRef  = useRef(null)

  useEffect(() => {
    // ── sessionStorage gate ──────────────────────────────────────────────
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('cinis_intro_seen')) {
      onComplete?.()
      return
    }

    const W = window.innerWidth
    const H = window.innerHeight
    const lowEnd = (navigator.hardwareConcurrency || 4) <= 2

    // ── Import dependencies lazily (client-only) ─────────────────────────
    Promise.all([
      import('three'),
      import('gsap'),
    ]).then(([THREE, { gsap }]) => {
      const container = containerRef.current
      if (!container) return

      // ── PHASE 2: Burst overlay div ───────────────────────────────────
      const burst = burstRef.current

      // ── Three.js renderer (flame shader) ────────────────────────────
      const renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        alpha: true,
        antialias: false,
      })
      const DPR = Math.min(window.devicePixelRatio || 1, 2)
      renderer.setPixelRatio(DPR)
      renderer.setSize(W, H)
      rendererRef.current = renderer

      const scene  = new THREE.Scene()
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

      const uniforms = {
        uTime:       { value: 0 },
        uSpread:     { value: 0 },
        uResolution: { value: new THREE.Vector2(W * DPR, H * DPR) },
      }

      const mat = new THREE.ShaderMaterial({
        vertexShader:   FLAME_VERT,
        fragmentShader: FLAME_FRAG,
        uniforms,
        transparent: true,
        depthWrite: false,
      })

      const geo  = new THREE.PlaneGeometry(2, 2)
      const mesh = new THREE.Mesh(geo, mat)
      scene.add(mesh)

      // ── Render loop ──────────────────────────────────────────────────
      let flameActive = false
      let startTime   = 0

      const tick = (t) => {
        rafRef.current = requestAnimationFrame(tick)
        if (!flameActive) return
        uniforms.uTime.value = (t - startTime) * 0.001
        renderer.render(scene, camera)
      }
      rafRef.current = requestAnimationFrame(tick)

      // ── SVG logo elements ────────────────────────────────────────────
      const svg      = svgRef.current
      const hexLine  = svg.querySelector('#hex-trace')
      const logoLayers = svg.querySelectorAll('.logo-layer')
      const perim    = hexPerimeter() * (64 / 64) // viewBox 64

      // Setup: all logo layers hidden
      gsap.set(svg, { opacity: 0 })
      gsap.set(logoLayers, { opacity: 0 })
      gsap.set(hexLine, {
        strokeDasharray: perim,
        strokeDashoffset: perim,
        opacity: 1,
      })
      gsap.set(burst, { opacity: 0, scale: 0 })
      gsap.set(container, { opacity: 1 })

      // ── GSAP master timeline ─────────────────────────────────────────
      const tl = gsap.timeline({
        onComplete: () => {
          sessionStorage.setItem('cinis_intro_seen', '1')
          onComplete?.()
          // Remove canvas and container after transition
          setTimeout(() => {
            if (container) container.style.display = 'none'
          }, 100)
        }
      })

      if (lowEnd) {
        // Low-end: skip to Phase 5 immediately
        tl.call(() => {
          flameActive = false
          gsap.set(burst, { opacity: 0 })
        })
        .set(svg, { opacity: 1, x: 0, y: 0, scale: 1 })
        .to(logoLayers, { opacity: 1, stagger: 0.05, duration: 0.15 })
        .to({}, { duration: 0.3 })
        .to(container, { opacity: 0, duration: 0.4 })

      } else {
        // ── PHASE 1: Blackout (0 – 0.3s) ────────────────────────────
        tl.to({}, { duration: 0.3 })

        // ── PHASE 2: Burst (0.3 – 0.8s) ─────────────────────────────
        .call(() => {
          gsap.set(burst, { opacity: 1, scale: 0 })
        })
        .to(burst, {
          scale: 12,
          duration: 0.5,
          ease: 'power4.out',
        })

        // ── PHASE 3: Ceiling fire (0.8 – 2.4s) ──────────────────────
        .call(() => {
          flameActive = true
          startTime = performance.now()
          gsap.set(burst, { opacity: 0 })
        })
        .to(uniforms.uSpread, {
          value: 1.0,
          duration: 1.2,
          ease: 'power2.out',
        })
        .to({}, { duration: 0.4 })  // hold flame at full spread

        // ── PHASE 4: Collapse (2.4 – 3.0s) ──────────────────────────
        .to(uniforms.uSpread, {
          value: 0.0,
          duration: 0.55,
          ease: 'power4.in',
        })
        // Collapse flash at 3.0s
        .call(() => {
          gsap.to(burst, {
            opacity: 1, scale: 0.15,
            duration: 0.04,
            onComplete: () => {
              gsap.to(burst, { opacity: 0, duration: 0.08, ease: 'power2.out' })
            }
          })
          // Kill flame renderer
          flameActive = false
          if (rendererRef.current) {
            geo.dispose()
            mat.dispose()
            rendererRef.current.dispose()
            rendererRef.current = null
          }
        })
        .to({}, { duration: 0.05 })

        // ── PHASE 5A: Hex trace (3.0 – 3.25s) ───────────────────────
        .call(() => {
          gsap.set(svg, { opacity: 1 })
          // Position SVG at center of screen
          gsap.set(svg, {
            position: 'fixed',
            left: '50%',
            top: '50%',
            xPercent: -50,
            yPercent: -50,
          })
        })
        .to(hexLine, {
          strokeDashoffset: 0,
          duration: 0.25,
          ease: 'power2.inOut',
        })

        // ── PHASE 5B: Fill layers (3.25 – 3.6s) ─────────────────────
        .to(logoLayers, {
          opacity: 1,
          duration: 0.1,
          stagger: 0.06,
          ease: 'power1.out',
        })

        // ── PHASE 5C: Glow pulse (3.6 – 4.2s) ───────────────────────
        .to(svg, {
          filter: 'drop-shadow(0 0 28px #FF6644)',
          duration: 0.3,
          ease: 'power2.out',
        })
        .to(svg, {
          filter: 'drop-shadow(0 0 8px rgba(255,102,68,0.3))',
          duration: 0.3,
          ease: 'power2.inOut',
        })
        .to({}, { duration: 0.1 })

        // ── PHASE 6A: Logo floats to nav position (4.2 – 4.7s) ──────
        .to(svg, {
          top: 20,
          left: 22,
          xPercent: 0,
          yPercent: 0,
          scale: 0.28,
          duration: 0.5,
          ease: 'power2.inOut',
        })

        // ── PHASE 6B: Page reveal (4.7 – 5.2s) ──────────────────────
        .to(container, {
          opacity: 0,
          duration: 0.5,
          ease: 'power2.inOut',
        }, '+=0')
      }
    }).catch(err => {
      // Fallback: skip intro on import failure
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
  }, [])

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

      {/* Burst radial overlay */}
      <div
        ref={burstRef}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #FFFDE0 0%, #FFE040 15%, #FF8C00 35%, #FF6644 55%, #E8321A 75%, transparent 100%)',
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
          transformOrigin: 'top left',
          pointerEvents: 'none',
          overflow: 'visible',
        }}
      >
        {/* Traveling-light hex trace */}
        <polyline
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
          p.fill === 'none' ? (
            <polygon
              key={i}
              className="logo-layer"
              points={p.points}
              fill="none"
              stroke={p.stroke}
              strokeWidth={p.strokeWidth}
              opacity={0}
            />
          ) : (
            <polygon
              key={i}
              className="logo-layer"
              points={p.points}
              fill={p.fill}
              opacity={0}
            />
          )
        ))}
      </svg>
    </div>
  )
}
