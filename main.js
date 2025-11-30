/* main.js
   Protótipo completo:
   - Canvas 2D: desenhar/editar pontos de controle
   - Curvas: De Casteljau (Bézier) e B-Spline (De Boor-like sampler)
   - Revolução: gerar malha 3D (vértices, normais, índices)
   - Three.js viewer com OrbitControls
   - Exportadores: JSON, OBJ (ASCII), STL (ASCII)
   - Controles UI integrados
*/

/* --------------------------
   Setup DOM e elementos
   -------------------------- */
const canvas = document.getElementById('canvas2d');
const ctx = canvas.getContext('2d');

const curveTypeSel = document.getElementById('curveType');
const bezierMenu = document.getElementById('bezierMenu');
const splineMenu = document.getElementById('splineMenu');
const weightSlider = document.getElementById('weightSlider');
const weightValue = document.getElementById('weightValue');
const splineDegreeInput = document.getElementById('splineDegree');
const splineStepInput = document.getElementById('splineStep');
const stepValue = document.getElementById('stepValue');

const axisSel = document.getElementById('axis');
const angleInput = document.getElementById('angle');
const divisionsInput = document.getElementById('divisions');

const addPointBtn = document.getElementById('addPointBtn');
const clearBtn = document.getElementById('clearBtn');
const surfaceBtn = document.getElementById('surfaceBtn');
const clearSurfaceBtn = document.getElementById('clearSurfaceBtn');

const exportJSONBtn = document.getElementById('exportJSON');
const exportOBJBtn = document.getElementById('exportOBJ');
const exportSTLBtn = document.getElementById('exportSTL');

const renderModeSel = document.getElementById('renderMode');

const viewerDiv = document.getElementById('viewer3d');

/* --------------------------
   Estado da aplicação
   -------------------------- */
let points = []; // {x,y,weight}
let selectedIdx = -1;
let dragging = false;
let addMode = false;

// 3D viewer state
let three = {
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  mesh: null
};

/* --------------------------
   Ajuste do canvas ao container
   -------------------------- */
function fitCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.floor(rect.width - 20);
  canvas.height = Math.floor(rect.height - 20);
  draw();
}
window.addEventListener('resize', fitCanvas);
setTimeout(fitCanvas, 50);

/* --------------------------
   UI: toggle menus
   -------------------------- */
curveTypeSel.addEventListener('change', () => {
  const v = curveTypeSel.value;
  bezierMenu.classList.toggle('hidden', v !== 'bezier');
  splineMenu.classList.toggle('hidden', v !== 'spline');
  draw();
});

weightSlider.addEventListener('input', () => {
  weightValue.textContent = weightSlider.value;
  if (selectedIdx >= 0 && points[selectedIdx]) {
    points[selectedIdx].weight = parseInt(weightSlider.value);
    draw();
  }
});

splineDegreeInput.addEventListener('change', () => draw());
splineStepInput.addEventListener('input', () => {
  stepValue.textContent = splineStepInput.value;
  draw();
});

/* --------------------------
   Mouse interactions: add / select / drag / remove
   -------------------------- */
function getMousePos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: e.clientX - r.left,
    y: e.clientY - r.top
  };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

canvas.addEventListener('pointerdown', (e) => {
  const m = getMousePos(e);
  // right click removal
  if (e.button === 2) {
    const idx = hitTest(m);
    if (idx >= 0) { points.splice(idx, 1); selectedIdx = -1; draw(); }
    return;
  }

  // if addMode, push point
  if (addMode) {
    points.push({ x: m.x, y: m.y, weight: 1 });
    draw();
    return;
  }

  // test selection
  const idx = hitTest(m);
  if (idx >= 0) {
    selectedIdx = idx;
    dragging = true;
    weightSlider.value = points[selectedIdx].weight || 1;
    weightValue.textContent = weightSlider.value;
    return;
  }

  // otherwise add new point
  points.push({ x: m.x, y: m.y, weight: 1 });
  draw();
});

