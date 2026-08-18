import { useEffect, useRef } from 'react';

/**
 * Flowing "silk" WebGL2 background. Self-contained -- raw canvas + hand
 * written GLSL, no extra dependency. Perf: DPR capped at 1.5, the RAF loop
 * pauses via IntersectionObserver when the canvas scrolls off-screen, and
 * prefers-reduced-motion renders a single static frame instead of animating.
 */

const VERT = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 vUv;
void main(){ vUv = a_position * .5 + .5; gl_Position = vec4(a_position, 0., 1.); }`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform float uTime;
uniform vec3 uColor;
uniform float uSpeed;
uniform float uScale;
uniform float uRotation;
uniform float uNoiseIntensity;
const float e = 2.71828182845904523536;
float noise(vec2 texCoord) {
  float G = e;
  vec2 r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}
vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle); float s = sin(angle);
  mat2 rot = mat2(c, -s, s, c);
  return rot * uv;
}
void main() {
  float rnd = noise(gl_FragCoord.xy);
  vec2 uv = rotateUvs(vUv * uScale, uRotation);
  vec2 tex = uv * uScale;
  float tOffset = uSpeed * uTime;
  tex.y += 0.03 * sin(8.0 * tex.x - tOffset);
  float pattern = 0.6 + 0.4 * sin(5.0 * (tex.x + tex.y +
    cos(3.0 * tex.x + 5.0 * tex.y) + 0.02 * tOffset) +
    sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));
  vec4 col = vec4(uColor, 1.0) * vec4(pattern) - rnd / 15.0 * uNoiseIntensity;
  col.a = 1.0;
  outColor = col;
}`;

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255]
    : [0.5, 0.5, 0.5];
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function Silk({
  speed = 1.1,
  scale = 1,
  color = '#0f2a4a', // deep PitcherML-blue tint, kept dark so text stays legible over it
  noiseIntensity = 1.2,
  rotation = 0.18,
}: {
  speed?: number;
  scale?: number;
  color?: string;
  noiseIntensity?: number;
  rotation?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) return;

    const compile = (src: string, type: number) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = compile(VERT, gl.VERTEX_SHADER);
    const fs = compile(FRAG, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const u = {
      time: gl.getUniformLocation(prog, 'uTime'),
      color: gl.getUniformLocation(prog, 'uColor'),
      speed: gl.getUniformLocation(prog, 'uSpeed'),
      scale: gl.getUniformLocation(prog, 'uScale'),
      rotation: gl.getUniformLocation(prog, 'uRotation'),
      noise: gl.getUniformLocation(prog, 'uNoiseIntensity'),
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const c = hexToRgb(color);
    const reduced = prefersReducedMotion();
    const t0 = performance.now();
    let raf = 0;

    const draw = (t: number) => {
      gl.uniform1f(u.time, t);
      gl.uniform3f(u.color, c[0], c[1], c[2]);
      gl.uniform1f(u.speed, speed);
      gl.uniform1f(u.scale, scale);
      gl.uniform1f(u.rotation, rotation);
      gl.uniform1f(u.noise, noiseIntensity);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const render = () => {
      draw((performance.now() - t0) / 1000);
      raf = requestAnimationFrame(render);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && !document.hidden;
        if (reduced) {
          draw(0);
          return;
        }
        if (visible && !raf) raf = requestAnimationFrame(render);
        if (!visible && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    // Also react directly to the tab itself going to/from the background,
    // not just scroll-based intersection -- an intersecting-but-backgrounded
    // tab would otherwise keep this animation (and the GPU memory it holds)
    // alive the whole time it's not being looked at.
    const onVisibility = () => {
      const canvasVisible = canvas.getBoundingClientRect().bottom > 0;
      if (document.hidden || !canvasVisible) {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      } else if (!raf && !reduced) {
        raf = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    if (reduced) draw(0);
    else raf = requestAnimationFrame(render);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [speed, scale, color, noiseIntensity, rotation]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />;
}
