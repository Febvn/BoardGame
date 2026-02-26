import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

class GameEngine {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.loadingText = document.getElementById('loading-text');
        this.loadingBar = document.getElementById('loading-bar');
        this.gameTitle = document.getElementById('current-game-title');
        this.gameStatus = document.getElementById('game-status-text');
        this.playerTurn = document.getElementById('player-turn');
        this.mobilePlayerTurn = document.getElementById('mobile-player-turn');
        this.resetBtn = document.getElementById('reset-btn');
        this.rollBtn = document.getElementById('roll-btn');
        this.diceValueDisp = document.getElementById('dice-value');
        this.diceResultUI = document.getElementById('dice-result-card');
        this.sidebar = document.getElementById('sidebar');
        this.sidebarOverlay = document.getElementById('sidebar-overlay');
        this.menuToggle = document.getElementById('menu-toggle');
        this.landingPage = document.getElementById('landing-page');
        this.gameView = document.getElementById('game-view');
        this.backToMenuBtn = document.getElementById('back-to-menu');
        this.authModal = document.getElementById('auth-modal');
        this.closeAuthModalBtn = document.getElementById('close-auth-modal');
        this.authBtns = document.querySelectorAll('.btn-show-auth');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.loader = new GLTFLoader();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.currentGame = 'tictactoe';
        this.gameState = {};
        this.models = {};
        this.isRolling = false;
        this.animating = false;
        this.isMobile = window.innerWidth <= 768;
        this.init();
    }

    async init() {
        const w = this.container.clientWidth || window.innerWidth;
        const h = this.container.clientHeight || window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.container.appendChild(this.renderer.domElement);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.maxPolarAngle = Math.PI / 2.1;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 20;
        this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const sun = new THREE.DirectionalLight(0xffffff, 1.5);
        sun.position.set(10, 20, 10); sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = sun.shadow.camera.bottom = -10;
        sun.shadow.camera.right = sun.shadow.camera.top = 10;
        this.scene.add(sun);
        const fill = new THREE.DirectionalLight(0x818cf8, 0.4);
        fill.position.set(-5, 5, -10);
        this.scene.add(fill);
        const floor = new THREE.Mesh(new THREE.CircleGeometry(25, 32), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.15 }));
        floor.rotation.x = -Math.PI / 2; floor.position.y = -0.51; floor.receiveShadow = true;
        this.scene.add(floor);
        const grid = new THREE.GridHelper(40, 20, 0x1e293b, 0x1e293b); grid.position.y = -0.5; this.scene.add(grid);
        window.addEventListener('resize', () => this.onResize());
        this.container.addEventListener('pointerdown', e => this.onClick(e));
        this.resetBtn.addEventListener('click', () => this.resetGame());
        this.rollBtn.addEventListener('click', () => this.rollDice());
        this.backToMenuBtn.addEventListener('click', () => this.showLandingPage());
        this.authBtns.forEach(btn => btn.addEventListener('click', () => this.showAuthModal()));
        this.closeAuthModalBtn.addEventListener('click', () => this.hideAuthModal());
        this.authModal.addEventListener('click', e => { if (e.target === this.authModal) this.hideAuthModal(); });
        this.setupMobileMenu();
        this.setupNavigation();
        this.setupLandingPage();
        this.animate();
        this._needsRender = true;
    }

    setupMobileMenu() {
        const close = () => { this.sidebar.classList.remove('open'); this.sidebarOverlay.classList.remove('active'); this.menuToggle.classList.remove('active'); };
        this.menuToggle.addEventListener('click', () => {
            if (!this.sidebar.classList.contains('open')) { this.sidebar.classList.add('open'); this.sidebarOverlay.classList.add('active'); this.menuToggle.classList.add('active'); } else close();
        });
        this.sidebarOverlay.addEventListener('click', close);
    }

    setupNavigation() {
        const btns = document.querySelectorAll('.game-btn');
        btns.forEach(btn => btn.addEventListener('click', async () => {
            if (btn.classList.contains('active')) return;
            this.selectGame(btn.dataset.game, btn.innerText);
        }));
    }

    setupLandingPage() {
        const cards = document.querySelectorAll('.game-card');
        cards.forEach(card => card.addEventListener('click', () => {
            const name = card.querySelector('.card-name').innerText;
            this.selectGame(card.dataset.game, name);
        }));
    }

    async selectGame(gt, name) {
        this.currentGame = gt;
        this.gameTitle.innerText = name.replace(/[^a-zA-Z ]/g, '').trim();

        // Update sidebar buttons
        document.querySelectorAll('.game-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.game === gt);
        });

        // Hide landing page if visible
        if (!this.landingPage.classList.contains('fade-out')) {
            this.landingPage.classList.add('fade-out');
            setTimeout(() => {
                this.gameView.classList.remove('game-view-hidden');
                this.gameView.classList.add('game-view-active');
            }, 300);
        }

        // Close mobile sidebar
        this.sidebar.classList.remove('open');
        this.sidebarOverlay.classList.remove('active');
        this.menuToggle.classList.remove('active');

        await this.loadGame(gt);
    }

    showLandingPage() {
        this.gameView.classList.remove('game-view-active');
        this.gameView.classList.add('game-view-hidden');
        setTimeout(() => {
            this.landingPage.classList.remove('fade-out');
        }, 300);
    }

    showAuthModal() {
        this.authModal.classList.remove('hidden');
    }

    hideAuthModal() {
        this.authModal.classList.add('hidden');
    }

    setCamera(x, y, z) { const s = this.isMobile ? 1.3 : 1; this.camera.position.set(x * s, y * s, z * s); this.camera.lookAt(0, 0, 0); this.controls.target.set(0, 0, 0); this.controls.update(); }

    async loadGame(gt) {
        this.loadingText.innerText = `Loading ${gt}...`;
        this.loadingOverlay.classList.remove('hidden');
        this.loadingBar.style.width = '10%';
        if (this.board) { this.scene.remove(this.board); this.board = null; }
        if (this.piecesGroup) this.scene.remove(this.piecesGroup);
        if (this.hitboxes) this.hitboxes.forEach(h => this.scene.remove(h));
        if (this.highlights) this.highlights.forEach(h => this.scene.remove(h));
        this.piecesGroup = new THREE.Group(); this.scene.add(this.piecesGroup);
        this.hitboxes = []; this.highlights = [];
        this.gameState = { gameOver: false }; this.models = {}; this.animating = false;
        const bp = '/assets/gltf';
        const load = async u => (await this.loader.loadAsync(`${bp}/${u}`)).scene;
        this.loadingBar.style.width = '30%';
        try {
            await this['setup_' + gt](load);
            this.loadingBar.style.width = '80%';
            if (this.board) this.board.traverse(c => { if (c.isMesh) { c.receiveShadow = true; c.castShadow = true; } });
        } catch (err) { console.error('Load Error:', err); this.gameStatus.innerText = 'Error: ' + err.message; }
        const dg = ['ludo', 'monopoly', 'backgammon'];
        this.rollBtn.classList.toggle('hidden', !dg.includes(gt));
        if (!dg.includes(gt)) this.diceResultUI.classList.add('hidden');
        this.loadingBar.style.width = '100%';
        this._needsRender = true;
        setTimeout(() => this.loadingOverlay.classList.add('hidden'), 300);
    }

    getBoardMetrics(b) { b.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(b); return { size: box.getSize(new THREE.Vector3()), center: box.getCenter(new THREE.Vector3()) }; }

    placePiece(key, x, y, z, color, scale = 0.3, rotY = 0) {
        const p = this.models[key].clone();
        p.scale.set(scale, scale, scale);
        if (rotY) p.rotation.y = rotY;
        p.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(p);
        const c = box.getCenter(new THREE.Vector3());
        const bot = box.min.y;
        p.position.set(x - (c.x - p.position.x), y - (bot - p.position.y), z - (c.z - p.position.z));
        p.traverse(ch => { if (ch.isMesh) { ch.castShadow = true; ch.material = ch.material.clone(); ch.material.color.set(color); } });
        this.piecesGroup.add(p);
        return p;
    }

    updateTurnUI(player, color) {
        this.playerTurn.innerText = player; this.playerTurn.style.color = color;
        if (this.mobilePlayerTurn) { this.mobilePlayerTurn.innerText = player; this.mobilePlayerTurn.style.color = color; }
    }

    clearHighlights() { this.highlights.forEach(h => this.scene.remove(h)); this.highlights = []; }

    addHighlight(x, y, z, sz, color = 0x00ff88) {
        const m = new THREE.Mesh(new THREE.RingGeometry(sz * 0.3, sz * 0.45, 32), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
        m.rotation.x = -Math.PI / 2; m.position.set(x, y + 0.02, z);
        this.scene.add(m); this.highlights.push(m); return m;
    }

    animateMove(obj, tx, ty, tz, cb) {
        this.animating = true;
        this._needsRender = true;
        const sx = obj.position.x, sy = obj.position.y, sz = obj.position.z;
        let t = 0;
        const step = () => {
            t += 0.05; if (t > 1) t = 1;
            obj.position.x = sx + (tx - sx) * t;
            obj.position.z = sz + (tz - sz) * t;
            obj.position.y = sy + (ty - sy) * t + Math.sin(t * Math.PI) * 0.6;
            if (t < 1) requestAnimationFrame(step);
            else { obj.position.set(tx, ty, tz); this.animating = false; if (cb) cb(); }
        };
        step();
    }

    // ═══════════════════════ TIC TAC TOE ═══════════════════════
    async setup_tictactoe(load) {
        this.gameStatus.innerText = 'Take turns placing X and O. Connect 3 in a row to win!';
        this.board = await load('Boards/TicTacToe/tictactoe-board-tan-black.gltf');
        this.scene.add(this.board);
        this.models.x = await load('Pieces/XO/x-v1-white-black.gltf');
        this.models.o = await load('Pieces/XO/o-v1-white-black.gltf');
        const { size, center } = this.getBoardMetrics(this.board);
        const cell = Math.min(size.x, size.z) * 0.82 / 3;
        const topY = center.y + size.y / 2 + 0.05;
        this.gameState = { board: Array(9).fill(null), currentPlayer: 'X', gameOver: false, cell, topY, center };
        for (let i = 0; i < 9; i++) {
            const bx = new THREE.Mesh(new THREE.BoxGeometry(cell * 0.9, 0.2, cell * 0.9), new THREE.MeshBasicMaterial({ visible: false }));
            bx.position.set(center.x + (i % 3 - 1) * cell, topY, center.z + (Math.floor(i / 3) - 1) * cell);
            bx.userData = { index: i }; this.scene.add(bx); this.hitboxes.push(bx);
        }
        this.setCamera(0, 6, 5);
        this.updateTurnUI('X', '#6366f1');
    }

    // ═══════════════════════ CHECKERS ═══════════════════════
    async setup_checkers(load) {
        this.gameStatus.innerText = 'Select your piece, then click a valid diagonal move. Jump to capture!';
        this.board = await load('Boards/Checkers/checkers-board-tan-black.gltf');
        this.scene.add(this.board);
        this.models.man = await load('Pieces/Man/man-v1-white.gltf');
        const { size, center } = this.getBoardMetrics(this.board);
        const cell = Math.min(size.x, size.z) * 0.88 / 8;
        const topY = center.y + size.y / 2 + 0.02;
        // board[r][c] = null | { color: 'Red'|'Blue', king: false, mesh }
        const board = Array.from({ length: 8 }, () => Array(8).fill(null));
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 === 1) {
                const x = center.x + (c - 3.5) * cell, z = center.z + (r - 3.5) * cell;
                if (r < 3) { const m = this.placePiece('man', x, topY, z, 0x3b82f6, 0.3); board[r][c] = { color: 'Blue', king: false, mesh: m }; }
                else if (r > 4) { const m = this.placePiece('man', x, topY, z, 0xf43f5e, 0.3); board[r][c] = { color: 'Red', king: false, mesh: m }; }
            }
        }
        // Hitboxes for all dark squares
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) {
            const hb = new THREE.Mesh(new THREE.BoxGeometry(cell * 0.9, 0.15, cell * 0.9), new THREE.MeshBasicMaterial({ visible: false }));
            hb.position.set(center.x + (c - 3.5) * cell, topY, center.z + (r - 3.5) * cell);
            hb.userData = { type: 'sq', row: r, col: c }; this.scene.add(hb); this.hitboxes.push(hb);
        }
        this.gameState = { board, currentPlayer: 'Red', gameOver: false, selected: null, cell, center, topY };
        this.setCamera(0, 7, 6);
        this.updateTurnUI('Red', '#f43f5e');
    }

    getCheckerMoves(r, c) {
        const gs = this.gameState, b = gs.board, p = b[r][c];
        if (!p) return [];
        const dirs = p.king ? [-1, 1] : (p.color === 'Red' ? [-1] : [1]);
        const moves = [], jumps = [];
        for (const dr of dirs) for (const dc of [-1, 1]) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                if (!b[nr][nc]) moves.push({ r: nr, c: nc, jump: false });
                else if (b[nr][nc].color !== p.color) {
                    const jr = nr + dr, jc = nc + dc;
                    if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && !b[jr][jc]) jumps.push({ r: jr, c: jc, jump: true, captR: nr, captC: nc });
                }
            }
        }
        return jumps.length > 0 ? jumps : moves; // Must jump if possible
    }

    // ═══════════════════════ CHESS ═══════════════════════
    async setup_chess(load) {
        this.gameStatus.innerText = 'Select your piece, valid moves highlight. Click to move. Capture by landing on opponent.';
        this.board = await load('Boards/Chess/chess-board-brown-white.gltf');
        this.scene.add(this.board);
        const types = ['pawn', 'rock', 'knight', 'bishop', 'queen', 'king'];
        for (const col of ['white', 'black']) for (const t of types) this.models[`chess_${t}_${col}`] = await load(`Pieces/Chess/chess-${t}-${col}.gltf`);
        const { size, center } = this.getBoardMetrics(this.board);
        const cell = Math.min(size.x, size.z) * 0.88 / 8;
        const topY = center.y + size.y / 2 + 0.01;
        const order = ['rock', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rock'];
        // board[r][c] = null | { type, color, mesh }
        const board = Array.from({ length: 8 }, () => Array(8).fill(null));
        for (let i = 0; i < 8; i++) {
            const x = c => center.x + (c - 3.5) * cell;
            const z = r => center.z + (r - 3.5) * cell;
            // Row 0 = black back, Row 1 = black pawns, Row 6 = white pawns, Row 7 = white back
            const wb = this.placePiece(`chess_${order[i]}_white`, x(i), topY, z(7), 0xffffff, 0.45);
            board[7][i] = { type: order[i], color: 'White', mesh: wb };
            const wp = this.placePiece('chess_pawn_white', x(i), topY, z(6), 0xffffff, 0.45);
            board[6][i] = { type: 'pawn', color: 'White', mesh: wp };
            const bb = this.placePiece(`chess_${order[i]}_black`, x(i), topY, z(0), 0x333333, 0.45, Math.PI);
            board[0][i] = { type: order[i], color: 'Black', mesh: bb };
            const bp = this.placePiece('chess_pawn_black', x(i), topY, z(1), 0x333333, 0.45, Math.PI);
            board[1][i] = { type: 'pawn', color: 'Black', mesh: bp };
        }
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const hb = new THREE.Mesh(new THREE.BoxGeometry(cell * 0.95, 0.1, cell * 0.95), new THREE.MeshBasicMaterial({ visible: false }));
            hb.position.set(center.x + (c - 3.5) * cell, topY, center.z + (r - 3.5) * cell);
            hb.userData = { type: 'sq', row: r, col: c }; this.scene.add(hb); this.hitboxes.push(hb);
        }
        this.gameState = { board, currentPlayer: 'White', gameOver: false, selected: null, validMoves: [], cell, center, topY };
        this.setCamera(0, 8, 7);
        this.updateTurnUI('White', '#f8fafc');
    }

    getChessMoves(r, c) {
        const b = this.gameState.board, p = b[r][c];
        if (!p) return [];
        const moves = [], col = p.color;
        const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
        const canGo = (r, c) => inB(r, c) && (!b[r][c] || b[r][c].color !== col);
        const isEmpty = (r, c) => inB(r, c) && !b[r][c];
        const isEnemy = (r, c) => inB(r, c) && b[r][c] && b[r][c].color !== col;
        const addSlide = (dr, dc) => { for (let i = 1; i < 8; i++) { const nr = r + dr * i, nc = c + dc * i; if (!inB(nr, nc)) break; if (!b[nr][nc]) moves.push([nr, nc]); else { if (b[nr][nc].color !== col) moves.push([nr, nc]); break; } } };

        switch (p.type) {
            case 'pawn': {
                const dir = col === 'White' ? -1 : 1;
                const startRow = col === 'White' ? 6 : 1;
                if (isEmpty(r + dir, c)) { moves.push([r + dir, c]); if (r === startRow && isEmpty(r + 2 * dir, c)) moves.push([r + 2 * dir, c]); }
                if (isEnemy(r + dir, c - 1)) moves.push([r + dir, c - 1]);
                if (isEnemy(r + dir, c + 1)) moves.push([r + dir, c + 1]);
                break;
            }
            case 'rock': addSlide(1, 0); addSlide(-1, 0); addSlide(0, 1); addSlide(0, -1); break;
            case 'bishop': addSlide(1, 1); addSlide(1, -1); addSlide(-1, 1); addSlide(-1, -1); break;
            case 'queen': addSlide(1, 0); addSlide(-1, 0); addSlide(0, 1); addSlide(0, -1); addSlide(1, 1); addSlide(1, -1); addSlide(-1, 1); addSlide(-1, -1); break;
            case 'king': for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (dr === 0 && dc === 0) continue; if (canGo(r + dr, c + dc)) moves.push([r + dr, c + dc]); } break;
            case 'knight': for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) if (canGo(r + dr, c + dc)) moves.push([r + dr, c + dc]); break;
        }
        return moves;
    }

    // ═══════════════════════ LUDO ═══════════════════════
    async setup_ludo(load) {
        this.gameStatus.innerText = 'Roll dice! 6 to enter the track. Click a token to move it forward.';
        this.board = await load('Boards/Ludo/ludo-board-tan-black.gltf');
        this.scene.add(this.board);
        this.models.token = await load('Pieces/Token/token-v1-white.gltf');
        this.models.dice = await load('Dices/dice-v1-white-black.gltf');
        const { size, center } = this.getBoardMetrics(this.board);
        const q = Math.min(size.x, size.z) * 0.28, topY = center.y + size.y / 2 + 0.02;
        const colors = [{ c: 0xf43f5e, name: 'Red', ox: -q, oz: -q }, { c: 0x3b82f6, name: 'Blue', ox: q, oz: -q }, { c: 0x10b981, name: 'Green', ox: -q, oz: q }, { c: 0xfacc15, name: 'Yellow', ox: q, oz: q }];
        const spread = q * 0.3;
        const players = {};
        colors.forEach(b => {
            const tokens = [];
            const offs = [[-spread, -spread], [spread, -spread], [-spread, spread], [spread, spread]];
            offs.forEach((o, i) => {
                const mesh = this.placePiece('token', center.x + b.ox + o[0], topY, center.z + b.oz + o[1], b.c, 0.35);
                tokens.push({ mesh, inBase: true, pos: -1, homeX: center.x + b.ox + o[0], homeZ: center.z + b.oz + o[1] });
            });
            players[b.name] = { tokens, color: b.c };
        });
        this.gameState = { currentPlayer: 'Red', gameOver: false, players, diceResult: null, rolled: false, topY, center };
        this.setCamera(0, 10, 6);
        this.updateTurnUI('Red', '#f43f5e');
    }

    // ═══════════════════════ MONOPOLY ═══════════════════════
    async setup_monopoly(load) {
        this.gameStatus.innerText = 'Roll dice to move around the board. Pass GO to collect!';
        this.board = await load('Boards/Monopoly/monopoly-board-tan-black.gltf');
        this.scene.add(this.board);
        this.models.dice = await load('Dices/dice-v1-white-black.gltf');
        this.models.token = await load('Pieces/Token/token-v1-white.gltf');
        const { size, center } = this.getBoardMetrics(this.board);
        const topY = center.y + size.y / 2 + 0.02;
        const half = Math.min(size.x, size.z) * 0.42;
        // Build 40 board positions around the edge
        const positions = [];
        const steps = 10;
        for (let i = 0; i <= steps; i++) positions.push({ x: center.x + half, z: center.z + half - (i / steps) * 2 * half }); // right side going up
        for (let i = 1; i <= steps; i++) positions.push({ x: center.x + half - (i / steps) * 2 * half, z: center.z - half }); // top going left
        for (let i = 1; i <= steps; i++) positions.push({ x: center.x - half, z: center.z - half + (i / steps) * 2 * half }); // left going down
        for (let i = 1; i < steps; i++) positions.push({ x: center.x - half + (i / steps) * 2 * half, z: center.z + half }); // bottom going right
        const p1 = this.placePiece('token', positions[0].x, topY, positions[0].z, 0xf43f5e, 0.35);
        const p2 = this.placePiece('token', positions[0].x - 0.25, topY, positions[0].z + 0.25, 0x3b82f6, 0.35);
        this.gameState = {
            currentPlayer: 0, gameOver: false, topY, positions,
            players: [
                { mesh: p1, pos: 0, color: '#f43f5e', name: 'Red' },
                { mesh: p2, pos: 0, color: '#3b82f6', name: 'Blue' }
            ],
            rolled: false,
        };
        this.setCamera(0, 10, 7);
        this.updateTurnUI('Red', '#f43f5e');
    }

    // ═══════════════════════ BACKGAMMON ═══════════════════════
    async setup_backgammon(load) {
        this.gameStatus.innerText = 'Roll dice and move your checkers. Bear off all 15 to win!';
        this.board = await load('Boards/Backgammon/backgammon-board-tan-black-brown.gltf');
        this.scene.add(this.board);
        this.models.dice = await load('Dices/dice-v1-white-black.gltf');
        this.models.man = await load('Pieces/Man/man-v1-white.gltf');
        const { size, center } = this.getBoardMetrics(this.board);
        const topY = center.y + size.y / 2 + 0.02;
        // Standard initial setup: point distribution
        const setup = [[0, 2, 'Red'], [5, 5, 'Blue'], [7, 3, 'Blue'], [11, 5, 'Red'], [12, 5, 'Blue'], [16, 3, 'Red'], [18, 5, 'Red'], [23, 2, 'Blue']];
        const pointX = (pt) => { const col = pt < 12 ? (11 - pt) : (pt - 12); return center.x + (col - 5.5) * size.x * 0.065; };
        const pointZ = (pt) => pt < 12 ? center.z + size.z * 0.35 : center.z - size.z * 0.35;
        const dir = (pt) => pt < 12 ? -1 : 1;
        setup.forEach(([pt, count, color]) => {
            for (let i = 0; i < count; i++) {
                this.placePiece('man', pointX(pt), topY + i * 0.08, pointZ(pt) + dir(pt) * i * size.z * 0.06, color === 'Red' ? 0xf43f5e : 0x3b82f6, 0.28);
            }
        });
        this.gameState = { currentPlayer: 'Red', gameOver: false };
        this.setCamera(0, 8, 8);
        this.updateTurnUI('Red', '#f43f5e');
    }

    // ═══════════════════════ MILL (Nine Men's Morris) ═══════════════════════
    async setup_mill(load) {
        this.gameStatus.innerText = 'Click intersections to place pieces. Form 3 in a line (a mill) to remove opponent piece!';
        this.board = await load('Boards/Mill/mill-board-tan-black.gltf');
        this.scene.add(this.board);
        this.models.man = await load('Pieces/Man/man-v1-white.gltf');
        const { size, center } = this.getBoardMetrics(this.board);
        const topY = center.y + size.y / 2 + 0.02;
        // 24 valid positions on a mill board (3 concentric squares, 8 points each)
        const s1 = Math.min(size.x, size.z) * 0.4, s2 = s1 * 0.6, s3 = s1 * 0.2;
        const rings = [s1, s2, s3];
        const points = [];
        rings.forEach(s => {
            const pts = [[-s, -s], [0, -s], [s, -s], [s, 0], [s, s], [0, s], [-s, s], [-s, 0]];
            pts.forEach(([px, pz]) => points.push({ x: center.x + px, z: center.z + pz }));
        });
        // Create hitboxes for each point
        points.forEach((pt, i) => {
            const hb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), new THREE.MeshBasicMaterial({ visible: false }));
            hb.position.set(pt.x, topY, pt.z);
            hb.userData = { type: 'millPt', idx: i };
            this.scene.add(hb); this.hitboxes.push(hb);
        });
        // Mill lines (indexes of points that form mills)
        const mills = [
            [0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 0], // outer
            [8, 9, 10], [10, 11, 12], [12, 13, 14], [14, 15, 8], // middle
            [16, 17, 18], [18, 19, 20], [20, 21, 22], [22, 23, 16], // inner
            [1, 9, 17], [3, 11, 19], [5, 13, 21], [7, 15, 23] // cross connections
        ];
        this.gameState = {
            currentPlayer: 'White', gameOver: false, phase: 'place', // place | move | remove
            board: Array(24).fill(null), points, topY, center,
            piecesLeft: { White: 9, Black: 9 }, mills,
            piecesOnBoard: { White: 0, Black: 0 }
        };
        this.setCamera(0, 8, 6);
        this.updateTurnUI('White', '#f8fafc');
    }

    // ═══════════════════════ CARDS ═══════════════════════
    async setup_cards(load) {
        this.gameStatus.innerText = 'Hearts - Premium Collection Showcase.';
        // Load a full high-value hand
        this.models.c10 = await load('Cards/Hearths/card-hearths-white-black-10.gltf');
        this.models.cJ = await load('Cards/Hearths/card-hearths-white-black-j.gltf');
        this.models.cQ = await load('Cards/Hearths/card-hearths-white-black-q.gltf');
        this.models.cK = await load('Cards/Hearths/card-hearths-white-black-k.gltf');
        this.models.cA = await load('Cards/Hearths/card-hearths-white-black-a.gltf');

        const cards = ['c10', 'cJ', 'cQ', 'cK', 'cA'];
        const scale = 2.5;

        cards.forEach((key, i) => {
            const offset = i - 2;
            const x = offset * 2.5; // Significantly increased spacing
            const z = Math.abs(offset) * 0.4;
            const rotY = -offset * 0.15;

            // Create and place card manually to avoid color override from placePiece
            const c = this.models[key].clone();
            c.scale.set(scale, scale, scale);
            c.position.set(x, 0, z);
            c.rotation.y = rotY;
            c.traverse(ch => { if (ch.isMesh) ch.castShadow = true; });
            this.piecesGroup.add(c);
        });

        this.gameState = { gameOver: true };
        this.setCamera(0, 6, 8);
        this.updateTurnUI('Collection', '#F5F5F7');
    }

    async setup_dominoes(load) {
        this.gameStatus.innerText = 'Dominoes - Premium Collection Showcase.';
        // Load various tiles
        this.models.d00 = await load('Dominoes/dominoes-white-black-0-0.gltf');
        this.models.d01 = await load('Dominoes/dominoes-white-black-0-1.gltf');
        this.models.d11 = await load('Dominoes/dominoes-white-black-1-1.gltf');
        this.models.d22 = await load('Dominoes/dominoes-white-black-2-2.gltf');
        this.models.d33 = await load('Dominoes/dominoes-white-black-3-3.gltf');
        this.models.d66 = await load('Dominoes/dominoes-white-black-6-6.gltf');

        const scale = 1.0;
        const ivory = 0xFCF6F0; // More premium ivory color

        // --- Sequence on Board ---
        // Placing d00, d01, d11 in a chain
        this.placePiece('d00', -2, 0, 0, ivory, scale, Math.PI / 2); // Double 0 (vertical)
        this.placePiece('d01', 0, 0, 0, ivory, scale, 0);           // 0-1 (horizontal)
        this.placePiece('d11', 2, 0, 0, ivory, scale, Math.PI / 2); // Double 1 (vertical)

        // --- Player Hand (Standing) ---
        // Placing d22, d33, d66 standing up in front of the camera
        const handZ = 4;
        const handXStart = -2;
        const handSpacing = 2;
        const handTiles = ['d22', 'd33', 'd66'];

        handTiles.forEach((key, i) => {
            const x = handXStart + i * handSpacing;
            const p = this.placePiece(key, x, 0.4, handZ, ivory, scale, 0);
            p.rotation.x = -Math.PI / 2; // Make it stand up (adjusting for original GLTF orientation if needed)
            // Wait, if placePiece sets rotation.y, I need to be careful.
            // Let's check placePiece implementation.
        });

        this.gameState = { gameOver: true };
        this.setCamera(0, 10, 12);
        this.updateTurnUI('Collection', '#F5F5F7');
    }

    // ═══════════════════════ DICE ROLL ═══════════════════════
    async rollDice() {
        if (this.isRolling || this.animating) return;
        this.isRolling = true;
        this.diceResultUI.classList.remove('hidden');
        this.diceValueDisp.innerText = '...';
        const dice = this.models.dice.clone();
        dice.position.set(0, 5, 0); dice.scale.set(0.5, 0.5, 0.5);
        this.scene.add(dice);
        const result = Math.floor(Math.random() * 6) + 1;
        let t = 0;
        const anim = () => {
            t += 0.06; dice.rotation.x += 0.35; dice.rotation.z += 0.25;
            dice.position.y = 0.5 + Math.abs(Math.sin(t * 6)) * Math.max(0, 3 - t);
            if (t < 2.5) requestAnimationFrame(anim);
            else {
                this.scene.remove(dice);
                this.diceValueDisp.innerText = result;
                this.isRolling = false;
                this.onDiceResult(result);
            }
        };
        anim();
    }

    onDiceResult(val) {
        const gs = this.gameState;
        if (this.currentGame === 'ludo') {
            gs.diceResult = val; gs.rolled = true;
            if (val === 6) this.gameStatus.innerText = `Rolled 6! Click a token in base to enter, or a token on track to move.`;
            else this.gameStatus.innerText = `Rolled ${val}. Click a token on the track to move it forward.`;
            // Auto-advance turn if no moves possible (simplified)
            const player = gs.players[gs.currentPlayer];
            const hasTrack = player.tokens.some(t => !t.inBase);
            const hasBase = player.tokens.some(t => t.inBase);
            if (!hasTrack && (val !== 6 || !hasBase)) {
                this.gameStatus.innerText = `Rolled ${val}. No moves available. Next player.`;
                setTimeout(() => this.advanceLudoTurn(), 1000);
            }
        } else if (this.currentGame === 'monopoly') {
            gs.rolled = true;
            const cp = gs.players[gs.currentPlayer];
            const newPos = (cp.pos + val) % gs.positions.length;
            const target = gs.positions[newPos];
            cp.pos = newPos;
            this.gameStatus.innerText = `${cp.name} rolled ${val}! Moving...`;
            this.animateMove(cp.mesh, target.x, gs.topY, target.z, () => {
                this.gameStatus.innerText = `${cp.name} landed on square ${newPos}. Roll dice for next player.`;
                gs.currentPlayer = (gs.currentPlayer + 1) % gs.players.length;
                const next = gs.players[gs.currentPlayer];
                this.updateTurnUI(next.name, next.color);
                gs.rolled = false;
            });
        } else if (this.currentGame === 'backgammon') {
            this.gameStatus.innerText = `Rolled ${val}. Move your checkers!`;
            const players = ['Red', 'Blue'], colors = ['#f43f5e', '#3b82f6'];
            const idx = (players.indexOf(gs.currentPlayer) + 1) % 2;
            gs.currentPlayer = players[idx];
            this.updateTurnUI(players[idx], colors[idx]);
        }
    }

    advanceLudoTurn() {
        const p = ['Red', 'Blue', 'Green', 'Yellow'], c = ['#f43f5e', '#3b82f6', '#10b981', '#facc15'];
        const gs = this.gameState;
        const idx = (p.indexOf(gs.currentPlayer) + 1) % 4;
        gs.currentPlayer = p[idx]; gs.rolled = false; gs.diceResult = null;
        this.updateTurnUI(p[idx], c[idx]);
        this.gameStatus.innerText = `${p[idx]}'s turn. Roll the dice!`;
    }

    // ═══════════════════════ CLICK HANDLER ═══════════════════════
    onClick(e) {
        if (this.gameState.gameOver || this.animating) return;
        this._needsRender = true;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        switch (this.currentGame) {
            case 'tictactoe': this.clickTTT(); break;
            case 'checkers': this.clickCheckers(); break;
            case 'chess': this.clickChess(); break;
            case 'ludo': this.clickLudo(); break;
            case 'mill': this.clickMill(); break;
        }
    }

    clickTTT() {
        const hit = this.raycaster.intersectObjects(this.hitboxes);
        if (hit.length > 0) { const idx = hit[0].object.userData.index; if (!this.gameState.board[idx]) this.makeTTTMove(idx); }
    }

    makeTTTMove(idx) {
        const gs = this.gameState, p = gs.currentPlayer;
        gs.board[idx] = p;
        const target = this.hitboxes[idx].position;
        const piece = this.placePiece(p === 'X' ? 'x' : 'o', target.x, target.y + 3, target.z, p === 'X' ? 0x6366f1 : 0xf43f5e, 0.7);
        this.animateMove(piece, target.x, target.y + 0.05, target.z, () => {
            const lines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
            if (lines.some(([a, b, c]) => gs.board[a] && gs.board[a] === gs.board[b] && gs.board[a] === gs.board[c])) {
                gs.gameOver = true;
                this.updateTurnUI(`${p} WINS!`, p === 'X' ? '#6366f1' : '#f43f5e');
                this.gameStatus.innerText = `Player ${p} wins! 🎉`;
            } else if (!gs.board.includes(null)) {
                gs.gameOver = true; this.updateTurnUI('DRAW', '#94a3b8');
                this.gameStatus.innerText = "It's a draw!";
            } else {
                gs.currentPlayer = p === 'X' ? 'O' : 'X';
                this.updateTurnUI(gs.currentPlayer, p === 'X' ? '#f43f5e' : '#6366f1');
            }
        });
    }

    clickCheckers() {
        const gs = this.gameState, b = gs.board;
        const hitSq = this.raycaster.intersectObjects(this.hitboxes);
        if (hitSq.length === 0) return;
        const { row: r, col: c } = hitSq[0].object.userData;
        if (gs.selected) {
            const moves = this.getCheckerMoves(gs.selected.r, gs.selected.c);
            const move = moves.find(m => m.r === r && m.c === c);
            if (move) {
                const piece = b[gs.selected.r][gs.selected.c];
                const cell = gs.cell, cen = gs.center, topY = gs.topY;
                const tx = cen.x + (c - 3.5) * cell, tz = cen.z + (r - 3.5) * cell;
                b[r][c] = piece; b[gs.selected.r][gs.selected.c] = null;
                if (move.jump) { const cap = b[move.captR][move.captC]; this.piecesGroup.remove(cap.mesh); b[move.captR][move.captC] = null; }
                this.animateMove(piece.mesh, tx, topY, tz, () => {
                    // King promotion
                    if ((piece.color === 'Red' && r === 0) || (piece.color === 'Blue' && r === 7)) {
                        piece.king = true;
                        piece.mesh.traverse(ch => { if (ch.isMesh) ch.material.emissive = new THREE.Color(0xffd700); ch.material.emissiveIntensity = 0.3; });
                    }
                    // Check for extra jump
                    if (move.jump) { const extra = this.getCheckerMoves(r, c).filter(m => m.jump); if (extra.length > 0) { gs.selected = { r, c }; this.clearHighlights(); extra.forEach(m => this.addHighlight(cen.x + (m.c - 3.5) * cell, topY, cen.z + (m.r - 3.5) * cell, cell)); return; } }
                    this.clearHighlights(); gs.selected = null;
                    gs.currentPlayer = gs.currentPlayer === 'Red' ? 'Blue' : 'Red';
                    this.updateTurnUI(gs.currentPlayer, gs.currentPlayer === 'Red' ? '#f43f5e' : '#3b82f6');
                    this.checkCheckersWin();
                });
            } else if (b[r][c] && b[r][c].color === gs.currentPlayer) {
                this.selectCheckerPiece(r, c);
            } else { this.clearHighlights(); gs.selected = null; }
        } else if (b[r][c] && b[r][c].color === gs.currentPlayer) {
            this.selectCheckerPiece(r, c);
        }
    }

    selectCheckerPiece(r, c) {
        const gs = this.gameState;
        this.clearHighlights(); gs.selected = { r, c };
        const moves = this.getCheckerMoves(r, c);
        moves.forEach(m => this.addHighlight(gs.center.x + (m.c - 3.5) * gs.cell, gs.topY, gs.center.z + (m.r - 3.5) * gs.cell, gs.cell));
    }

    checkCheckersWin() {
        const gs = this.gameState, b = gs.board;
        let red = 0, blue = 0;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { if (b[r][c]) { if (b[r][c].color === 'Red') red++; else blue++; } }
        if (red === 0) { gs.gameOver = true; this.updateTurnUI('Blue WINS!', '#3b82f6'); this.gameStatus.innerText = 'Blue wins! 🎉'; }
        else if (blue === 0) { gs.gameOver = true; this.updateTurnUI('Red WINS!', '#f43f5e'); this.gameStatus.innerText = 'Red wins! 🎉'; }
    }

    clickChess() {
        const gs = this.gameState, b = gs.board;
        const hitSq = this.raycaster.intersectObjects(this.hitboxes);
        if (hitSq.length === 0) return;
        const { row: r, col: c } = hitSq[0].object.userData;
        if (gs.selected) {
            const isValid = gs.validMoves.some(([mr, mc]) => mr === r && mc === c);
            if (isValid) {
                const piece = b[gs.selected.r][gs.selected.c];
                // Capture
                if (b[r][c]) {
                    const captured = b[r][c];
                    this.piecesGroup.remove(captured.mesh);
                    if (captured.type === 'king') { gs.gameOver = true; }
                }
                b[r][c] = piece; b[gs.selected.r][gs.selected.c] = null;
                const tx = gs.center.x + (c - 3.5) * gs.cell, tz = gs.center.z + (r - 3.5) * gs.cell;
                // Pawn promotion
                if (piece.type === 'pawn' && (r === 0 || r === 7)) piece.type = 'queen';
                this.animateMove(piece.mesh, tx, gs.topY, tz, () => {
                    this.clearHighlights(); gs.selected = null; gs.validMoves = [];
                    if (gs.gameOver) {
                        this.updateTurnUI(`${gs.currentPlayer} WINS!`, gs.currentPlayer === 'White' ? '#f8fafc' : '#64748b');
                        this.gameStatus.innerText = `${gs.currentPlayer} wins by capturing the King! 👑`;
                    } else {
                        gs.currentPlayer = gs.currentPlayer === 'White' ? 'Black' : 'White';
                        this.updateTurnUI(gs.currentPlayer, gs.currentPlayer === 'White' ? '#f8fafc' : '#64748b');
                    }
                });
            } else if (b[r][c] && b[r][c].color === gs.currentPlayer) {
                this.selectChessSquare(r, c);
            } else { this.clearHighlights(); gs.selected = null; gs.validMoves = []; }
        } else if (b[r][c] && b[r][c].color === gs.currentPlayer) {
            this.selectChessSquare(r, c);
        }
    }

    selectChessSquare(r, c) {
        const gs = this.gameState;
        this.clearHighlights();
        gs.selected = { r, c };
        gs.validMoves = this.getChessMoves(r, c);
        gs.validMoves.forEach(([mr, mc]) => {
            const color = gs.board[mr][mc] ? 0xFF3131 : 0x00D8FF;
            this.addHighlight(gs.center.x + (mc - 3.5) * gs.cell, gs.topY, gs.center.z + (mr - 3.5) * gs.cell, gs.cell, color);
        });
    }

    clickLudo() {
        const gs = this.gameState;
        if (!gs.rolled) { this.gameStatus.innerText = 'Roll the dice first!'; return; }
        // Simplified: clicking any token of current player moves it
        const player = gs.players[gs.currentPlayer];
        // Find token meshes
        const meshes = player.tokens.map(t => t.mesh);
        const hit = this.raycaster.intersectObjects(meshes, true);
        if (hit.length === 0) return;
        let clickedMesh = hit[0].object;
        while (clickedMesh.parent && !meshes.includes(clickedMesh)) clickedMesh = clickedMesh.parent;
        const token = player.tokens.find(t => t.mesh === clickedMesh);
        if (!token) return;
        if (token.inBase && gs.diceResult === 6) {
            token.inBase = false; token.pos = 0;
            // Move to start position (just offset from center)
            const angle = ['Red', 'Blue', 'Green', 'Yellow'].indexOf(gs.currentPlayer) * Math.PI / 2;
            const r = Math.min(this.getBoardMetrics(this.board).size.x, this.getBoardMetrics(this.board).size.z) * 0.15;
            const tx = gs.center.x + Math.cos(angle) * r, tz = gs.center.z + Math.sin(angle) * r;
            this.animateMove(token.mesh, tx, gs.topY, tz, () => { this.advanceLudoTurn(); });
        } else if (!token.inBase) {
            token.pos += gs.diceResult;
            const angle = ['Red', 'Blue', 'Green', 'Yellow'].indexOf(gs.currentPlayer) * Math.PI / 2 + (token.pos * 0.15);
            const r = Math.min(this.getBoardMetrics(this.board).size.x, this.getBoardMetrics(this.board).size.z) * 0.15 + token.pos * 0.12;
            const tx = gs.center.x + Math.cos(angle) * r, tz = gs.center.z + Math.sin(angle) * r;
            this.animateMove(token.mesh, tx, gs.topY, tz, () => { this.advanceLudoTurn(); });
        }
    }

    clickMill() {
        const gs = this.gameState;
        const hitPt = this.raycaster.intersectObjects(this.hitboxes);
        if (hitPt.length === 0) return;
        const idx = hitPt[0].object.userData.idx;
        if (gs.phase === 'place') {
            if (gs.board[idx]) return;
            const col = gs.currentPlayer;
            const pt = gs.points[idx];
            const mesh = this.placePiece('man', pt.x, gs.topY, pt.z, col === 'White' ? 0xF5F5F7 : 0x1A1A1A, 0.25);
            gs.board[idx] = { color: col, mesh };
            gs.piecesLeft[col]--;
            gs.piecesOnBoard[col]++;
            // Check mill formed
            if (this.checkMillFormed(idx, col)) {
                gs.phase = 'remove';
                this.gameStatus.innerText = `Mill! Click an opponent piece to remove it.`;
                return;
            }
            this.advanceMillTurn();
        } else if (gs.phase === 'remove') {
            if (!gs.board[idx] || gs.board[idx].color === gs.currentPlayer) return;
            this.piecesGroup.remove(gs.board[idx].mesh);
            const opp = gs.board[idx].color;
            gs.board[idx] = null;
            gs.piecesOnBoard[opp]--;
            // Check win
            if (gs.piecesOnBoard[opp] + gs.piecesLeft[opp] < 3) {
                gs.gameOver = true;
                this.updateTurnUI(`${gs.currentPlayer} WINS!`, gs.currentPlayer === 'White' ? '#F5F5F7' : '#FF3131');
                this.gameStatus.innerText = `${gs.currentPlayer} wins! 🎉`;
                return;
            }
            gs.phase = 'place';
            this.advanceMillTurn();
        }
    }

    checkMillFormed(idx, color) {
        return this.gameState.mills.some(mill => mill.includes(idx) && mill.every(i => this.gameState.board[i] && this.gameState.board[i].color === color));
    }

    advanceMillTurn() {
        const gs = this.gameState;
        gs.currentPlayer = gs.currentPlayer === 'White' ? 'Black' : 'White';
        this.updateTurnUI(gs.currentPlayer, gs.currentPlayer === 'White' ? '#F5F5F7' : '#FF3131');
        if (gs.piecesLeft.White === 0 && gs.piecesLeft.Black === 0) {
            gs.phase = 'move'; // TODO: implement move phase
            this.gameStatus.innerText = `All pieces placed! Phase: Move pieces along lines.`;
        } else {
            this.gameStatus.innerText = `${gs.currentPlayer}'s turn. Place a piece. (${gs.piecesLeft[gs.currentPlayer]} left)`;
        }
    }

    resetGame() { this.loadGame(this.currentGame); }

    onResize() {
        this.isMobile = window.innerWidth <= 768;
        const w = this.container.clientWidth, h = this.container.clientHeight;
        if (w > 0 && h > 0) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h); }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.controls.update() || this.animating || this._needsRender) {
            this.renderer.render(this.scene, this.camera);
            this._needsRender = false;
        }
    }
}

new GameEngine();