canvas.addEventListener('pointermove', (e) => {
  const m = getMousePos(e);
  if (dragging && selectedIdx >= 0) {
    points[selectedIdx].x = m.x;
    points[selectedIdx].y = m.y;
    draw();
  } else {
    // hover cursor style
    const idx = hitTest(m);
    canvas.style.cursor = (idx >= 0 || addMode) ? 'pointer' : 'crosshair';
  }
});

window.addEventListener('pointerup', () => {
  dragging = false;
});

canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); });

window.addEventListener('keydown', (e) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdx >= 0) {
    points.splice(selectedIdx, 1);
    selectedIdx = -1;
    draw();
  }
});

/* hit test for control points */
function hitTest(pos) {
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (Math.hypot(p.x - pos.x, p.y - pos.y) < 8) return i;
  }
  return -1;
}

/* --------------------------
   Drawing 2D: control points + curve
   -------------------------- */
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // draw axis (center vertical)
  ctx.save();
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.restore();

  // control polygon
  if (points.length > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  // curve
  if (points.length >= 1) {
    if (curveTypeSel.value === 'bezier') drawBezier();
    else drawBSpline();
  }

  // draw control points
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    ctx.beginPath();
    ctx.fillStyle = (i === selectedIdx) ? '#f97373' : (i === points.length - 1 ? '#60a5fa' : '#fff');
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // index label
    ctx.fillStyle = '#0b0b0d';
    ctx.font = '10px Arial';
    ctx.fillText(String(i), p.x + 8, p.y + 4);
  }
}

/* Bézier (De Casteljau) */
function deCasteljau(pts, t) {
  const temp = pts.map(p => ({ x: p.x, y: p.y }));
  const n = temp.length - 1;
  for (let r = 1; r <= n; r++) {
    for (let i = 0; i <= n - r; i++) {
      temp[i].x = (1 - t) * temp[i].x + t * temp[i + 1].x;
      temp[i].y = (1 - t) * temp[i].y + t * temp[i + 1].y;
    }
  }
  return temp[0];
}

function drawBezier() {
  if (points.length === 0) return;
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const steps = Math.max(16, Math.floor(canvas.width / 3));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = deCasteljau(points, t);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

/* B-Spline sampler (open uniform approximation using basis functions) */
/* We'll use a simple Cox–de Boor style sampler with knot vector open uniform */
function makeKnots(nCtrl, degree) {
  const m = nCtrl + degree + 1;
  const knots = [];
  const k = degree;
  // first k+1 zeros
  for (let i = 0; i <= k; i++) knots.push(0);
  // internal knots
  const internal = m - 2 * (k + 1);
  for (let i = 1; i <= internal; i++) knots.push(i / (internal + 1));
  // last k+1 ones
  for (let i = 0; i <= k; i++) knots.push(1);
  return knots;
}

function deBoor(ctrl, degree, knots, t) {
  // clamp t
  t = Math.max(0, Math.min(1 - 1e-9, t));
  const n = ctrl.length - 1;
  const m = knots.length - 1;
  // find interval
  let k = -1;
  for (let i = 0; i < knots.length - 1; i++) {
    if (t >= knots[i] && t < knots[i + 1]) { k = i; break; }
  }
  if (k === -1) k = knots.length - degree - 2;

  // initial d
  const d = [];
  for (let j = 0; j <= degree; j++) {
    const idx = k - degree + j;
    const P = ctrl[Math.max(0, Math.min(ctrl.length - 1, idx))];
    d[j] = { x: P.x, y: P.y };
  }

  for (let r = 1; r <= degree; r++) {
    for (let j = degree; j >= r; j--) {
      const i = k - degree + j;
      const denom = (knots[i + degree - r + 1] - knots[i]) || 1e-9;
      const alpha = (t - knots[i]) / denom;
      d[j].x = (1 - alpha) * d[j - 1].x + alpha * d[j].x;
      d[j].y = (1 - alpha) * d[j - 1].y + alpha * d[j].y;
    }
  }
  return d[degree];
}

function drawBSpline() {
  if (points.length === 0) return;
  const degree = Math.max(1, parseInt(splineDegreeInput.value) || 3);
  if (points.length < degree + 1) {
    // fallback to polyline
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    return;
  }
  const knots = makeKnots(points.length, degree);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const samples = Math.max(16, parseInt(splineStepInput.value) || 80);
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = deBoor(points, degree, knots, t);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

/* --------------------------
   Revolução: gera mesh (vertices, normals, indices)
   -------------------------- */

/**
 * Gera amostras da curva 2D (array de {x,y}) com base nas configurações
 */
function sampleProfile() {
  if (points.length === 0) return [];
  if (curveTypeSel.value === 'bezier') {
    const steps = Math.max(8, Math.floor(canvas.width / 3));
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      out.push(deCasteljau(points, t));
    }
    return out;
  } else {
    const degree = Math.max(1, parseInt(splineDegreeInput.value) || 3);
    if (points.length < degree + 1) return points.slice();
    const knots = makeKnots(points.length, degree);
    const samples = Math.max(8, parseInt(splineStepInput.value) || 80);
    const out = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      out.push(deBoor(points, degree, knots, t));
    }
    return out;
  }
}

