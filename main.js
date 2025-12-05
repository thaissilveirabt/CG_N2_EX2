window.addEventListener('DOMContentLoaded', () => {
  console.log('[main.js] DOM carregado — inicializando aplicação');

const canvas = document.getElementById('canvas2d');
const ctx = canvas.getContext('2d'); // Esse é o pincel pra desenhar 2D

// Pegando os menus, sliders e inputs de configuração
const curveTypeSel = document.getElementById('curveType');
const bezierMenu = document.getElementById('bezierMenu');
const splineMenu = document.getElementById('splineMenu');
const weightSlider = document.getElementById('weightSlider');
const weightValue = document.getElementById('weightValue');
const splineDegreeInput = document.getElementById('splineDegree');
const splineStepInput = document.getElementById('splineStep');
const stepValue = document.getElementById('stepValue');

// Configurações da revolução (eixo, ângulo, divisões)
const axisSel = document.getElementById('axis');
const angleInput = document.getElementById('angle');
const divisionsInput = document.getElementById('divisions');

// Botões de ação (adicionar, limpar, gerar 3D)
const addPointBtn = document.getElementById('addPointBtn');
const clearBtn = document.getElementById('clearBtn');
const surfaceBtn = document.getElementById('surfaceBtn');
const clearSurfaceBtn = document.getElementById('clearSurfaceBtn');

// Botões pra baixar o arquivo final
const exportJSONBtn = document.getElementById('exportJSON');
const exportOBJBtn = document.getElementById('exportOBJ');
const exportSTLBtn = document.getElementById('exportSTL');

const renderModeSel = document.getElementById('renderMode');

// Onde o Three.js vai desenhar a parte 3D
const viewerDiv = document.getElementById('viewer3d');

// Aqui ficam os dados "vivos" do app
let points = []; 
let selectedIdx = -1; 
let dragging = false; 
let addMode = false; 

// Objeto pra guardar as coisas do Three.js pra não perder a referência
let three = {
  renderer: null,
  scene: null,
  camera: null,
  controls: null,
  mesh: null
};

// Essa função serve pro canvas sempre caber na tela certinho se redimensionar a janela
function fitCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.floor(rect.width - 20);
  canvas.height = Math.floor(rect.height - 20);
  draw(); // Redesenha tudo, senão some quando muda o tamanho
}
// Ouve o evento de resize da janela
window.addEventListener('resize', fitCanvas);
setTimeout(fitCanvas, 50); // Chama uma vez no começo pra garantir


// Se mudar o tipo de curva (Bézier ou Spline), esconde o menu que não precisa
curveTypeSel.addEventListener('change', () => {
  const v = curveTypeSel.value;
  // Truque com classList.toggle pra mostrar/esconder
  bezierMenu.classList.toggle('hidden', v !== 'bezier');
  splineMenu.classList.toggle('hidden', v !== 'spline');
  draw(); // Atualiza o desenho
});

weightSlider.addEventListener('input', () => {
  weightValue.textContent = weightSlider.value;
  if (selectedIdx >= 0 && points[selectedIdx]) {
    points[selectedIdx].weight = parseInt(weightSlider.value);
    draw();
  }
});

// Se mudar o grau ou passos da Spline, redesenha
splineDegreeInput.addEventListener('change', () => draw());
splineStepInput.addEventListener('input', () => {
  stepValue.textContent = splineStepInput.value;
  draw();
});


// Função auxiliar pra saber onde o mouse tá dentro do canvas (desconta as bordas)
function getMousePos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: e.clientX - r.left,
    y: e.clientY - r.top
  };
}

// Matemática básica: distância entre dois pontos (Pitágoras)
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Quando clica no canvas
canvas.addEventListener('pointerdown', (e) => {
  const m = getMousePos(e);
  
  // Se for botão direito (código 2), apaga o ponto
  if (e.button === 2) {
    const idx = hitTest(m); // Verifica se clicou em cima de algum ponto
    if (idx >= 0) { points.splice(idx, 1); selectedIdx = -1; draw(); }
    return;
  }

  // Se o modo "Adicionar" estiver ligado, só cria ponto novo e sai
  if (addMode) {
    points.push({ x: m.x, y: m.y, weight: 1 });
    draw();
    return;
  }

  // Tenta selecionar um ponto existente pra arrastar
  const idx = hitTest(m);
  if (idx >= 0) {
    selectedIdx = idx;
    dragging = true;
    // Atualiza a UI com o peso desse ponto
    weightSlider.value = points[selectedIdx].weight || 1;
    weightValue.textContent = weightSlider.value;
    return;
  }

  // Se não clicou em nada e não é botão direito, cria um ponto novo onde clicou
  points.push({ x: m.x, y: m.y, weight: 1 });
  draw();
});

