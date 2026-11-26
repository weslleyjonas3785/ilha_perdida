// Shaders do renderizador realista: PBR (GGX), materiais com detalhe procedural (metal escovado e
// desgastado, tecido, pele, couro, madeira, pedra, folhagem translúcida, terreno), sombras PCF,
// névoa de altura com dispersão solar, céu atmosférico e pós-processamento (SSAO, bloom, ACES, FXAA).
export const MAX_BONES = 32;
export const MAX_PL = 8;

const NOISE = `
float hash3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash3(i), hash3(i+vec3(1,0,0)), f.x), mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x), mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += vnoise3(p)*a; p = p*2.03 + 17.1; a *= 0.5; } return s; }
`;

export const COMMON_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_nrm;
layout(location=2) in vec4 a_col;
#ifdef SKINNED
layout(location=3) in vec4 a_joints;
layout(location=4) in vec4 a_weights;
uniform mat4 u_bones[${MAX_BONES}];
#endif
#ifdef INSTANCED
layout(location=5) in vec4 a_i0;
layout(location=6) in vec4 a_i1;
layout(location=7) in vec4 a_i2;
layout(location=8) in vec4 a_i3;
layout(location=9) in vec4 a_icol;
#endif
#ifdef TEX
layout(location=10) in vec2 a_uv;
out vec2 v_uv;
#endif
uniform mat4 u_model, u_viewProj, u_lightVP;
uniform float u_time, u_wind;
out vec3 v_wpos; out vec3 v_nrm; out vec4 v_col; out vec4 v_lpos; out vec3 v_opos;
void main(){
  vec4 p = vec4(a_pos,1.0); vec3 n = a_nrm;
#ifdef SKINNED
  mat4 sk = u_bones[int(a_joints.x)]*a_weights.x + u_bones[int(a_joints.y)]*a_weights.y
          + u_bones[int(a_joints.z)]*a_weights.z + u_bones[int(a_joints.w)]*a_weights.w;
  p = sk*p; n = mat3(sk)*n;
#endif
  mat4 M = u_model;
  vec4 col = a_col;
#ifdef INSTANCED
  M = M*mat4(a_i0,a_i1,a_i2,a_i3);
  col *= a_icol;
#endif
  vec4 w = M*p;
#ifdef WIND
  float h = max(a_pos.y, 0.0);
  float ph = u_time*1.6 + w.x*0.21 + w.z*0.17;
  float amp = u_wind * h * h * a_col.a;
  float flutter = sin(u_time*7.0 + a_pos.x*9.0 + a_pos.z*7.0) * 0.012 * u_wind * a_col.a;
  w.x += sin(ph)*amp*0.018 + sin(ph*2.7)*amp*0.006 + flutter;
  w.z += cos(ph*0.8)*amp*0.014 + flutter*0.7;
  w.y += flutter*0.5;
#endif
  v_wpos = w.xyz; v_nrm = mat3(M)*n; v_col = col; v_opos = a_pos;
#ifdef TEX
  v_uv = a_uv;
#endif
  v_lpos = u_lightVP * w;
  gl_Position = u_viewProj * w;
}`;

export const DEPTH_FS = `#version 300 es
precision mediump float;
#ifdef ALPHA
in vec2 v_uv; uniform sampler2D u_tex;
#endif
out vec4 o;
void main(){
#ifdef ALPHA
  if (texture(u_tex, v_uv).a < 0.5) discard;
#endif
  o = vec4(1.0); }`;

export const LIT_FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;
in vec3 v_wpos; in vec3 v_nrm; in vec4 v_col; in vec4 v_lpos; in vec3 v_opos;
#ifdef TEX
in vec2 v_uv; uniform sampler2D u_tex;
#endif
uniform sampler2DShadow u_shadow;
uniform vec3 u_sunDir, u_sunCol, u_ambSky, u_ambGround, u_fogCol, u_camPos, u_scatterCol;
uniform float u_fogMul;
uniform float u_fogDensity, u_fogHeight, u_alpha, u_emissive, u_shadowOn, u_time, u_wet, u_rim, u_detail;
uniform vec4 u_tint;
uniform vec4 u_plPos[${MAX_PL}]; uniform vec4 u_plCol[${MAX_PL}]; uniform int u_plCount;
out vec4 o;
${NOISE}
const float PI = 3.14159265;
// fator anti-serrilhado: some o detalhe quando a frequência excede o pixel
float aaF(float f){ return clamp(1.5 - length(fwidth(v_opos))*f*1.2, 0.0, 1.0); }
float shadowF(vec3 N, vec3 L){
  if(u_shadowOn < 0.5) return 1.0;
  vec3 sc = v_lpos.xyz / v_lpos.w * 0.5 + 0.5;
  if(sc.x<0.0||sc.x>1.0||sc.y<0.0||sc.y>1.0||sc.z>1.0) return 1.0;
  float bias = 0.0009 + 0.0022*(1.0-max(dot(N,L),0.0));
  float s = 0.0; vec2 ts = vec2(1.0/2048.0);
  const vec2 pd[12] = vec2[](vec2(-0.326,-0.406),vec2(-0.840,-0.074),vec2(-0.696,0.457),vec2(-0.203,0.621),vec2(0.962,-0.195),vec2(0.473,-0.480),
    vec2(0.519,0.767),vec2(0.185,-0.893),vec2(0.507,0.064),vec2(0.896,0.412),vec2(-0.322,-0.933),vec2(-0.792,-0.598));
  float ang = hash3(v_wpos*7.0)*6.2831; mat2 R = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
  for(int i=0;i<12;i++) s += texture(u_shadow, vec3(sc.xy + R*pd[i]*ts*1.8, sc.z - bias));
  s /= 12.0;
  vec2 e = smoothstep(0.0, 0.08, sc.xy) * smoothstep(1.0, 0.92, sc.xy);
  return mix(1.0, s, e.x*e.y);
}
// Bump por derivadas de tela (gradiente de superfície)
vec3 bump(vec3 N, float h, float k){
  vec3 dpdx = dFdx(v_wpos), dpdy = dFdy(v_wpos); float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpdy, N), r2 = cross(N, dpdx); float det = dot(dpdx, r1);
  if (abs(det) < 1e-8) return N;
  vec3 g = sign(det) * (dhx * r1 + dhy * r2);
  vec3 r = abs(det) * N - g * k; float rl = length(r); return rl > 1e-6 ? r / rl : N;
}
float D_GGX(float NoH, float a){ float a2 = max(a*a, 0.0025); float d = max(NoH*NoH*(a2-1.0)+1.0, 1e-3); return min(a2/(PI*d*d), 200.0); }
float V_Smith(float NoV, float NoL, float a){ float k = a*0.5; return 0.25/((NoV*(1.0-k)+k)*(NoL*(1.0-k)+k)); }
vec3 F_Schlick(vec3 f0, float VoH){ return f0 + (1.0-f0)*pow(clamp(1.0-VoH, 0.0, 1.0), 5.0); }
void main(){
  vec3 base = pow(v_col.rgb, vec3(2.2));
  float alphaTex = 1.0;
#ifdef TEX
  vec4 t = texture(u_tex, v_uv); base *= pow(t.rgb, vec3(2.2)); alphaTex = t.a;
#endif
#ifdef ALPHA
  if (alphaTex < 0.5) discard;
#endif
  base *= u_tint.rgb;
  vec3 N = v_nrm; { float nl0 = length(N); N = nl0 > 1e-6 ? N / nl0 : vec3(0.0, 1.0, 0.0); }
  if(!gl_FrontFacing) N = -N;
  // ---- material (codificado no alfa da cor do vértice) ----
  float specK = 1.0; float a = v_col.a; float rough = 0.78, metal = 0.0, glow = 0.0, sheen = 0.0, trans = 0.0, wrap = 0.0;
  vec3 P = v_opos; float dist = length(v_wpos - u_camPos); float det = u_detail * clamp(1.6 - dist/45.0, 0.0, 1.0);
#ifdef WIND
  // folhagem: translucidez e variação de cor
  if (a < 0.2) { // casca: fissuras verticais
    float g = vnoise3(P*vec3(14.0, 1.5, 14.0))*0.65 + vnoise3(P*vec3(50.0, 6.0, 50.0))*0.35*aaF(50.0);
    base *= 0.55 + 0.75*g; rough = 0.92; N = bump(N, g, 0.03*det);
  } else if (a < 0.45) { rough = 0.35; } // frutos, caules
  else { float fv = vnoise3(v_wpos*0.7); base *= 0.85 + 0.3*fv; rough = 0.7; trans = 0.7; wrap = 0.5; specK = 0.2; }
#elif defined(TERRAIN)
  {
    vec3 W = v_wpos; float slope = 1.0 - N.y;
    float n1 = fbm3(W*0.35), n2 = vnoise3(W*2.3), n3 = vnoise3(W*0.045);
    // camadas: grama/solo da cor do vértice + terra + pedra nas encostas
    vec3 soil = pow(vec3(0.33,0.26,0.19), vec3(2.2)) * (0.75+0.5*n2);
    vec3 col = base * (0.7 + 0.45*n1 + 0.15*n3);
    col = mix(col, soil, smoothstep(0.55, 0.8, n1 + 0.25*n3) * 0.55 * (1.0 - smoothstep(0.85, 1.0, base.g/(base.r+0.001)*0.5)));
    vec3 rockC = pow(vec3(0.43,0.41,0.38), vec3(2.2)) * (0.7 + 0.5*fbm3(W*vec3(0.6,2.4,0.6)));
    float rk = smoothstep(0.28, 0.46, slope + (n2-0.5)*0.12);
    base = mix(col, rockC, rk);
    float h = (n1*0.6 + n2*0.4) * mix(0.6, 2.2, rk) + vnoise3(W*9.0)*0.15;
    N = bump(N, h, 0.9 * det + 0.25);
    rough = mix(0.92, 0.75, rk);
  }
#else
  if (a < 0.05) { glow = 1.0; rough = 0.5; }
  else if (a > 0.45 && a < 0.55) { // metal: escovado, riscos, desgaste nas arestas, manchas
    metal = 1.0;
    float brush = mix(0.5, vnoise3(P*vec3(160.0, 9.0, 160.0)), aaF(160.0)); float scratch = smoothstep(0.82, 0.9, vnoise3(P*vec3(30.0, 120.0, 30.0))) * aaF(120.0);
    float grime = fbm3(P*6.0);
    float curv = clamp(length(fwidth(v_nrm)) * 3.0 - 0.15, 0.0, 1.0); // arestas (curvatura)
    rough = clamp(0.32 + brush*0.18 + grime*0.25 - scratch*0.15 - curv*0.1, 0.12, 0.85);
    base = mix(base, base*0.55, smoothstep(0.55, 0.85, grime)*0.6);           // sujeira nas cavidades
    base = mix(base, vec3(0.62,0.6,0.57), clamp(curv*0.55 + scratch*0.4, 0.0, 0.7)); // metal exposto
    N = bump(N, brush*0.15 + scratch*0.4 + grime*0.6, 0.004*det);
  }
  else if (a > 0.6 && a < 0.67) { // madeira / casca
    float g = vnoise3(P*vec3(9.0, 1.2, 9.0)) * 0.7 + vnoise3(P*vec3(40.0, 4.0, 40.0)) * 0.3;
    base *= 0.65 + 0.6*g; rough = 0.88; N = bump(N, g, 0.03*det);
  }
  else if (a > 0.67 && a < 0.73) { // couro
    float g = mix(0.5, fbm3(P*60.0), aaF(60.0)); base *= 0.8 + 0.35*g; rough = 0.62 - g*0.15; N = bump(N, g, 0.002*det);
  }
  else if (a > 0.73 && a < 0.79) { // pele: poros, translucidez quente
    float g = mix(0.5, vnoise3(P*200.0), aaF(200.0))*0.4 + vnoise3(P*25.0)*0.6; base *= 0.95 + 0.08*g; rough = 0.52 + g*0.12; wrap = 0.45; N = bump(N, g, 0.0012*det);
  }
  else if (a > 0.8 && a < 0.86) { // tecido: trama, fiapos, brilho de borda
    float wx = sin(P.x*300.0 + P.y*300.0), wy = sin(P.x*300.0 - P.y*300.0); float weave = 0.5 + 0.25*(wx*wy)*aaF(300.0);
    float fuzz = fbm3(P*14.0); base *= 0.86 + 0.2*fuzz + 0.06*weave; rough = 0.95; sheen = 0.35; N = bump(N, weave*0.4 + fuzz*0.6, 0.004*det);
  }
  else if (a > 0.89 && a < 0.97) { // pedra / concreto: ruído multi-oitava, manchas
    float g = fbm3(P*3.0), g2 = mix(0.5, vnoise3(P*25.0), aaF(25.0)); base *= 0.65 + 0.55*g + 0.15*g2; base = mix(base, base*vec3(0.75,0.8,0.7), smoothstep(0.6, 0.8, fbm3(P*0.9))*0.5);
    rough = 0.9; N = bump(N, g*0.7 + g2*0.3, 0.06*det);
  }
  else { float g = vnoise3(P*30.0); base *= 0.92 + 0.14*g; rough = 0.7; N = bump(N, g, 0.003*det); }
#endif
  // superfícies molhadas pela chuva
  float wet = u_wet * smoothstep(0.2, 0.8, N.y) * (1.0 - metal);
  base *= 1.0 - 0.35*wet; rough = mix(rough, 0.18, wet*0.8);
  vec3 V = normalize(u_camPos - v_wpos);
  vec3 L = u_sunDir;
  float NoL0 = dot(N, L), NoL = max(NoL0, 0.0), NoV = max(dot(N, V), 1e-3);
  vec3 H = normalize(L + V); float NoH = max(dot(N, H), 0.0), VoH = max(dot(V, H), 0.0);
  float ar = rough*rough;
  vec3 f0 = mix(vec3(0.04), base, metal);
  vec3 F = F_Schlick(f0, VoH);
  vec3 spec = D_GGX(NoH, ar) * V_Smith(NoV, NoL, ar) * F * specK;
  vec3 kd = (1.0 - F) * (1.0 - metal);
  float diffL = mix(NoL, clamp((NoL0 + wrap)/(1.0 + wrap), 0.0, 1.0), wrap > 0.0 ? 1.0 : 0.0);
  float sh = shadowF(N, L);
  vec3 col = (kd * base / PI * PI * diffL + spec * NoL) * u_sunCol * sh;
  // translucidez (folhas contra o sol) e subsuperfície (pele)
  col += base * u_sunCol * trans * pow(max(dot(-V, L), 0.0), 3.0) * 0.9 * (0.4 + 0.6*sh);
  col += wrap * base * vec3(0.55, 0.12, 0.06) * u_sunCol * max(0.0, -NoL0) * 0.12 * sh;
  // ambiente: irradiância hemisférica + reflexo especular aproximado do céu
  vec3 hemi = mix(u_ambGround, u_ambSky, N.y*0.5+0.5);
  vec3 R = reflect(-V, N);
  vec3 envC = mix(u_ambGround*0.8, u_ambSky*1.5, smoothstep(-0.2, 0.6, R.y));
  vec3 Fa = f0 + (max(vec3(1.0 - rough), f0) - f0) * pow(1.0 - NoV, 5.0);
  float occ = mix(0.55, 1.0, smoothstep(-0.6, 0.6, N.y)); // oclusão direcional simples
  col += (kd * base * hemi + Fa * envC * (1.0 - rough*0.7) * specK) * occ;
  col += sheen * pow(1.0 - NoV, 3.0) * (u_ambSky + u_sunCol*0.2) * base * 2.0;
  col += u_rim * pow(1.0 - NoV, 3.0) * (u_ambSky*0.6 + u_sunCol*0.1) * (0.3 + 0.7*base);
  // luzes pontuais (fogueiras, tochas, explosões)
  for(int i=0;i<${MAX_PL};i++){ if(i>=u_plCount) break;
    vec3 Lp = u_plPos[i].xyz - v_wpos; float d = max(length(Lp), 1e-3); Lp/=d;
    float att = clamp(1.0 - d/u_plPos[i].w, 0.0, 1.0); att*=att;
    float nl = max(dot(N,Lp),0.0); vec3 hv = Lp + V; vec3 Hp = hv / max(length(hv), 1e-4);
    vec3 sp = D_GGX(clamp(dot(N,Hp),0.0,1.0), max(ar, 0.04)) * V_Smith(NoV, nl, ar) * F_Schlick(f0, max(dot(V,Hp),0.0));
    col += (kd*base*(nl*0.9+0.1) + sp*nl) * u_plCol[i].rgb * att;
  }
  col += base * glow * 6.0 + base * u_emissive * 4.0;
  // névoa exponencial de altura com dispersão na direção do sol
  vec3 ray = v_wpos - u_camPos;
  float fh = u_fogHeight;
  float k = max(abs(ray.y), 0.001);
  float hf = exp(-max(u_camPos.y - fh, 0.0)*0.03) * (1.0 - exp(-k*0.03)) / (k*0.03);
  float fogAmt = 1.0 - exp(-dist * u_fogDensity * mix(1.0, hf, 0.6));
  float sunAmt = pow(max(dot(normalize(ray), u_sunDir), 0.0), 8.0);
  vec3 fogC = u_fogCol + u_scatterCol * sunAmt;
  col = mix(col, fogC, clamp(fogAmt * u_fogMul, 0.0, 1.0));
  // celular: o buffer HDR é de meia precisão (máx. ~65000); valor infinito ou inválido vira mancha preta — limita e troca pela névoa
  if (!(col.r == col.r && col.g == col.g && col.b == col.b) || any(isinf(col))) col = fogC;
  col = clamp(col, 0.0, 3.0e4);
  o = vec4(col, u_alpha * u_tint.a);
}`;