/**
 * Gera malha por revolução
 * axis: 'X'|'Y'|'Z'
 * angleDeg: number
 * segments: integer
 * profile: array of {x,y} in canvas coordinates — we'll convert to centered coords
 */
function revolveMesh(profile, axis, angleDeg, segments) {
  // Convert profile to centered coordinates where origin is canvas center and Y up
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const pts = profile.map(p => ({ x: p.x - centerX, y: (centerY - p.y) })); // world coords

  const angleRad = angleDeg * Math.PI / 180;
  const close = Math.abs(angleDeg - 360) < 1e-6;
  const cols = close ? segments : segments + 1;
  const rows = pts.length;

  const positions = [];
  const normalsAcc = []; // accumulate normals
  const indices = [];

  // build vertices
  for (let r = 0; r < rows; r++) {
    const p = pts[r];
    for (let c = 0; c < cols; c++) {
      const theta = (c / segments) * angleRad;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      let vx = 0, vy = 0, vz = 0;
      if (axis === 'Y') {
        vx = p.x * cos;
        vy = p.y;
        vz = p.x * sin;
      } else if (axis === 'X') {
        vx = p.x;
        vy = p.y * cos;
        vz = p.y * sin;
      } else { // Z axis (rotate in XY plane)
        vx = p.x * cos - p.y * sin;
        vy = p.x * sin + p.y * cos;
        vz = 0;
      }
      positions.push(vx, vy, vz);
      normalsAcc.push(0, 0, 0);
    }
  }

  // helper index
  const idx = (r, c) => r * cols + (c % cols);

  // build faces (triangles)
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      const a = idx(r, c);
      const b = idx(r + 1, c);
      const c2 = idx(r + 1, c + 1);
      const d = idx(r, c + 1);
      // triangle a-b-c2 and a-c2-d
      indices.push(a, b, c2);
      indices.push(a, c2, d);
      // compute face normal and add to vertex normals accumulator
      const v0 = [positions[3 * a], positions[3 * a + 1], positions[3 * a + 2]];
      const v1 = [positions[3 * b], positions[3 * b + 1], positions[3 * b + 2]];
      const v2 = [positions[3 * c2], positions[3 * c2 + 1], positions[3 * c2 + 2]];
      const ux = v1[0] - v0[0], uy = v1[1] - v0[1], uz = v1[2] - v0[2];
      const vx2 = v2[0] - v0[0], vy2 = v2[1] - v0[1], vz2 = v2[2] - v0[2];
      const nx = uy * vz2 - uz * vy2;
      const ny = uz * vx2 - ux * vz2;
      const nz = ux * vy2 - uy * vx2;
      // add to accumulators
      [a, b, c2].forEach(i => {
        normalsAcc[3 * i] += nx;
        normalsAcc[3 * i + 1] += ny;
        normalsAcc[3 * i + 2] += nz;
      });
      [a, c2, d].forEach(i => {
        normalsAcc[3 * i] += nx;
        normalsAcc[3 * i + 1] += ny;
        normalsAcc[3 * i + 2] += nz;
      });
    }
  }

  // normalize normals
  const normals = new Float32Array(normalsAcc.length);
  for (let i = 0; i < normalsAcc.length; i += 3) {
    const nx = normalsAcc[i], ny = normalsAcc[i + 1], nz = normalsAcc[i + 2];
    const l = Math.hypot(nx, ny, nz) || 1;
    normals[i] = nx / l;
    normals[i + 1] = ny / l;
    normals[i + 2] = nz / l;
  }

  return {
    positions: new Float32Array(positions),
    normals,
    indices: new Uint32Array(indices),
    rows,
    cols
  };
}