// Quando move o mouse
canvas.addEventListener('pointermove', (e) => {
  const m = getMousePos(e);
  // Se tiver arrastando um ponto, atualiza a posição dele
  if (dragging && selectedIdx >= 0) {
    points[selectedIdx].x = m.x;
    points[selectedIdx].y = m.y;
    draw();
  } else {
    // Só muda o cursorzinho pra mãozinha se passar em cima de um ponto
    const idx = hitTest(m);
    canvas.style.cursor = (idx >= 0 || addMode) ? 'pointer' : 'crosshair';
  }
});

// Soltou o clique -> parou de arrastar
window.addEventListener('pointerup', () => {
  dragging = false;
});

// Bloqueia o menu normal do botão direito pra gente poder usar pra apagar ponto
canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); });

// Atalho de teclado: Delete ou Backspace apaga o ponto selecionado
window.addEventListener('keydown', (e) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdx >= 0) {
    points.splice(selectedIdx, 1);
    selectedIdx = -1;
    draw();
  }
});

/* Função pra ver se o mouse tá perto o suficiente de um ponto (hitbox de 8px) */
function hitTest(pos) {
  // Varre de trás pra frente (pra pegar o que tá "por cima" primeiro)
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (Math.hypot(p.x - pos.x, p.y - pos.y) < 8) return i;
  }
  return -1; // Não achou ninguém
}

/* --------------------------
   Desenhando no 2D: pontos de controle + curva
   -------------------------- */
function draw() {
  // Limpa a tela inteira pra desenhar o próximo frame
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Desenha o eixo central (onde vai girar o 3D)
  ctx.save();
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.restore();

  // Desenha as linhas cinzas conectando os pontos de controle (polígono de controle)
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

  // Desenha a curva em si (chama a função específica dependendo do select)
  if (points.length >= 1) {
    if (curveTypeSel.value === 'bezier') drawBezier();
    else drawBSpline();
  }

  // Desenha as bolinhas dos pontos
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    ctx.beginPath();
    // Muda a cor se for o selecionado, o último ou normal
    ctx.fillStyle = (i === selectedIdx) ? '#f97373' : (i === points.length - 1 ? '#60a5fa' : '#fff');
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Coloca o numerozinho do índice do lado do ponto
    ctx.fillStyle = '#0b0b0d';
    ctx.font = '10px Arial';
    ctx.fillText(String(i), p.x + 8, p.y + 4);
  }
}

/* Algoritmo de De Casteljau (Bézier) */
// Esse aqui é matemática pura, interpolação linear recursiva pra achar o ponto na curva
function deCasteljau(pts, t) {
  // Copia os pontos pra não estragar o original
  const temp = pts.map(p => ({ x: p.x, y: p.y }));
  const n = temp.length - 1;
  // Loop dentro de loop reduzindo os pontos até sobrar 1
  for (let r = 1; r <= n; r++) {
    for (let i = 0; i <= n - r; i++) {
      temp[i].x = (1 - t) * temp[i].x + t * temp[i + 1].x;
      temp[i].y = (1 - t) * temp[i].y + t * temp[i + 1].y;
    }
  }
  return temp[0]; // O ponto final na curva
}

