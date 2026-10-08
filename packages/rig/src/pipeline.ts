import * as THREE from 'three';
import { G } from './npr';

const POST_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// Nét mực: Laplacian của 1/độ sâu — chỗ độ sâu gãy (mép, nếp gấp) thì tối đi. Thêm hạt giấy và tối góc.
const POST_FRAG = /* glsl */ `
uniform sampler2D tColor, tDepth;
uniform vec2 uRes;
uniform float uNear, uFar, uOutline, uThick, uPixel;
varying vec2 vUv;
float invz(float d){ float z = d * 2.0 - 1.0; return (uFar + uNear - z * (uFar - uNear)) / (2.0 * uNear * uFar); }
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
void main(){
  vec2 px = uThick / uRes;
  vec3 col = texture2D(tColor, vUv).rgb;
  float w0 = invz(texture2D(tDepth, vUv).r);
  float wl = invz(texture2D(tDepth, vUv - vec2(px.x, 0.0)).r);
  float wr = invz(texture2D(tDepth, vUv + vec2(px.x, 0.0)).r);
  float wu = invz(texture2D(tDepth, vUv + vec2(0.0, px.y)).r);
  float wd = invz(texture2D(tDepth, vUv - vec2(0.0, px.y)).r);
  float lap = (4.0 * w0 - wl - wr - wu - wd) / w0;
  float edge = smoothstep(0.0025, 0.01, lap) * uOutline;
  col = mix(col, col * vec3(0.2, 0.18, 0.26), edge * 0.92);
  vec2 fc = vUv * uRes;
  if (uPixel > 0.5) col = floor(col * 14.0 + 0.5 + bayer4(fc) - 0.5) / 14.0;
  else col *= 0.975 + 0.05 * h12(floor(gl_FragCoord.xy));
  float v = length(vUv - 0.5) * 1.35;
  col *= mix(1.0, 0.86, smoothstep(0.45, 1.05, v));
  gl_FragColor = vec4(col, 1.0);
}`;

// Khử răng cưa bằng siêu lấy mẫu: vẽ cả cảnh lẫn nét mực ở `ss` lần mỗi chiều rồi thu về khung.
// FXAA làm nhoè nét mực mảnh; MSAA không resolve độ sâu nên nét mực dò từ độ sâu mất hẳn.
export const AA = { off: 1, 'ss1.5': 1.5, ss2: 2 } as const;
export type AaMode = keyof typeof AA;

export interface PipelineOptions {
  /** Hộp ống kính bóng đổ: nửa cạnh và tâm (three). Phải ôm hết vùng có bóng trong khung. */
  shadow?: { half: number; center: THREE.Vector3 };
  shadowSize?: number;
}

export interface Pipeline {
  /** Cỡ khung CSS px; `pixel` vẽ ở ~360 px cạnh ngắn rồi phóng lên, bỏ `aa`. */
  setSize(w: number, h: number, o?: { aa?: AaMode; pixel?: boolean }): void;
  /** Một khung: bóng đổ, cảnh, nét mực. `G.uLightDir` phải đã đặt cho khung này. */
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, o?: { outline?: boolean }): void;
}

/**
 * Pipeline vẽ trên một `WebGLRenderer`: bóng đổ tự render độ sâu từ ống kính trực giao của đèn, cảnh vào
 * render target có độ sâu, rồi lượt hậu kỳ dò nét mực từ độ sâu. Vật `userData.noShadow` và vỏ ngược (`BackSide`) không đổ bóng.
 */
export function createPipeline(renderer: THREE.WebGLRenderer, { shadow = { half: 11, center: new THREE.Vector3() }, shadowSize = 2048 }: PipelineOptions = {}): Pipeline {
  const SM = shadowSize;
  const shadowRT = new THREE.WebGLRenderTarget(SM, SM, { depthTexture: new THREE.DepthTexture(SM, SM) });
  const SH = shadow;
  const shadowCam = new THREE.OrthographicCamera(-SH.half, SH.half, SH.half, -SH.half, 1, 30 + SH.half * 2.5);
  const depthMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });
  G.uShadowMap.value = shadowRT.depthTexture;
  G.uShadowTexel.value = 1 / SM;
  const bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);

  const mainRT = new THREE.WebGLRenderTarget(4, 4, { depthTexture: new THREE.DepthTexture(4, 4) });
  const inkRT = new THREE.WebGLRenderTarget(4, 4);
  const copyMat = new THREE.ShaderMaterial({
    vertexShader: POST_VERT,
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }',
    uniforms: { tDiffuse: { value: inkRT.texture } },
    depthTest: false,
    depthWrite: false,
  });
  const postMat = new THREE.ShaderMaterial({
    vertexShader: POST_VERT,
    fragmentShader: POST_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tColor: { value: mainRT.texture },
      tDepth: { value: mainRT.depthTexture },
      uRes: { value: new THREE.Vector2() },
      uNear: { value: 0 },
      uFar: { value: 0 },
      uOutline: { value: 1 },
      uThick: { value: 1 },
      uPixel: { value: 0 },
    },
  });
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat);
  quad.frustumCulled = false;
  postScene.add(quad);

  return {
    setSize(w, h, { aa = 'ss2', pixel = false } = {}) {
      renderer.setSize(w, h);
      const dpr = renderer.getPixelRatio();
      const ss = pixel ? 1 : AA[aa];
      const k = pixel ? 360 / Math.min(w, h) : dpr * ss;
      const rw = Math.max(1, Math.round(w * k)), rh = Math.max(1, Math.round(h * k));
      mainRT.setSize(rw, rh);
      inkRT.setSize(rw, rh);
      quad.material = ss === 1 ? postMat : copyMat;
      const filt = pixel ? THREE.NearestFilter : THREE.LinearFilter;
      mainRT.texture.minFilter = mainRT.texture.magFilter = filt;
      mainRT.texture.needsUpdate = true;
      postMat.uniforms.uRes.value.set(rw, rh);
      postMat.uniforms.uThick.value = pixel ? 1 : Math.max(1, dpr * ss * 1.25);
      postMat.uniforms.uPixel.value = pixel ? 1 : 0;
    },

    render(scene, camera, { outline = true } = {}) {
      scene.updateMatrixWorld();
      const ld = G.uLightDir.value;
      shadowCam.position.copy(ld).multiplyScalar(30).add(SH.center);
      shadowCam.lookAt(SH.center);
      shadowCam.updateMatrixWorld();
      G.uShadowMatrix.value.copy(bias).multiply(shadowCam.projectionMatrix).multiply(shadowCam.matrixWorldInverse);
      const hidden: THREE.Object3D[] = [];
      scene.traverse((o) => {
        const hull = (o as THREE.Mesh).isMesh && ((o as THREE.Mesh).material as THREE.Material).side === THREE.BackSide;
        if ((o.userData.noShadow || hull) && o.visible) hidden.push(o);
      });
      for (const o of hidden) o.visible = false;
      scene.overrideMaterial = depthMat;
      renderer.setRenderTarget(shadowRT);
      renderer.clear();
      renderer.render(scene, shadowCam);
      scene.overrideMaterial = null;
      for (const o of hidden) o.visible = true;

      postMat.uniforms.uNear.value = camera.near;
      postMat.uniforms.uFar.value = camera.far;
      renderer.setRenderTarget(mainRT);
      renderer.render(scene, camera);
      postMat.uniforms.uOutline.value = outline ? 1 : 0;
      if (quad.material !== postMat) {
        const fin = quad.material;
        quad.material = postMat;
        renderer.setRenderTarget(inkRT);
        renderer.render(postScene, postCam);
        quad.material = fin;
      }
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    },
  };
}