/* --------------------------
   Three.js viewer
   -------------------------- */

function initThree() {
  // create renderer
  three.renderer = new THREE.WebGLRenderer({ antialias: true });
  three.renderer.setPixelRatio(window.devicePixelRatio || 1);
  three.renderer.setSize(viewerDiv.clientWidth, viewerDiv.clientHeight);
  three.renderer.setClearColor(0x070809);
  viewerDiv.innerHTML = '';
  viewerDiv.appendChild(three.renderer.domElement);

  // scene and camera
  three.scene = new THREE.Scene();
  three.camera = new THREE.PerspectiveCamera(45, viewerDiv.clientWidth / viewerDiv.clientHeight, 0.1, 10000);
  three.camera.position.set(200, 200, 400);

  // controls
  three.controls = new THREE.OrbitControls(three.camera, three.renderer.domElement);
  three.controls.enableDamping = true;

  // lights
  three.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(100, 200, 100);
  three.scene.add(dir);

  window.addEventListener('resize', () => {
    three.renderer.setSize(viewerDiv.clientWidth, viewerDiv.clientHeight);
    three.camera.aspect = viewerDiv.clientWidth / viewerDiv.clientHeight;
    three.camera.updateProjectionMatrix();
  });

  animateThree();
}

function animateThree() {
  requestAnimationFrame(animateThree);
  if (three.controls) three.controls.update();
  if (three.renderer && three.scene && three.camera) {
    three.renderer.render(three.scene, three.camera);
  }
}

/**
 * Sets / replaces mesh in the scene from meshData {positions,normals,indices}
 */
function setThreeMesh(meshData, mode = 'solid') {
  if (!three.renderer) initThree();

  // remove previous
  if (three.mesh) {
    three.scene.remove(three.mesh);
    if (three.mesh.geometry) three.mesh.geometry.dispose();
    if (three.mesh.material) three.mesh.material.dispose();
    three.mesh = null;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
  geom.setIndex(new THREE.BufferAttribute(meshData.indices, 1));

  let material;
  if (mode === 'wire') material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
  else if (mode === 'smooth') material = new THREE.MeshStandardMaterial({ color: 0x60a5fa, metalness: 0.05, roughness: 0.6, flatShading: false });
  else material = new THREE.MeshStandardMaterial({ color: 0x60a5fa, metalness: 0.05, roughness: 0.6, flatShading: true });

  three.mesh = new THREE.Mesh(geom, material);
  three.scene.add(three.mesh);

  // center camera on mesh approximate bounding
  three.mesh.geometry.computeBoundingBox();
  const box = three.mesh.geometry.boundingBox;
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const camDist = maxDim * 2.0;
  three.camera.position.set(camDist, camDist, camDist);
  three.controls.update();
}

/* --------------------------
   Exporters (JSON, OBJ, STL ASCII)
   -------------------------- */

function downloadString(filename, content, mime='text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(meshData, config) {
  const payload = {
    config,
    mesh: {
      positions: Array.from(meshData.positions),
      normals: Array.from(meshData.normals),
      indices: Array.from(meshData.indices),
      rows: meshData.rows,
      cols: meshData.cols
    },
    controlPoints: points
  };
  downloadString('revolution.json', JSON.stringify(payload, null, 2), 'application/json');
}

function exportOBJ(meshData) {
  let out = '';
  const v = meshData.positions;
  const n = meshData.normals;
  for (let i = 0; i < v.length; i += 3) {
    out += `v ${v[i].toFixed(6)} ${v[i + 1].toFixed(6)} ${v[i + 2].toFixed(6)}\n`;
  }
  for (let i = 0; i < n.length; i += 3) {
    out += `vn ${n[i].toFixed(6)} ${n[i + 1].toFixed(6)} ${n[i + 2].toFixed(6)}\n`;
  }
  const idx = meshData.indices;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] + 1, b = idx[i + 1] + 1, c = idx[i + 2] + 1;
    out += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
  }
  downloadString('revolution.obj', out, 'text/plain');
}