function drawBezier() {
  if (points.length === 0) return;
  ctx.strokeStyle = '#60a5fa'; // Azulzinho
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Define quantos passos vai ter a curva baseada na largura da tela pra ficar suave
  const steps = Math.max(16, Math.floor(canvas.width / 3));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // t vai de 0 a 1
    const p = deCasteljau(points, t);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

/* B-Spline sampler (open uniform approximation) */
// Essa parte de Spline e vetor de nós (knots) é complicada, peguei o algoritmo padrão Cox–de Boor
function makeKnots(nCtrl, degree) {
  // Calcula o vetor de nós (knots) para B-Spline uniforme aberta
  const m = nCtrl + degree + 1;
  const knots = [];
  const k = degree;
  // Preenche com zeros no começo (multiplicidade)
  for (let i = 0; i <= k; i++) knots.push(0);
  // Preenche o miolo
  const internal = m - 2 * (k + 1);
  for (let i = 1; i <= internal; i++) knots.push(i / (internal + 1));
  // Preenche com uns no final
  for (let i = 0; i <= k; i++) knots.push(1);
  return knots;
}

function deBoor(ctrl, degree, knots, t) {
  // Garante que t tá entre 0 e 1 (menos um pouquinho pra não bugar)
  t = Math.max(0, Math.min(1 - 1e-9, t));
  
  // Lógica complexa pra achar em qual intervalo o 't' está
  let k = -1;
  for (let i = 0; i < knots.length - 1; i++) {
    if (t >= knots[i] && t < knots[i + 1]) { k = i; break; }
  }
  if (k === -1) k = knots.length - degree - 2;

  // Inicializa o array d com os pontos de controle relevantes
  const d = [];
  for (let j = 0; j <= degree; j++) {
    const idx = k - degree + j;
    // Proteção pra não acessar array fora do índice
    const P = ctrl[Math.max(0, Math.min(ctrl.length - 1, idx))];
    d[j] = { x: P.x, y: P.y };
  }

  // Interpolação iterativa (Cox-de Boor)
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
  
  // Se tiver menos pontos que o grau + 1, não dá pra fazer curva, vira reta
  if (points.length < degree + 1) {
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

  // Gera a curva suave da Spline
  const knots = makeKnots(points.length, degree);
  ctx.strokeStyle = '#f59e0b'; // Amarelo/Laranja
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
   Revolução: gera mesh (vertices, normais, indices)
   -------------------------- */

/**
 * Pega a curva matemática e transforma num array de pontos {x,y}
 * pra gente poder girar depois.
 */
function sampleProfile() {
  if (points.length === 0) return [];
  // Basicamente repete a lógica do draw(), mas em vez de desenhar, guarda num array
  if (curveTypeSel.value === 'bezier') {
    const steps = Math.max(8, Math.floor(canvas.width / 3));
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      out.push(deCasteljau(points, t));
    }
    return out;
  } else {
    // Mesma coisa pra Spline
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
 * AQUI É A MÁGICA 3D (Surface of Revolution)
 * Pega o perfil 2D e gira em torno do eixo X, Y ou Z.
 */
function revolveMesh(profile, axis, angleDeg, segments) {
  // Centraliza os pontos (origem no meio da tela)
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  // Inverte Y porque no canvas Y cresce pra baixo, mas no 3D pra cima
  const pts = profile.map(p => ({ x: p.x - centerX, y: (centerY - p.y) })); 

  const angleRad = angleDeg * Math.PI / 180;
  const close = Math.abs(angleDeg - 360) < 1e-6; // Se for 360 graus, fecha o círculo
  const cols = close ? segments : segments + 1;
  const rows = pts.length;

  const positions = [];
  const normalsAcc = []; // Acumulador pra calcular normais (pra luz funcionar)
  const indices = []; // Triângulos

  // Gera os vértices girando
  for (let r = 0; r < rows; r++) {
    const p = pts[r];
    for (let c = 0; c < cols; c++) {
      const theta = (c / segments) * angleRad;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      let vx = 0, vy = 0, vz = 0;

      // Matemática de rotação básica dependendo do eixo
      if (axis === 'Y') {
        vx = p.x * cos;
        vy = p.y;
        vz = p.x * sin;
      } else if (axis === 'X') {
        vx = p.x;
        vy = p.y * cos;
        vz = p.y * sin;
      } else { // Z
        vx = p.x * cos - p.y * sin;
        vy = p.x * sin + p.y * cos;
        vz = 0;
      }
      positions.push(vx, vy, vz);
      normalsAcc.push(0, 0, 0); // Inicializa normal com zero
    }
  }

  // Funçãozinha pra achar o índice no array linear
  const idx = (r, c) => r * cols + (c % cols);

  // Conecta os pontos formando triângulos (faces)
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      // Pega 4 pontos vizinhos
      const a = idx(r, c);
      const b = idx(r + 1, c);
      const c2 = idx(r + 1, c + 1);
      const d = idx(r, c + 1);
      
      // Cria 2 triângulos pra fechar o quadrado (quad)
      indices.push(a, b, c2);
      indices.push(a, c2, d);

      // --- Cálculo de normais (produto vetorial) ---
      // Isso aqui é necessário pra iluminação não ficar toda errada
      const v0 = [positions[3 * a], positions[3 * a + 1], positions[3 * a + 2]];
      const v1 = [positions[3 * b], positions[3 * b + 1], positions[3 * b + 2]];
      const v2 = [positions[3 * c2], positions[3 * c2 + 1], positions[3 * c2 + 2]];
      
      // Vetores das arestas
      const ux = v1[0] - v0[0], uy = v1[1] - v0[1], uz = v1[2] - v0[2];
      const vx2 = v2[0] - v0[0], vy2 = v2[1] - v0[1], vz2 = v2[2] - v0[2];
      
      // Produto vetorial pra achar a normal da face
      const nx = uy * vz2 - uz * vy2;
      const ny = uz * vx2 - ux * vz2;
      const nz = ux * vy2 - uy * vx2;

      // Soma nos vértices (pra depois fazer a média e ficar suave - Gouraud/Phong shading)
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

  // Normaliza os vetores normais (tamanho 1)
  const normals = new Float32Array(normalsAcc.length);
  for (let i = 0; i < normalsAcc.length; i += 3) {
    const nx = normalsAcc[i], ny = normalsAcc[i + 1], nz = normalsAcc[i + 2];
    const l = Math.hypot(nx, ny, nz) || 1;
    normals[i] = nx / l;
    normals[i + 1] = ny / l;
    normals[i + 2] = nz / l;
  }

  // Retorna tudo formatado pro Three.js entender
  return {
    positions: new Float32Array(positions),
    normals,
    indices: new Uint32Array(indices),
    rows,
    cols
  };
}

/* --------------------------
   Three.js viewer (Setup básico do 3D)
   -------------------------- */

function initThree() {
  // Cria o renderizador WebGL
  three.renderer = new THREE.WebGLRenderer({ antialias: true });
  three.renderer.setPixelRatio(window.devicePixelRatio || 1);
  three.renderer.setSize(viewerDiv.clientWidth, viewerDiv.clientHeight);
  three.renderer.setClearColor(0x070809); // Fundo quase preto
  viewerDiv.innerHTML = '';
  viewerDiv.appendChild(three.renderer.domElement);

  // Cria a cena e a câmera
  three.scene = new THREE.Scene();
  three.camera = new THREE.PerspectiveCamera(45, viewerDiv.clientWidth / viewerDiv.clientHeight, 0.1, 10000);
  three.camera.position.set(200, 200, 400); // Posição inicial

  // Controles pra girar a câmera com o mouse (OrbitControls)
  three.controls = new THREE.OrbitControls(three.camera, three.renderer.domElement);
  three.controls.enableDamping = true; // Deixa o movimento "macio"

  // Luzes (Ambiente + Direcional) pra dar volume
  three.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(100, 200, 100);
  three.scene.add(dir);

  // Se redimensionar a janela, arruma a câmera 3D também
  window.addEventListener('resize', () => {
    three.renderer.setSize(viewerDiv.clientWidth, viewerDiv.clientHeight);
    three.camera.aspect = viewerDiv.clientWidth / viewerDiv.clientHeight;
    three.camera.updateProjectionMatrix();
  });

  animateThree(); // Começa o loop de animação
}

// Loop infinito (60fps) pra renderizar a cena
function animateThree() {
  requestAnimationFrame(animateThree);
  if (three.controls) three.controls.update();
  if (three.renderer && three.scene && three.camera) {
    three.renderer.render(three.scene, three.camera);
  }
}

/**
 * Pega os dados da malha gerados lá no revolveMesh e bota na tela
 */
function setThreeMesh(meshData, mode = 'solid') {
  if (!three.renderer) initThree();

  // Se já tinha algo desenhado, remove pra não sobrepor
  if (three.mesh) {
    three.scene.remove(three.mesh);
    if (three.mesh.geometry) three.mesh.geometry.dispose(); // Limpa memória
    if (three.mesh.material) three.mesh.material.dispose();
    three.mesh = null;
  }

  // Cria a geometria no Three.js
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3));
  geom.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3));
  geom.setIndex(new THREE.BufferAttribute(meshData.indices, 1));

  // Escolhe o material (Wireframe, Smooth ou Flat)
  let material;
  if (mode === 'wire') material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
  else if (mode === 'smooth') material = new THREE.MeshStandardMaterial({ color: 0x60a5fa, metalness: 0.05, roughness: 0.6, flatShading: false });
  else material = new THREE.MeshStandardMaterial({ color: 0x60a5fa, metalness: 0.05, roughness: 0.6, flatShading: true });

  three.mesh = new THREE.Mesh(geom, material);
  three.scene.add(three.mesh);

  // Centraliza a câmera no objeto novo (Compute Bounding Box)
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
   Exportadores (Salvar arquivos)
   -------------------------- */

// Função gambiarra pra forçar o browser a baixar um arquivo de texto
function downloadString(filename, content, mime='text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Salva tudo num JSON pra poder recarregar depois (se implementasse import)
function exportJSON(meshData, config) {
  const payload = {
    config,
    mesh: {
      positions: Array.from(meshData.positions), // Converte TypedArray pra array normal
      normals: Array.from(meshData.normals),
      indices: Array.from(meshData.indices),
      rows: meshData.rows,
      cols: meshData.cols
    },
    controlPoints: points
  };
  downloadString('revolution.json', JSON.stringify(payload, null, 2), 'application/json');
}

// Exporta pra .OBJ (formato universal 3D)
function exportOBJ(meshData) {
  let out = '';
  // Escreve vértices (v x y z)
  const v = meshData.positions;
  const n = meshData.normals;
  for (let i = 0; i < v.length; i += 3) {
    out += `v ${v[i].toFixed(6)} ${v[i + 1].toFixed(6)} ${v[i + 2].toFixed(6)}\n`;
  }
  // Escreve normais (vn x y z)
  for (let i = 0; i < n.length; i += 3) {
    out += `vn ${n[i].toFixed(6)} ${n[i + 1].toFixed(6)} ${n[i + 2].toFixed(6)}\n`;
  }
  // Escreve faces (f v//vn v//vn v//vn) - formato chato do OBJ
  const idx = meshData.indices;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] + 1, b = idx[i + 1] + 1, c = idx[i + 2] + 1; // OBJ começa em 1, não 0
    out += `f ${a}//${a} ${b}//${b} ${c}//${c}\n`;
  }
  downloadString('revolution.obj', out, 'text/plain');
}

