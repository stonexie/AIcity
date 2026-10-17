// Local Blender MCP Bridge + NetEase Leihuo Tripo 3D OpenAPI v2 Live Generator & Scene Spawner.
import * as THREE from 'three/webgpu';
import './aiBridgePanel.css';

const STORAGE_KEY = 'nk_aibridge_config_v1';

const TRIPO_PRESETS = [
  { label: '赛博拉面摊车', prompt: 'Cyberpunk neon street ramen food stall cart with glowing lanterns, weathered metal, PBR game asset' },
  { label: '未来自动售货机', prompt: 'Japanese cyberpunk holographic beverage vending machine with neon kanji signage, realistic wet metal' },
  { label: '浮空巡逻警车', prompt: 'Futuristic Tokyo cyberpunk hover patrol vehicle, sleek black and white armor with red LED lightbar' },
  { label: '街头全息广告柱', prompt: 'Cyberpunk street holographic advertisement pillar totem with cables and power boxes' },
];

const BLENDER_SCRIPTS = [
  {
    label: '生成赛博霓虹建筑块',
    code: `import bpy, bmesh
bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 2.5))
obj = bpy.context.active_object
obj.name = "NK_Cyber_Block"
obj.scale = (1.6, 1.6, 2.5)
bpy.ops.object.transform_apply(scale=True)
mat = bpy.data.materials.new(name="NK_Neon_Mat")
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get("Principled BSDF")
if bsdf:
    bsdf.inputs["Base Color"].default_value = (0.05, 0.08, 0.12, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.85
    bsdf.inputs["Roughness"].default_value = 0.25
obj.data.materials.append(mat)
result = f"Created {obj.name} ({len(obj.data.vertices)} verts)"`,
  },
  {
    label: '给选中物体添加赛博发光材质',
    code: `import bpy
obj = bpy.context.active_object
if obj and obj.type == 'MESH':
    mat = bpy.data.materials.new(name="NK_Cyan_Glow")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.08, 0.9, 1.0, 1.0)
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (0.1, 0.95, 1.0, 1.0)
            bsdf.inputs["Emission Strength"].default_value = 4.0
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    result = f"Applied neon material to {obj.name}"
else:
    result = "No active mesh object selected"`,
  },
];

// Zero-dependency Python 3 local bridge script (HTTP 8765 <-> Blender MCP TCP 9876)
const LOCAL_BRIDGE_PY = `#!/usr/bin/env python3
"""
NEON KAIDO <-> Local Blender MCP Bridge (Zero Dependencies)
Usage:
  1. In Blender, enable the Blender MCP addon and click "Start Server" (TCP 127.0.0.1:9876).
  2. Run this script on your computer:  python blender_mcp_bridge.py
  3. In the NEON KAIDO web UI, click "连接本机 Blender" or "一键同步 Blender 模型到城市".
"""
import json, socket
from http.server import BaseHTTPRequestHandler, HTTPServer

BLENDER_HOST = "127.0.0.1"
BLENDER_PORT = 9876
BRIDGE_PORT = 8765

def send_to_blender(payload: dict) -> dict:
    with socket.create_connection((BLENDER_HOST, BLENDER_PORT), timeout=30) as s:
        s.sendall(json.dumps(payload).encode("utf-8"))
        chunks = []
        s.settimeout(30)
        while True:
            data = s.recv(65536)
            if not data:
                break
            chunks.append(data)
            try:
                return json.loads(b"".join(chunks).decode("utf-8"))
            except json.JSONDecodeError:
                continue
        raw = b"".join(chunks).decode("utf-8", errors="replace")
        return json.loads(raw) if raw else {"status": "error", "message": "Empty response from Blender"}

class Handler(BaseHTTPRequestHandler):
    def _headers(self, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

    def do_OPTIONS(self):
        self._headers(204)

    def do_GET(self):
        try:
            resp = send_to_blender({"type": "get_scene_info", "params": {}})
            self._headers(200)
            self.wfile.write(json.dumps({"ok": True, "blender": resp}).encode("utf-8"))
        except Exception as e:
            self._headers(502)
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        try:
            resp = send_to_blender(body)
            self._headers(200)
            self.wfile.write(json.dumps({"ok": True, "blender": resp}).encode("utf-8"))
        except Exception as e:
            self._headers(502)
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))

    def log_message(self, fmt, *args):
        print("[BlenderBridge]", fmt % args)

if __name__ == "__main__":
    print(f"Blender MCP HTTP Bridge listening on http://127.0.0.1:{BRIDGE_PORT} -> TCP {BLENDER_HOST}:{BLENDER_PORT}")
    HTTPServer(("127.0.0.1", BRIDGE_PORT), Handler).serve_forever()
`;

// Python snippet executed inside Blender via MCP `execute_code` to export selection/scene as base64 GLB
const EXPORT_GLB_BPY = (onlySelection) => `
import bpy, tempfile, os, base64
tmp = os.path.join(tempfile.gettempdir(), "nk_blender_live.glb")
sel_only = ${onlySelection ? 'True' : 'False'}
if sel_only and not bpy.context.selected_objects:
    sel_only = False
bpy.ops.export_scene.gltf(
    filepath=tmp,
    export_format='GLB',
    use_selection=sel_only,
    export_apply=True,
    export_yup=True
)
with open(tmp, "rb") as f:
    b64 = base64.b64encode(f.read()).decode("ascii")
print("NK_GLB_B64_START:" + b64 + ":NK_GLB_B64_END")
result = {"glb_b64": b64, "bytes": os.path.getsize(tmp)}
`;