function exportSTL(meshData) {
  let out = 'solid revolution\n';
  const v = meshData.positions;
  const n = meshData.normals;
  const idx = meshData.indices;
  for (let i = 0; i < idx.length; i += 3) {
    const i0 = idx[i] * 3, i1 = idx[i + 1] * 3, i2 = idx[i + 2] * 3;
    const nx = (n[i0] + n[i1] + n[i2]) / 3;
    const ny = (n[i0 + 1] + n[i1 + 1] + n[i2 + 1]) / 3;
    const nz = (n[i0 + 2] + n[i1 + 2] + n[i2 + 2]) / 3;
    out += ` facet normal ${nx} ${ny} ${nz}\n  outer loop\n`;
    out += `   vertex ${v[i0]} ${v[i0 + 1]} ${v[i0 + 2]}\n`;
    out += `   vertex ${v[i1]} ${v[i1 + 1]} ${v[i1 + 2]}\n`;
    out += `   vertex ${v[i2]} ${v[i2 + 1]} ${v[i2 + 2]}\n`;
    out += '  endloop\n endfacet\n';
  }
  out += 'endsolid revolution\n';
  downloadString('revolution.stl', out, 'text/plain');
}

/* --------------------------
   Actions: Buttons
   -------------------------- */

addPointBtn.addEventListener('click', () => {
  // add at center-ish
  points.push({ x: canvas.width / 2 + 40, y: canvas.height / 2 - 120, weight: 1 });
  draw();
});

clearBtn.addEventListener('click', () => {
  points = [];
  selectedIdx = -1;
  draw();
});

surfaceBtn.addEventListener('click', () => {
  const profile = sampleProfile();
  if (!profile || profile.length < 2) return alert('Desenhe um perfil com pelo menos 2 pontos.');
  const axis = (axisSel.value || 'Y').toUpperCase();
  const angle = parseFloat(angleInput.value) || 360;
  const divisions = Math.max(3, parseInt(divisionsInput.value) || 64);
  const meshData = revolveMesh(profile, axis, angle, divisions);
  const mode = renderModeSel.value || 'solid';
  setThreeMesh(meshData, mode === 'wire' ? 'wire' : mode === 'smooth' ? 'smooth' : 'solid');

  // store last mesh for exports
  three._lastMeshData = meshData;
  three._lastConfig = {
    curveType: curveTypeSel.value,
    splineDegree: parseInt(splineDegreeInput.value),
    splineStep: parseInt(splineStepInput.value),
    axis, angle, divisions
  };
});

clearSurfaceBtn.addEventListener('click', () => {
  if (three.mesh && three.scene) {
    three.scene.remove(three.mesh);
    three.mesh = null;
  }
  three._lastMeshData = null;
  three._lastConfig = null;
});

exportJSONBtn.addEventListener('click', () => {
  if (!three._lastMeshData) return alert('Gere a superfície antes de exportar.');
  exportJSON(three._lastMeshData, three._lastConfig);
});

exportOBJBtn.addEventListener('click', () => {
  if (!three._lastMeshData) return alert('Gere a superfície antes de exportar.');
  exportOBJ(three._lastMeshData);
});

exportSTLBtn.addEventListener('click', () => {
  if (!three._lastMeshData) return alert('Gere a superfície antes de exportar.');
  exportSTL(three._lastMeshData);
});

/* --------------------------
   Initial seed and start
   -------------------------- */
(function seed() {
  // create an example profile for convenience
  const cx = canvas.width / 2 || 400;
  const cy = canvas.height / 2 || 300;
  points = [
    { x: cx + 30, y: cy - 180, weight: 1 },
    { x: cx + 80, y: cy - 120, weight: 1 },
    { x: cx + 70, y: cy - 20, weight: 1 },
    { x: cx + 60, y: cy + 60, weight: 1 },
    { x: cx + 18, y: cy + 180, weight: 1 },
  ];
  draw();
})();

initThree(); // initialize Three.js viewer (renders empty scene)