// Exporta pra STL (bom pra impressão 3D)
function exportSTL(meshData) {
  let out = 'solid revolution\n';
  const v = meshData.positions;
  const n = meshData.normals;
  const idx = meshData.indices;
  
  for (let i = 0; i < idx.length; i += 3) {
    const i0 = idx[i] * 3, i1 = idx[i + 1] * 3, i2 = idx[i + 2] * 3;
    // Média das normais (STL usa normal por face)
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
   Ações: O que os botões fazem
   -------------------------- */

addPointBtn.addEventListener('click', () => {
  console.log('[main.js] addPointBtn clicked');
  // Adiciona um ponto meio que no centro da tela pra facilitar
  points.push({ x: canvas.width / 2 + 40, y: canvas.height / 2 - 120, weight: 1 });
  draw();
});

clearBtn.addEventListener('click', () => {
  console.log('[main.js] clearBtn clicked');
  points = []; // Zera o array
  selectedIdx = -1;
  draw();
});

surfaceBtn.addEventListener('click', () => {
  console.log('[main.js] surfaceBtn clicked');
  // 1. Gera o perfil da curva
  const profile = sampleProfile();
  if (!profile || profile.length < 2) return alert('Desenhe um perfil com pelo menos 2 pontos.');
  
  // 2. Pega configs do form
  const axis = (axisSel.value || 'Y').toUpperCase();
  const angle = parseFloat(angleInput.value) || 360;
  const divisions = Math.max(3, parseInt(divisionsInput.value) || 64);
  
  // 3. Gera a malha 3D (revolução)
  const meshData = revolveMesh(profile, axis, angle, divisions);
  const mode = renderModeSel.value || 'solid';
  
  // 4. Manda pro Three.js renderizar
  try {
    setThreeMesh(meshData, mode === 'wire' ? 'wire' : mode === 'smooth' ? 'smooth' : 'solid');
  } catch (err) {
    console.error('[main.js] Erro ao setThreeMesh:', err);
    alert('Erro ao renderizar superfície. Veja o console para detalhes.');
    return;
  }

  // 5. Salva no "cache" pra poder exportar depois se clicar nos botões de download
  three._lastMeshData = meshData;
  three._lastConfig = {
    curveType: curveTypeSel.value,
    splineDegree: parseInt(splineDegreeInput.value),
    splineStep: parseInt(splineStepInput.value),
    axis, angle, divisions
  };
});

clearSurfaceBtn.addEventListener('click', () => {
  console.log('[main.js] clearSurfaceBtn clicked');
  // Remove o objeto 3D da cena
  if (three.mesh && three.scene) {
    three.scene.remove(three.mesh);
    three.mesh = null;
  }
  three._lastMeshData = null;
  three._lastConfig = null;
});

// Botões de exportação só chamam as funções se já tiver malha gerada
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
   Seed inicial e start
   -------------------------- */
(function seed() {
  // Cria uns pontos iniciais pra tela não ficar vazia quando abre
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

initThree(); // Inicializa o viewer 3D (vazio por enquanto)
  // fim do DOMContentLoaded
});