export const SKY_VS = `#version 300 es
layout(location=0) in vec2 a_p; out vec2 v_p; void main(){ v_p=a_p; gl_Position=vec4(a_p,0.9999,1.0); }`;
export const SKY_FS = `#version 300 es
precision highp float; in vec2 v_p; out vec4 o;
uniform mat4 u_invVP; uniform vec3 u_camPos, u_sunDir, u_moonDir, u_zenith, u_horizon, u_fogCol, u_scatterCol;
uniform float u_night, u_cloud, u_time, u_fogAmt, u_flash;
float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<6;i++){ s+=vn(p)*a; p=p*2.03+1.7; a*=0.5;} return s; }
void main(){
  vec4 w = u_invVP * vec4(v_p, 1.0, 1.0); vec3 d = normalize(w.xyz/w.w - u_camPos);
  float y = max(d.y, 0.0);
  vec3 zen = pow(u_zenith, vec3(2.2)), hor = pow(u_horizon, vec3(2.2));
  vec3 col = mix(hor, zen, pow(y, 0.45));
  float sd = max(dot(d, u_sunDir), 0.0);
  // dispersão de Mie (halo) e disco solar
  col += pow(u_scatterCol, vec3(1.0)) * (pow(sd, 6.0)*0.5 + pow(sd, 64.0)*1.5) * (1.0-u_night) * (1.0-u_cloud*0.6);
  col += vec3(1.0,0.92,0.8) * smoothstep(0.9994, 0.9997, sd) * 40.0 * (1.0-u_cloud*0.9);
  float md = max(dot(d, u_moonDir), 0.0);
  col += vec3(0.8,0.85,1.0) * smoothstep(0.9991, 0.9994, md) * 3.0 * u_night * (1.0-u_cloud*0.8);
  col += vec3(0.25,0.3,0.45) * pow(md, 40.0) * 0.15 * u_night;
  if(u_night > 0.01 && d.y > 0.0){
    vec3 sp = floor(d*260.0); float s = hash(sp);
    col += vec3(step(0.9972, s) * u_night * (1.0-u_cloud) * (0.5+0.5*sin(u_time*3.0+s*50.0))) * 0.8;
  }
  if(d.y > 0.0){
    vec2 cp = d.xz/(d.y+0.1)*1.1 + vec2(u_time*0.008, u_time*0.003);
    float c = fbm(cp); float cov = mix(0.6, 0.28, u_cloud);
    float cm = smoothstep(cov, cov+0.3, c) * smoothstep(0.0, 0.18, d.y);
    float thick = smoothstep(cov, cov+0.6, fbm(cp*1.7 + 3.0));
    vec3 lit = mix(vec3(1.0,0.97,0.93), vec3(0.42,0.44,0.48), u_cloud) * (1.0 - thick*0.45);
    lit += pow(u_scatterCol, vec3(1.0)) * pow(sd, 3.0) * 0.6;
    lit *= mix(1.0, 0.06, u_night);
    col = mix(col, pow(lit, vec3(2.2)) * 1.4, cm*0.92);
  }
  vec3 fogL = pow(u_fogCol, vec3(1.0));
  col = mix(col, fogL, clamp(u_fogAmt*(1.0-y*0.5),0.0,1.0));
  col = mix(col, fogL, smoothstep(0.06, -0.12, d.y));
  col += vec3(0.6,0.65,0.8)*u_flash*2.0;
  if (!(col.r == col.r && col.g == col.g && col.b == col.b) || any(isinf(col))) col = fogL; col = clamp(col, 0.0, 3.0e4);
  o = vec4(col, 1.0);
}`;

