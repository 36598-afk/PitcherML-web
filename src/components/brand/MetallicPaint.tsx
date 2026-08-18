import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

/**
 * Liquid-metal logo (WebGL2) from the Aura design. An image is turned into a
 * depth map via a relaxation pass on mount, then a metallic shader animates it.
 * Perf: processing + canvas resolution capped, the loop pauses off-screen, and
 * reduced-motion holds a single frame. Preset = the Signal cyan emblem.
 */

const VERT = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 vP;
void main(){vP=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}`

const FRAG = `#version 300 es
precision highp float;
in vec2 vP;
out vec4 oC;
uniform sampler2D u_tex;
uniform float u_time,u_ratio,u_imgRatio,u_seed,u_scale,u_refract,u_blur,u_liquid;
uniform float u_bright,u_contrast,u_angle,u_fresnel,u_sharp,u_wave,u_noise,u_chroma;
uniform float u_distort,u_contour;
uniform vec3 u_lightColor,u_darkColor,u_tint;
vec3 sC,sM;
vec3 pW(vec3 v){
  vec3 i=floor(v),f=fract(v),s=sign(fract(v*.5)-.5),h=fract(sM*i+i.yzx),c=f*(f-1.);
  return s*c*((h*16.-4.)*c-1.);
}
vec3 aF(vec3 b,vec3 c){return pW(b+c.zxy-pW(b.zxy+c.yzx)+pW(b.yzx+c.xyz));}
vec3 lM(vec3 s,vec3 p){return(p+aF(s,p))*.5;}
vec2 fA(){
  vec2 c=vP-.5;
  c.x*=u_ratio>u_imgRatio?u_ratio/u_imgRatio:1.;
  c.y*=u_ratio>u_imgRatio?1.:u_imgRatio/u_ratio;
  return vec2(c.x+.5,.5-c.y);
}
vec2 rot(vec2 p,float r){float c=cos(r),s=sin(r);return vec2(p.x*c+p.y*s,p.y*c-p.x*s);}
float bM(vec2 c,float t){
  vec2 l=smoothstep(vec2(0.),vec2(t),c),u=smoothstep(vec2(0.),vec2(t),1.-c);
  return l.x*l.y*u.x*u.y;
}
float mG(float hi,float lo,float t,float sh,float cv){
  sh*=(2.-u_sharp);
  float ci=smoothstep(.15,.85,cv),r=lo;
  float e1=.08/u_scale;
  r=mix(r,hi,smoothstep(0.,sh*1.5,t));
  r=mix(r,lo,smoothstep(e1-sh,e1+sh,t));
  float e2=e1+.05/u_scale*(1.-ci*.35);
  r=mix(r,hi,smoothstep(e2-sh,e2+sh,t));
  float e3=e2+.025/u_scale*(1.-ci*.45);
  r=mix(r,lo,smoothstep(e3-sh,e3+sh,t));
  float e4=e1+.1/u_scale;
  r=mix(r,hi,smoothstep(e4-sh,e4+sh,t));
  float rm=1.-e4,gT=clamp((t-e4)/rm,0.,1.);
  r=mix(r,mix(hi,lo,smoothstep(0.,1.,gT)),smoothstep(e4-sh*.5,e4+sh*.5,t));
  return r;
}
void main(){
  sC=fract(vec3(.7548,.5698,.4154)*(u_seed+17.31))+.5;
  sM=fract(sC.zxy-sC.yzx*1.618);
  vec2 sc=vec2(vP.x*u_ratio,1.-vP.y);
  float angleRad=u_angle*3.14159/180.;
  sc=rot(sc-.5,angleRad)+.5;
  sc=clamp(sc,0.,1.);
  float sl=sc.x-sc.y,an=u_time*.001;
  vec2 iC=fA();
  vec4 texSample=texture(u_tex,iC);
  float dp=texSample.r;
  float shapeMask=texSample.a;
  vec3 hi=u_lightColor*u_bright;
  vec3 lo=u_darkColor*(2.-u_bright);
  lo.b+=smoothstep(.6,1.4,sc.x+sc.y)*.08;
  vec2 fC=sc-.5;
  float rd=length(fC+vec2(0.,sl*.15));
  vec2 ag=rot(fC,(.22-sl*.18)*3.14159);
  float cv=1.-pow(rd*1.65,1.15);
  cv*=pow(sc.y,.35);
  float vs=shapeMask;
  vs*=bM(iC,.01);
  float fr=pow(1.-cv,u_fresnel)*.3;
  vs=min(vs+fr*vs,1.);
  float mT=an*.0625;
  vec3 wO=vec3(-1.05,1.35,1.55);
  vec3 wA=aF(vec3(31.,73.,56.),mT+wO)*.22*u_wave;
  vec3 wB=aF(vec3(24.,64.,42.),mT-wO.yzx)*.22*u_wave;
  vec2 nC=sc*45.*u_noise;
  nC+=aF(sC.zxy,an*.17*sC.yzx-sc.yxy*.35).xy*18.*u_wave;
  vec3 tC=vec3(.00041,.00053,.00076)*mT+wB*nC.x+wA*nC.y;
  tC=lM(sC,tC);
  tC=lM(sC+1.618,tC);
  float tb=sin(tC.x*3.14159)*.5+.5;
  tb=tb*2.-1.;
  float noiseVal=pW(vec3(sc*8.+an,an*.5)).x;
  float edgeFactor=smoothstep(0.,.5,dp)*smoothstep(1.,.5,dp);
  float lD=dp+(1.-dp)*u_liquid*tb;
  lD+=noiseVal*u_distort*.15*edgeFactor;
  float rB=clamp(1.-cv,0.,1.);
  float fl=ag.x+sl;
  fl+=noiseVal*sl*u_distort*edgeFactor;
  fl*=mix(1.,1.-dp*.5,u_contour);
  fl-=dp*u_contour*.8;
  float eI=smoothstep(0.,1.,lD)*smoothstep(1.,0.,lD);
  fl-=tb*sl*1.8*eI;
  float cA=cv*clamp(pow(sc.y,.12),.25,1.);
  fl*=.12+(1.05-lD)*cA;
  fl*=smoothstep(1.,.65,lD);
  float vA1=smoothstep(.08,.18,sc.y)*smoothstep(.38,.18,sc.y);
  float vA2=smoothstep(.08,.18,1.-sc.y)*smoothstep(.38,.18,1.-sc.y);
  fl+=vA1*.16+vA2*.025;
  fl*=.45+pow(sc.y,2.)*.55;
  fl*=u_scale;
  fl-=an;
  float rO=rB+cv*tb*.025;
  float vM1=smoothstep(-.12,.18,sc.y)*smoothstep(.48,.08,sc.y);
  float cM1=smoothstep(.35,.55,cv)*smoothstep(.95,.35,cv);
  rO+=vM1*cM1*4.5;
  rO-=sl;
  float bO=rB*1.25;
  float vM2=smoothstep(-.02,.35,sc.y)*smoothstep(.75,.08,sc.y);
  float cM2=smoothstep(.35,.55,cv)*smoothstep(.75,.35,cv);
  bO+=vM2*cM2*.9;
  bO-=lD*.18;
  rO*=u_refract*u_chroma;
  bO*=u_refract*u_chroma;
  float sf=u_blur;
  float rP=fract(fl+rO);
  float rC=mG(hi.r,lo.r,rP,sf+.018+u_refract*cv*.025,cv);
  float gP=fract(fl);
  float gC=mG(hi.g,lo.g,gP,sf+.008/max(.01,1.-sl),cv);
  float bP=fract(fl-bO);
  float bC=mG(hi.b,lo.b,bP,sf+.008,cv);
  vec3 col=vec3(rC,gC,bC);
  col=(col-.5)*u_contrast+.5;
  col=clamp(col,0.,1.);
  col=mix(col,1.-min(vec3(1.),(1.-col)/max(u_tint,vec3(.001))),length(u_tint-1.)*.5);
  col=clamp(col,0.,1.);
  oC=vec4(col*vs,vs);
}`

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m
    ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
    : [1, 1, 1]
}

/** Turn the emblem image into an alpha depth-map (capped size for perf). */
function processImage(img: HTMLImageElement): ImageData {
  const SIZE = 420 // fixed working resolution — emblem is simple, keeps it fast
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, SIZE, SIZE)

  const { data } = ctx.getImageData(0, 0, SIZE, SIZE)
  const size = SIZE * SIZE
  const alpha = new Float32Array(size)
  const shape = new Uint8Array(size)
  const boundary = new Uint8Array(size)

  for (let i = 0; i < size; i++) {
    const idx = i * 4
    const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3]
    const bg = (r > 250 && g > 250 && b > 250 && a === 255) || a < 5
    alpha[i] = bg ? 0 : a / 255
    shape[i] = alpha[i] > 0.1 ? 1 : 0
  }
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = y * SIZE + x
      if (!shape[idx]) continue
      if (
        x === 0 || x === SIZE - 1 || y === 0 || y === SIZE - 1 ||
        !shape[idx - 1] || !shape[idx + 1] || !shape[idx - SIZE] || !shape[idx + SIZE]
      )
        boundary[idx] = 1
    }
  }
  const u = new Float32Array(size)
  const ITER = 160
  const C = 0.01
  const omega = 1.85
  for (let it = 0; it < ITER; it++) {
    for (let y = 1; y < SIZE - 1; y++) {
      for (let x = 1; x < SIZE - 1; x++) {
        const idx = y * SIZE + x
        if (!shape[idx] || boundary[idx]) continue
        const sum =
          (shape[idx + 1] ? u[idx + 1] : 0) +
          (shape[idx - 1] ? u[idx - 1] : 0) +
          (shape[idx + SIZE] ? u[idx + SIZE] : 0) +
          (shape[idx - SIZE] ? u[idx - SIZE] : 0)
        u[idx] = omega * ((C + sum) / 4) + (1 - omega) * u[idx]
      }
    }
  }
  let max = 0
  for (let i = 0; i < size; i++) if (u[i] > max) max = u[i]
  if (max === 0) max = 1
  const out = ctx.createImageData(SIZE, SIZE)
  for (let i = 0; i < size; i++) {
    const px = i * 4
    const depth = u[i] / max
    const gray = Math.round(255 * (1 - depth * depth))
    out.data[px] = out.data[px + 1] = out.data[px + 2] = gray
    out.data[px + 3] = Math.round(alpha[i] * 255)
  }
  return out
}

export default function MetallicPaint({
  imageSrc = '/pitcherml-emblem.svg',
  seed = 42,
  scale = 4,
  refraction = 0.02,
  blur = 0.015,
  liquid = 0.85,
  speed = 0.35,
  brightness = 2.7,
  contrast = 1.05,
  angle = 0,
  fresnel = 1,
  lightColor = '#eaf7ff',
  darkColor = '#3c4d63',
  patternSharpness = 1,
  waveAmplitude = 1,
  noiseScale = 0.5,
  chromaticSpread = 2.6,
  distortion = 1,
  contour = 0.25,
  tintColor = '#1d8cf8',
}: Partial<{
  imageSrc: string
  seed: number
  scale: number
  refraction: number
  blur: number
  liquid: number
  speed: number
  brightness: number
  contrast: number
  angle: number
  fresnel: number
  lightColor: string
  darkColor: string
  patternSharpness: number
  waveAmplitude: number
  noiseScale: number
  chromaticSpread: number
  distortion: number
  contour: number
  tintColor: string
}>) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: true })
    if (!gl) return

    const compile = (src: string, type: number) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s))
        return null
      }
      return s
    }
    const vs = compile(VERT, gl.VERTEX_SHADER)
    const fs = compile(FRAG, gl.FRAGMENT_SHADER)
    if (!vs || !fs) return
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return

    const U: Record<string, WebGLUniformLocation | null> = {}
    const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS)
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(prog, i)
      if (info) U[info.name] = gl.getUniformLocation(prog, info.name)
    }
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    gl.useProgram(prog)
    const pos = gl.getAttribLocation(prog, 'a_position')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

    const side = Math.round(Math.min(2, window.devicePixelRatio || 1) * 320)
    canvas.width = side
    canvas.height = side
    gl.viewport(0, 0, side, side)

    // static uniforms
    const setF = (n: string, v: number) => gl.uniform1f(U[n], v)
    const setC = (n: string, hex: string) => {
      const c = hexToRgb(hex)
      gl.uniform3f(U[n], c[0], c[1], c[2])
    }
    setF('u_seed', seed)
    setF('u_scale', scale)
    setF('u_refract', refraction)
    setF('u_blur', blur)
    setF('u_liquid', liquid)
    setF('u_bright', brightness)
    setF('u_contrast', contrast)
    setF('u_angle', angle)
    setF('u_fresnel', fresnel)
    setF('u_sharp', patternSharpness)
    setF('u_wave', waveAmplitude)
    setF('u_noise', noiseScale)
    setF('u_chroma', chromaticSpread)
    setF('u_distort', distortion)
    setF('u_contour', contour)
    setC('u_lightColor', lightColor)
    setC('u_darkColor', darkColor)
    setC('u_tint', tintColor)

    let raf = 0
    let animTime = 0
    let last = performance.now()
    let textureReady = false
    let visible = true
    let destroyed = false
    const reduced = prefersReducedMotion()

    const drawOnce = () => {
      gl.uniform1f(U.u_time, animTime)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    const render = (t: number) => {
      animTime += (t - last) * speed
      last = t
      drawOnce()
      raf = requestAnimationFrame(render)
    }
    const start = () => {
      if (destroyed || !textureReady || raf) return
      if (reduced) {
        drawOnce()
        return
      }
      last = performance.now()
      raf = requestAnimationFrame(render)
    }
    const stop = () => {
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    }

    // The depth-map precompute (processImage) is expensive, so it is deferred
    // until the emblem is first on-screen — off-screen/reduced-motion users do
    // not pay the cost upfront (per the CLAUDE.md perf rules).
    let textureRequested = false
    const ensureTexture = () => {
      if (textureRequested || destroyed) return
      textureRequested = true
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (destroyed) return
        const data = processImage(img)
        const tex = gl.createTexture()
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, data.width, data.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data.data)
        gl.uniform1i(U.u_tex, 0)
        gl.uniform1f(U.u_imgRatio, data.width / data.height)
        gl.uniform1f(U.u_ratio, 1)
        textureReady = true
        if (visible) start()
      }
      img.src = imageSrc
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        if (visible) {
          ensureTexture() // process on first visibility, not on mount
          start()
        } else {
          stop()
        }
      },
      { threshold: 0 },
    )
    io.observe(canvas)

    return () => {
      destroyed = true
      stop()
      io.disconnect()
    }
  }, [
    imageSrc, seed, scale, refraction, blur, liquid, speed, brightness, contrast,
    angle, fresnel, lightColor, darkColor, patternSharpness, waveAmplitude,
    noiseScale, chromaticSpread, distortion, contour, tintColor,
  ])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', height: '100%', width: '100%', objectFit: 'contain' }}
    />
  )
}