export class AIBridgePanel {
  constructor(ctx, hud) {
    this.ctx = ctx;
    this.hud = hud;
    this.open = false;
    this.tab = 'tripo';
    this.spawned = [];
    this.blenderConnected = false;
    this.pollingTimer = null;

    this.cfg = {
      tripoBaseUrl: 'https://ai.leihuo.netease.com',
      tripoKey: '',
      tripoHeaderName: 'Authorization',
      tripoHeaderPrefix: 'Bearer ',
      tripoModelVer: 'v2.5-20250123',
      targetHeight: 2.4,
      addCollider: true,
      blenderBridgeUrl: 'http://127.0.0.1:8765',
      ...this.loadConfig(),
    };

    this.spawnGroup = new THREE.Group();
    this.spawnGroup.name = 'ai_bridge_spawned';
    ctx.scene.add(this.spawnGroup);

    this.buildUI();
    this.bindKeys();
  }

  loadConfig() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cfg));
    } catch { /* ignore */ }
  }

  bindKeys() {
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.code === 'Escape') {
          document.activeElement.blur();
          this.toggle(false);
        }
        e.stopPropagation();
        return;
      }
      if (e.code === 'KeyB' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.toggle();
      }
    }, true);
  }

  toggle(force) {
    const next = force !== undefined ? force : !this.open;
    this.open = next;
    this.ctx.uiModalOpen = next;
    this.panelEl.classList.toggle('open', next);
    this.launchBtn.classList.toggle('active', next);
    if (next && document.pointerLockElement) {
      try { document.exitPointerLock?.(); } catch { /* ignore */ }
    }
  }

  switchTab(tab) {
    this.tab = tab;
    this.panelEl.querySelectorAll('.nk-ab-tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
    this.panelEl.querySelectorAll('.nk-ab-pane').forEach((p) => p.classList.toggle('on', p.dataset.pane === tab));
  }

  buildUI() {
    const host = this.hud.root;

    // Floating quick-launch button (accessible in both Title & Gameplay)
    const btn = document.createElement('button');
    btn.className = 'nk-aibridge-btn';
    btn.innerHTML = `<span class="dot"></span><span>[B] BLENDER MCP + 雷火 TRIPO 3D</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    host.appendChild(btn);
    this.launchBtn = btn;

    const panel = document.createElement('div');
    panel.className = 'nk-aibridge';
    panel.addEventListener('click', (e) => e.stopPropagation());
    panel.innerHTML = `
      <div class="nk-ab-head">
        <div class="nk-ab-title">
          <span class="kicker">NEURAL FABRICATOR // 实时 3D 资产管线</span>
          <h3>TRIPO 3D & BLENDER MCP</h3>
        </div>
        <button class="nk-ab-close" type="button">关闭 [B]</button>
      </div>

      <div class="nk-ab-tabs">
        <div class="nk-ab-tab on" data-tab="tripo">雷火 TRIPO 3D</div>
        <div class="nk-ab-tab" data-tab="blender">本地 BLENDER MCP</div>
        <div class="nk-ab-tab" data-tab="scene">场景模型 (<span class="ab-cnt">0</span>)</div>
      </div>

      <div class="nk-ab-body">
        <!-- ==================== TAB 1: TRIPO 3D ==================== -->
        <div class="nk-ab-pane on" data-pane="tripo">
          <div class="nk-ab-sec">
            <div class="nk-ab-sec-h">
              <span>端点信息 · ENDPOINTS</span>
              <span class="nk-ab-badge ok">OPENAPI V2</span>
            </div>
            <div class="nk-ab-endpoints">
              <div class="nk-ab-ep"><span class="tag">tripo-generation</span><span class="m">POST</span><span class="p">/v2/openapi/task</span></div>
              <div class="nk-ab-ep"><span class="tag">tripo-task</span><span class="m get">GET</span><span class="p">/v2/openapi/task/{task_id}</span></div>
              <div class="nk-ab-ep"><span class="tag">tripo-upload</span><span class="m">POST</span><span class="p">/v2/openapi/upload/sts</span></div>
            </div>
            <div class="nk-ab-lbl" style="margin-top:4px">
              <span>网关地址 (BASE URL)</span>
              <span class="nk-ab-chips">
                <span class="nk-ab-chip" data-url="https://ai.leihuo.netease.com">雷火网关</span>
                <span class="nk-ab-chip" data-url="https://api.tripo3d.ai">Tripo公网</span>
              </span>
            </div>
            <input class="nk-ab-inp ab-tripo-url" type="text" placeholder="https://ai.leihuo.netease.com" />
            <div class="nk-ab-lbl">
              <span>API KEY / BEARER TOKEN</span>
              <span style="font-size:10px;color:#5ef6ff">自动保存在浏览器本地</span>
            </div>
            <input class="nk-ab-inp ab-tripo-key" type="password" placeholder="输入雷火 AI 平台 Token 或 Tripo tsk_... 密钥" />
            <div class="nk-ab-row">
              <div style="flex:1">
                <div class="nk-ab-lbl">Header 名称</div>
                <input class="nk-ab-inp ab-tripo-hname" type="text" placeholder="Authorization" />
              </div>
              <div style="flex:1">
                <div class="nk-ab-lbl">前缀 (Prefix)</div>
                <input class="nk-ab-inp ab-tripo-hprefix" type="text" placeholder="Bearer " />
              </div>
            </div>
          </div>

          <div class="nk-ab-sec">
            <div class="nk-ab-sec-h">
              <span>1. 文生 3D / 图生 3D (POST /v2/openapi/task)</span>
            </div>
            <div class="nk-ab-chips ab-prompt-presets">
              ${TRIPO_PRESETS.map((p, i) => `<span class="nk-ab-chip" data-pi="${i}">+ ${p.label}</span>`).join('')}
            </div>
            <textarea class="nk-ab-ta ab-tripo-prompt" placeholder="描述你想生成的 3D 模型（支持中文或英文 Prompt），生成完成后将自动加载到玩家面前的街道上...">${TRIPO_PRESETS[0].prompt}</textarea>
            <div class="nk-ab-row">
              <div style="flex:1">
                <div class="nk-ab-lbl">模型版本</div>
                <select class="nk-ab-sel ab-tripo-ver">
                  <option value="v2.5-20250123">Tripo v2.5 (20250123)</option>
                  <option value="Turbo-v1.0-20250506">Tripo Turbo v1.0</option>
                  <option value="v2.0-20240919">Tripo v2.0</option>
                  <option value="">默认版本 (不传 model_version)</option>
                </select>
              </div>
              <div style="width:110px">
                <div class="nk-ab-lbl">目标高度 (米)</div>
                <input class="nk-ab-inp ab-target-h" type="number" step="0.2" min="0.2" max="30" value="2.4" />
              </div>
            </div>
            <div class="nk-ab-row">
              <button class="nk-ab-btn ab-btn-text3d" type="button" style="flex:1">⚡ 发起文生 3D 任务</button>
              <label class="nk-ab-btn sec" style="cursor:pointer;text-align:center">
                🖼️ 图生 3D (上传图片)
                <input class="ab-file-img3d" type="file" accept="image/png,image/jpeg,image/webp" style="display:none" />
              </label>
            </div>
          </div>

          <div class="nk-ab-sec">
            <div class="nk-ab-sec-h">
              <span>2. 查询任务 / 直接加载 (GET /v2/openapi/task/{task_id})</span>
            </div>
            <div class="nk-ab-row">
              <input class="nk-ab-inp ab-task-id" type="text" placeholder="输入已有 task_id 或直接粘贴 .glb 模型链接" style="flex:1" />
              <button class="nk-ab-btn sec ab-btn-poll" type="button">查询并导入</button>
            </div>
            <div class="nk-ab-prog"><div class="ab-prog-fill"></div></div>
            <div class="nk-ab-log ab-tripo-log">就绪：等待提交 Tripo 3D 任务（需要浏览器处于雷火内网或使用有效密钥）。</div>
          </div>
        </div>

        <!-- ==================== TAB 2: BLENDER MCP ==================== -->
        <div class="nk-ab-pane" data-pane="blender">
          <div class="nk-ab-sec">
            <div class="nk-ab-sec-h">
              <span>本机 BLENDER MCP 连接设置</span>
              <span class="nk-ab-badge off ab-bl-status">DISCONNECTED</span>
            </div>
            <div class="nk-ab-lbl">本地桥接地址 (转发至本机 Blender TCP 127.0.0.1:9876)</div>
            <div class="nk-ab-row">
              <input class="nk-ab-inp ab-bl-url" type="text" placeholder="http://127.0.0.1:8765" style="flex:1" />
              <button class="nk-ab-btn sec ab-btn-bl-ping" type="button">连接 / 读取场景</button>
            </div>
            <div class="nk-ab-row">
              <button class="nk-ab-btn ab-btn-bl-sync" type="button" style="flex:1">⚡ 一键导出 Blender 选中模型到城市</button>
              <button class="nk-ab-btn sec ab-btn-bl-syncall" type="button">导出整场景</button>
            </div>
          </div>

          <div class="nk-ab-sec">
            <div class="nk-ab-sec-h">
              <span>远程执行 BLENDER PYTHON (execute_code)</span>
            </div>
            <div class="nk-ab-chips ab-bl-presets">
              ${BLENDER_SCRIPTS.map((s, i) => `<span class="nk-ab-chip" data-bi="${i}">▶ ${s.label}</span>`).join('')}
            </div>
            <textarea class="nk-ab-ta ab-bl-code" spellcheck="false">${BLENDER_SCRIPTS[0].code}</textarea>
            <div class="nk-ab-row">
              <button class="nk-ab-btn sec ab-btn-bl-exec" type="button" style="flex:1">在 Blender 中执行代码</button>
              <button class="nk-ab-btn ab-btn-bl-exec-sync" type="button" style="flex:1">执行并同步到城市</button>
            </div>
            <div class="nk-ab-log ab-bl-log">提示：先在本地运行下方桥接脚本，并确保 Blender 插件面板已点击 "Start Server" (端口 9876)。</div>
          </div>

          <div class="nk-ab-sec">
            <div class="nk-ab-sec-h">
              <span>本机零依赖转发脚本 (blender_mcp_bridge.py)</span>
            </div>
            <div style="font-size:12px;color:#b8d4d8;line-height:1.4;text-transform:none">
              由于浏览器无法直连原始 TCP Socket (9876)，请下载或复制此 Python 标准库脚本并在本机终端运行：<code style="color:#fcee0a">python blender_mcp_bridge.py</code>
            </div>
            <div class="nk-ab-row">
              <button class="nk-ab-btn sec ab-btn-copy-py" type="button" style="flex:1">📋 复制 Python 脚本</button>
              <button class="nk-ab-btn sec ab-btn-dl-py" type="button" style="flex:1">💾 下载 blender_mcp_bridge.py</button>
            </div>
          </div>
        </div>

        <!-- ==================== TAB 3: SCENE SPAWNER ==================== -->
        <div class="nk-ab-pane" data-pane="scene">
          <div class="nk-ab-sec">
            <div class="nk-ab-sec-h">
              <span>本地 GLB 文件导入 / 预设模型投放</span>
            </div>
            <div class="nk-ab-row">
              <label class="nk-ab-btn" style="flex:1;text-align:center;cursor:pointer">
                📂 选择本地 .GLB / .GLTF 模型投放到街道
                <input class="ab-file-glb" type="file" accept=".glb,.gltf" style="display:none" />
              </label>
            </div>
            <div class="nk-ab-lbl" style="margin-top:4px">快速投放内置 Blender 资产验证管线：</div>
            <div class="nk-ab-chips ab-builtin-assets">
              <span class="nk-ab-chip" data-glb="models/vehicles/hero.glb" data-h="1.45" data-name="KUROGANE GT-R">🏎️ 赛博跑车</span>
              <span class="nk-ab-chip" data-glb="models/vehicles/av.glb" data-h="2.2" data-name="ARASAKA AV">🛸 浮空飞车 AV</span>
              <span class="nk-ab-chip" data-glb="models/landmarks/cherry_tree_0.glb" data-h="6.5" data-name="SAKURA TREE">🌸 霓虹樱花树</span>
              <span class="nk-ab-chip" data-glb="models/signage/chochin_tall.glb" data-h="2.6" data-name="CHOCHIN LANTERN">🏮 提灯招牌</span>
              <span class="nk-ab-chip" data-glb="models/buildings/water_tank.glb" data-h="3.2" data-name="ROOF WATER TANK">🛢️ 屋顶水塔</span>
            </div>
          </div>

          <div class="nk-ab-sec">
            <div class="nk-ab-sec-h">
              <span>已投放到城市的 3D 模型</span>
              <button class="nk-ab-btn danger ab-btn-clear-all" type="button" style="padding:3px 8px;font-size:11px">清空全部</button>
            </div>
            <div class="nk-ab-list ab-spawn-list">
              <div style="font-size:12px;color:rgba(233,246,247,0.5);text-transform:none">暂无动态投放的模型。通过 Tripo 3D、Blender MCP 或本地 GLB 导入后会显示在这里。</div>
            </div>
          </div>
        </div>
      </div>
    `;
    host.appendChild(panel);
    this.panelEl = panel;

    this.wireEvents();
  }

  wireEvents() {
    const p = this.panelEl;
    const q = (s) => p.querySelector(s);

    q('.nk-ab-close').addEventListener('click', () => this.toggle(false));
    p.querySelectorAll('.nk-ab-tab').forEach((tab) => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Populate saved config
    const urlInp = q('.ab-tripo-url');
    const keyInp = q('.ab-tripo-key');
    const hNameInp = q('.ab-tripo-hname');
    const hPrefInp = q('.ab-tripo-hprefix');
    const verSel = q('.ab-tripo-ver');
    const thInp = q('.ab-target-h');
    const blUrlInp = q('.ab-bl-url');

    urlInp.value = this.cfg.tripoBaseUrl;
    keyInp.value = this.cfg.tripoKey;
    hNameInp.value = this.cfg.tripoHeaderName;
    hPrefInp.value = this.cfg.tripoHeaderPrefix;
    verSel.value = this.cfg.tripoModelVer;
    thInp.value = this.cfg.targetHeight;
    blUrlInp.value = this.cfg.blenderBridgeUrl;

    const syncCfg = () => {
      this.cfg.tripoBaseUrl = urlInp.value.trim().replace(/\/+$/, '');
      this.cfg.tripoKey = keyInp.value.trim();
      this.cfg.tripoHeaderName = hNameInp.value.trim() || 'Authorization';
      this.cfg.tripoHeaderPrefix = hPrefInp.value;
      this.cfg.tripoModelVer = verSel.value;
      this.cfg.targetHeight = Math.max(0.2, parseFloat(thInp.value) || 2.4);
      this.cfg.blenderBridgeUrl = blUrlInp.value.trim().replace(/\/+$/, '');
      this.saveConfig();
    };
    [urlInp, keyInp, hNameInp, hPrefInp, verSel, thInp, blUrlInp].forEach((el) => el.addEventListener('change', syncCfg));

    // URL presets
    p.querySelectorAll('[data-url]').forEach((chip) => {
      chip.addEventListener('click', () => {
        urlInp.value = chip.dataset.url;
        syncCfg();
      });
    });

    // Prompt presets
    p.querySelectorAll('[data-pi]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const pr = TRIPO_PRESETS[Number(chip.dataset.pi)];
        if (pr) q('.ab-tripo-prompt').value = pr.prompt;
      });
    });

    // Text-to-3D submit
    q('.ab-btn-text3d').addEventListener('click', () => {
      syncCfg();
      this.submitTripoText3D(q('.ab-tripo-prompt').value.trim());
    });

    // Image-to-3D upload
    q('.ab-file-img3d').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        syncCfg();
        this.submitTripoImage3D(file);
        e.target.value = '';
      }
    });

    // Task ID / Direct URL poll
    q('.ab-btn-poll').addEventListener('click', () => {
      syncCfg();
      const val = q('.ab-task-id').value.trim();
      if (!val) return;
      if (/^https?:\/\//i.test(val) || val.endsWith('.glb')) {
        this.loadAndSpawnGLBUrl(val, 'REMOTE_GLB');
      } else {
        this.pollTripoTask(val);
      }
    });

    // Blender presets
    p.querySelectorAll('[data-bi]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const sc = BLENDER_SCRIPTS[Number(chip.dataset.bi)];
        if (sc) q('.ab-bl-code').value = sc.code;
      });
    });

    // Blender actions
    q('.ab-btn-bl-ping').addEventListener('click', () => { syncCfg(); this.pingBlender(); });
    q('.ab-btn-bl-sync').addEventListener('click', () => { syncCfg(); this.syncFromBlender(true); });
    q('.ab-btn-bl-syncall').addEventListener('click', () => { syncCfg(); this.syncFromBlender(false); });
    q('.ab-btn-bl-exec').addEventListener('click', () => { syncCfg(); this.execBlenderCode(q('.ab-bl-code').value, false); });
    q('.ab-btn-bl-exec-sync').addEventListener('click', () => { syncCfg(); this.execBlenderCode(q('.ab-bl-code').value, true); });

    q('.ab-btn-copy-py').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(LOCAL_BRIDGE_PY);
        this.logBlender('已复制 blender_mcp_bridge.py 到剪贴板！保存为文件后运行 python blender_mcp_bridge.py 即可。');
      } catch {
        this.logBlender('复制失败，请点击右侧下载按钮。', true);
      }
    });

    q('.ab-btn-dl-py').addEventListener('click', () => {
      const blob = new Blob([LOCAL_BRIDGE_PY], { type: 'text/x-python' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'blender_mcp_bridge.py';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });

    // Local GLB upload
    q('.ab-file-glb').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      syncCfg();
      const buf = await file.arrayBuffer();
      await this.spawnFromArrayBuffer(buf, file.name.replace(/\.(glb|gltf)$/i, ''), 'LOCAL_GLB');
      e.target.value = '';
    });

    // Built-in quick test assets
    p.querySelectorAll('[data-glb]').forEach((chip) => {
      chip.addEventListener('click', async () => {
        const path = chip.dataset.glb;
        const h = parseFloat(chip.dataset.h) || 2.2;
        const name = chip.dataset.name || 'ASSET';
        const gltf = await this.ctx.assets.gltf(path);
        if (gltf?.scene) {
          this.placeObjectInCity(gltf.scene.clone(true), name, 'PRESET', h);
        }
      });
    });

    q('.ab-btn-clear-all').addEventListener('click', () => this.clearAllSpawned());
  }

  // ==================== TRIPO 3D OPENAPI V2 ====================
  tripoHeaders(isJson = true) {
    const h = {};
    if (isJson) h['Content-Type'] = 'application/json';
    if (this.cfg.tripoKey) {
      h[this.cfg.tripoHeaderName || 'Authorization'] = `${this.cfg.tripoHeaderPrefix ?? 'Bearer '}${this.cfg.tripoKey}`;
    }
    return h;
  }

  logTripo(msg, isErr = false) {
    const el = this.panelEl.querySelector('.ab-tripo-log');
    el.textContent = msg;
    el.classList.toggle('err', isErr);
  }

  setProgress(pct) {
    const el = this.panelEl.querySelector('.ab-prog-fill');
    if (el) el.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }

  async submitTripoText3D(prompt) {
    if (!prompt) {
      this.logTripo('请输入 3D 生成提示词 (Prompt)。', true);
      return;
    }
    const base = this.cfg.tripoBaseUrl || 'https://ai.leihuo.netease.com';
    const endpoint = `${base}/v2/openapi/task`;
    const body = {
      type: 'text_to_model',
      prompt,
      ...(this.cfg.tripoModelVer ? { model_version: this.cfg.tripoModelVer } : {}),
    };

    this.setProgress(8);
    this.logTripo(`正在请求 POST ${endpoint} ...\nPayload: ${JSON.stringify(body)}`);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: this.tripoHeaders(true),
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || (data.code !== undefined && data.code !== 0)) {
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      const taskId = data.data?.task_id || data.task_id || data.id;
      if (!taskId) throw new Error(`未返回 task_id: ${JSON.stringify(data)}`);
      this.panelEl.querySelector('.ab-task-id').value = taskId;
      this.logTripo(`任务创建成功！task_id: ${taskId}\n开始轮询 GET /v2/openapi/task/${taskId} ...`);
      this.pollTripoTask(taskId, prompt.slice(0, 22));
    } catch (err) {
      this.setProgress(0);
      this.logTripo(
        `请求失败: ${err.message}\n提示：若调用 https://ai.leihuo.netease.com，请确保你当前浏览器处于雷火办公网/VPN 环境，并已填写正确的 API Token。`,
        true
      );
    }
  }

  async submitTripoImage3D(file) {
    const base = this.cfg.tripoBaseUrl || 'https://ai.leihuo.netease.com';
    const stsEndpoint = `${base}/v2/openapi/upload/sts`;
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();

    this.setProgress(5);
    this.logTripo(`正在通过 ${stsEndpoint} 获取上传凭证 (${file.name})...`);

    try {
      let fileToken = null;
      // 1. Try /v2/openapi/upload/sts first (matches user screenshot endpoint)
      const stsRes = await fetch(stsEndpoint, {
        method: 'POST',
        headers: this.tripoHeaders(true),
        body: JSON.stringify({ format: ext }),
      }).catch(() => null);

      if (stsRes && stsRes.ok) {
        const stsData = await stsRes.json().catch(() => ({}));
        fileToken = stsData.data?.image_token || stsData.data?.file_token || stsData.data?.sts_token || null;
        const uploadUrl = stsData.data?.upload_url || stsData.data?.url;
        if (uploadUrl) {
          await fetch(uploadUrl, { method: 'PUT', body: file });
        }
      }

      // 2. Fallback to standard multipart /v2/openapi/upload if STS didn't return a direct token
      if (!fileToken) {
        const fd = new FormData();
        fd.append('file', file);
        const upRes = await fetch(`${base}/v2/openapi/upload`, {
          method: 'POST',
          headers: this.tripoHeaders(false),
          body: fd,
        });
        const upData = await upRes.json().catch(() => ({}));
        fileToken = upData.data?.image_token || upData.data?.file_token;
      }

      if (!fileToken) throw new Error('未能从 /v2/openapi/upload/sts 获取 image_token');

      // 3. Submit image_to_model task
      const taskBody = {
        type: 'image_to_model',
        file: { type: ext, file_token: fileToken },
        ...(this.cfg.tripoModelVer ? { model_version: this.cfg.tripoModelVer } : {}),
      };
      const taskRes = await fetch(`${base}/v2/openapi/task`, {
        method: 'POST',
        headers: this.tripoHeaders(true),
        body: JSON.stringify(taskBody),
      });
      const taskData = await taskRes.json().catch(() => ({}));
      const taskId = taskData.data?.task_id || taskData.task_id;
      if (!taskId) throw new Error(taskData.message || '创建图生3D任务失败');

      this.panelEl.querySelector('.ab-task-id').value = taskId;
      this.pollTripoTask(taskId, file.name);
    } catch (err) {
      this.setProgress(0);
      this.logTripo(`图生 3D 失败: ${err.message}`, true);
    }
  }

  async pollTripoTask(taskId, label = 'TRIPO_MODEL') {
    if (this.pollingTimer) clearTimeout(this.pollingTimer);
    const base = this.cfg.tripoBaseUrl || 'https://ai.leihuo.netease.com';
    const endpoint = `${base}/v2/openapi/task/${encodeURIComponent(taskId)}`;

    const tick = async () => {
      try {
        const res = await fetch(endpoint, {
          method: 'GET',
          headers: this.tripoHeaders(false),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || (json.code !== undefined && json.code !== 0)) {
          throw new Error(json.message || json.error || `HTTP ${res.status}`);
        }
        const d = json.data || json;
        const status = (d.status || '').toUpperCase();
        const prog = d.progress ?? (status === 'SUCCESS' ? 100 : 25);
        this.setProgress(prog);
        this.logTripo(`任务 [${taskId}]\n状态: ${status} (${prog}%)`);

        if (status === 'SUCCESS') {
          const glbUrl =
            d.output?.pbr_model ||
            d.output?.model ||
            d.output?.base_model ||
            d.result?.pbr_model?.url ||
            d.result?.model?.url;
          if (!glbUrl) throw new Error('任务已完成，但返回数据中未找到 model GLB URL');
          this.logTripo(`生成完成 (100%)！正在下载并加载 GLB 到城市场景...\nURL: ${glbUrl}`);
          await this.loadAndSpawnGLBUrl(glbUrl, label);
          return;
        }
        if (status === 'FAILED' || status === 'CANCELLED' || status === 'EXPIRED') {
          throw new Error(`任务终止，状态: ${status}`);
        }
        this.pollingTimer = setTimeout(tick, 2200);
      } catch (err) {
        this.logTripo(`轮询任务出错: ${err.message}`, true);
      }
    };
    tick();
  }

  // ==================== LOCAL BLENDER MCP BRIDGE ====================
  logBlender(msg, isErr = false) {
    const el = this.panelEl.querySelector('.ab-bl-log');
    el.textContent = msg;
    el.classList.toggle('err', isErr);
  }

  setBlenderStatus(online) {
    this.blenderConnected = online;
    const badge = this.panelEl.querySelector('.ab-bl-status');
    badge.textContent = online ? 'ONLINE · 9876' : 'OFFLINE';
    badge.className = `nk-ab-badge ${online ? 'ok' : 'off'} ab-bl-status`;
    this.launchBtn.classList.toggle('connected', online);
  }

  async pingBlender() {
    const url = this.cfg.blenderBridgeUrl || 'http://127.0.0.1:8765';
    this.logBlender(`正在连接本机 Blender 桥接服务 ${url} ...`);
    try {
      const res = await fetch(url, { method: 'GET' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Blender 未响应');
      this.setBlenderStatus(true);
      const info = data.blender?.result || data.blender;
      const objs = info?.objects ? info.objects.map((o) => o.name || o).join(', ') : JSON.stringify(info).slice(0, 180);
      this.logBlender(`已连接本机 Blender MCP!\n当前场景物体: ${objs || '(空)'}`);
      this.hud.toast({ kind: 'info', k: 'BLENDER MCP // LINKED', h: 'BLENDER 本地桥接已连接', body: '<span>TCP 127.0.0.1:9876 READY</span>' }, 3200);
    } catch (err) {
      this.setBlenderStatus(false);
      this.logBlender(
        `无法连接 ${url} (${err.message})。\n请确认：\n1. 已在本地终端运行 python blender_mcp_bridge.py\n2. Blender 中已开启 Blender MCP 插件并点击 Start Server`,
        true
      );
    }
  }

  async execBlenderCode(code, andSync = false) {
    const url = this.cfg.blenderBridgeUrl || 'http://127.0.0.1:8765';
    this.logBlender('正在向本机 Blender 发送 Python 脚本...');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'execute_code',
          params: { code },
        }),
      });
      const data = await res.json();
      if (!data.ok || data.blender?.status === 'error') {
        throw new Error(data.error || data.blender?.message || '执行失败');
      }
      this.setBlenderStatus(true);
      const out = data.blender?.result?.result || data.blender?.result || '执行成功';
      this.logBlender(`Blender 执行完成:\n${typeof out === 'string' ? out : JSON.stringify(out)}`);
      if (andSync) {
        await this.syncFromBlender(true);
      }
    } catch (err) {
      this.logBlender(`Blender 脚本执行失败: ${err.message}`, true);
    }
  }

  async syncFromBlender(onlySelection = true) {
    const url = this.cfg.blenderBridgeUrl || 'http://127.0.0.1:8765';
    this.logBlender(`正在从本机 Blender 导出 ${onlySelection ? '当前选中物体' : '整个场景'} 为 GLB...`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'execute_code',
          params: { code: EXPORT_GLB_BPY(onlySelection) },
        }),
      });
      const data = await res.json();
      if (!data.ok || data.blender?.status === 'error') {
        throw new Error(data.error || data.blender?.message || 'Blender GLB 导出失败');
      }
      this.setBlenderStatus(true);
      const rawStr = JSON.stringify(data.blender);
      const match = rawStr.match(/NK_GLB_B64_START:([A-Za-z0-9+/=]+):NK_GLB_B64_END/);
      const b64 = match?.[1] || data.blender?.result?.glb_b64;
      if (!b64) {
        throw new Error('未从 Blender 返回数据中解析到 GLB 数据，请确认场景中有网格物体。');
      }
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      await this.spawnFromArrayBuffer(bytes.buffer, onlySelection ? 'BLENDER_SELECTION' : 'BLENDER_SCENE', 'BLENDER_MCP');
      this.logBlender(`同步成功！(${(bytes.byteLength / 1024).toFixed(1)} KB GLB 已投放到玩家面前)`);
      this.switchTab('scene');
    } catch (err) {
      this.logBlender(`同步 Blender 模型失败: ${err.message}`, true);
    }
  }

  // ==================== GLB PARSING & CITY PLACEMENT ====================
  async loadAndSpawnGLBUrl(url, label = 'TRIPO_3D') {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      await this.spawnFromArrayBuffer(buf, label, 'TRIPO_3D', url);
      this.logTripo(`模型 [${label}] 已成功投放到你面前的街道上！`);
    } catch (err) {
      this.logTripo(`加载 GLB 失败 (${err.message})。若存在跨域限制，可复制链接下载后通过「场景模型」本地导入。`, true);
    }
  }

  async spawnFromArrayBuffer(arrayBuffer, name = 'CUSTOM_MODEL', source = 'LOCAL', downloadUrl = null) {
    const loader = this.ctx.assets.gltfLoader;
    const gltf = await new Promise((resolve, reject) => {
      loader.parse(arrayBuffer, '', resolve, reject);
    });
    if (!gltf?.scene) throw new Error('GLB 不包含有效场景节点');
    const blobUrl = downloadUrl || URL.createObjectURL(new Blob([arrayBuffer], { type: 'model/gltf-binary' }));
    this.placeObjectInCity(gltf.scene, name, source, this.cfg.targetHeight, blobUrl);
  }

  placeObjectInCity(rootObj, name, source, targetHeight = 2.4, downloadUrl = null) {
    // Normalize Materials for WebGPU & shadows
    rootObj.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    // Compute bounds & normalize scale to targetHeight
    const box = new THREE.Box3().setFromObject(rootObj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const scale = targetHeight / maxDim;

    const wrapper = new THREE.Group();
    wrapper.name = `spawn_${name}`;
    rootObj.scale.setScalar(scale);
    // Re-center horizontally and put bottom on y = 0
    rootObj.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    wrapper.add(rootObj);

    // Spawn 5.5m in front of player or camera
    const cam = this.ctx.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    fwd.normalize();

    const basePos = this.ctx.api.player?.object?.position || cam.position;
    const sx = basePos.x + fwd.x * 5.5;
    const sz = basePos.z + fwd.z * 5.5;
    const sy = this.ctx.api.ground?.heightAt?.(sx, sz) ?? 0;

    wrapper.position.set(sx, sy, sz);
    wrapper.rotation.y = Math.atan2(-fwd.x, -fwd.z);
    this.spawnGroup.add(wrapper);

    // Add Rapier static box collider so player/cars can interact with it
    const halfExt = new THREE.Vector3(
      Math.max(0.2, (size.x * scale) * 0.5),
      Math.max(0.2, (size.y * scale) * 0.5),
      Math.max(0.2, (size.z * scale) * 0.5)
    );
    const item = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: name.toUpperCase(),
      source,
      wrapper,
      rootObj,
      baseScale: scale,
      scaleMul: 1.0,
      yawDeg: Math.round((wrapper.rotation.y * 180) / Math.PI),
      halfExt,
      body: null,
      downloadUrl,
    };
    this.rebuildCollider(item);
    this.spawned.unshift(item);
    this.renderSpawnList();

    this.hud.toast(
      {
        kind: 'info',
        k: `${source} // ASSET DEPLOYED`,
        h: item.name,
        body: `<span>POS (${sx.toFixed(1)}, ${sz.toFixed(1)})</span><span>HEIGHT ${targetHeight.toFixed(1)}M</span>`,
      },
      3800
    );
  }

  rebuildCollider(item) {
    const { RAPIER, world } = this.ctx.physics || {};
    if (!world) return;
    if (item.body) {
      try { world.removeRigidBody(item.body); } catch { /* ignore */ }
      item.body = null;
    }
    const p = item.wrapper.position;
    const q = item.wrapper.quaternion;
    const m = item.scaleMul;
    const hx = item.halfExt.x * m;
    const hy = item.halfExt.y * m;
    const hz = item.halfExt.z * m;
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(p.x, p.y + hy, p.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.85), body);
    item.body = body;
  }

  removeSpawned(id) {
    const idx = this.spawned.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const it = this.spawned[idx];
    if (it.body && this.ctx.physics?.world) {
      try { this.ctx.physics.world.removeRigidBody(it.body); } catch { /* ignore */ }
    }
    if (it.wrapper.parent) it.wrapper.parent.remove(it.wrapper);
    this.spawned.splice(idx, 1);
    this.renderSpawnList();
  }

  clearAllSpawned() {
    while (this.spawned.length) {
      this.removeSpawned(this.spawned[0].id);
    }
  }

  renderSpawnList() {
    const cnt = this.panelEl.querySelector('.ab-cnt');
    if (cnt) cnt.textContent = String(this.spawned.length);
    const box = this.panelEl.querySelector('.ab-spawn-list');
    if (!this.spawned.length) {
      box.innerHTML = `<div style="font-size:12px;color:rgba(233,246,247,0.5);text-transform:none">暂无动态投放的模型。通过 Tripo 3D、Blender MCP 或本地 GLB 导入后会显示在这里。</div>`;
      return;
    }
    box.innerHTML = this.spawned.map((it) => `
      <div class="nk-ab-item" data-id="${it.id}">
        <div class="nk-ab-item-top">
          <span>${it.name} <small style="color:#5ef6ff;font-size:10px">[${it.source}]</small></span>
          <span>(${it.wrapper.position.x.toFixed(0)}, ${it.wrapper.position.z.toFixed(0)})</span>
        </div>
        <div class="nk-ab-row">
          <span style="font-size:11px;width:54px">缩放 ${it.scaleMul.toFixed(1)}x</span>
          <input class="ab-s-scale" type="range" min="0.2" max="8" step="0.1" value="${it.scaleMul}" style="flex:1" />
          <span style="font-size:11px;width:52px">旋转 ${it.yawDeg}°</span>
          <input class="ab-s-yaw" type="range" min="-180" max="180" step="5" value="${it.yawDeg}" style="flex:1" />
        </div>
        <div class="nk-ab-row">
          <button class="nk-ab-btn sec ab-s-tp" type="button" style="padding:4px 8px;font-size:11px;flex:1">传送至模型</button>
          <button class="nk-ab-btn sec ab-s-here" type="button" style="padding:4px 8px;font-size:11px;flex:1">移到面前</button>
          ${it.downloadUrl ? `<a class="nk-ab-btn sec" href="${it.downloadUrl}" download="${it.name}.glb" style="padding:4px 8px;font-size:11px;text-decoration:none">下载 GLB</a>` : ''}
          <button class="nk-ab-btn danger ab-s-del" type="button" style="padding:4px 8px;font-size:11px">删除</button>
        </div>
      </div>
    `).join('');

    box.querySelectorAll('.nk-ab-item').forEach((row) => {
      const id = Number(row.dataset.id);
      const it = this.spawned.find((x) => x.id === id);
      if (!it) return;

      row.querySelector('.ab-s-scale').addEventListener('input', (e) => {
        it.scaleMul = parseFloat(e.target.value) || 1;
        it.rootObj.scale.setScalar(it.baseScale * it.scaleMul);
        this.rebuildCollider(it);
        row.querySelector('span[style*="width:54px"]').textContent = `缩放 ${it.scaleMul.toFixed(1)}x`;
      });

      row.querySelector('.ab-s-yaw').addEventListener('input', (e) => {
        it.yawDeg = parseFloat(e.target.value) || 0;
        it.wrapper.rotation.y = (it.yawDeg * Math.PI) / 180;
        this.rebuildCollider(it);
        row.querySelector('span[style*="width:52px"]').textContent = `旋转 ${it.yawDeg}°`;
      });

      row.querySelector('.ab-s-tp').addEventListener('click', () => {
        const p = it.wrapper.position;
        window.__player?.teleport?.(p.x, p.y + 0.5, p.z + 4.5, 0);
      });

      row.querySelector('.ab-s-here').addEventListener('click', () => {
        const cam = this.ctx.camera;
        const fwd = new THREE.Vector3();
        cam.getWorldDirection(fwd);
        fwd.y = 0;
        if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
        fwd.normalize();
        const basePos = this.ctx.api.player?.object?.position || cam.position;
        const sx = basePos.x + fwd.x * 5.0;
        const sz = basePos.z + fwd.z * 5.0;
        const sy = this.ctx.api.ground?.heightAt?.(sx, sz) ?? 0;
        it.wrapper.position.set(sx, sy, sz);
        this.rebuildCollider(it);
        this.renderSpawnList();
      });

      row.querySelector('.ab-s-del').addEventListener('click', () => this.removeSpawned(id));
    });
  }
}