export const WATER_VS = `#version 300 es
precision highp float; layout(location=0) in vec3 a_pos;
uniform mat4 u_viewProj; uniform float u_time; uniform vec2 u_off; out vec3 v_wpos;
void main(){ vec3 p=a_pos; p.xz += u_off; p.y += sin(p.x*0.12+u_time*1.1)*0.06 + cos(p.z*0.15+u_time*0.9)*0.06; v_wpos=p; gl_Position=u_viewProj*vec4(p,1.0); }`;
export const WATER_FS = `#version 300 es
precision highp float; in vec3 v_wpos; out vec4 o;
uniform vec3 u_camPos, u_sunDir, u_sunCol, u_zenith, u_horizon, u_fogCol, u_ambSky; uniform float u_time, u_fogDensity, u_night, u_rain;
uniform sampler2D u_height; uniform vec4 u_hInfo;
float wave(vec2 p, vec2 dir, float f, float s){ return sin(dot(p,dir)*f + u_time*s); }
void main(){
  vec2 p = v_wpos.xz;
  vec3 n = vec3(0.0,1.0,0.0);
  n.x += wave(p, vec2(0.8,0.6), 0.9, 1.7)*0.05 + wave(p, vec2(-0.3,0.95), 2.3, 2.9)*0.03 + wave(p, vec2(0.6,-0.8), 5.1, 4.1)*0.02*(1.0+u_rain*3.0) + wave(p, vec2(0.95,0.3), 11.0, 6.0)*0.012;
  n.z += wave(p, vec2(0.2,-0.98), 1.1, 1.3)*0.05 + wave(p, vec2(0.9,0.4), 2.9, 3.3)*0.03 + wave(p, vec2(-0.7,-0.7), 6.3, 5.0)*0.02*(1.0+u_rain*3.0) + wave(p, vec2(-0.4,0.9), 13.0, 7.0)*0.012;
  n = normalize(n);
  vec2 uv = (p - u_hInfo.xy)/u_hInfo.z;
  float depth = clamp(-texture(u_height, uv).r, 0.0, 30.0);
  vec3 V = normalize(u_camPos - v_wpos);
  float fres = 0.02 + 0.98*pow(1.0 - max(dot(n, V), 0.0), 5.0);
  vec3 sky = pow(mix(u_horizon, u_zenith, 0.4), vec3(2.2));
  vec3 shallow = pow(vec3(0.12,0.36,0.34), vec3(2.2)), deep = pow(vec3(0.02,0.08,0.12), vec3(2.2));
  vec3 wc = mix(shallow, deep, smoothstep(0.0, 8.0, depth)) * (u_ambSky + u_sunCol*0.25*max(u_sunDir.y,0.0));
  vec3 col = mix(wc, sky, fres);
  vec3 H = normalize(u_sunDir + V);
  col += u_sunCol * pow(max(dot(n,H),0.0), 400.0) * 12.0 + u_sunCol * pow(max(dot(n,H),0.0), 60.0) * 0.4;
  float foam = smoothstep(0.6, 0.0, depth) * (0.5+0.5*sin(depth*14.0 - u_time*2.0 + p.x*0.3));
  col = mix(col, vec3(0.75)*(u_ambSky+u_sunCol*0.4), foam*0.4);
  float a = mix(0.45, 0.94, smoothstep(0.0, 4.0, depth));
  float dist = length(v_wpos - u_camPos);
  float fog = 1.0 - exp(-dist*u_fogDensity);
  col = mix(col, u_fogCol, clamp(fog,0.0,1.0));
  if (!(col.r == col.r && col.g == col.g && col.b == col.b) || any(isinf(col))) col = vec3(0.3, 0.4, 0.45); col = clamp(col, 0.0, 3.0e4);
  o = vec4(col, max(a, fog));
}`;

export const PART_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_ip;
layout(location=2) in vec4 a_icol;
layout(location=3) in float a_stretch;
uniform mat4 u_viewProj; uniform vec3 u_camRight, u_camUp;
out vec4 v_col; out vec2 v_c;
void main(){
  vec3 up = a_stretch > 0.0 ? vec3(0.0,1.0,0.0)*a_stretch : u_camUp;
  vec3 w = a_ip.xyz + (u_camRight*a_corner.x + up*a_corner.y) * a_ip.w;
  v_col = a_icol; v_c = a_corner;
  gl_Position = u_viewProj*vec4(w,1.0);
}`;
export const PART_FS = `#version 300 es
precision mediump float; in vec4 v_col; in vec2 v_c; out vec4 o;
void main(){ float d = length(v_c); float a = smoothstep(1.0, 0.25, d); vec3 c = v_col.rgb; o = vec4(c*c, v_col.a*a); }`;

// ---------------- pós-processamento ----------------
export const FS_VS = `#version 300 es
layout(location=0) in vec2 a_p; out vec2 v_uv; void main(){ v_uv = a_p*0.5+0.5; gl_Position=vec4(a_p,0.0,1.0); }`;
export const SSAO_FS = `#version 300 es
precision highp float; in vec2 v_uv; out vec4 o;
uniform sampler2D u_depth; uniform mat4 u_invProj; uniform vec2 u_res; uniform float u_proj11;
vec3 viewPos(vec2 uv){ float d = texture(u_depth, uv).r; vec4 p = u_invProj * vec4(uv*2.0-1.0, d*2.0-1.0, 1.0); return p.xyz/p.w; }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
void main(){
  float d0 = texture(u_depth, v_uv).r; if (d0 >= 0.9999) { o = vec4(1.0); return; }
  vec3 P = viewPos(v_uv);
  vec3 N = normalize(cross(dFdx(P), dFdy(P)));
  float radius = 0.55; float rpx = radius * u_proj11 / max(-P.z, 0.1) * 0.5; // em UV
  float ao = 0.0; float ang = hash(v_uv*u_res)*6.2831;
  for (int i = 0; i < 12; i++) {
    float t = (float(i)+0.5)/12.0; float a = ang + t*6.2831*3.0; vec2 off = vec2(cos(a), sin(a)) * rpx * t;
    vec3 S = viewPos(v_uv + off); vec3 D = S - P; float l = length(D);
    ao += max(dot(N, D/l) - 0.08, 0.0) * smoothstep(radius*2.0, radius*0.3, l);
  }
  ao = clamp(1.0 - ao/12.0*1.6, 0.0, 1.0);
  o = vec4(ao, ao, ao, 1.0);
}`;
export const BRIGHT_FS = `#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_tex; uniform float u_exposure;
void main(){ vec3 c = texture(u_tex, v_uv).rgb * u_exposure; float l = dot(c, vec3(0.2126,0.7152,0.0722)); o = vec4(c * smoothstep(1.0, 2.5, l), 1.0); }`;
export const BLUR_FS = `#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_tex; uniform vec2 u_dir;
void main(){ vec3 s = texture(u_tex, v_uv).rgb*0.227;
  s += (texture(u_tex, v_uv + u_dir*1.38).rgb + texture(u_tex, v_uv - u_dir*1.38).rgb)*0.316;
  s += (texture(u_tex, v_uv + u_dir*3.23).rgb + texture(u_tex, v_uv - u_dir*3.23).rgb)*0.07; o = vec4(s, 1.0); }`;
export const COMPOSITE_FS = `#version 300 es
precision highp float; in vec2 v_uv; out vec4 o;
uniform sampler2D u_hdr, u_ao, u_bloom; uniform float u_exposure, u_aoOn, u_bloomOn, u_time, u_sat, u_vig; uniform vec4 u_overlay; uniform vec2 u_texel;
vec3 aces(vec3 x){ return clamp(x*(2.51*x+0.03)/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec3 c = texture(u_hdr, v_uv).rgb;
  // pixel inválido (NaN/infinito): usa a média dos vizinhos válidos em vez de deixar um ponto preto
  if (!(c.r == c.r && c.g == c.g && c.b == c.b) || any(isinf(c)) || c.r < 0.0 || c.g < 0.0 || c.b < 0.0) { vec3 acc = vec3(0.0); float n = 0.0;
    for (int i = 0; i < 4; i++) { vec2 off = vec2(i == 0 ? 1.0 : i == 1 ? -1.0 : 0.0, i == 2 ? 1.0 : i == 3 ? -1.0 : 0.0) * u_texel; vec3 q = texture(u_hdr, v_uv + off).rgb; if (q.r == q.r && q.g == q.g && q.b == q.b && !any(isinf(q)) && q.r >= 0.0 && q.g >= 0.0 && q.b >= 0.0) { acc += q; n += 1.0; } }
    c = n > 0.0 ? acc / n : vec3(0.0); }
  c = min(c, vec3(3.0e4));
  if (u_aoOn > 0.5) { float ao = 0.0; for (int x=-1;x<=1;x++) for (int y=-1;y<=1;y++) ao += texture(u_ao, v_uv + vec2(x,y)*u_texel*2.0).r; ao /= 9.0; c *= mix(1.0, ao, 0.9); }
  if (u_bloomOn > 0.5) c += texture(u_bloom, v_uv).rgb * 0.35;
  c = mix(c, u_overlay.rgb * dot(c, vec3(0.3)), u_overlay.a);
  c *= u_exposure;
  c = aces(c);
  // gradação de cor: leve dessaturação, sombras frias e luzes quentes (atmosfera de sobrevivência)
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  c = mix(vec3(l), c, u_sat);
  c *= mix(vec3(0.94,0.98,1.04), vec3(1.04,1.0,0.95), smoothstep(0.1, 0.8, l));
  c = pow(c, vec3(1.0/2.2));
  vec2 q = v_uv - 0.5; c *= 1.0 - dot(q, q) * u_vig;
  c += (hash(v_uv*1000.0 + u_time) - 0.5) * 0.018;
  o = vec4(c, dot(c, vec3(0.299,0.587,0.114)));
}`;
export const FXAA_FS = `#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_tex; uniform vec2 u_texel;
void main(){
  vec3 rgbNW = texture(u_tex, v_uv + vec2(-1,-1)*u_texel).rgb, rgbNE = texture(u_tex, v_uv + vec2(1,-1)*u_texel).rgb;
  vec3 rgbSW = texture(u_tex, v_uv + vec2(-1,1)*u_texel).rgb, rgbSE = texture(u_tex, v_uv + vec2(1,1)*u_texel).rgb, rgbM = texture(u_tex, v_uv).rgb;
  vec3 lw = vec3(0.299,0.587,0.114); float lNW = dot(rgbNW,lw), lNE = dot(rgbNE,lw), lSW = dot(rgbSW,lw), lSE = dot(rgbSE,lw), lM = dot(rgbM,lw);
  float lMin = min(lM, min(min(lNW,lNE), min(lSW,lSE))), lMax = max(lM, max(max(lNW,lNE), max(lSW,lSE)));
  vec2 dir = vec2(-((lNW+lNE)-(lSW+lSE)), ((lNW+lSW)-(lNE+lSE)));
  float red = max((lNW+lNE+lSW+lSE)*0.03125, 1.0/128.0); float rcp = 1.0/(min(abs(dir.x),abs(dir.y))+red);
  dir = clamp(dir*rcp, -8.0, 8.0)*u_texel;
  vec3 A = 0.5*(texture(u_tex, v_uv + dir*(1.0/3.0-0.5)).rgb + texture(u_tex, v_uv + dir*(2.0/3.0-0.5)).rgb);
  vec3 Bc = A*0.5 + 0.25*(texture(u_tex, v_uv + dir*-0.5).rgb + texture(u_tex, v_uv + dir*0.5).rgb);
  float lB = dot(Bc, lw); o = vec4((lB < lMin || lB > lMax) ? A : Bc, 1.0);
}`;
