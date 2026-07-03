/**
 * panel-styles.js — 面板 CSS 样式
 * 从 panel.js 抽出，保持样式与逻辑分离
 */
export const DEBUG_PANEL_CSS = '__CS_DEBUG_PANEL_CSS_PLACEHOLDER__';

export const PANEL_CSS = `
  #cs-overlay, #cs-dashboard, #cs-dashboard *, #cs-overlay *, #cs-context-menu, .cs-topic-detail-overlay, .cs-dash-modal-overlay * {
    box-sizing:border-box;line-height:1.5;
  }
  /* ── Droplet 水态设计系统 ── */
  #cs-overlay, #cs-dashboard, #cs-context-menu, .cs-topic-detail-overlay, .cs-dash-modal-overlay {
    /* 浅色：纯白 */
    --cs-bg:#ffffff;--cs-bg-body:#f8f9fa;--cs-bg-elevated:#ffffff;--cs-text:#171717;--cs-text-secondary:#525252;--cs-text-tertiary:#a3a3a3;
    --cs-border:rgba(0,0,0,.08);--cs-border-strong:rgba(0,0,0,.15);--cs-shadow:0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);--cs-shadow-md:0 4px 12px rgba(0,0,0,.08),0 2px 4px rgba(0,0,0,.04);--cs-shadow-lg:0 12px 32px rgba(0,0,0,.1),0 4px 8px rgba(0,0,0,.06);
    --cs-accent:#0284c7;--cs-accent-hover:#0369a1;--cs-accent-soft:rgba(2,132,199,.06);--cs-accent-glow:rgba(2,132,199,.15);
    --cs-toggle-bg:rgba(0,0,0,.1);--cs-toggle-on:#0284c7;--cs-danger:#ef4444;--cs-danger-soft:rgba(239,68,68,.06);--cs-success:#0ea5e9;--cs-success-soft:rgba(14,165,233,.06);
    --cs-warning:#f59e0b;--cs-warning-soft:rgba(245,158,11,.06);
    --cs-input-bg:#f8f9fa;--cs-input-border:rgba(0,0,0,.1);--cs-divider:rgba(0,0,0,.06);
    --cs-toxic-bg:rgba(239,68,68,.06);--cs-toxic-text:#dc2626;
    /* 水态信号色谱 */
    --cs-signal-calm:#0284c7;--cs-signal-ripple:#0ea5e9;--cs-signal-wave:#6366f1;--cs-signal-vortex:#8b5cf6;--cs-signal-storm:#ec4899;--cs-signal-danger:#ef4444;
    --cs-radius-sm:6px;--cs-radius:10px;--cs-radius-lg:14px;--cs-radius-xl:20px;
    --cs-font:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
    --cs-font-mono:'JetBrains Mono','SF Mono','Cascadia Code','Fira Code',monospace;
    --cs-transition: cubic-bezier(.4,0,.2,1);
  }
  @media(prefers-color-scheme:dark){
    /* 深色：纯黑 + 赛博朋克霓虹 + ROG 红色点缀 */
    #cs-overlay, #cs-dashboard, #cs-context-menu, .cs-topic-detail-overlay, .cs-dash-modal-overlay {
      --cs-bg:#000000;--cs-bg-body:#0a0a0a;--cs-bg-elevated:#141414;--cs-text:#ffffff;--cs-text-secondary:#a3a3a3;--cs-text-tertiary:#525252;
      --cs-border:rgba(255,255,255,.12);--cs-border-strong:rgba(255,255,255,.32);--cs-shadow:0 1px 3px rgba(0,0,0,.4),0 1px 2px rgba(0,0,0,.2);--cs-shadow-md:0 4px 12px rgba(0,0,0,.5),0 2px 4px rgba(0,0,0,.3);--cs-shadow-lg:0 12px 32px rgba(0,0,0,.6),0 4px 8px rgba(0,0,0,.4);
      --cs-accent:#38bdf8;--cs-accent-hover:#7dd3fc;--cs-accent-soft:rgba(56,189,248,.08);--cs-accent-glow:rgba(56,189,248,.2);
      --cs-toggle-bg:rgba(255,255,255,.1);--cs-toggle-on:#38bdf8;--cs-danger:#f87171;--cs-danger-soft:rgba(248,113,113,.08);--cs-success:#22d3ee;--cs-success-soft:rgba(34,211,238,.08);
      --cs-warning:#fbbf24;--cs-warning-soft:rgba(251,191,36,.08);
      --cs-input-bg:#0a0a0a;--cs-input-border:rgba(255,255,255,.1);--cs-divider:rgba(255,255,255,.06);
      --cs-toxic-bg:rgba(248,113,113,.08);--cs-toxic-text:#fca5a5;
      /* 水态信号色谱（深色） */
      --cs-signal-calm:#38bdf8;--cs-signal-ripple:#22d3ee;--cs-signal-wave:#818cf8;--cs-signal-vortex:#a78bfa;--cs-signal-storm:#f472b6;--cs-signal-danger:#f87171;
      /* 赛博朋克专属 */
      --cs-neon-glow:0 0 8px rgba(56,189,248,.4),0 0 16px rgba(56,189,248,.2);
      --cs-neon-text:0 0 6px rgba(56,189,248,.5);
      --cs-scanline:repeating-linear-gradient(0deg,transparent 0,transparent 2px,rgba(56,189,248,.015) 2px,rgba(56,189,248,.015) 3px);
      /* ROG 红色点缀 */
      --cs-rog-red:#e53935;--cs-rog-orange:#ff6d00;--cs-rog-glow:0 0 8px rgba(229,57,53,.35),0 0 16px rgba(229,57,53,.15);
    }
  }
  /* ── 水态信号色谱说明（颜色即分类，值已合并到上方变量） ── */
  /* ── SVG 图标 ── */
  .cs-glyph{display:inline-block;vertical-align:middle;flex-shrink:0}

  /* ── 水滴脉动 — 思考状态 ── */
  .cs-glyph-thinking{
    display:inline-flex;align-items:center;justify-content:center;
    width:18px;height:18px;flex-shrink:0;
    animation:csThinkPulse 2s ease-in-out infinite;
  }
  .cs-glyph-thinking::before{
    content:'';width:10px;height:10px;
    background:var(--cs-signal-calm);border-radius:50%;
    box-shadow:0 0 8px var(--cs-signal-calm);
  }
  @keyframes csThinkPulse{
    0%,100%{opacity:.4;transform:scale(.85)}
    50%{opacity:1;transform:scale(1)}
  }

  /* ── 频谱跳动 — 工具执行中 ── */
  .cs-glyph-tool-active{color:var(--cs-signal-ripple);animation:csSpectrum .6s steps(3) infinite}
  @keyframes csSpectrum{0%{transform:scaleY(.4)}33%{transform:scaleY(1)}66%{transform:scaleY(.6)}100%{transform:scaleY(.4)}}

  /* ── 靶心锁定 — 完成 ── */
  .cs-glyph-done{color:var(--cs-signal-calm);animation:csLock .3s ease-out forwards}
  @keyframes csLock{0%{transform:scale(1.4);opacity:0}60%{transform:scale(.95);opacity:1}100%{transform:scale(1);opacity:1}}

  /* ── 否定圈 + 抖动 — 失败 ── */
  .cs-glyph-fail{color:var(--cs-signal-danger);animation:csShake .4s ease-out}
  @keyframes csShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-3px)}40%{transform:translateX(3px)}60%{transform:translateX(-2px)}80%{transform:translateX(1px)}}

  /* ── 警戒脉冲 — 降级 ── */
  .cs-glyph-warning{color:var(--cs-signal-storm);animation:csPulse 2s ease-in-out infinite}
  @keyframes csPulse{0%,100%{opacity:.5;transform:scale(.95)}50%{opacity:1;transform:scale(1.05)}}

  /* ── 流式光标（水流式：柔和脉动，非硬闪烁）── */
  .cs-stream-bubble{line-height:1.7}
  .cs-stream-cursor::after{
    content:'';display:inline-block;width:4px;height:1em;
    background:var(--cs-accent);border-radius:4px;
    animation:csFlowPulse 2s ease-in-out infinite;
    margin-left:2px;vertical-align:text-bottom;
    box-shadow:0 0 8px var(--cs-accent-glow);
  }
  @keyframes csFlowPulse{
    0%,100%{opacity:.2;transform:scaleY(.7)}
    50%{opacity:.6;transform:scaleY(1)}
  }

  /* ── 工具追踪线 ── */
  .cs-track{padding:8px 0;position:relative}
  .cs-track-line{display:flex;height:2px;border-radius:1px;overflow:hidden;margin:10px 0}
  .cs-track-seg-done{background:var(--cs-signal-calm)}
  .cs-track-seg-active{background:var(--cs-signal-ripple)}
  .cs-track-seg-pending{background:var(--cs-border)}
  .cs-track-nodes{display:flex;justify-content:space-between}
  .cs-track-node{display:flex;flex-direction:column;align-items:center;gap:4px}
  .cs-track-label{font-size:10px;color:var(--cs-text-secondary)}
  .cs-track-dur{color:var(--cs-signal-ripple);font-variant-numeric:tabular-nums}
  .cs-track-dot{width:8px;height:8px;border-radius:50%;border:1.5px solid var(--cs-border);display:inline-block}

  /* ── 敏感度进度条 ── */
  .cs-sensitivity-bar{height:4px;background:var(--cs-border);border-radius:2px;overflow:hidden;display:inline-block;width:60px;vertical-align:middle;margin:0 4px}
  .cs-sensitivity-fill{display:block;height:100%;border-radius:2px;transition:width .3s ease}

  /* ── 关键词 Tag 胶囊 ── */
  .cs-tag{display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;background:var(--cs-accent-soft);color:var(--cs-accent);border:1px solid var(--cs-border-strong);margin:1px 2px}

  /* ── 确认卡片执行中状态 ── */
  .cs-confirm-card-executing{opacity:.7;pointer-events:none}
  .cs-confirm-card-executing .cs-confirm-btn-primary{background:var(--cs-signal-ripple);position:relative;overflow:hidden}
  .cs-confirm-card-executing .cs-confirm-btn-primary::after{
    content:'';position:absolute;top:0;left:0;height:100%;width:30%;
    background:rgba(255,255,255,.3);animation:csBtnProgress 1.5s ease-in-out infinite;
  }
  @keyframes csBtnProgress{0%{left:-30%}100%{left:100%}}

  /* ── 确认卡片收起 ── */
  .cs-confirm-card-collapsed{padding:6px 10px;font-size:11px;border-color:var(--cs-signal-calm)}
  .cs-confirm-card-collapsed .cs-confirm-card-detail,
  .cs-confirm-card-collapsed .cs-confirm-card-actions{display:none}

  /* ─── Animation tokens ─────────────────────── */
  @keyframes csFadeSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes csFadeSlideOut{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-8px)}}
  @keyframes csScaleIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
  @keyframes csDotBounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}}
  @keyframes csToastIn{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}
  @keyframes csToastOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(100%)}}
  @keyframes csBubblePop{0%{opacity:0;transform:translateY(8px) scale(.92)}60%{transform:translateY(-2px) scale(1.02)}100%{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes csShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
  @keyframes csGlow{0%,100%{box-shadow:0 0 0 0 var(--cs-accent-glow)}50%{box-shadow:0 0 16px 4px var(--cs-accent-glow)}}
  @keyframes csSlideReveal{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
  @keyframes csCountUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}

  /* ── 暂停按钮 ── */
  .cs-chat-add-btn{width:32px;height:32px;border-radius:50%;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--cs-text-secondary);transition:all .2s ease;flex-shrink:0}
  .cs-chat-add-btn:hover{background:var(--cs-bg);color:var(--cs-accent)}
  .cs-send-pause-btn{position:relative;width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s ease}
  .cs-send-pause-btn.cs-sending{background:var(--cs-signal-danger);color:#fff}
  .cs-send-pause-btn.cs-sending::after{content:'';width:12px;height:12px;background:#fff;border-radius:2px}
  .cs-send-pause-btn.cs-busy{background:var(--cs-signal-danger);color:#fff}
  .cs-send-pause-btn.cs-busy svg{width:14px;height:14px}
  .cs-send-pause-btn.cs-idle{background:var(--cs-accent);color:#fff}
  .cs-send-pause-btn.cs-idle svg{width:16px;height:16px}
  .cs-send-pause-btn:disabled{opacity:.5;cursor:not-allowed}

  /* ── 思考区域 ── */
  .cs-thinking-block{margin:6px 0;border:1px solid var(--cs-border);border-radius:8px;overflow:hidden;animation:csScaleIn .3s ease}
  .cs-thinking-header{display:flex;align-items:center;gap:6px;padding:6px 10px;font-size:11px;color:var(--cs-text-secondary);cursor:pointer;background:var(--cs-bg-body);user-select:none}
  .cs-thinking-header:hover{background:var(--cs-border)}
  .cs-thinking-header .cs-thinking-arrow{transition:transform .2s ease;font-size:10px}
  .cs-thinking-block.cs-thinking-collapsed .cs-thinking-arrow{transform:rotate(-90deg)}
  .cs-thinking-body{font-size:12px;color:var(--cs-text-secondary);line-height:1.6;padding:8px 10px;max-height:200px;overflow-y:auto;background:var(--cs-bg-body);border-top:1px solid var(--cs-border)}
  .cs-thinking-block.cs-thinking-collapsed .cs-thinking-body{display:none}
  .cs-thinking-time{font-size:10px;color:var(--cs-signal-ripple);margin-left:auto}

  /* ── Agent 卡片增强 ── */
  .cs-agent-card{border:1px solid var(--cs-border);border-radius:12px;padding:14px;margin:8px 0;animation:csScaleIn .3s ease;background:var(--cs-bg-elevated)}
  .cs-agent-card-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}
  .cs-agent-card-icon{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
  .cs-agent-card-title{font-size:13px;font-weight:600}
  .cs-agent-card-desc{font-size:12px;color:var(--cs-text-secondary);line-height:1.5;margin-bottom:8px}
  .cs-agent-card-meta{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}
  .cs-agent-card-actions{display:flex;gap:8px;margin-top:8px}
  .cs-agent-card-btn{padding:4px 12px;border-radius:6px;border:1px solid var(--cs-border);font-size:12px;cursor:pointer;background:var(--cs-bg);transition:all .2s ease}
  .cs-agent-card-btn:hover{border-color:var(--cs-accent);color:var(--cs-accent)}
  .cs-agent-card-btn.cs-card-btn-primary{background:var(--cs-accent);color:#fff;border-color:var(--cs-accent)}
  .cs-agent-card-btn.cs-card-btn-primary:hover{background:var(--cs-accent-hover)}
  .cs-agent-card-btn.cs-card-btn-danger{color:var(--cs-danger);border-color:var(--cs-danger)}
  .cs-agent-card-btn.cs-card-btn-danger:hover{background:var(--cs-danger-soft)}

  /* ─── 引导卡片样式（Claude 式淡入缩放） ─────────────────── */

  @keyframes csCardFadeInScale {
    from { opacity: 0; transform: scale(0.96) translateY(8px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  @keyframes csFieldStagger {
    from { opacity: 0; transform: translateX(-4px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .cs-guide-card {
    animation: csCardFadeInScale 0.32s cubic-bezier(0.4, 0, 0.2, 1);
    background: var(--cs-bg-elevated, #fff);
    border: 1px solid var(--cs-border, #e2e8f0);
    border-radius: var(--cs-radius-lg, 14px);
    padding: 16px;
    margin: 8px 0;
    box-shadow: var(--cs-shadow-md, 0 4px 12px rgba(0,0,0,0.08));
    max-width: 100%;
  }

  .cs-guide-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 15px;
    font-weight: 600;
    color: var(--cs-text, #0f172a);
  }

  .cs-guide-card-icon { font-size: 18px; color: var(--cs-accent); display:inline-flex; align-items:center; }

  .cs-guide-understanding-text {
    padding: 12px;
    background: var(--cs-accent-soft, rgba(2,132,199,0.08));
    border-radius: var(--cs-radius, 10px);
    margin-bottom: 12px;
    color: var(--cs-text, #0f172a);
    line-height: 1.6;
  }

  .cs-guide-field {
    animation: csFieldStagger 0.24s cubic-bezier(0.4, 0, 0.2, 1) backwards;
    margin-bottom: 14px;
  }

  .cs-guide-field:nth-child(1) { animation-delay: 0.04s; }
  .cs-guide-field:nth-child(2) { animation-delay: 0.08s; }
  .cs-guide-field:nth-child(3) { animation-delay: 0.12s; }
  .cs-guide-field:nth-child(4) { animation-delay: 0.16s; }
  .cs-guide-field:nth-child(5) { animation-delay: 0.20s; }
  .cs-guide-field:nth-child(6) { animation-delay: 0.24s; }

  .cs-guide-field-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--cs-text-secondary, #64748b);
    margin-bottom: 6px;
  }

  .cs-guide-field-tag {
    display: inline-block;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--cs-bg-body, #f4f5f7);
    color: var(--cs-text-secondary, #64748b);
    margin-left: 4px;
    font-weight: 400;
  }

  .cs-guide-input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--cs-border, #e2e8f0);
    border-radius: var(--cs-radius-sm, 6px);
    font-size: 14px;
    color: var(--cs-text, #0f172a);
    background: var(--cs-bg, #fff);
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .cs-guide-input:focus {
    outline: none;
    border-color: var(--cs-accent, #0284c7);
    box-shadow: 0 0 0 3px var(--cs-accent-glow, rgba(2,132,199,0.15));
  }

  .cs-guide-options {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .cs-guide-option {
    padding: 6px 12px;
    border: 1px solid var(--cs-border, #e2e8f0);
    border-radius: var(--cs-radius-sm, 6px);
    background: var(--cs-bg, #fff);
    color: var(--cs-text-secondary, #64748b);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cs-guide-option:hover {
    border-color: var(--cs-accent, #0284c7);
    color: var(--cs-accent, #0284c7);
  }

  .cs-guide-option--active {
    background: var(--cs-accent, #0284c7);
    border-color: var(--cs-accent, #0284c7);
    color: #fff;
  }

  .cs-guide-option--checkbox {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .cs-guide-checkbox { font-size: 14px; }

  .cs-guide-keywords {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px;
    border: 1px solid var(--cs-border, #e2e8f0);
    border-radius: var(--cs-radius-sm, 6px);
    min-height: 40px;
    align-items: center;
  }

  .cs-guide-keyword {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: var(--cs-accent-soft, rgba(2,132,199,0.08));
    color: var(--cs-accent, #0284c7);
    border-radius: 4px;
    font-size: 13px;
  }

  .cs-guide-keyword-remove {
    background: none;
    border: none;
    color: var(--cs-text-secondary, #64748b);
    cursor: pointer;
    font-size: 14px;
    padding: 0;
    line-height: 1;
  }

  .cs-guide-keyword-remove:hover { color: var(--cs-danger, #ef4444); }

  .cs-guide-keyword-input {
    border: none;
    outline: none;
    background: transparent;
    font-size: 13px;
    color: var(--cs-text, #0f172a);
    min-width: 120px;
    flex: 1;
  }

  .cs-guide-card-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }

  .cs-guide-btn {
    padding: 8px 16px;
    border-radius: var(--cs-radius-sm, 6px);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .cs-guide-btn-primary {
    background: var(--cs-accent, #0284c7);
    color: #fff;
  }

  .cs-guide-btn-primary:hover {
    background: var(--cs-accent-hover, #0369a1);
    box-shadow: 0 0 0 3px var(--cs-accent-glow, rgba(2,132,199,0.15));
  }

  .cs-guide-btn-secondary {
    background: var(--cs-bg-body, #f4f5f7);
    color: var(--cs-text-secondary, #64748b);
  }

  .cs-guide-btn-secondary:hover {
    background: var(--cs-border, #e2e8f0);
    color: var(--cs-text, #0f172a);
  }

  .cs-guide-steps {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 12px;
  }

  .cs-guide-step {
    padding: 10px;
    background: var(--cs-bg-body, #f4f5f7);
    border-radius: var(--cs-radius-sm, 6px);
    border-left: 3px solid var(--cs-accent, #0284c7);
  }

  .cs-guide-step-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--cs-text, #0f172a);
  }

  .cs-guide-step-index {
    font-size: 11px;
    color: var(--cs-text-secondary, #64748b);
    font-weight: 400;
  }

  .cs-guide-step-icon { font-size: 14px; }

  .cs-guide-step-detail {
    margin-top: 6px;
    padding-left: 20px;
    font-size: 12px;
    color: var(--cs-text-secondary, #64748b);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cs-guide-supplement-input {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cs-guide-textarea {
    width: 100%;
    min-height: 60px;
    padding: 8px 10px;
    border: 1px solid var(--cs-border, #e2e8f0);
    border-radius: var(--cs-radius-sm, 6px);
    font-size: 13px;
    color: var(--cs-text, #0f172a);
    background: var(--cs-bg, #fff);
    resize: vertical;
    font-family: inherit;
  }

  .cs-guide-textarea:focus {
    outline: none;
    border-color: var(--cs-accent, #0284c7);
    box-shadow: 0 0 0 3px var(--cs-accent-glow, rgba(2,132,199,0.15));
  }

  @media(prefers-reduced-motion:reduce){
    #cs-dashboard *,#cs-overlay *,#cs-context-menu *,.cs-topic-detail-overlay *,.cs-dash-modal-overlay *{
      animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;
    }
  }
  /* ── Typography scale (rooted at #cs-dashboard) ──────── */
  #cs-dashboard{
    font-size:15px;
    --cs-fz-xxs:10px;
    --cs-fz-xs:11px;
    --cs-fz-sm:12px;
    --cs-fz-base:13px;
    --cs-fz-md:14px;
    --cs-fz-lg:15px;
    --cs-fz-xl:17px;
    --cs-fz-h1:20px;
    --cs-fz-h2:16px;

    --cs-panel-width:960px;
    --cs-panel-top:32px;
    --cs-panel-bottom:32px;
    --cs-sidebar-width:184px;
  }

  #cs-overlay{position:fixed;right:20px;bottom:20px;z-index:2147483647;font-family:var(--cs-font);user-select:none;font-size:var(--cs-fz-md)}
  .cs-shield-btn{width:56px;height:56px;border-radius:50%;border:2px solid var(--cs-accent);background:var(--cs-bg);cursor:pointer;box-shadow:var(--cs-shadow-md),0 0 16px var(--cs-accent-glow);display:flex;align-items:center;justify-content:center;padding:0;transition:all .25s var(--cs-transition);animation:csFloat 4s ease-in-out infinite,csDropBreath 3s ease-in-out infinite;position:relative}
  .cs-shield-drop{position:relative;z-index:2;filter:drop-shadow(0 2px 6px var(--cs-accent-glow))}
  .cs-shield-ripple{position:absolute;inset:-2px;border-radius:50%;border:1.5px solid var(--cs-accent);opacity:0;pointer-events:none;animation:csGuardianRipple 3s ease-out infinite}
  .cs-shield-ripple:nth-child(2){animation-delay:1.5s}
  .cs-shield-btn:hover{transform:scale(1.08);box-shadow:var(--cs-shadow-lg),0 0 0 4px var(--cs-accent-soft),0 0 24px var(--cs-accent-glow)}
  .cs-shield-btn:active{transform:scale(.95)}
  .cs-shield-btn.cs-shield-ai-active{animation:csFloat 4s ease-in-out infinite,csAIPulse 2.5s ease-in-out infinite;border-color:var(--cs-accent)}
  @keyframes csFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
  @keyframes csAIPulse{0%,100%{box-shadow:var(--cs-shadow-md),0 0 16px var(--cs-accent-glow)}50%{box-shadow:0 0 0 0 var(--cs-accent-glow),0 0 32px 8px var(--cs-accent-glow),var(--cs-shadow-md)}}
  .cs-shield-btn svg{width:28px;height:28px;position:relative;z-index:2}
  .cs-overlay-card{position:absolute;bottom:66px;right:0;width:280px;background:var(--cs-bg);border-radius:var(--cs-radius-lg);box-shadow:var(--cs-shadow-lg);border:1px solid var(--cs-border);padding:14px;animation:csSlideUp .3s var(--cs-transition)}
  .cs-overlay-card.cs-hidden{display:none}
  @keyframes csSlideUp{from{opacity:0;transform:translateY(12px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
  .cs-overlay-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}
  .cs-overlay-title{font-weight:700;font-size:13px;color:var(--cs-accent);letter-spacing:-.01em}
  .cs-overlay-dot{width:7px;height:7px;border-radius:50%;margin-left:auto}
  .cs-overlay-stats{display:flex;gap:6px;margin-bottom:8px}
  .cs-overlay-stat{flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 4px;background:var(--cs-bg-body);border-radius:var(--cs-radius-sm)}
  .cs-stat-num{font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--cs-text);font-family:var(--cs-font-mono);letter-spacing:-.03em;animation:csCountUp .5s var(--cs-transition)}
  .cs-stat-num-toxic{color:var(--cs-toxic-text)}
  .cs-stat-lbl{font-size:9px;color:var(--cs-text-secondary);text-transform:uppercase;letter-spacing:.03em}
  .cs-overlay-ai{display:flex;align-items:center;gap:4px;margin-bottom:6px;padding:5px 8px;background:var(--cs-accent-soft);border-radius:var(--cs-radius-sm);font-size:11px}
  .cs-overlay-learn{display:flex;align-items:center;gap:4px;margin-bottom:6px;padding:4px 8px;background:color-mix(in srgb,var(--cs-accent)4%,var(--cs-bg-body));border-radius:var(--cs-radius-sm);font-size:10px;border:1px solid color-mix(in srgb,var(--cs-accent)8%,var(--cs-border))}
  .cs-overlay-learn-dot{width:5px;height:5px;border-radius:50%;background:var(--cs-text-tertiary);flex-shrink:0}
  .cs-overlay-learn-dot.cs-learn-active{background:var(--cs-success);box-shadow:0 0 6px var(--cs-success);animation:csLearnPulse 1.6s ease-in-out infinite}
  @keyframes csLearnPulse{0%,100%{opacity:1;box-shadow:0 0 4px var(--cs-success)}50%{opacity:.5;box-shadow:0 0 8px var(--cs-success),0 0 12px color-mix(in srgb,var(--cs-success)30%,transparent)}}
  .cs-overlay-learn-label{color:var(--cs-text-secondary);font-weight:500;margin-right:auto}
  .cs-overlay-learn-val{font-weight:700;color:var(--cs-accent);font-family:var(--cs-font-mono);font-size:11px;font-variant-numeric:tabular-nums}
  .cs-overlay-learn-cand{font-size:9px;color:var(--cs-success);font-weight:600;font-family:var(--cs-font-mono);min-width:0}
  .cs-overlay-ai-label{color:var(--cs-text-secondary)}
  .cs-overlay-ai-val{color:var(--cs-accent);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;text-align:right}
  .cs-overlay-actions{display:flex;gap:6px}
  .cs-ov-btn{flex:1;padding:7px;border:1px solid var(--cs-border);border-radius:8px;background:var(--cs-bg-body);color:var(--cs-text);cursor:pointer;font-size:11px;font-weight:600;text-align:center;transition:all .2s var(--cs-transition)}
  .cs-ov-btn:hover{background:var(--cs-accent);color:#fff;border-color:var(--cs-accent)}

  #cs-dashboard{position:fixed;inset:0;z-index:2147483646;display:none;font-family:var(--cs-font);font-size:var(--cs-fz-lg);user-select:none}
  #cs-dashboard.cs-dash-open{display:block}
  .cs-dash-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
  .cs-dash-panel{position:absolute;top:var(--cs-panel-top);bottom:var(--cs-panel-bottom);left:50%;transform:translateX(-50%);width:var(--cs-panel-width);max-width:95vw;display:flex;border-radius:var(--cs-radius-xl);overflow:hidden;box-shadow:var(--cs-shadow-lg);border:1px solid var(--cs-border);animation:csFadeIn .3s var(--cs-transition);transition:width .3s var(--cs-transition)}
  @keyframes csFadeIn{from{opacity:0;transform:translateX(-50%) translateY(-12px) scale(.97)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
  .cs-dash-sidebar{width:var(--cs-sidebar-width);background:linear-gradient(180deg,color-mix(in srgb,var(--cs-accent)2%,var(--cs-bg-body)) 0%,var(--cs-bg-body) 100%);display:flex;flex-direction:column;border-right:1px solid var(--cs-border);flex-shrink:0;position:relative;box-shadow:inset -1px 0 0 color-mix(in srgb,var(--cs-accent)4%,transparent)}
  .cs-dash-brand{padding:20px 14px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--cs-border);position:relative;overflow:hidden;background:linear-gradient(180deg,color-mix(in srgb,var(--cs-accent)4%,transparent) 0%,transparent 100%)}
  .cs-dash-brand::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--cs-accent),transparent);background-size:200% 100%;animation:csShimmer 4s ease infinite;opacity:.5}
  .cs-dash-brand::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--cs-accent)30%,transparent),transparent);opacity:.3}
  /* 守护水滴 — 涟漪光环象征"默默守护" */
  .cs-dash-guardian{position:relative;width:28px;height:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
  .cs-dash-logo{width:28px;height:28px;position:relative;z-index:2;filter:drop-shadow(0 2px 6px var(--cs-accent-glow));animation:csFloat 4s ease-in-out infinite,csDropBreath 3s ease-in-out infinite}
  .cs-guardian-ring{position:absolute;width:28px;height:28px;border-radius:50%;border:1.5px solid var(--cs-accent);opacity:0;animation:csGuardianRipple 3s ease-out infinite}
  .cs-guardian-ring:nth-child(2){animation-delay:1.5s}
  @keyframes csGuardianRipple{0%{transform:scale(.6);opacity:.5}100%{transform:scale(1.8);opacity:0}}
  @keyframes csDropBreath{0%,100%{filter:drop-shadow(0 2px 6px var(--cs-accent-glow))}50%{filter:drop-shadow(0 2px 12px var(--cs-accent-glow))}}
  .cs-dash-title{font-weight:800;font-size:var(--cs-fz-lg);color:var(--cs-accent);letter-spacing:-.02em}
  .cs-dash-ver{font-size:var(--cs-fz-xxs);color:var(--cs-text-secondary);margin-left:auto;font-family:var(--cs-font-mono)}
  .cs-dash-nav{flex:1;display:flex;flex-direction:column;padding:10px 8px;gap:2px;overflow-y:auto}
  .cs-nav-item{display:flex;align-items:center;gap:8px;padding:10px 12px;border:none;background:none;color:var(--cs-text-secondary);font-size:var(--cs-fz-base);font-weight:600;cursor:pointer;border-radius:var(--cs-radius);text-align:left;width:100%;transition:all .2s var(--cs-transition);position:relative;overflow:hidden;animation:csNavSlideIn .35s var(--cs-transition) both}
  .cs-nav-item:nth-child(1){animation-delay:0s}
  .cs-nav-item:nth-child(2){animation-delay:.02s}
  .cs-nav-item:nth-child(3){animation-delay:.04s}
  .cs-nav-item:nth-child(4){animation-delay:.06s}
  .cs-nav-item:nth-child(5){animation-delay:.08s}
  .cs-nav-item:nth-child(6){animation-delay:.1s}
  .cs-nav-item:nth-child(7){animation-delay:.12s}
  .cs-nav-item:nth-child(8){animation-delay:.14s}
  .cs-nav-item:nth-child(9){animation-delay:.16s}
  .cs-nav-item:nth-child(10){animation-delay:.18s}
  .cs-nav-item:hover{background:color-mix(in srgb,var(--cs-accent)8%,var(--cs-bg));color:var(--cs-text);transform:translateX(2px)}
  .cs-nav-item:focus-visible{outline:2px solid var(--cs-accent);outline-offset:-2px;border-radius:var(--cs-radius)}
  /* 守护者左侧指示条 — 渐变发光 */
  .cs-nav-item::after{content:'';position:absolute;left:0;top:50%;width:3px;height:0;border-radius:0 2px 2px 0;background:linear-gradient(180deg,var(--cs-accent),var(--cs-signal-ripple,var(--cs-accent)));transform:translateY(-50%);transition:height .3s var(--cs-transition),opacity .3s var(--cs-transition);box-shadow:0 0 10px var(--cs-accent-glow);opacity:0}
  .cs-nav-item:hover::after{height:16px;opacity:.7}
  /* 守护者涟漪光环 — hover 时扩散 */
  .cs-nav-item::before{content:'';position:absolute;inset:0;border-radius:var(--cs-radius);border:1px solid transparent;transition:all .35s var(--cs-transition);pointer-events:none}
  .cs-nav-item:hover::before{border-color:color-mix(in srgb,var(--cs-accent)15%,transparent);box-shadow:inset 0 0 16px color-mix(in srgb,var(--cs-accent)6%,transparent)}
  .cs-nav-active,.cs-nav-active:hover{background:linear-gradient(135deg,color-mix(in srgb,var(--cs-accent)12%,var(--cs-bg)),color-mix(in srgb,var(--cs-accent)4%,transparent));color:var(--cs-accent);font-weight:700;position:relative;overflow:hidden;transform:none}
  .cs-nav-active::after{height:24px !important;opacity:1;box-shadow:0 0 16px var(--cs-accent-glow)}
  /* 守护者流光扫描 */
  .cs-nav-active::before{content:'';position:absolute;inset:0;border:1px solid color-mix(in srgb,var(--cs-accent)20%,transparent);background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--cs-accent)8%,transparent),transparent);background-size:200% 100%;animation:csShimmer 3s ease infinite;pointer-events:none;border-radius:var(--cs-radius);box-shadow:inset 0 0 20px color-mix(in srgb,var(--cs-accent)6%,transparent)}
  .cs-nav-item:active{transform:scale(.97)}
  .cs-nav-icon{font-size:16px;width:22px;text-align:center;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:transform .2s var(--cs-transition)}
  .cs-nav-item:hover .cs-nav-icon{transform:scale(1.1)}
  .cs-nav-active .cs-nav-icon{transform:scale(1.05)}
  .cs-nav-icon svg{width:18px;height:18px}
  .cs-nav-sm{font-size:var(--cs-fz-sm);padding:9px 12px}
  .cs-nav-close{justify-content:center;font-size:var(--cs-fz-h2)}
  @keyframes csNavSlideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
  .cs-dash-sidebar-footer{padding:10px 8px;border-top:1px solid var(--cs-border);display:flex;flex-direction:column;gap:2px;position:relative}
  .cs-dash-sidebar-footer::before{content:'';position:absolute;top:-1px;left:20%;right:20%;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--cs-accent)30%,transparent),transparent);opacity:.5}
  .cs-dash-footer-row{display:flex;gap:4px;align-items:stretch}

  /* ── 右上角顶栏（拖拽 + 主题切换 + 关闭） ── */
  .cs-dash-topbar{position:absolute;top:12px;right:16px;display:flex;gap:4px;z-index:10}
  .cs-dash-lock-toggle{width:30px;height:30px;border:1px solid transparent;background:transparent;border-radius:var(--cs-radius-sm);cursor:pointer;color:var(--cs-text-secondary);display:flex;align-items:center;justify-content:center;transition:all .25s var(--cs-transition);margin-right:auto}
  .cs-dash-lock-toggle:hover{background:color-mix(in srgb,var(--cs-accent)8%,transparent);color:var(--cs-accent);border-color:var(--cs-border-strong);transform:translateY(-1px)}
  .cs-dash-lock-toggle:active{transform:scale(.92)}
  .cs-dash-lock-toggle svg{width:16px;height:16px;transition:transform .3s var(--cs-transition)}
  .cs-lock-icon-unlocked{display:none}
  .cs-drag-enabled .cs-lock-icon-locked{display:none}
  .cs-drag-enabled .cs-lock-icon-unlocked{display:inline}
  .cs-drag-enabled .cs-dash-lock-toggle{color:var(--cs-accent);border-color:color-mix(in srgb,var(--cs-accent)20%,transparent);background:color-mix(in srgb,var(--cs-accent)6%,transparent)}
  .cs-drag-enabled .cs-dash-panel{cursor:grab}
  .cs-drag-enabled .cs-dash-panel:active{cursor:grabbing}
  .cs-dash-dragging{transition:none!important;user-select:none!important;pointer-events:none!important;opacity:.96}
  .cs-dash-dragging .cs-dash-main{pointer-events:none!important}
  .cs-dash-theme-toggle{width:30px;height:30px;border:1px solid transparent;background:transparent;border-radius:var(--cs-radius-sm);cursor:pointer;color:var(--cs-text-secondary);display:flex;align-items:center;justify-content:center;transition:all .25s var(--cs-transition);position:relative;overflow:hidden}
  .cs-dash-theme-toggle:hover{background:var(--cs-accent-soft);color:var(--cs-accent);transform:translateY(-1px);border-color:var(--cs-border-strong)}
  .cs-dash-theme-toggle:active{transform:scale(.92)}
  .cs-dash-theme-toggle svg{width:16px;height:16px;transition:transform .4s var(--cs-transition)}
  .cs-dash-theme-toggle:hover svg{transform:rotate(20deg)}
  .cs-theme-icon-sun{display:none}
  .cs-theme-icon-moon{display:block}
  #cs-dashboard.cs-theme-light .cs-theme-icon-sun{display:block;animation:csSunRise .4s var(--cs-transition)}
  #cs-dashboard.cs-theme-light .cs-theme-icon-moon{display:none}
  #cs-dashboard.cs-theme-dark .cs-theme-icon-sun{display:none}
  #cs-dashboard.cs-theme-dark .cs-theme-icon-moon{display:block;animation:csMoonRise .4s var(--cs-transition)}
  @keyframes csSunRise{from{transform:rotate(-90deg) scale(.5);opacity:0}to{transform:rotate(0) scale(1);opacity:1}}
  @keyframes csMoonRise{from{transform:rotate(90deg) scale(.5);opacity:0}to{transform:rotate(0) scale(1);opacity:1}}

  /* ── 手动主题覆盖（完整变量集） ── */
  #cs-dashboard.cs-theme-light,#cs-dashboard.cs-theme-light *,
  html.cs-dash-theme-light #cs-dash-modal,html.cs-dash-theme-light #cs-dash-modal *,
  html.cs-dash-theme-light .cs-topic-detail-overlay,html.cs-dash-theme-light .cs-topic-detail-overlay *,
  html.cs-dash-theme-light .cs-dash-modal-overlay,html.cs-dash-theme-light .cs-dash-modal-overlay *{
    --cs-bg:#ffffff !important;--cs-bg-body:#f8f9fa !important;--cs-bg-elevated:#ffffff !important;
    --cs-text:#171717 !important;--cs-text-secondary:#525252 !important;--cs-text-tertiary:#a3a3a3 !important;
    --cs-border:rgba(0,0,0,.08) !important;--cs-border-strong:rgba(0,0,0,.15) !important;
    --cs-shadow:0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04) !important;--cs-shadow-md:0 4px 12px rgba(0,0,0,.08),0 2px 4px rgba(0,0,0,.04) !important;--cs-shadow-lg:0 12px 32px rgba(0,0,0,.1),0 4px 8px rgba(0,0,0,.06) !important;
    --cs-accent:#0284c7 !important;--cs-accent-hover:#0369a1 !important;--cs-accent-soft:rgba(2,132,199,.06) !important;--cs-accent-glow:rgba(2,132,199,.15) !important;
    --cs-toggle-bg:rgba(0,0,0,.1) !important;--cs-toggle-on:#0284c7 !important;
    --cs-danger:#ef4444 !important;--cs-danger-soft:rgba(239,68,68,.06) !important;
    --cs-success:#0ea5e9 !important;--cs-success-soft:rgba(14,165,233,.06) !important;
    --cs-warning:#f59e0b !important;--cs-warning-soft:rgba(245,158,11,.06) !important;
    --cs-input-bg:#f8f9fa !important;--cs-input-border:rgba(0,0,0,.1) !important;--cs-divider:rgba(0,0,0,.06) !important;
    --cs-toxic-bg:rgba(239,68,68,.06) !important;--cs-toxic-text:#dc2626 !important;
    --cs-signal-calm:#0284c7 !important;--cs-signal-ripple:#0ea5e9 !important;--cs-signal-wave:#6366f1 !important;--cs-signal-vortex:#8b5cf6 !important;--cs-signal-storm:#ec4899 !important;--cs-signal-danger:#ef4444 !important;
  }
  #cs-dashboard.cs-theme-dark,#cs-dashboard.cs-theme-dark *,
  html.cs-dash-theme-dark #cs-dash-modal,html.cs-dash-theme-dark #cs-dash-modal *,
  html.cs-dash-theme-dark .cs-topic-detail-overlay,html.cs-dash-theme-dark .cs-topic-detail-overlay *,
  html.cs-dash-theme-dark .cs-dash-modal-overlay,html.cs-dash-theme-dark .cs-dash-modal-overlay *{
    --cs-bg:#000000 !important;--cs-bg-body:#0a0a0a !important;--cs-bg-elevated:#141414 !important;
    --cs-text:#e0f2fe !important;--cs-text-secondary:#7dd3fc !important;--cs-text-tertiary:#38bdf8 !important;
    --cs-border:rgba(56,189,248,.12) !important;--cs-border-strong:rgba(56,189,248,.32) !important;
    --cs-shadow:0 1px 3px rgba(0,0,0,.4),0 1px 2px rgba(0,0,0,.2) !important;--cs-shadow-md:0 4px 16px rgba(56,189,248,.08),0 2px 4px rgba(0,0,0,.3) !important;--cs-shadow-lg:0 12px 32px rgba(0,0,0,.6),0 4px 8px rgba(56,189,248,.1) !important;
    --cs-accent:#38bdf8 !important;--cs-accent-hover:#7dd3fc !important;--cs-accent-soft:rgba(56,189,248,.08) !important;--cs-accent-glow:rgba(56,189,248,.2) !important;
    --cs-toggle-bg:rgba(255,255,255,.1) !important;--cs-toggle-on:#38bdf8 !important;
    --cs-danger:#f87171 !important;--cs-danger-soft:rgba(248,113,113,.08) !important;
    --cs-success:#22d3ee !important;--cs-success-soft:rgba(34,211,238,.08) !important;
    --cs-warning:#fbbf24 !important;--cs-warning-soft:rgba(251,191,36,.08) !important;
    --cs-input-bg:#0a0a0a !important;--cs-input-border:rgba(56,189,248,.1) !important;--cs-divider:rgba(56,189,248,.06) !important;
    --cs-toxic-bg:rgba(248,113,113,.08) !important;--cs-toxic-text:#fca5a5 !important;
    --cs-signal-calm:#38bdf8 !important;--cs-signal-ripple:#22d3ee !important;--cs-signal-wave:#818cf8 !important;--cs-signal-vortex:#a78bfa !important;--cs-signal-storm:#f472b6 !important;--cs-signal-danger:#f87171 !important;
    --cs-neon-glow:0 0 8px rgba(56,189,248,.4),0 0 16px rgba(56,189,248,.2) !important;
    --cs-neon-text:0 0 6px rgba(56,189,248,.5) !important;
    --cs-scanline:repeating-linear-gradient(0deg,transparent 0,transparent 2px,rgba(56,189,248,.015) 2px,rgba(56,189,248,.015) 3px) !important;
    --cs-rog-red:#e53935 !important;--cs-rog-orange:#ff6d00 !important;--cs-rog-glow:0 0 8px rgba(229,57,53,.35),0 0 16px rgba(229,57,53,.15) !important;
    --cs-text-gradient-main:linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #7dd3fc 100%) !important;
    --cs-text-gradient-heading:linear-gradient(135deg, #7dd3fc 0%, #38bdf8 50%, #0ea5e9 100%) !important;
    --cs-text-gradient-accent:linear-gradient(135deg, #38bdf8 0%, #818cf8 100%) !important;
    --cs-text-gradient-brand:linear-gradient(135deg, #7dd3fc 0%, #38bdf8 33%, #0ea5e9 66%, #818cf8 100%) !important;
  }

  /* ── 语言切换器 ── */
  .cs-lang-switcher{position:relative}
  .cs-lang-btn{display:flex;align-items:center;gap:6px;padding:9px 12px;border:1px solid transparent;background:transparent;color:var(--cs-text-secondary);font-size:var(--cs-fz-sm);font-weight:500;cursor:pointer;border-radius:var(--cs-radius);text-align:left;width:100%;transition:all .2s var(--cs-transition);font-family:inherit}
  .cs-lang-btn:hover{background:color-mix(in srgb,var(--cs-accent)6%,var(--cs-bg));color:var(--cs-text);border-color:color-mix(in srgb,var(--cs-accent)12%,var(--cs-border));transform:translateY(-1px);box-shadow:0 2px 6px rgba(0,0,0,.04)}
  .cs-lang-btn:active{transform:translateY(0)}
  .cs-lang-btn svg{width:14px;height:14px;flex-shrink:0;opacity:.7}
  .cs-lang-btn .cs-lang-current{font-weight:600;color:var(--cs-text);transition:color .2s}
  .cs-lang-btn:hover .cs-lang-current{color:var(--cs-accent)}
  .cs-lang-btn .cs-lang-arrow{margin-left:auto;font-size:10px;transition:transform .2s var(--cs-transition);opacity:.5}
  .cs-lang-dropdown{position:absolute;bottom:calc(100% + 4px);left:0;right:0;background:var(--cs-bg);border:1px solid var(--cs-border-strong);border-radius:var(--cs-radius);box-shadow:var(--cs-shadow-md),0 0 0 1px var(--cs-border);overflow:hidden;opacity:0;visibility:hidden;transform:translateY(4px) scale(.97);transition:all .2s var(--cs-transition);z-index:20;transform-origin:bottom center}
  .cs-lang-dropdown.cs-lang-open{opacity:1;visibility:visible;transform:translateY(0) scale(1)}
  .cs-lang-option{display:flex;align-items:center;gap:8px;padding:9px 12px;border:none;background:none;color:var(--cs-text-secondary);font-size:var(--cs-fz-sm);cursor:pointer;width:100%;text-align:left;transition:all .15s var(--cs-transition);font-family:inherit;position:relative}
  .cs-lang-option:hover{background:color-mix(in srgb,var(--cs-accent)6%,var(--cs-bg));color:var(--cs-text)}
  .cs-lang-option.cs-lang-active{color:var(--cs-accent);font-weight:600;background:color-mix(in srgb,var(--cs-accent)8%,var(--cs-bg))}
  .cs-lang-option.cs-lang-active::before{content:'';position:absolute;left:0;top:4px;bottom:4px;width:2px;border-radius:0 2px 2px 0;background:var(--cs-accent)}
  .cs-lang-option .cs-lang-code{font-size:10px;color:var(--cs-text-tertiary);margin-left:auto;font-family:var(--cs-font-mono);text-transform:uppercase}
  .cs-lang-option.cs-lang-active .cs-lang-code{color:var(--cs-accent)}
  .cs-dash-close-btn{width:30px;height:30px;border:1px solid transparent;background:transparent;border-radius:var(--cs-radius-sm);cursor:pointer;font-size:var(--cs-fz-h2);line-height:1;color:var(--cs-text-secondary);display:flex;align-items:center;justify-content:center;transition:all .2s var(--cs-transition)}
  .cs-dash-close-btn:hover{background:var(--cs-danger);color:#fff;transform:rotate(90deg);border-color:var(--cs-danger)}
  .cs-dash-main{flex:1;overflow:hidden;background:var(--cs-bg);min-width:0;display:flex;flex-direction:column;flex-shrink:0;position:relative;padding-top:56px}
  .cs-dash-section{padding:16px 18px;overflow-y:auto;flex:1 1 0;animation:csFadeSlideIn .3s var(--cs-transition);min-height:0;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
  .cs-dash-section-header{
    display:flex;align-items:center;justify-content:space-between;
    margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--cs-border);
    position:relative;
  }
  .cs-dash-section-header::after{
    content:'';position:absolute;bottom:-1px;left:0;width:48px;height:2px;border-radius:1px;
    background:linear-gradient(90deg,var(--cs-accent),var(--cs-signal-ripple,var(--cs-accent)));
    background-size:200% 100%;animation:csShimmer 3s ease infinite;
  }
  .cs-dash-section-title{font-size:var(--cs-fz-h1);font-weight:800;color:var(--cs-text);letter-spacing:-.02em;display:flex;align-items:center;gap:8px;position:relative}
  .cs-dash-section-title::before{
    content:'';width:6px;height:22px;border-radius:3px;flex-shrink:0;
    background:linear-gradient(180deg,var(--cs-accent),var(--cs-signal-ripple,var(--cs-accent)));
    box-shadow:0 0 8px var(--cs-accent-glow);
  }
  .cs-dash-section-header-actions{display:flex;align-items:center;gap:6px}
  .cs-dash-block{background:var(--cs-bg-body);border:1px solid var(--cs-border);border-radius:var(--cs-radius-lg);padding:12px 14px;margin-bottom:10px;transition:all .25s var(--cs-transition);position:relative;overflow:hidden;animation:csFadeSlideIn .35s var(--cs-transition) both}
  .cs-dash-block:nth-child(1){animation-delay:0s}
  .cs-dash-block:nth-child(2){animation-delay:.04s}
  .cs-dash-block:nth-child(3){animation-delay:.08s}
  .cs-dash-block:nth-child(4){animation-delay:.12s}
  .cs-dash-block:nth-child(5){animation-delay:.16s}
  .cs-dash-block:nth-child(6){animation-delay:.2s}
  .cs-dash-block:hover{border-color:var(--cs-accent);transform:translateY(-2px);box-shadow:0 4px 16px var(--cs-shadow-md),0 0 0 1px var(--cs-accent-soft)}
  .cs-dash-block::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--cs-accent),transparent);opacity:0;transition:opacity .25s}
  .cs-dash-block:hover::before{opacity:.6}
  .cs-dash-block-label{font-size:13px;font-weight:700;color:var(--cs-text);margin-bottom:6px}
  .cs-dash-block-header{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:13px}
  .cs-block-label{color:var(--cs-text-secondary)}
  .cs-block-val{font-weight:600;color:var(--cs-text)}

  /* ─── 功能限额管理 ──────────────────────────────── */
  .cs-quota-item{background:var(--cs-bg-elevated);border:1px solid var(--cs-border);border-radius:var(--cs-radius);padding:12px 14px;margin-bottom:8px;transition:all .25s var(--cs-transition);animation:csFadeSlideIn .35s var(--cs-transition) both;position:relative;overflow:hidden}
  .cs-quota-item:nth-child(1){animation-delay:0s}
  .cs-quota-item:nth-child(2){animation-delay:.04s}
  .cs-quota-item:nth-child(3){animation-delay:.08s}
  .cs-quota-item:hover{border-color:var(--cs-border-strong);box-shadow:0 4px 16px rgba(0,0,0,.08),0 0 0 1px var(--cs-border-strong);transform:translateY(-1px)}
  .cs-quota-item::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--cs-accent),transparent);opacity:0;transition:opacity .25s}
  .cs-quota-item:hover::before{opacity:.5}
  .cs-quota-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px;gap:12px}
  .cs-quota-label{font-size:13px;font-weight:700;color:var(--cs-text);display:block;line-height:1.4}
  .cs-quota-desc{font-size:11px;color:var(--cs-text-secondary);display:block;margin-top:1px;line-height:1.4}
  .cs-quota-num{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--cs-text);font-family:var(--cs-font-mono);white-space:nowrap;flex-shrink:0;letter-spacing:-.03em}
  .cs-quota-bar{height:6px;border-radius:3px;background:var(--cs-bg-body);border:1px solid var(--cs-border);overflow:hidden;position:relative}
  .cs-quota-fill{height:100%;border-radius:2px;transition:width .6s var(--cs-transition),background .3s;position:relative}
  .cs-quota-fill::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 20%,rgba(255,255,255,.25) 45%,rgba(255,255,255,.08) 55%,transparent 80%);background-size:250% 100%;animation:csBarShimmer 3s ease infinite;pointer-events:none}
  .cs-quota-controls{display:flex;align-items:center;justify-content:space-between;margin-top:8px;gap:10px}
  .cs-quota-limit-label{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--cs-text-secondary);font-weight:500}
  .cs-quota-limit-input{width:72px;padding:4px 8px;border:1px solid var(--cs-border);border-radius:6px;background:var(--cs-bg-body);color:var(--cs-text);font-size:13px;font-weight:600;font-family:var(--cs-font-mono);font-variant-numeric:tabular-nums;transition:border-color .2s,box-shadow .2s;text-align:center}
  .cs-quota-limit-input:focus{border-color:var(--cs-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--cs-accent)10%,transparent);outline:none}
  .cs-quota-limit-input:hover{border-color:var(--cs-border-strong)}
  .cs-quota-remaining{font-size:12px;font-weight:600;color:var(--cs-text-secondary);font-variant-numeric:tabular-nums}

  .cs-ov-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}

  /* ═══ 守护者状态可视化 — 概览页 Hero ═══ */
  .cs-guardian-hero{
    display:flex;align-items:center;gap:18px;padding:20px 18px;margin-bottom:14px;
    background:linear-gradient(135deg,var(--cs-bg-body),var(--cs-bg-elevated));
    border:1px solid var(--cs-border);border-radius:var(--cs-radius-xl);
    position:relative;overflow:hidden;animation:csFadeSlideIn .4s var(--cs-transition);
  }
  .cs-guardian-hero::before{
    content:'';position:absolute;top:-50%;right:-20%;width:60%;height:200%;
    background:radial-gradient(ellipse,var(--cs-accent-glow),transparent 60%);
    opacity:.5;animation:csGuardianAura 8s ease-in-out infinite;pointer-events:none;
  }
  @keyframes csGuardianAura{0%,100%{transform:translate(0,0) scale(1);opacity:.3}50%{transform:translate(-10px,10px) scale(1.1);opacity:.5}}
  .cs-guardian-visual{
    position:relative;width:64px;height:64px;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;
  }
  .cs-guardian-drop{
    width:44px;height:44px;position:relative;z-index:3;
    filter:drop-shadow(0 4px 12px var(--cs-accent-glow));
    animation:csFloat 4s ease-in-out infinite,csDropBreath 3s ease-in-out infinite;
  }
  .cs-guardian-aura{
    position:absolute;width:64px;height:64px;border-radius:50%;
    background:radial-gradient(circle,var(--cs-accent-glow),transparent 70%);
    animation:csGuardianPulse 3s ease-in-out infinite;
  }
  @keyframes csGuardianPulse{0%,100%{transform:scale(.8);opacity:.4}50%{transform:scale(1.2);opacity:.7}}
  .cs-guardian-ripple{
    position:absolute;width:48px;height:48px;border-radius:50%;
    border:1.5px solid var(--cs-accent);opacity:0;
    animation:csGuardianRing 3s ease-out infinite;
  }
  .cs-guardian-ripple:nth-child(2){animation-delay:0s}
  .cs-guardian-ripple:nth-child(3){animation-delay:1s}
  .cs-guardian-ripple:nth-child(4){animation-delay:2s}
  @keyframes csGuardianRing{0%{transform:scale(.5);opacity:.6}100%{transform:scale(1.8);opacity:0}}
  .cs-guardian-active .cs-guardian-ripple{border-color:var(--cs-signal-calm)}
  .cs-guardian-info{flex:1;min-width:0;position:relative;z-index:2}
  .cs-guardian-name{
    font-size:22px;font-weight:800;color:var(--cs-text);letter-spacing:-.02em;
    background:linear-gradient(135deg,var(--cs-accent),var(--cs-signal-ripple,var(--cs-accent)));
    -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  }
  .cs-guardian-tagline{
    font-size:12px;color:var(--cs-text-secondary);margin-top:2px;font-weight:500;
    letter-spacing:.02em;
  }
  .cs-guardian-status{
    display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;
  }
  .cs-guardian-dot{
    width:8px;height:8px;border-radius:50%;flex-shrink:0;
  }
  .cs-guardian-dot.on{
    background:var(--cs-signal-calm);
    box-shadow:0 0 8px var(--cs-signal-calm),0 0 16px var(--cs-accent-glow);
    animation:csGuardianPulse 2s ease-in-out infinite;
  }
  .cs-guardian-dot.off{background:var(--cs-text-tertiary)}
  .cs-guardian-status-text{color:var(--cs-text);font-weight:600}
  .cs-guardian-platform{
    color:var(--cs-text-secondary);font-size:11px;
    padding:2px 8px;border-radius:8px;background:var(--cs-bg-body);border:1px solid var(--cs-border);
  }

  /* ═══ 状态信息块 ═══ */
  .cs-status-block{padding:12px 16px}
  .cs-status-row{
    display:flex;justify-content:space-between;align-items:center;
    padding:5px 0;font-size:13px;
  }
  .cs-status-row+.cs-status-row{border-top:1px solid var(--cs-divider)}
  .cs-status-time{font-family:var(--cs-font-mono);font-variant-numeric:tabular-nums}

  /* ═══ AI 自学习状态 ═══ */
  .cs-learn-block{padding:12px 16px;margin-top:10px}
  .cs-learn-block-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  .cs-learn-block-dot{width:6px;height:6px;border-radius:50%;background:var(--cs-text-tertiary);flex-shrink:0}
  .cs-learn-block-dot.cs-learn-active{background:var(--cs-success);box-shadow:0 0 6px var(--cs-success);animation:csLearnPulse 1.6s ease-in-out infinite}
  .cs-learn-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px}
  .cs-learn-stat{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;background:var(--cs-bg-elevated);border:1px solid var(--cs-border);border-radius:var(--cs-radius);transition:all .2s}
  .cs-learn-stat:hover{border-color:var(--cs-border-strong);transform:translateY(-1px)}
  .cs-learn-num{font-size:18px;font-weight:800;color:var(--cs-accent);font-family:var(--cs-font-mono);font-variant-numeric:tabular-nums;letter-spacing:-.03em;line-height:1.2}
  .cs-learn-lbl{font-size:10px;color:var(--cs-text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
  .cs-learn-bar{display:flex;align-items:center;gap:8px}
  .cs-learn-bar-track{flex:1;height:4px;border-radius:2px;background:var(--cs-bg-body);border:1px solid var(--cs-border);overflow:hidden}
  .cs-learn-bar-fill{height:100%;border-radius:1px;background:linear-gradient(90deg,var(--cs-accent),var(--cs-signal-ripple));transition:width .6s var(--cs-transition)}
  .cs-learn-bar-label{font-size:9px;color:var(--cs-text-secondary);font-weight:500;white-space:nowrap}
  .cs-learn-suggest{margin-top:8px;padding:6px 10px;background:color-mix(in srgb,var(--cs-warning)8%,transparent);border:1px solid color-mix(in srgb,var(--cs-warning)15%,var(--cs-border));border-radius:var(--cs-radius-sm);font-size:11px;color:var(--cs-warning);font-weight:600;text-align:center}

  /* ═══ 涟漪事件流 ═══ */
  .cs-ripple-feed{
    background:var(--cs-bg-body);border:1px solid var(--cs-border);
    border-radius:var(--cs-radius-lg);padding:14px 16px;margin-bottom:12px;
    position:relative;overflow:hidden;
  }
  .cs-ripple-feed-header{
    display:flex;align-items:center;gap:8px;margin-bottom:10px;
  }
  .cs-ripple-feed-title{
    font-size:13px;font-weight:700;color:var(--cs-text);letter-spacing:-.01em;
  }
  .cs-ripple-feed-pulse{
    width:6px;height:6px;border-radius:50%;background:var(--cs-signal-calm);
    animation:csGuardianPulse 1.5s ease-in-out infinite;
    box-shadow:0 0 6px var(--cs-signal-calm);
  }
  .cs-ripple-feed-list{display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto}
  .cs-ripple-feed-list::-webkit-scrollbar{width:3px}
  .cs-ripple-feed-list::-webkit-scrollbar-thumb{background:var(--cs-border-strong);border-radius:2px}
  .cs-ripple-item{
    display:flex;align-items:center;gap:8px;padding:7px 10px;
    border-radius:var(--cs-radius);background:var(--cs-bg);
    border:1px solid var(--cs-border);font-size:12px;
    transition:all .2s var(--cs-transition);animation:csFadeSlideIn .3s var(--cs-transition);
  }
  .cs-ripple-item:hover{transform:translateX(3px);border-color:var(--cs-border-strong)}
  .cs-ripple-dot{
    width:6px;height:6px;border-radius:50%;flex-shrink:0;
  }
  .cs-ripple-toxic .cs-ripple-dot{background:var(--cs-signal-danger);box-shadow:0 0 6px var(--cs-signal-danger)}
  .cs-ripple-suspicious .cs-ripple-dot{background:var(--cs-warning);box-shadow:0 0 6px var(--cs-warning)}
  .cs-ripple-safe .cs-ripple-dot{background:var(--cs-signal-calm);box-shadow:0 0 6px var(--cs-signal-calm)}
  .cs-ripple-verdict{font-weight:600;font-size:11px;flex-shrink:0}
  .cs-ripple-toxic .cs-ripple-verdict{color:var(--cs-signal-danger)}
  .cs-ripple-suspicious .cs-ripple-verdict{color:var(--cs-warning)}
  .cs-ripple-safe .cs-ripple-verdict{color:var(--cs-signal-calm)}
  .cs-ripple-user{
    color:var(--cs-text);font-weight:500;flex:1;min-width:0;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  }
  .cs-ripple-time{
    color:var(--cs-text-tertiary);font-family:var(--cs-font-mono);
    font-variant-numeric:tabular-nums;font-size:11px;flex-shrink:0;
  }
  .cs-ripple-empty{
    text-align:center;padding:16px;color:var(--cs-text-tertiary);font-size:12px;
  }
  .cs-scan-btn{display:inline-flex;align-items:center;gap:6px}

  .cs-ov-card{background:var(--cs-bg-body);border:1px solid var(--cs-border-strong);border-radius:var(--cs-radius-lg);padding:16px;text-align:center;transition:all .25s var(--cs-transition);position:relative;overflow:hidden}
  .cs-ov-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--cs-accent);opacity:0;transition:opacity .25s}
  .cs-ov-card::after{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 0,var(--cs-accent-glow),transparent 70%);opacity:0;animation:csCardBreath 4s ease-in-out infinite;pointer-events:none}
  @keyframes csCardBreath{0%,100%{opacity:0}50%{opacity:.4}}
  .cs-ov-card-toxic{border-color:var(--cs-danger)}
  .cs-ov-card-toxic::before{background:var(--cs-danger)}
  .cs-ov-card-toxic::after{background:radial-gradient(circle at 50% 0,var(--cs-danger-soft),transparent 70%)}
  .cs-ov-card:hover{transform:translateY(-2px);box-shadow:var(--cs-shadow-md);border-color:var(--cs-border-strong)}
  .cs-ov-card:hover::before{opacity:1}
  .cs-ov-card:hover::after{opacity:.6;animation:none}
  .cs-dash-block:hover{transform:translateY(-1px);box-shadow:var(--cs-shadow-md);border-color:var(--cs-border-strong)}
  .cs-stagger-item{animation:csFadeSlideIn .35s var(--cs-transition) both}
  .cs-stagger-item:nth-child(1){animation-delay:0s}
  .cs-stagger-item:nth-child(2){animation-delay:.04s}
  .cs-stagger-item:nth-child(3){animation-delay:.08s}
  .cs-stagger-item:nth-child(4){animation-delay:.12s}
  .cs-stagger-item:nth-child(5){animation-delay:.16s}
  .cs-stagger-item:nth-child(6){animation-delay:.2s}
  .cs-stagger-item:nth-child(7){animation-delay:.24s}
  .cs-stagger-item:nth-child(8){animation-delay:.28s}
  .cs-ov-num{font-size:28px;font-weight:700;font-variant-numeric:tabular-nums;font-family:var(--cs-font-mono);letter-spacing:-.02em;color:var(--cs-text)}
  .cs-ov-card-toxic .cs-ov-num{color:var(--cs-signal-danger)}
  .cs-ov-lbl{font-size:12px;color:var(--cs-text-secondary);margin-top:2px;font-weight:500}
  .cs-dash-actions{display:flex;gap:8px;margin-top:8px}
  .cs-dash-actions .cs-btn{flex:0 0 auto}
  .cs-dash-modal-overlay{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;animation:csFadeSlideIn .2s var(--cs-transition)}

  .cs-sens-options{display:flex;flex-direction:column;gap:8px;margin-bottom:4px}
  .cs-sens-option{display:flex;flex-direction:column;gap:2px;padding:10px 12px;cursor:pointer;border:1px solid var(--cs-border);border-radius:var(--cs-radius);transition:all .2s var(--cs-transition);user-select:none;background:var(--cs-bg-body)}
  .cs-sens-option input{display:none}
  .cs-sens-label{font-size:13px;font-weight:600;color:var(--cs-text)}
  .cs-sens-desc{font-size:12px;color:var(--cs-text-secondary)}
  .cs-sens-option:hover{border-color:var(--cs-accent);background:var(--cs-accent-soft)}
  .cs-sens-option.active{background:var(--cs-accent);border-color:var(--cs-accent);box-shadow:0 2px 8px var(--cs-accent-glow)}
  .cs-sens-option.active .cs-sens-label{color:#fff}
  .cs-sens-option.active .cs-sens-desc{color:rgba(255,255,255,.85)}
  .cs-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:2px 0}
  .cs-label{font-size:14px;color:var(--cs-text)}
  .cs-switch{position:relative;width:40px;height:22px;flex-shrink:0}
  .cs-switch input{opacity:0;width:0;height:0}
  .cs-slider{position:absolute;cursor:pointer;inset:0;background:var(--cs-toggle-bg);border-radius:22px;transition:background .3s var(--cs-transition)}
  .cs-slider::before{content:'';position:absolute;left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .3s var(--cs-transition);box-shadow:0 1px 3px rgba(0,0,0,.2)}
  .cs-switch input:checked+.cs-slider{background:var(--cs-toggle-on)}
  .cs-switch input:checked+.cs-slider::before{transform:translateX(18px)}
  .cs-select{background:var(--cs-input-bg);border:1px solid var(--cs-input-border);color:var(--cs-text);border-radius:var(--cs-radius-sm);padding:6px 10px;font-size:13px;outline:none;cursor:pointer;transition:border-color .2s var(--cs-transition)}
  .cs-select:focus{border-color:var(--cs-accent);box-shadow:0 0 0 3px var(--cs-accent-soft)}
  .cs-select-sm{max-width:120px}
  .cs-input{background:var(--cs-input-bg);border:1px solid var(--cs-input-border);color:var(--cs-text);border-radius:var(--cs-radius-sm);padding:7px 10px;font-size:13px;outline:none;width:100%;box-sizing:border-box;transition:border-color .2s var(--cs-transition),box-shadow .2s var(--cs-transition)}
  .cs-input:focus{border-color:var(--cs-accent);box-shadow:0 0 0 3px var(--cs-accent-soft),0 0 12px var(--cs-accent-glow)}
  .cs-input-narrow{width:auto}
  .cs-hint{font-size:12px;color:var(--cs-text-secondary);line-height:1.4;font-weight:500}
  .cs-btn{padding:8px 14px;border:1px solid var(--cs-border);border-radius:var(--cs-radius);background:var(--cs-bg-body);color:var(--cs-text);cursor:pointer;font-size:13px;font-weight:600;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;transition:all .2s var(--cs-transition);position:relative;overflow:visible}
  /* 守护者数量徽章 */
  .cs-count-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;background:var(--cs-accent);color:#fff;border-radius:9px;padding:0 5px;font-size:10px;font-weight:700;line-height:18px;text-align:center;box-shadow:0 0 8px var(--cs-accent-glow);z-index:2;pointer-events:none}
  .cs-btn:hover{background:var(--cs-accent);color:#fff;border-color:var(--cs-accent);box-shadow:0 2px 8px var(--cs-accent-glow);transform:translateY(-1px)}
  .cs-btn-sm{flex:0 0 auto;padding:6px 14px;font-size:12px}
  .cs-btn-xs{padding:4px 10px;font-size:12px}
  .cs-btn-ghost{background:none;border:none;color:var(--cs-accent)}
  .cs-btn-ghost:hover{text-decoration:underline;background:none;box-shadow:none}
  .cs-btn-danger{background:var(--cs-danger);color:#fff;border-color:var(--cs-danger)}
  .cs-btn-danger:hover{background:var(--cs-danger);opacity:.9;box-shadow:0 2px 8px rgba(239,68,68,.3);transform:translateY(-1px)}
  .cs-btn:active{transform:scale(.97)}
  .cs-btn-accent{background:var(--cs-accent);color:#fff;border-color:var(--cs-accent);box-shadow:0 2px 8px var(--cs-accent-glow)}
  .cs-btn-accent:hover{background:var(--cs-accent-hover);box-shadow:0 4px 16px var(--cs-accent-glow),0 0 24px var(--cs-accent-glow);transform:translateY(-1px)}
  .cs-btn-loading{opacity:.7;pointer-events:none;position:relative}
  .cs-btn-loading::after{content:'';position:absolute;inset:0;border-radius:inherit;background:repeating-linear-gradient(90deg,transparent,transparent 8px,rgba(255,255,255,.15) 8px,rgba(255,255,255,.15) 16px);background-size:200% 100%;animation:csBtnLoad .8s linear infinite}
  @keyframes csBtnLoad{from{background-position:200% 0}to{background-position:-200% 0}}
  /* ─── Rules Toolbar ─────────────────────── */
  .cs-rules-toolbar{display:flex;align-items:center;gap:8px;margin-bottom:8px}
  .cs-rules-input-wrap{flex:1;display:flex;align-items:center;gap:8px;background:var(--cs-bg-body);border:1px solid var(--cs-border);border-radius:var(--cs-radius-xl);padding:6px 12px;transition:border-color .2s var(--cs-transition),box-shadow .2s var(--cs-transition)}
  .cs-rules-input-wrap:focus-within{border-color:var(--cs-accent);box-shadow:0 0 0 3px var(--cs-accent-soft)}
  .cs-rules-input-wrap svg{color:var(--cs-text-tertiary);flex-shrink:0}
  .cs-rules-input-wrap .cs-input{border:none;background:transparent;padding:0;font-size:13px;flex:1;outline:none;color:var(--cs-text)}
  .cs-rules-input-wrap .cs-input::placeholder{color:var(--cs-text-tertiary)}
  .cs-rules-count{font-size:12px;color:var(--cs-text-secondary);margin-bottom:8px;font-weight:500}
  .cs-rules-count strong{color:var(--cs-accent);font-weight:700}
  .cs-rules-footer{margin-top:8px;padding-top:8px;border-top:1px solid var(--cs-border);display:flex;justify-content:flex-end}

  /* ─── Custom Keywords List ─────────────────────── */
  .cs-custom-input-row{display:flex;gap:6px}
  .cs-custom-input-row .cs-input{flex:1}
  .cs-custom-list{max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:4px}
  .cs-custom-empty{font-size:13px;color:var(--cs-text-secondary);text-align:center;padding:10px 0}
  .cs-custom-item{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--cs-bg-body);border:1px solid var(--cs-border);border-radius:var(--cs-radius-lg);font-size:13px;transition:all .15s var(--cs-transition)}
  .cs-custom-item:hover{border-color:var(--cs-border-strong);background:var(--cs-bg-elevated)}
  .cs-custom-kw{font-weight:500;flex-shrink:0;font-size:13px;color:var(--cs-text)}
  .cs-custom-aliases{color:var(--cs-text-secondary);font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
  .cs-custom-del{background:none;border:none;color:var(--cs-text-secondary);cursor:pointer;font-size:14px;padding:4px 6px;line-height:1;flex-shrink:0;border-radius:var(--cs-radius-sm);transition:all .15s}
  .cs-custom-del:hover{color:var(--cs-danger);background:var(--cs-toxic-bg)}

  /* ─── Topic Groups ─────────────────────── */
  .cs-topic-stats{display:flex;align-items:center;gap:6px;margin-bottom:14px;padding:10px 14px;background:var(--cs-bg-body);border-radius:var(--cs-radius-lg);border:1px solid var(--cs-border);width:fit-content}
  .cs-topic-stat-item{display:flex;align-items:baseline;gap:4px}
  .cs-topic-stat-num{font-size:18px;font-weight:800;color:var(--cs-accent);line-height:1}
  .cs-topic-stat-label{font-size:12px;color:var(--cs-text-secondary);font-weight:500}
  .cs-topic-stat-sep{color:var(--cs-text-tertiary);font-weight:300}
  .cs-topic-group{margin-bottom:16px}
  .cs-topic-group:last-child{margin-bottom:0}
  .cs-topic-group-header{display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--cs-border)}
  .cs-topic-group-icon{font-size:16px;line-height:1}
  .cs-topic-group-label{font-size:13px;font-weight:700;color:var(--cs-text);letter-spacing:-.01em}
  .cs-topic-group-count{font-size:11px;color:var(--cs-text-secondary);background:var(--cs-bg-body);padding:2px 8px;border-radius:10px;margin-left:auto;font-weight:600}
  .cs-topic-group-hot .cs-topic-group-label{color:#ff6b35}
  .cs-topic-group-hot .cs-topic-group-count{background:color-mix(in srgb,#ff6b35 12%,transparent);color:#ff6b35}

  /* ─── Topic Chips ─────────────────────── */
  .cs-topic-grid{display:flex;flex-wrap:wrap;gap:8px}
  .cs-topic-chip{display:inline-flex;align-items:center;gap:6px;background:var(--cs-bg-body);border:1px solid var(--cs-border);border-radius:16px;padding:3px 6px 3px 10px;transition:all .2s var(--cs-transition);font-size:12px;cursor:default}
  .cs-topic-chip:hover{border-color:var(--cs-border-strong);transform:translateY(-1px);box-shadow:0 2px 8px var(--cs-shadow-sm)}
  .cs-topic-chip.cs-topic-on{background:color-mix(in srgb,var(--cs-accent)14%,transparent);border-color:color-mix(in srgb,var(--cs-accent)50%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--cs-accent)20%,transparent)}
  .cs-topic-chip.cs-topic-on:hover{box-shadow:0 2px 8px var(--cs-accent-glow),0 0 0 1px color-mix(in srgb,var(--cs-accent)30%,transparent)}
  .cs-topic-chip.cs-topic-hot{background:color-mix(in srgb,#ff6b35 10%,transparent);border-color:color-mix(in srgb,#ff6b35 30%,transparent)}
  .cs-topic-chip.cs-topic-hot.cs-topic-on{background:color-mix(in srgb,#ff6b35 18%,transparent);border-color:color-mix(in srgb,#ff6b35 50%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,#ff6b35 20%,transparent)}
  .cs-topic-chip-inner{display:inline-flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap}
  .cs-topic-chip-inner input[type="checkbox"]{accent-color:var(--cs-accent);margin:0;width:14px;height:14px;cursor:pointer}
  .cs-topic-chip-label{font-size:12px;line-height:1.6;color:var(--cs-text);font-weight:500}
  .cs-keyword-tag{font-weight:500}
  .cs-topic-del-btn{background:none;border:none;color:var(--cs-text-secondary);font-size:14px;cursor:pointer;padding:2px 5px;line-height:1;border-radius:50%;opacity:.4;transition:all .15s;margin-left:2px}
  .cs-topic-chip:hover .cs-topic-del-btn{opacity:1}
  .cs-topic-del-btn:hover{color:var(--cs-danger);background:var(--cs-toxic-bg)}
  .cs-topic-add-form{margin-top:8px;padding-top:6px;border-top:1px dashed var(--cs-border)}
  .cs-topic-add-row{display:flex;align-items:center;gap:6px}
  .cs-topic-add-row .cs-input{font-size:11px;padding:4px 8px;flex:1;min-width:0}
  .cs-topic-info-btn{background:transparent;border:1px solid var(--cs-border);color:var(--cs-text-secondary);cursor:pointer;font-size:11px;padding:2px 10px;line-height:1.5;flex-shrink:0;border-radius:10px;transition:all .15s;font-weight:500}
  .cs-topic-info-btn:hover{background:var(--cs-accent);color:#fff;border-color:var(--cs-accent);box-shadow:0 2px 6px var(--cs-accent-glow)}
  .cs-topic-detail-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:2147483646;display:flex;align-items:center;justify-content:center;animation:csFadeSlideIn .2s var(--cs-transition)}
  .cs-topic-detail-panel{background:var(--cs-bg);color:var(--cs-text);border-radius:var(--cs-radius-xl);width:380px;max-height:80vh;display:flex;flex-direction:column;box-shadow:var(--cs-shadow-lg);overflow:hidden;animation:csScaleIn .3s var(--cs-transition);border:1px solid var(--cs-border)}
  .cs-topic-detail-header{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid var(--cs-divider)}
  .cs-topic-detail-title{font-size:15px;font-weight:700}
  .cs-topic-detail-source{font-size:10px;color:var(--cs-text-secondary);background:var(--cs-bg-body);padding:2px 6px;border-radius:4px}
  .cs-topic-detail-close{background:none;border:none;font-size:18px;cursor:pointer;color:var(--cs-text-secondary);margin-left:auto;padding:2px 6px;border-radius:4px}
  .cs-topic-detail-close:hover{background:var(--cs-bg-body)}
  .cs-topic-detail-body{padding:14px 18px;overflow-y:auto}
  .cs-topic-detail-hdr{display:flex;align-items:center;gap:8px;margin-bottom:10px}
  .cs-topic-detail-status{font-size:11px;padding:2px 8px;border-radius:6px;background:var(--cs-bg-body);color:var(--cs-text-secondary)}
  .cs-topic-detail-status.cs-topic-status-on{background:var(--cs-success);color:#fff}
  .cs-topic-detail-kw-count{font-size:11px;color:var(--cs-text-secondary);margin-left:auto}
  .cs-topic-detail-section{margin-bottom:10px}
  .cs-topic-detail-section-title{font-size:12px;font-weight:600;color:var(--cs-text);margin-bottom:4px;display:flex;align-items:center;justify-content:space-between}
  .cs-topic-detail-tags{display:flex;flex-wrap:wrap;gap:4px}
  .cs-topic-detail-tag{font-size:11px;padding:2px 8px;border-radius:6px;background:var(--cs-bg-body);border:1px solid var(--cs-border)}
  .cs-tag-zh{background:color-mix(in srgb,var(--cs-accent)10%,var(--cs-bg-body));border-color:color-mix(in srgb,var(--cs-accent)30%,transparent);color:var(--cs-accent)}
  .cs-tag-en{background:color-mix(in srgb,var(--cs-warning)10%,var(--cs-bg-body));border-color:color-mix(in srgb,var(--cs-warning)30%,transparent);color:var(--cs-warning)}
  .cs-topic-detail-none{font-size:12px;color:var(--cs-text-secondary);padding:2px 0}
  .cs-topic-detail-clear-btn{background:none;border:none;font-size:11px;color:var(--cs-text-secondary);cursor:pointer;padding:2px 6px;border-radius:4px}
  .cs-topic-detail-clear-btn:hover{background:var(--cs-toxic-bg);color:var(--cs-danger)}
  .cs-topic-detail-rule-list{list-style:none;padding:0;margin:0}
  .cs-topic-detail-rule-item{display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px;border-bottom:1px solid var(--cs-divider)}
  .cs-topic-detail-rule-item:last-child{border-bottom:none}
  .cs-rule-trigger{font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cs-rule-conf{color:var(--cs-accent);font-size:11px;font-weight:600}
  .cs-rule-hits{font-size:11px;color:var(--cs-text-secondary)}
  .cs-topic-detail-example-list{list-style:none;padding:0;margin:0}
  .cs-topic-detail-example-item{display:flex;gap:6px;padding:4px 0;font-size:12px;border-bottom:1px solid var(--cs-divider)}
  .cs-topic-detail-example-item:last-child{border-bottom:none}
  .cs-example-user{color:var(--cs-accent);font-weight:600;flex-shrink:0;min-width:40px}
  .cs-example-time{font-size:10px;color:var(--cs-text-secondary);flex-shrink:0}
  .cs-example-text{color:var(--cs-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cs-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
  .cs-dot-on{background:var(--cs-toggle-on);box-shadow:0 0 6px var(--cs-toggle-on);animation:csDotBreath 2.4s ease-in-out infinite}
  .cs-dot-off{background:var(--cs-text-secondary)}
  @keyframes csDotBreath{0%,100%{box-shadow:0 0 4px var(--cs-toggle-on);opacity:.7}50%{box-shadow:0 0 10px var(--cs-toggle-on),0 0 16px var(--cs-accent-glow);opacity:1}}
  .cs-modal-inner{background:var(--cs-bg);border-radius:var(--cs-radius-xl);width:640px;max-width:92vw;max-height:78vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--cs-shadow-lg);border:1px solid var(--cs-border);animation:csScaleIn .3s var(--cs-transition)}
  .cs-modal-header{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid var(--cs-divider);font-weight:700;font-size:15px;letter-spacing:-.01em}
  .cs-modal-header button{background:none;border:none;font-size:18px;cursor:pointer;color:var(--cs-text-secondary);padding:4px 8px;border-radius:var(--cs-radius-sm);transition:all .2s var(--cs-transition)}
  .cs-modal-header button:hover{background:var(--cs-bg-body);color:var(--cs-text)}
  .cs-modal-body{overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:12px}
  .cs-entry{border:1px solid var(--cs-entry-border,#e5e7eb);border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;background:var(--cs-entry-bg,#f9fafb)}
  .cs-entry-meta{display:flex;gap:10px;align-items:center;font-size:13px}
  .cs-entry-user{color:var(--cs-accent);font-weight:600}
  .cs-entry-verdict{padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600}
  .cs-verdict-toxic{background:var(--cs-toxic-bg);color:var(--cs-toxic-text)}
  .cs-verdict-suspicious{background:#fff7ed;color:#ea580c}
  .cs-entry-type{padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;background:var(--cs-bg-body);color:var(--cs-text-secondary)}
  .cs-entry-time{color:var(--cs-text-secondary);margin-left:auto;font-size:12px}
  .cs-entry-text{color:var(--cs-text);font-size:13px;line-height:1.5;word-break:break-all}
  .cs-entry-actions{margin-top:4px}
  .cs-fp-btn{background:none;border:1px solid var(--cs-border);border-radius:4px;padding:2px 8px;font-size:11px;color:var(--cs-text-secondary);cursor:pointer}
  .cs-fp-btn:hover{background:var(--cs-bg-body);color:var(--cs-accent)}
  .cs-fp-marked{font-size:11px;color:var(--cs-success)}
  .cs-false-positive{opacity:.6}
  .cs-entry-risk{font-size:11px;font-weight:600}
  .cs-empty{color:var(--cs-text-secondary);text-align:center;padding:30px 0;font-size:14px}
  .cs-rules-search-row{display:flex;gap:8px;padding:12px 18px 0}
  .cs-rules-custom-toolbar{display:flex;gap:6px;margin-bottom:10px}
  .cs-rules-action-btn{background:none;border:none;color:var(--cs-text-secondary);cursor:pointer;font-size:13px;padding:0 4px;line-height:1;flex-shrink:0;border-radius:3px;opacity:.6;transition:opacity .15s}
  .cs-rules-action-btn:hover{opacity:1}
  .cs-rules-tabs{display:flex;gap:6px;padding:10px 18px;border-bottom:1px solid var(--cs-divider);flex-wrap:wrap}
  .cs-rules-tab{background:none;border:1px solid var(--cs-border);padding:7px 14px;border-radius:var(--cs-radius-sm);color:var(--cs-text-secondary);font-size:var(--cs-fz-base);cursor:pointer;transition:all .2s var(--cs-transition);font-weight:500;display:inline-flex;align-items:center;gap:5px}
  .cs-rules-tab:hover{background:var(--cs-accent-soft);color:var(--cs-text);border-color:var(--cs-border-strong)}
  .cs-rules-tab-active{background:var(--cs-accent);color:#fff;font-weight:600;border-color:var(--cs-accent);box-shadow:0 2px 8px var(--cs-accent-glow)}
  .cs-rules-tab-active:hover{background:var(--cs-accent-hover);color:#fff}
  .cs-rules-content{flex:1;overflow:hidden;display:flex;flex-direction:column}
  .cs-rules-panel{display:none;overflow-y:auto;padding:12px 14px;flex:1}
  .cs-rules-panel-active{display:block}
  .cs-rules-no-result{text-align:center;padding:16px;color:var(--cs-text-secondary)}
  .cs-keyword-list{display:flex;flex-wrap:wrap;gap:6px}
  .cs-keyword-tag{background:var(--cs-bg-body);border:1px solid var(--cs-border);padding:5px 12px;border-radius:var(--cs-radius);font-size:13px;color:var(--cs-text);transition:all .2s var(--cs-transition);display:inline-flex;align-items:center;gap:3px}
  .cs-keyword-tag:hover{border-color:var(--cs-border-strong)}
  .cs-kw-del-mode{padding-right:4px}
  .cs-kw-del-btn{display:none;background:none;border:none;cursor:pointer;font-size:13px;line-height:1;padding:0 3px;color:var(--cs-danger);border-radius:3px;margin-left:2px}
  .cs-kw-del-mode:hover .cs-kw-del-btn{display:inline-flex}
  .cs-kw-del-btn:hover{background:var(--cs-danger);color:#fff}
  .cs-regex-del-mode{display:inline-flex;align-items:center;gap:4px;padding-right:4px!important}
  .cs-regex-del-mode .cs-regex-del-btn{display:none;background:none;border:none;cursor:pointer;font-size:12px;line-height:1;padding:0 3px;color:var(--cs-danger);border-radius:3px}
  .cs-regex-del-mode:hover .cs-regex-del-btn{display:inline-flex}

  /* ─── Toast notifications ─────────────────────── */
  .cs-toast-container{position:fixed;top:16px;right:16px;z-index:2147483647;display:flex;flex-direction:column;gap:8px;pointer-events:none}
  .cs-toast{padding:12px 18px;border-radius:var(--cs-radius);font-size:13px;font-weight:500;box-shadow:var(--cs-shadow-lg);pointer-events:auto;animation:csToastIn .3s var(--cs-transition);max-width:320px;display:flex;align-items:center;gap:8px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
  .cs-toast.cs-toast-out{animation:csToastOut .25s var(--cs-transition) forwards}
  .cs-toast-success{background:var(--cs-success);color:#fff}
  .cs-toast-error{background:var(--cs-danger);color:#fff}
  .cs-toast-info{background:var(--cs-accent);color:#fff}
  .cs-toast-icon{font-size:16px;flex-shrink:0}

  /* ─── Empty states ─────────────────────── */
  .cs-empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;text-align:center}
  .cs-empty-state-icon{font-size:36px;margin-bottom:12px;opacity:.5;filter:grayscale(.3)}
  .cs-empty-state-text{font-size:14px;color:var(--cs-text-secondary);margin-bottom:16px}
  .cs-empty-state-action{padding:8px 20px;border-radius:var(--cs-radius);border:1px solid var(--cs-border);background:var(--cs-bg-body);cursor:pointer;font-size:13px;color:var(--cs-text);transition:all .2s var(--cs-transition)}
  .cs-empty-state-action:hover{background:var(--cs-accent);color:#fff;border-color:var(--cs-accent);box-shadow:0 2px 8px var(--cs-accent-glow)}

  /* ─── 液态回到顶部按钮 ─────────────────────── */
  .cs-dash-scroll-top{
    position:absolute;right:20px;bottom:20px;width:40px;height:40px;
    border-radius:50%;border:1px solid var(--cs-border-strong);
    background:linear-gradient(135deg,var(--cs-bg-elevated),var(--cs-bg-body));
    backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
    cursor:pointer;display:flex;align-items:center;justify-content:center;
    color:var(--cs-accent);opacity:0;transform:translateY(8px) scale(.8);
    pointer-events:none;transition:opacity .25s var(--cs-transition),transform .25s var(--cs-transition);
    box-shadow:0 4px 16px var(--cs-shadow-md),0 0 0 1px var(--cs-border);
    overflow:visible;z-index:5;
  }
  .cs-dash-scroll-top.cs-show{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}
  .cs-dash-scroll-top:hover{
    transform:translateY(-2px) scale(1.08);border-color:var(--cs-accent);
    box-shadow:0 6px 24px var(--cs-accent-glow),0 0 0 1px var(--cs-accent);
  }
  .cs-dash-scroll-top:active{transform:translateY(0) scale(.95)}
  .cs-scroll-top-drop{
    width:18px;height:18px;position:relative;z-index:2;
    filter:drop-shadow(0 0 4px var(--cs-accent-glow));
    transition:transform .25s var(--cs-transition);
  }
  .cs-dash-scroll-top:hover .cs-scroll-top-drop{transform:translateY(-2px)}
  .cs-scroll-top-ripple{
    position:absolute;width:100%;height:100%;border-radius:50%;
    border:1.5px solid var(--cs-accent);opacity:0;
    animation:csScrollTopRing 2.4s ease-out infinite;
  }
  .cs-scroll-top-ripple:nth-child(2){animation-delay:1.2s}
  @keyframes csScrollTopRing{0%{transform:scale(.6);opacity:.5}100%{transform:scale(1.6);opacity:0}}

  /* ─── AI Chat Panel ─────────────────────── */
  .cs-chat-container{display:flex;flex-direction:column;height:100%;background:var(--cs-bg)}
  .cs-chat-header{
    display:flex;align-items:center;justify-content:space-between;
    padding:12px 16px;gap:12px;flex-shrink:0;
    border-bottom:1px solid var(--cs-border);
    background:linear-gradient(180deg,var(--cs-bg-elevated)0%,var(--cs-bg)100%);
    position:sticky;top:0;z-index:20;pointer-events:auto;
  }
  .cs-chat-header::after{
    content:'';position:absolute;bottom:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,var(--cs-accent),transparent);
    opacity:.3;
  }
  .cs-chat-header-left{display:flex;align-items:center;gap:10px}
  .cs-chat-history-toggle{
    width:40px;height:40px;border-radius:var(--cs-radius);border:none;
    background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;
    color:var(--cs-text-secondary);transition:all .2s var(--cs-transition);
    padding:6px;
  }
  .cs-chat-history-toggle svg{width:18px;height:18px}
  .cs-chat-history-toggle:hover{background:var(--cs-bg-body);color:var(--cs-accent)}
  .cs-chat-header-brand{display:flex;align-items:center;gap:10px}
  .cs-chat-header-icon{
    width:36px;height:36px;border-radius:var(--cs-radius);
    background:var(--cs-accent-soft);display:flex;align-items:center;justify-content:center;
    position:relative;overflow:hidden;
  }
  .cs-chat-header-icon svg{
    width:20px;height:20px;color:var(--cs-accent);
    filter:drop-shadow(0 0 4px var(--cs-accent-glow));
    animation:csDropBreath 3s ease-in-out infinite;
  }
  .cs-chat-header-icon::after{
    content:'';position:absolute;inset:0;
    background:radial-gradient(circle at 50% 50%,var(--cs-accent-glow),transparent 70%);
    animation:csGuardianPulse 3s ease-in-out infinite;
  }
  .cs-chat-header-info{display:flex;flex-direction:column;gap:1px}
  .cs-chat-header-title{
    font-weight:700;font-size:15px;color:var(--cs-text);letter-spacing:-.01em;
  }
  .cs-chat-header-subtitle{
    font-size:11px;color:var(--cs-text-secondary);
  }
  .cs-chat-header-right{display:flex;align-items:center;gap:8px}
  .cs-chat-header-status{
    display:flex;align-items:center;gap:6px;padding:4px 10px;
    background:var(--cs-bg-body);border-radius:20px;border:1px solid var(--cs-border);
  }
  .cs-chat-status-dot{
    width:6px;height:6px;border-radius:50%;background:var(--cs-text-tertiary);
    transition:all .3s var(--cs-transition);
  }
  .cs-chat-status-dot.cs-online{
    background:var(--cs-success);box-shadow:0 0 8px var(--cs-success);
    animation:csGuardianPulse 2s ease-in-out infinite;
  }
  .cs-chat-status-dot.cs-offline{background:var(--cs-text-tertiary)}
  .cs-chat-status-text{font-size:11px;color:var(--cs-text-secondary);font-weight:500}
  .cs-chat-header-btn{
    width:40px;height:40px;border-radius:var(--cs-radius);border:none;
    background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;
    color:var(--cs-text-secondary);transition:all .2s var(--cs-transition);
    padding:6px;
  }
  .cs-chat-header-btn svg{width:18px;height:18px}
  .cs-chat-header-btn:hover{
    background:var(--cs-bg-body);color:var(--cs-accent);
    transform:translateY(-1px);box-shadow:0 2px 8px var(--cs-shadow-md);
  }
  .cs-chat-header-btn:active{transform:scale(.95)}
  .cs-chat-close-btn:hover{background:var(--cs-danger);color:#fff}
  .cs-chat-messages{flex:1;overflow-y:auto;padding:16px 20px;scroll-behavior:smooth;background:var(--cs-bg-body)}
  .cs-chat-input-area{padding:16px 20px;border-top:1px solid var(--cs-border);background:var(--cs-bg);flex-shrink:0}
  .cs-chat-input-wrap{
    display:flex;align-items:center;gap:10px;
    background:var(--cs-bg-body);border:1px solid var(--cs-border);
    border-radius:var(--cs-radius-xl);padding:8px 12px;
    transition:border-color .2s var(--cs-transition),box-shadow .2s var(--cs-transition);
    width:100%;
  }
  .cs-chat-input-wrap:focus-within{
    border-color:var(--cs-accent);
    box-shadow:0 0 0 3px var(--cs-accent-soft),0 0 20px var(--cs-accent-glow);
  }
  .cs-chat-add-btn{
    width:36px;height:36px;border-radius:var(--cs-radius);border:none;
    background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;
    color:var(--cs-text-secondary);transition:all .2s var(--cs-transition);flex-shrink:0;
  }
  .cs-chat-add-btn svg{width:18px;height:18px}
  .cs-chat-add-btn:hover{background:var(--cs-bg);color:var(--cs-accent)}
  .cs-chat-input-wrapper{flex:1;position:relative}
  .cs-chat-input{
    width:100%;border:none;background:transparent;font-size:14px;
    resize:none;outline:none;max-height:120px;line-height:1.6;
    font-family:inherit;color:var(--cs-text);padding:8px 0;
    white-space:pre-wrap;overflow-y:auto;word-break:break-word;
  }
  .cs-chat-input[data-placeholder]:empty:before{
    content:attr(data-placeholder);color:var(--cs-text-tertiary);
    pointer-events:none;cursor:text;
  }
  .cs-chat-input-actions{display:flex;align-items:center;gap:6px}
  .cs-chat-input-hint{
    text-align:center;font-size:11px;color:var(--cs-text-tertiary);
    margin-top:8px;width:100%;opacity:.7;
  }

  /* Chat message — AI Chat Style */
  .cs-chat-msg-user{
    display:flex;align-items:flex-end;gap:10px;margin-bottom:20px;
    animation:csBubblePop .35s var(--cs-transition);
  }
  .cs-chat-msg-ai{
    display:flex;align-items:flex-start;gap:10px;margin-bottom:20px;
    animation:csBubbleFadeIn .4s var(--cs-transition);
  }
  .cs-chat-avatar{
    width:36px;height:36px;border-radius:var(--cs-radius-lg);
    display:flex;align-items:center;justify-content:center;
    flex-shrink:0;
  }
  .cs-chat-avatar-user{
    background:linear-gradient(135deg,var(--cs-accent),var(--cs-accent-secondary));
    color:#fff;
  }
  .cs-chat-avatar-user svg{width:18px;height:18px}
  .cs-chat-avatar-ai{
    background:var(--cs-accent-soft);
    color:var(--cs-accent);
  }
  .cs-chat-avatar-ai svg{width:18px;height:18px}
  .cs-chat-bubble{
    padding:12px 16px;border-radius:var(--cs-radius-xl);
    font-size:14px;line-height:1.65;word-break:break-word;
  }
  .cs-chat-bubble-user{
    background:linear-gradient(135deg,var(--cs-accent),var(--cs-accent-secondary));
    color:#fff;border-radius:var(--cs-radius-xl) var(--cs-radius-xl) 4px var(--cs-radius-xl);
    max-width:75%;box-shadow:0 4px 16px var(--cs-accent-glow);
  }
  .cs-chat-bubble-ai{
    background:var(--cs-bg);border:1px solid var(--cs-border);
    color:var(--cs-text);border-radius:var(--cs-radius-xl) var(--cs-radius-xl) var(--cs-radius-xl) 4px;
    max-width:85%;
  }
  .cs-chat-bubble code{background:color-mix(in srgb,var(--cs-bg-body)80%,transparent);padding:2px 6px;border-radius:6px;font-size:12px;font-family:var(--cs-font-mono)}
  .cs-chat-bubble pre{background:var(--cs-bg-body);border:1px solid var(--cs-border);border-radius:var(--cs-radius-lg);padding:16px;overflow-x:auto;margin:12px 0}
  .cs-chat-bubble pre code{background:transparent;padding:0}
  .cs-chat-bubble ul,.cs-chat-bubble ol{padding-left:24px;margin:10px 0}
  .cs-chat-bubble li{margin:6px 0}
  .cs-chat-bubble h1{font-size:20px;font-weight:700;margin:16px 0 10px}
  .cs-chat-bubble h2{font-size:16px;font-weight:600;margin:12px 0 8px}
  .cs-chat-bubble h3{font-size:14px;font-weight:600;margin:10px 0 6px}
  .cs-chat-bubble p{margin:8px 0}
  .cs-chat-bubble a{color:var(--cs-accent);text-decoration:none;border-bottom:1px solid transparent}
  .cs-chat-bubble a:hover{border-bottom-color:var(--cs-accent)}
  .cs-chat-bubble-user code{background:color-mix(in srgb,#fff 20%,transparent)}
  .cs-chat-bubble-user a{color:#fff;border-bottom-color:rgba(255,255,255,.3)}
  @keyframes csBubbleFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}

  /* ★ Message action bar — ChatGPT 风格：hover 浮现于气泡下方 */
  .cs-msg-actions{display:flex;gap:2px;opacity:0;transition:opacity .15s ease;padding:4px 0 0}
  .cs-chat-msg-user:hover .cs-msg-actions,.cs-chat-msg-ai:hover .cs-msg-actions,.cs-msg-actions:focus-within,.cs-msg-actions:hover{opacity:.85}
  .cs-msg-action-btn{background:transparent;border:none;border-radius:6px;width:26px;height:26px;padding:0;margin:0;color:var(--cs-text-tertiary);cursor:pointer;transition:all .15s ease;display:inline-flex;align-items:center;justify-content:center}
  .cs-msg-action-btn:hover{color:var(--cs-accent);background:rgba(34,197,94,.08)}
  .cs-msg-action-btn.cs-copied{color:var(--cs-success)}

  /* ★ Edit mode for user messages */
  .cs-chat-edit-area{width:100%;background:var(--cs-bg-body);border:1px solid var(--cs-accent);border-radius:8px;padding:8px 12px;font-size:13px;color:var(--cs-text);resize:none;outline:none;min-height:40px;font-family:inherit}
  .cs-chat-edit-actions{display:flex;gap:6px;margin-top:6px;justify-content:flex-end}
  .cs-chat-edit-btn{padding:4px 12px;border-radius:6px;font-size:11px;cursor:pointer;border:none}
  .cs-chat-edit-confirm{background:var(--cs-accent);color:#fff}
  .cs-chat-edit-cancel{background:var(--cs-bg-body);color:var(--cs-text-secondary);border:1px solid var(--cs-border)}
  .cs-chat-typing{display:inline-flex;gap:4px;align-items:center;padding:4px 0}
  .cs-chat-typing-dot{width:6px;height:6px;border-radius:50%;background:var(--cs-text-secondary);animation:csDotBounce 1.4s ease-in-out infinite}
  .cs-chat-typing-dot:nth-child(2){animation-delay:.2s}
  .cs-chat-typing-dot:nth-child(3){animation-delay:.4s}

  /* Chat history sidebar */
  .cs-chat-history-panel{width:260px;flex-shrink:0;background:var(--cs-bg-body);border-right:1px solid var(--cs-border);display:flex;flex-direction:column;animation:csHistorySlideIn .25s cubic-bezier(0.4,0,0.2,1);overflow:hidden}
  @keyframes csHistorySlideIn{from{transform:translateX(-20px);opacity:0}to{transform:translateX(0);opacity:1}}
  .cs-chat-history-header{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 12px;border-bottom:1px solid var(--cs-border);flex-shrink:0}
  .cs-chat-history-title{font-weight:700;font-size:13px;letter-spacing:0.05em;text-transform:uppercase}
  .cs-chat-history-close{width:36px;height:36px;border:none;background:transparent;cursor:pointer;color:var(--cs-text-secondary);border-radius:10px;display:flex;align-items:center;justify-content:center;transition:all .15s var(--cs-transition);padding:6px}
  .cs-chat-history-close svg{width:16px;height:16px}
  .cs-chat-history-close:hover{background:var(--cs-bg);color:var(--cs-accent);transform:scale(1.05)}
  .cs-chat-history-list{flex:1;overflow-y:auto;padding:8px 8px 12px}
  .cs-chat-history-item{display:flex;flex-direction:column;gap:5px;padding:12px 14px;border-radius:12px;cursor:pointer;transition:all .2s ease;margin-bottom:2px;border:1px solid transparent}
  .cs-chat-history-item:hover{background:var(--cs-bg);border-color:var(--cs-border);transform:translateX(2px)}
  .cs-chat-history-item-active{
    background:linear-gradient(135deg,var(--cs-accent-soft),color-mix(in srgb,var(--cs-signal-wave)5%,transparent));
    border-color:color-mix(in srgb,var(--cs-accent)20%,transparent);
    box-shadow:0 2px 8px var(--cs-shadow);
  }
  .cs-chat-history-item-active:hover{transform:none}
  .cs-chat-history-item-preview{font-size:13px;color:var(--cs-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;line-height:1.4}
  .cs-chat-history-item-time{font-size:11px;color:var(--cs-text-tertiary);font-weight:500;letter-spacing:0.02em}
  .cs-chat-history-item-del{background:none;border:none;color:var(--cs-text-secondary);cursor:pointer;padding:6px;border-radius:8px;opacity:0;transition:all .15s ease;display:flex;align-items:center;width:32px;height:32px;flex-shrink:0;margin-left:auto}
  .cs-chat-history-item-del svg{width:14px;height:14px}
  .cs-chat-history-item:hover .cs-chat-history-item-del{opacity:1}
  .cs-chat-history-item-del:hover{color:var(--cs-danger);background:var(--cs-danger-soft);transform:scale(1.1)}
  .cs-chat-history-empty{padding:40px 24px;text-align:center;font-size:13px;color:var(--cs-text-secondary);line-height:1.6}
  .cs-chat-history-new{margin:8px 8px 12px;padding:12px 14px;border-radius:12px;border:1px dashed var(--cs-border);background:transparent;color:var(--cs-text-secondary);cursor:pointer;font-size:13px;transition:all .2s var(--cs-transition);display:flex;align-items:center;justify-content:center;gap:8px;font-weight:600}
  .cs-chat-history-new svg{width:16px;height:16px}
  .cs-chat-history-new:hover{border-color:var(--cs-accent);color:var(--cs-accent);background:var(--cs-accent-soft);transform:translateY(-1px);box-shadow:0 4px 12px var(--cs-shadow)}

  /* Debug panel */
  .cs-chat-debug-panel{width:300px;flex-shrink:0;background:var(--cs-bg);border-left:1px solid var(--cs-border);display:flex;flex-direction:column;animation:csDebugSlideIn .2s ease;overflow:hidden}
  @keyframes csDebugSlideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
  .cs-chat-debug-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--cs-border);flex-shrink:0}
  .cs-chat-debug-btn{height:28px;padding:0 8px;border:none;background:transparent;cursor:pointer;color:var(--cs-text-secondary);border-radius:6px;display:flex;align-items:center;justify-content:center;gap:4px;font-size:11px;transition:all .15s var(--cs-transition)}
  .cs-chat-debug-btn svg{width:13px;height:13px}
  .cs-chat-debug-btn:hover{background:var(--cs-bg-body);color:var(--cs-accent)}
  .cs-chat-debug-title{font-weight:600;font-size:13px;display:flex;align-items:center;gap:6px;color:var(--cs-text)}
  .cs-chat-debug-title svg{width:14px;height:14px;color:var(--cs-accent)}
  .cs-chat-debug-textarea{flex:1;border:none;background:var(--cs-bg-body);color:var(--cs-text);font-family:'Cascadia Code','Fira Code','JetBrains Mono',monospace;font-size:12px;line-height:1.6;padding:12px;resize:none;outline:none;white-space:pre-wrap;word-break:break-all}

  /* Interactive cards */
  .cs-interactive-card{border:1px solid var(--cs-border);border-radius:var(--cs-radius-lg);background:var(--cs-bg-body);margin:8px 0;overflow:hidden;animation:csScaleIn .3s var(--cs-transition);transition:all .25s var(--cs-transition)}
  .cs-interactive-card:hover{border-color:var(--cs-accent);box-shadow:0 4px 16px var(--cs-shadow-md),0 0 0 1px var(--cs-accent-soft)}
  .cs-interactive-card-header{padding:10px 14px;border-bottom:1px solid var(--cs-border);display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600}
  .cs-interactive-card-icon{font-size:16px;color:var(--cs-accent);display:inline-flex;align-items:center;filter:drop-shadow(0 0 4px var(--cs-accent-glow))}
  .cs-interactive-card-body{padding:10px 14px}
  .cs-interactive-card-footer{padding:8px 14px;border-top:1px solid var(--cs-border);display:flex;gap:6px;flex-wrap:wrap;background:color-mix(in srgb,var(--cs-bg)50%,transparent)}

  /* Option chips */
  .cs-option-chip{display:inline-flex;align-items:center;gap:4px;padding:6px 14px;border-radius:var(--cs-radius-xl);border:1px solid var(--cs-border);background:var(--cs-bg);cursor:pointer;font-size:12px;color:var(--cs-text);transition:all .2s var(--cs-transition);user-select:none}
  .cs-option-chip:hover{border-color:var(--cs-accent);background:var(--cs-accent-soft);color:var(--cs-accent)}
  .cs-option-chip:active{transform:scale(.96)}
  .cs-option-chip.cs-option-selected{border-color:var(--cs-accent);background:var(--cs-accent);color:#fff;box-shadow:0 2px 8px var(--cs-accent-glow)}
  .cs-option-chip-check{font-size:11px}

  /* Scope cards */
  .cs-scope-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin:6px 0}
  .cs-scope-card{padding:10px 12px;border-radius:var(--cs-radius);border:1px solid var(--cs-border);background:var(--cs-bg);cursor:pointer;text-align:center;font-size:12px;transition:all .2s var(--cs-transition)}
  .cs-scope-card:hover{border-color:var(--cs-accent);background:var(--cs-accent-soft)}
  .cs-scope-card:active{transform:scale(.97)}
  .cs-scope-card.cs-scope-selected{border-color:var(--cs-accent);background:var(--cs-accent-soft);color:var(--cs-accent);font-weight:600;box-shadow:0 2px 8px var(--cs-accent-glow)}
  .cs-scope-card-icon{font-size:18px;display:block;margin-bottom:2px}

  /* Confirm card */
  .cs-confirm-card{border:1px solid var(--cs-accent);border-radius:var(--cs-radius-lg);background:var(--cs-accent-soft);margin:8px 0;padding:12px 14px;animation:csScaleIn .3s var(--cs-transition)}
  .cs-confirm-card-title{font-size:13px;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:6px}
  .cs-confirm-card-detail{font-size:12px;color:var(--cs-text-secondary);line-height:1.6;margin-bottom:8px}
  .cs-confirm-card-detail code{background:var(--cs-bg);padding:1px 5px;border-radius:4px;font-size:11px}
  .cs-confirm-card-actions{display:flex;gap:8px}
  .cs-confirm-btn{padding:6px 16px;border-radius:var(--cs-radius);border:none;cursor:pointer;font-size:12px;font-weight:500;transition:all .2s var(--cs-transition)}
  .cs-confirm-btn:active{transform:scale(.97)}
  .cs-confirm-btn-primary{background:var(--cs-accent);color:#fff}
  .cs-confirm-btn-primary:hover{opacity:.9;box-shadow:0 2px 8px var(--cs-accent-glow)}
  .cs-confirm-btn-secondary{background:var(--cs-bg);color:var(--cs-text);border:1px solid var(--cs-border)}
  .cs-confirm-btn-secondary:hover{border-color:var(--cs-accent)}
  .cs-confirm-btn-danger{background:var(--cs-danger);color:#fff}

  /* Progress steps */
  .cs-progress-steps{margin:8px 0}
  .cs-progress-step{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;animation:csFadeSlideIn .25s ease}
  .cs-progress-step-icon{font-size:14px;flex-shrink:0}
  .cs-progress-step-text{flex:1}
  .cs-progress-step.cs-step-done .cs-progress-step-text{color:var(--cs-text-secondary)}
  .cs-progress-step.cs-step-active .cs-progress-step-text{color:var(--cs-accent);font-weight:500}
  .cs-progress-step.cs-step-pending .cs-progress-step-text{color:var(--cs-text-secondary);opacity:.5}
  @keyframes csTypingPulse{0%,100%{opacity:.3}50%{opacity:1}}

  /* Welcome Section — 极简水态 */
  @keyframes csCalmFadeIn{
    0%{opacity:0;transform:translateY(16px)}
    100%{opacity:1;transform:translateY(0)}
  }
  @keyframes csGlowPulse{
    0%,100%{opacity:.4;transform:scale(1)}
    50%{opacity:.7;transform:scale(1.05)}
  }
  .cs-chat-welcome{
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:60px 32px 40px;
    min-height:400px;
    position:relative;
  }
  .cs-welcome-glow{
    position:absolute;
    width:320px;height:320px;
    background:radial-gradient(circle,rgba(56,189,248,.12) 0%,rgba(129,140,248,.06) 40%,transparent 70%);
    border-radius:50%;
    animation:csGlowPulse 6s ease-in-out infinite;
    pointer-events:none;
    z-index:0;
  }
  .cs-welcome-title{
    font-size:40px;font-weight:800;
    margin:0 0 8px;letter-spacing:-.03em;
    animation:csCalmFadeIn .8s ease .1s both;
    position:relative;z-index:1;
  }
  .cs-welcome-tagline{
    font-size:12px;font-weight:600;
    margin:0 0 16px;letter-spacing:.2em;text-transform:uppercase;
    opacity:.7;
    animation:csCalmFadeIn .8s ease .25s both;
    position:relative;z-index:1;
  }
  .cs-welcome-desc{
    font-size:14px;color:var(--cs-text-secondary);
    margin:0 0 40px;text-align:center;max-width:360px;
    line-height:1.7;
    animation:csCalmFadeIn .8s ease .4s both;
    position:relative;z-index:1;
  }
  .cs-chat-welcome-suggestions{
    display:grid;grid-template-columns:1fr 1fr;gap:10px;
    width:100%;max-width:440px;
    animation:csCalmFadeIn .8s ease .55s both;
    position:relative;z-index:1;
  }
  .cs-chat-welcome-suggestions .cs-suggestion-btn{
    opacity:1;
  }
  .cs-suggestion-btn{
    display:flex;align-items:center;justify-content:center;gap:8px;
    padding:14px 18px;
    border-radius:14px;background:var(--cs-bg-body);
    border:1px solid var(--cs-border);
    font-size:13px;font-weight:500;cursor:pointer;
    transition:all .25s var(--cs-transition);white-space:nowrap;
  }
  .cs-suggestion-btn:hover{
    background:var(--cs-accent-soft);border-color:var(--cs-accent);
    transform:translateY(-2px);
    box-shadow:0 8px 24px var(--cs-shadow-lg);
  }
  .cs-suggestion-btn:active{transform:translateY(-1px) scale(.98)}
  .cs-suggestion-btn svg{width:15px;height:15px}

  /* Quick Action Form */
  .cs-quick-form{margin:12px 16px;border:1px solid var(--cs-accent);border-radius:12px;overflow:hidden;background:var(--cs-bg);color:var(--cs-text);box-shadow:0 2px 12px rgba(0,0,0,.08);animation:qfSlideIn .2s ease}
  @keyframes qfSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .cs-qf-header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--cs-accent-soft);border-bottom:1px solid var(--cs-border)}
  .cs-qf-title{font-size:13px;font-weight:600;color:var(--cs-accent)}
  .cs-qf-close{width:24px;height:24px;border:none;background:transparent;cursor:pointer;color:var(--cs-text-secondary);border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .15s var(--cs-transition)}
  .cs-qf-close svg{width:14px;height:14px}
  .cs-qf-close:hover{background:var(--cs-border);color:var(--cs-text)}
  .cs-qf-body{padding:12px 14px;display:flex;flex-direction:column;gap:10px}
  .cs-qf-field{display:flex;flex-direction:column;gap:4px}
  .cs-qf-label{font-size:11px;font-weight:500;color:var(--cs-text-secondary)}
  .cs-qf-input,.cs-qf-select{width:100%;padding:8px 10px;border:1px solid var(--cs-border);border-radius:8px;font-size:12px;background:var(--cs-bg-body);color:var(--cs-text);transition:border-color .15s;outline:none;box-sizing:border-box}
  .cs-qf-input:focus,.cs-qf-select:focus{border-color:var(--cs-accent)}
  .cs-qf-checkbox-group{display:flex;flex-wrap:wrap;gap:6px}
  .cs-qf-checkbox{display:flex;align-items:center;gap:3px;font-size:12px;color:var(--cs-text);cursor:pointer}
  .cs-qf-checkbox input[type="checkbox"]{accent-color:var(--cs-accent);width:14px;height:14px}
  .cs-qf-footer{display:flex;justify-content:flex-end;gap:8px;padding:10px 14px;border-top:1px solid var(--cs-border)}
  .cs-qf-btn{padding:6px 16px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;border:none}
  .cs-qf-cancel{background:var(--cs-bg-body);color:var(--cs-text-secondary)}
  .cs-qf-cancel:hover{background:var(--cs-border)}
  .cs-qf-submit{background:var(--cs-accent);color:#fff}
  .cs-qf-submit:hover{filter:brightness(1.1)}

  /* Tool call cards */
  .cs-tool-call-card{margin:8px 0;border:1px solid var(--cs-border);border-radius:10px;overflow:hidden;font-size:12px}
  .cs-tool-call-header{display:flex;align-items:center;gap:6px;padding:8px 12px;background:var(--cs-bg);cursor:pointer;user-select:none}
  .cs-tool-call-header:hover{background:color-mix(in srgb,var(--cs-accent)5%,transparent)}
  .cs-tool-call-icon{font-size:12px;color:var(--cs-text-secondary);display:inline-flex;align-items:center}
  .cs-tool-call-name{flex:1;font-weight:600;font-family:monospace;font-size:11px}
  .cs-tool-call-status{font-size:11px}
  .cs-tool-call-success{color:var(--cs-success)}
  .cs-tool-call-fail{color:var(--cs-danger)}
  .cs-tool-call-toggle{font-size:10px;color:var(--cs-text-secondary)}
  .cs-tool-call-body{padding:8px 12px;border-top:1px solid var(--cs-border);font-family:monospace;font-size:11px;white-space:pre-wrap;word-break:break-all}
  .cs-tool-call-collapsed .cs-tool-call-body{display:none}
  .cs-tool-call-collapsed .cs-tool-call-toggle::after{content:'▶'}
  .cs-tool-call:not(.cs-tool-call-collapsed) .cs-tool-call-toggle::after{content:'▼'}
  .cs-tool-call-label{font-weight:600;color:var(--cs-text-secondary);margin-right:4px}
  .cs-tool-call-params{margin-bottom:4px}
  .cs-tool-call-params code{background:var(--cs-bg);padding:2px 6px;border-radius:4px;font-size:10px}

  /* Sidebar */
  .cs-sidebar{width:200px;border-right:1px solid var(--cs-border);background:var(--cs-bg-body);display:flex;flex-direction:column;overflow-y:auto;transition:width .2s,opacity .2s;flex-shrink:0}
  .cs-sidebar.cs-sidebar-collapsed{width:0;overflow:hidden;opacity:0}
  .cs-sidebar-header{padding:10px 12px;font-weight:600;font-size:12px;border-bottom:1px solid var(--cs-border);display:flex;align-items:center;gap:6px}
  .cs-sidebar-topic{display:flex;align-items:center;gap:6px;padding:6px 12px;font-size:11px;border-bottom:1px solid color-mix(in srgb,var(--cs-border)50%,transparent)}
  .cs-sidebar-topic-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cs-sidebar-footer{padding:6px 8px;border-top:1px solid var(--cs-border);display:flex;gap:4px;justify-content:center}
  .cs-sidebar-btn{width:32px;height:32px;border-radius:8px;border:none;background:transparent;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;color:var(--cs-text-secondary)}
  .cs-sidebar-btn:hover{background:var(--cs-bg);color:var(--cs-text)}

  /* Settings drawer */
  .cs-settings-drawer-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;justify-content:flex-end;animation:csFadeSlideIn .2s var(--cs-transition)}
  .cs-settings-drawer{width:340px;max-width:90vw;height:100%;background:var(--cs-bg);border-left:1px solid var(--cs-border);display:flex;flex-direction:column;animation:csDrawerSlide .3s var(--cs-transition);overflow-y:auto;box-shadow:var(--cs-shadow-lg)}
  @keyframes csDrawerSlide{from{transform:translateX(100%)}to{transform:translateX(0)}}
  .cs-settings-drawer-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--cs-border);flex-shrink:0}
  .cs-settings-drawer-close{width:28px;height:28px;border:none;background:var(--cs-bg-body);border-radius:var(--cs-radius-sm);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;color:var(--cs-text-secondary);transition:all .2s var(--cs-transition)}
  .cs-settings-drawer-close:hover{background:var(--cs-danger);color:#fff;transform:rotate(90deg)}
  .cs-settings-drawer-body{padding:16px 18px;overflow-y:auto;flex:1}

  /* Legacy agent styles (for compatibility with non-chat sections) */
  .cs-agent-container{border:1px solid var(--cs-border);border-radius:12px;overflow:hidden;background:var(--cs-bg-body);margin-top:14px}
  .cs-agent-header{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--cs-border);background:var(--cs-bg)}
  .cs-agent-messages{display:flex;flex-direction:column;gap:10px;padding:14px;max-height:360px;overflow-y:auto;background:linear-gradient(180deg,var(--cs-bg)0%,var(--cs-bg-body)100%)}
  .cs-agent-bubble{display:flex;gap:8px;max-width:85%;animation:fadeIn .2s ease}
  .cs-agent-bubble-user{flex-direction:row-reverse;align-self:flex-end}
  .cs-agent-bubble-ai{align-self:flex-start}
  .cs-agent-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}
  .cs-agent-bubble-user .cs-agent-avatar{background:var(--cs-accent);color:#fff}
  .cs-agent-bubble-ai .cs-agent-avatar{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff}
  .cs-agent-content{background:var(--cs-bg);border:1px solid var(--cs-border);border-radius:12px;padding:8px 12px;font-size:12px;line-height:1.5;color:var(--cs-text);word-break:break-word}
  .cs-agent-bubble-user .cs-agent-content{background:color-mix(in srgb,var(--cs-accent)8%,var(--cs-bg));border-color:color-mix(in srgb,var(--cs-accent)20%,transparent)}
  .cs-agent-actions{display:flex;gap:6px;padding:6px 14px;border-top:1px solid var(--cs-border);background:var(--cs-bg)}
  .cs-agent-action-btn{border:1px solid var(--cs-border);background:var(--cs-bg-body);border-radius:14px;padding:4px 12px;font-size:11px;cursor:pointer;color:var(--cs-text-secondary);transition:all .15s}
  .cs-agent-action-btn:hover{background:var(--cs-accent);color:#fff;border-color:var(--cs-accent)}
  .cs-agent-input-row{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--cs-border);background:var(--cs-bg)}
  .cs-agent-input{flex:1;border:1px solid var(--cs-border);border-radius:18px;padding:8px 14px;font-size:12px;outline:none;background:var(--cs-bg-body);color:var(--cs-text);transition:border-color .15s}
  .cs-agent-input:focus{border-color:var(--cs-accent)}
  .cs-agent-send-btn{border:none;background:var(--cs-accent);color:#fff;border-radius:18px;padding:8px 18px;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .15s;flex-shrink:0}
  .cs-agent-send-btn:hover{opacity:.85}
  .cs-regex-list{display:flex;flex-wrap:wrap;gap:6px}
  .cs-regex-item{background:var(--cs-bg-body);border:1px solid var(--cs-border);padding:5px 12px;border-radius:12px;font-size:13px;color:var(--cs-text);font-family:monospace}
  .cs-custom-rules-item{display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--cs-bg-body);border-radius:6px;font-size:13px;margin-bottom:4px}
  .cs-custom-rules-item .cs-custom-kw{font-weight:600;flex-shrink:0}
  .cs-custom-rules-item .cs-custom-aliases{color:var(--cs-text-secondary);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
  .cs-custom-rules-del:hover{color:var(--cs-toxic-text);background:var(--cs-toxic-bg)}
  .cs-custom-rules-edit:hover{color:var(--cs-accent)}
  .cs-regex-del-btn{background:none;border:none;color:var(--cs-text-secondary);cursor:pointer;font-size:13px;padding:0 4px;line-height:1;border-radius:3px;opacity:.6;flex-shrink:0}
  .cs-regex-del-btn:hover{color:var(--cs-toxic-text);background:var(--cs-toxic-bg);opacity:1}
  .cs-custom-edit-form{display:flex;flex-direction:column;gap:4px;width:100%}
  .cs-edit-kw-input{font-size:13px}
  .cs-edit-alias-input{font-size:12px}
  /* ─── Guardian Log Panel ────────────────────────────────── */
  @keyframes csScanPulse{0%,100%{opacity:1;box-shadow:0 0 0 0 var(--cs-accent-glow)}50%{opacity:.65;box-shadow:0 0 0 6px transparent}}
  @keyframes csEntryReveal{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes csBadgePop{0%{transform:scale(.8)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
  @keyframes csScanLine{0%{background-position:0 0}100%{background-position:0 100%}}
  @keyframes csGlowRing{0%,100%{box-shadow:0 0 0 0 var(--cs-accent-glow)}50%{box-shadow:0 0 0 4px var(--cs-accent-soft)}}

  .cs-log-guardian{display:flex;flex-direction:column;gap:0;animation:csFadeSlideIn .35s var(--cs-transition)}

  .cs-log-status-header{display:flex;align-items:center;gap:14px;padding:16px 18px;background:linear-gradient(135deg,color-mix(in srgb,var(--cs-accent)7%,var(--cs-bg)),color-mix(in srgb,var(--cs-accent)3%,var(--cs-bg)));border:1px solid color-mix(in srgb,var(--cs-accent)18%,var(--cs-border));border-radius:var(--cs-radius-lg);margin-bottom:14px;position:relative;overflow:hidden}
  .cs-log-status-header::after{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(90deg,transparent 0%,color-mix(in srgb,var(--cs-accent)4%,transparent) 50%,transparent 100%);background-size:200% 100%;animation:csShimmer 4s ease infinite;pointer-events:none}
  .cs-log-scan-dot{width:11px;height:11px;border-radius:50%;background:var(--cs-success);flex-shrink:0;animation:csScanPulse 2.2s ease-in-out infinite;position:relative;z-index:1}
  .cs-log-scan-dot.cs-scan-idle{background:var(--cs-text-secondary);animation:none}
  .cs-log-status-text{flex:1;min-width:0;position:relative;z-index:1}
  .cs-log-status-title{font-size:14px;font-weight:700;color:var(--cs-text);letter-spacing:-.01em}
  .cs-log-status-sub{font-size:11.5px;color:var(--cs-text-secondary);margin-top:1px;display:flex;align-items:center;gap:6px}
  .cs-log-stats{display:flex;gap:5px;margin-left:auto;flex-shrink:0;position:relative;z-index:1}
  .cs-log-stat{display:flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;background:var(--cs-bg-body);border:1px solid var(--cs-border);color:var(--cs-text-secondary);transition:all .2s var(--cs-transition);cursor:default}
  .cs-log-stat:hover{border-color:var(--cs-border-strong);transform:translateY(-1px)}
  .cs-log-stat .n{font-variant-numeric:tabular-nums;min-width:14px;text-align:center}
  .cs-log-stat.s-toxic .n{color:var(--cs-signal-danger)}
  .cs-log-stat.s-suspicious .n{color:var(--cs-warning)}
  .cs-log-stat.s-safe .n{color:var(--cs-success)}
  .cs-log-stat.s-fp .n{color:var(--cs-signal-vortex)}

  .cs-log-controls{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
  .cs-log-controls-row{display:flex;align-items:center;gap:10px}
  .cs-log-seg{display:flex;flex:1;border-radius:var(--cs-radius);border:1px solid var(--cs-border);background:var(--cs-bg-body);padding:2px;gap:1px}
  .cs-log-seg-btn{flex:1;justify-content:center;padding:6px 8px;border-radius:calc(var(--cs-radius) - 2px);border:none;background:transparent;color:var(--cs-text-secondary);font-size:13px;font-weight:600;cursor:pointer;transition:all .2s var(--cs-transition);font-family:inherit;white-space:nowrap;position:relative;line-height:1.4;text-align:center}
  .cs-log-seg-btn:hover{color:var(--cs-text);background:color-mix(in srgb,var(--cs-accent)6%,transparent)}
  .cs-log-seg-btn.active{background:var(--cs-bg-elevated);color:var(--cs-accent);font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.08),0 0 0 1px var(--cs-border-strong)}
  .cs-log-seg-btn .seg-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:middle;position:relative;top:-1px}
  .cs-log-seg-btn .seg-count{font-size:11px;font-weight:700;padding:2px 6px;border-radius:8px;margin-left:4px;background:var(--cs-bg-body);color:var(--cs-text-secondary);font-variant-numeric:tabular-nums;transition:all .2s var(--cs-transition)}
  .cs-log-seg-btn.active .seg-count{background:color-mix(in srgb,var(--cs-accent)12%,transparent);color:var(--cs-accent)}
  .cs-log-seg-btn .seg-count.has-items{animation:csBadgePop .25s var(--cs-transition)}

  .cs-log-search-wrap{display:flex;align-items:center;gap:6px;background:var(--cs-bg-body);border:1px solid var(--cs-border);border-radius:var(--cs-radius);padding:7px 12px;flex:1;min-width:180px;max-width:280px;transition:border-color .2s,box-shadow .2s}
  .cs-log-search-wrap:focus-within{border-color:var(--cs-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--cs-accent)10%,transparent)}
  .cs-log-search-wrap svg{width:15px;height:15px;color:var(--cs-text-secondary);flex-shrink:0}
  .cs-log-search-input{border:none;background:transparent;outline:none;font-size:13px;color:var(--cs-text);flex:1;min-width:0;font-family:inherit}
  .cs-log-search-input::placeholder{color:color-mix(in srgb,var(--cs-text-secondary)60%,transparent)}

  .cs-log-actions-row{display:flex;gap:6px;margin-left:auto;align-items:center}
  .cs-log-act-btn{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:var(--cs-radius);border:1px solid var(--cs-border);background:var(--cs-bg-body);color:var(--cs-text-secondary);font-size:13px;font-weight:500;cursor:pointer;transition:all .2s var(--cs-transition);font-family:inherit;white-space:nowrap}
  .cs-log-act-btn:hover{border-color:var(--cs-border-strong);color:var(--cs-text);background:var(--cs-bg-elevated);transform:translateY(-1px);box-shadow:0 2px 6px rgba(0,0,0,.06)}
  .cs-log-act-btn:active{transform:translateY(0);box-shadow:none}
  .cs-log-act-btn.act-scan{border-color:color-mix(in srgb,var(--cs-accent)30%,var(--cs-border));color:var(--cs-accent)}
  .cs-log-act-btn.act-scan:hover{background:color-mix(in srgb,var(--cs-accent)8%,var(--cs-bg-elevated));border-color:var(--cs-accent);box-shadow:0 2px 8px color-mix(in srgb,var(--cs-accent)15%,transparent)}
  .cs-log-act-btn.act-danger:hover{border-color:var(--cs-danger);color:var(--cs-danger);background:color-mix(in srgb,var(--cs-danger)6%,var(--cs-bg-elevated))}
  .cs-log-act-btn svg{width:14px;height:14px}

  .cs-log-list{display:flex;flex-direction:column;gap:8px;min-height:80px}
  .cs-log-entry{border:1px solid var(--cs-border);border-radius:var(--cs-radius);background:var(--cs-bg-elevated);overflow:hidden;transition:all .25s var(--cs-transition);animation:csEntryReveal .3s var(--cs-transition) both;border-left:3px solid var(--cs-border);position:relative}
  .cs-log-entry:hover{border-color:var(--cs-border-strong);box-shadow:0 4px 16px rgba(0,0,0,.08),0 0 0 1px var(--cs-border-strong);transform:translateY(-1px)}
  .cs-log-entry.v-toxic{border-left-color:var(--cs-signal-danger);box-shadow:inset 3px 0 12px -3px rgba(248,113,113,.15)}
  .cs-log-entry.v-toxic:hover{border-color:rgba(248,113,113,.3);border-left-color:var(--cs-signal-danger);box-shadow:inset 3px 0 12px -3px rgba(248,113,113,.25),0 4px 16px rgba(248,113,113,.08)}
  .cs-log-entry.v-suspicious{border-left-color:var(--cs-warning);box-shadow:inset 3px 0 12px -3px rgba(251,191,36,.15)}
  .cs-log-entry.v-suspicious:hover{border-color:rgba(251,191,36,.3);border-left-color:var(--cs-warning);box-shadow:inset 3px 0 12px -3px rgba(251,191,36,.25),0 4px 16px rgba(251,191,36,.08)}
  .cs-log-entry.v-safe{border-left-color:var(--cs-success);box-shadow:inset 3px 0 12px -3px rgba(34,211,238,.12)}
  .cs-log-entry.v-safe:hover{border-color:rgba(34,197,94,.25);border-left-color:var(--cs-success);box-shadow:inset 3px 0 12px -3px rgba(34,211,238,.2),0 4px 16px rgba(34,197,94,.06)}
  .cs-log-entry.v-misjudged{border-left-color:var(--cs-signal-vortex);background:color-mix(in srgb,var(--cs-signal-vortex) 3%,var(--cs-bg-elevated))}

  .cs-log-entry-head{display:flex;align-items:center;gap:10px;padding:12px 16px 4px}
  .cs-log-entry-check{width:16px;height:16px;accent-color:var(--cs-accent);cursor:pointer;flex-shrink:0;margin:-1px 0 0 -2px}
  .cs-log-entry-user{font-size:14px;font-weight:700;color:var(--cs-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
  .cs-log-entry-time{font-size:12px;color:var(--cs-text-secondary);margin-left:auto;flex-shrink:0;font-variant-numeric:tabular-nums}
  .cs-log-entry-badges{display:inline-flex;gap:5px;align-items:center;flex-shrink:0}
  .cs-log-badge{font-size:11px;font-weight:650;padding:2px 8px;border-radius:10px;line-height:1.4;letter-spacing:.01em}
  .cs-log-badge.b-toxic{background:rgba(248,113,113,.12);color:#fca5a5;border:1px solid rgba(248,113,113,.25)}
  .cs-log-badge.b-suspicious{background:rgba(251,191,36,.12);color:#fcd34d;border:1px solid rgba(251,191,36,.25)}
  .cs-log-badge.b-safe{background:rgba(34,197,94,.12);color:#86efac;border:1px solid rgba(34,197,94,.25)}
  .cs-log-badge.b-fp{background:rgba(167,139,250,.12);color:#c4b5fd;border:1px solid rgba(167,139,250,.25)}
  .cs-log-badge.b-ai{background:rgba(129,140,248,.12);color:#a5b4fc;border:1px solid rgba(129,140,248,.25)}
  .cs-log-badge.b-layer{background:var(--cs-bg-body);color:var(--cs-text-secondary);border:1px solid var(--cs-border);font-weight:500}
  .cs-log-badge.b-detect{background:color-mix(in srgb,#3b82f6 8%,var(--cs-bg-body));color:#60a5fa;border:1px solid color-mix(in srgb,#3b82f6 20%,var(--cs-border));font-weight:500}

  /* ── Particle Spectrum Risk Bar ── */
  @keyframes csRiskFill{from{width:0}to{width:var(--pct,0%)}}
  @keyframes csPtDrift{0%{transform:translateX(0) translateY(0) scale(1);opacity:.85}100%{transform:translateX(var(--dx,10px)) translateY(var(--dy,-12px)) scale(0);opacity:0}}
  @keyframes csEdgePulse{0%,100%{box-shadow:0 0 4px 1px var(--edge-clr,#22d3ee),0 0 8px 2px color-mix(in srgb,var(--edge-clr,#22d3ee) 30%,transparent);opacity:.85}50%{box-shadow:0 0 8px 3px var(--edge-clr,#22d3ee),0 0 18px 5px color-mix(in srgb,var(--edge-clr,#22d3ee) 25%,transparent);opacity:1}}
  @keyframes csBarShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
  @keyframes csTrackBreath{0%,100%{box-shadow:inset 0 1px 3px rgba(0,0,0,.1),0 0 0 0 transparent}50%{box-shadow:inset 0 1px 3px rgba(0,0,0,.1),0 0 6px -2px var(--edge-clr,transparent)}}
  @keyframes csCritPulse{0%,100%{opacity:.88}50%{opacity:1}}

  .cs-risk{display:flex;align-items:center;gap:12px;min-height:30px;margin-top:10px}
  .cs-risk-track{flex:1;height:8px;border-radius:5px;position:relative;overflow:visible;background:var(--cs-bg-body);border:1px solid var(--cs-border);box-shadow:inset 0 1px 3px rgba(0,0,0,.1);animation:csTrackBreath 4s ease-in-out infinite}
  .cs-risk-fill{height:100%;border-radius:4px;position:relative;overflow:visible;animation:csRiskFill .9s var(--cs-transition) both}
  .cs-risk-fill::before{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(90deg,transparent 20%,rgba(255,255,255,.22) 45%,rgba(255,255,255,.08) 55%,transparent 80%);background-size:250% 100%;animation:csBarShimmer 4s ease infinite;pointer-events:none}
  .cs-risk-edge{position:absolute;right:-4px;top:50%;transform:translateY(-50%);width:8px;height:8px;border-radius:50%;background:var(--edge-clr,#22d3ee);animation:csEdgePulse 2.4s ease-in-out infinite;z-index:2}
  .cs-risk-pt{position:absolute;border-radius:50%;pointer-events:none;display:block;animation:csPtDrift var(--dur,2.5s) ease-out infinite;animation-delay:var(--delay,0s);will-change:transform,opacity}
  .cs-risk.is-critical .cs-risk-fill{animation:csRiskFill .9s var(--cs-transition) both,csCritPulse 2.8s ease-in-out infinite .9s}
  .cs-risk.is-critical .cs-risk-edge{animation:csEdgePulse 1.4s ease-in-out infinite}
  .cs-risk-meta{display:flex;align-items:center;gap:8px;flex-shrink:0;min-width:110px;justify-content:flex-end}
  .cs-risk-pct{font-size:14px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.03em;color:var(--edge-clr,var(--cs-text))}
  .cs-risk-lvl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:3px 9px;border-radius:6px;white-space:nowrap;background:color-mix(in srgb,var(--edge-clr,var(--cs-text)) 10%,var(--cs-bg-body));color:var(--edge-clr,var(--cs-text));border:1px solid color-mix(in srgb,var(--edge-clr,var(--cs-text)) 22%,var(--cs-border))}

  .cs-log-ai-label{font-size:11px;font-weight:600;color:var(--cs-signal-wave);margin-right:6px}

  .cs-log-entry-body{padding:4px 16px 12px}
  .cs-log-entry-text{font-size:14px;line-height:1.6;color:var(--cs-text);word-break:break-word;font-weight:500}
  .cs-log-entry-ctx{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:6px;font-size:12px;color:var(--cs-text-secondary);line-height:1.4;font-weight:500}
  .cs-log-kws b{color:#fca5a5;font-weight:600;background:rgba(248,113,113,.12);padding:1px 6px;border-radius:4px;border:1px solid rgba(248,113,113,.25);font-size:12px}
  .cs-log-reason{color:var(--cs-text-muted,var(--cs-text-secondary))}
  .cs-log-sp{color:var(--cs-border);margin:0 2px}

  .cs-log-entry-ai{margin:8px 16px 12px;padding:9px 12px;background:linear-gradient(135deg,color-mix(in srgb,#6366f1 6%,transparent),color-mix(in srgb,var(--cs-accent)5%,transparent));border-radius:8px;font-size:13px;line-height:1.5;color:var(--cs-text);border:1px solid color-mix(in srgb,#6366f1 12%,var(--cs-border))}
  .cs-log-ai-icon{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:5px;background:var(--cs-signal-wave);color:#fff;font-size:10px;font-weight:800;margin-right:6px;vertical-align:middle;flex-shrink:0}

  .cs-log-entry-actions{display:flex;gap:5px;padding:0 14px 0;opacity:0;max-height:0;overflow:hidden;transition:opacity .2s var(--cs-transition),max-height .25s var(--cs-transition),padding .2s var(--cs-transition)}
  .cs-log-entry:hover .cs-log-entry-actions{opacity:1;max-height:48px;padding:8px 14px 10px}
  .cs-log-ea-btn{font-size:12px;padding:5px 14px;border-radius:8px;border:1px solid var(--cs-border);background:var(--cs-bg-body);color:var(--cs-text-secondary);cursor:pointer;font-weight:500;font-family:inherit;transition:all .15s var(--cs-transition);line-height:1.3}
  .cs-log-ea-btn:hover{transform:translateY(-1px);box-shadow:0 1px 4px rgba(0,0,0,.06)}
  .cs-log-ea-btn.ea-fp:hover{color:#fcd34d;border-color:#fbbf24;background:rgba(251,191,36,.1)}
  .cs-log-ea-btn.ea-fp.is-fp{color:#fcd34d;border-color:#fbbf24;background:rgba(251,191,36,.1)}
  .cs-log-ea-btn.ea-wl:hover{color:#86efac;border-color:#22c55e;background:rgba(34,197,94,.1)}
  .cs-log-ea-btn.ea-ai:hover{color:#a5b4fc;border-color:#6366f1;background:rgba(99,102,241,.1)}

  .cs-log-empty{text-align:center;padding:40px 20px;color:var(--cs-text-secondary)}
  .cs-log-empty-icon{font-size:32px;margin-bottom:8px;opacity:.45}
  .cs-log-empty-text{font-size:13px;line-height:1.5}

  .cs-log-tab.cs-btn-accent{background:var(--cs-accent);color:#fff;border-color:var(--cs-accent)}

  /* ═══ 关于页 — 守护者宣言 ═══ */
  .cs-about{padding:24px}
  .cs-about-hero{
    display:flex;align-items:center;gap:24px;padding:28px 24px;margin-bottom:20px;
    background:linear-gradient(135deg,var(--cs-bg-body),var(--cs-bg-elevated));
    border:1px solid var(--cs-border);border-radius:var(--cs-radius-xl);
    position:relative;overflow:hidden;animation:csFadeSlideIn .4s var(--cs-transition);
  }
  .cs-about-hero::before{
    content:'';position:absolute;inset:0;
    background:radial-gradient(ellipse at 30% 50%,var(--cs-accent-glow),transparent 60%);
    opacity:.4;pointer-events:none;
  }
  .cs-about-guardian{
    position:relative;width:80px;height:80px;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;
  }
  .cs-about-drop{
    width:52px;height:52px;position:relative;z-index:3;
    filter:drop-shadow(0 6px 16px var(--cs-accent-glow));
    animation:csFloat 4s ease-in-out infinite,csDropBreath 3s ease-in-out infinite;
  }
  .cs-about-aura{
    position:absolute;width:80px;height:80px;border-radius:50%;
    background:radial-gradient(circle,var(--cs-accent-glow),transparent 70%);
    animation:csGuardianPulse 3s ease-in-out infinite;
  }
  .cs-about-ring{
    position:absolute;width:60px;height:60px;border-radius:50%;
    border:1.5px solid var(--cs-accent);opacity:0;
    animation:csGuardianRing 3s ease-out infinite;
  }
  .cs-about-ring:nth-child(3){animation-delay:1.5s}
  .cs-about-manifesto{flex:1;min-width:0;position:relative;z-index:2}
  .cs-about-brand{
    font-size:28px;font-weight:800;letter-spacing:-.03em;
    background:linear-gradient(135deg,var(--cs-accent),var(--cs-signal-ripple,var(--cs-accent)));
    -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  }
  .cs-about-version{
    font-size:12px;color:var(--cs-text-secondary);font-family:var(--cs-font-mono);
    margin-top:2px;font-weight:500;
  }
  .cs-about-quote{
    font-size:15px;font-weight:600;color:var(--cs-text);margin-top:12px;
    line-height:1.5;letter-spacing:-.01em;font-style:italic;
  }
  .cs-about-desc{
    font-size:13px;color:var(--cs-text-secondary);margin-top:6px;line-height:1.6;
  }
  .cs-about-features-grid{
    display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;
  }
  .cs-about-feature{
    display:flex;align-items:center;gap:10px;padding:12px 14px;
    background:var(--cs-bg-body);border:1px solid var(--cs-border);
    border-radius:var(--cs-radius);transition:all .2s var(--cs-transition);
    animation:csFadeSlideIn .35s var(--cs-transition) both;
  }
  .cs-about-feature:nth-child(1){animation-delay:0s}
  .cs-about-feature:nth-child(2){animation-delay:.04s}
  .cs-about-feature:nth-child(3){animation-delay:.08s}
  .cs-about-feature:nth-child(4){animation-delay:.12s}
  .cs-about-feature:nth-child(5){animation-delay:.16s}
  .cs-about-feature:nth-child(6){animation-delay:.2s}
  .cs-about-feature:nth-child(7){animation-delay:.24s}
  .cs-about-feature:nth-child(8){animation-delay:.28s}
  .cs-about-feature:hover{transform:translateY(-2px);border-color:var(--cs-accent);box-shadow:0 4px 12px var(--cs-accent-glow)}
  .cs-about-feature-icon{
    font-size:16px;color:var(--cs-accent);flex-shrink:0;
    filter:drop-shadow(0 0 4px var(--cs-accent-glow));
  }
  .cs-about-feature-text{font-size:12px;color:var(--cs-text);font-weight:500;line-height:1.4}
  .cs-about-section{margin-bottom:16px}
  .cs-about-section-title{
    font-size:13px;font-weight:700;color:var(--cs-text);margin-bottom:8px;
    letter-spacing:-.01em;display:flex;align-items:center;gap:6px;
  }
  .cs-about-section-title::before{
    content:'';width:3px;height:12px;border-radius:2px;
    background:linear-gradient(180deg,var(--cs-accent),var(--cs-signal-ripple,var(--cs-accent)));
  }
  .cs-about-shortcuts{display:flex;flex-direction:column;gap:6px}
  .cs-about-shortcut{
    display:flex;align-items:center;gap:10px;font-size:12px;color:var(--cs-text-secondary);
  }
  .cs-about-shortcut kbd{
    font-family:var(--cs-font-mono);font-size:11px;font-weight:600;
    padding:3px 8px;border-radius:5px;background:var(--cs-bg-body);
    border:1px solid var(--cs-border-strong);color:var(--cs-text);
    box-shadow:0 1px 0 var(--cs-border);min-width:60px;text-align:center;
  }
  .cs-changelog-list{display:flex;flex-direction:column;gap:6px}
  .cs-changelog-item{
    display:flex;gap:10px;font-size:12px;color:var(--cs-text-secondary);line-height:1.6;
    padding:6px 10px;border-radius:var(--cs-radius);background:var(--cs-bg-body);
    border:1px solid var(--cs-border);
  }
  .cs-changelog-ver{
    font-weight:700;color:var(--cs-accent);white-space:nowrap;min-width:50px;
    font-family:var(--cs-font-mono);
  }
  .cs-about-text{font-size:13px;color:var(--cs-text-secondary);line-height:1.6;margin-bottom:6px}
  .cs-about-footer{
    display:flex;align-items:center;gap:12px;flex-wrap:wrap;
    padding-top:16px;border-top:1px solid var(--cs-divider);
  }
  .cs-about-links{display:flex;gap:12px}
  .cs-about-link{
    color:var(--cs-accent);text-decoration:none;font-size:13px;font-weight:600;
    transition:all .2s var(--cs-transition);
  }
  .cs-about-link:hover{color:var(--cs-accent-hover);text-shadow:0 0 8px var(--cs-accent-glow)}
  .cs-guide-block{display:flex;flex-direction:column;gap:8px}
  .cs-guide-item{display:flex;flex-direction:column;gap:2px;padding:8px 10px;background:var(--cs-bg-body);border:1px solid var(--cs-border);border-radius:8px}
  .cs-guide-label{font-size:13px;font-weight:600;color:var(--cs-accent)}
  .cs-guide-desc{font-size:12px;color:var(--cs-text-secondary);line-height:1.5}
  .cs-about-link{color:var(--cs-accent);text-decoration:none;font-size:13px}
  .cs-about-link:hover{text-decoration:underline}
  .cs-divider{height:1px;background:var(--cs-divider);margin:4px 0}
  .cs-live-feed{background:var(--cs-bg-body);border:1px solid var(--cs-border);border-radius:10px;padding:12px 14px;margin-bottom:12px}
  .cs-live-feed-title{font-size:13px;font-weight:600;color:var(--cs-text);margin-bottom:8px}
  .cs-live-empty{font-size:12px;color:var(--cs-text-secondary);text-align:center;padding:8px 0}
  .cs-live-item{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;border-bottom:1px solid var(--cs-divider)}
  .cs-live-item:last-child{border-bottom:none}
  .cs-live-verdict{font-weight:600;flex-shrink:0}
  .cs-live-user{color:var(--cs-text-secondary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cs-live-time{font-size:11px;color:var(--cs-text-secondary);flex-shrink:0}

  .cs-suggest-item{display:flex;align-items:center;gap:8px;padding:6px 8px;margin:4px 0;background:var(--cs-bg-body);border:1px solid var(--cs-border);border-radius:8px}
  .cs-suggest-word{font-weight:700;font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .cs-suggest-meta{display:flex;align-items:center;gap:6px;flex-shrink:0}
  .cs-suggest-conf{font-size:11px;font-weight:600;color:var(--cs-accent)}
  .cs-suggest-evidence{font-size:11px;color:var(--cs-text-secondary)}
  .cs-suggest-actions{display:flex;gap:4px;flex-shrink:0}

  /* ─── Responsive ─────────────────────── */
  @media(max-width:899px){
    .cs-dash-panel{width:95vw;max-width:95vw}
    .cs-dash-sidebar{width:64px}
    .cs-dash-brand{padding:12px 6px;flex-direction:column;gap:2px}
    .cs-dash-title{display:none}
    .cs-dash-ver{display:none}
    .cs-nav-item{padding:10px 6px;justify-content:center;font-size:0}
    .cs-nav-icon{font-size:18px}
    .cs-nav-item[data-section]{font-size:0}
    .cs-dash-sidebar-footer .cs-nav-sm{font-size:0;padding:8px 6px;justify-content:center}
    .cs-dash-section{padding:16px}
    /* Chat Panel Responsive */
    .cs-chat-header{padding:10px 12px}
    .cs-chat-header-icon{width:32px;height:32px}
    .cs-chat-header-icon svg{width:18px;height:18px}
    .cs-chat-header-title{font-size:14px}
    .cs-chat-header-subtitle{font-size:10px}
    .cs-chat-header-status{display:none}
    .cs-chat-header-btn{width:28px;height:28px}
    .cs-chat-header-btn svg{width:14px;height:14px}
    .cs-chat-messages{padding:12px 16px}
    .cs-chat-input-area{padding:10px 12px}
    .cs-chat-bubble{padding:10px 14px;font-size:13px}
    .cs-chat-avatar{width:32px;height:32px}
    .cs-chat-avatar svg{width:16px;height:16px}
    .cs-chat-bubble-user{max-width:80%}
    .cs-chat-bubble-ai{max-width:90%}
  }
  @media(max-width:599px){
    .cs-dash-panel{top:0;bottom:0;left:0;right:0;width:100vw;max-width:100vw;transform:none;border-radius:0}
    .cs-dash-sidebar{display:none}
    .cs-dash-mobile-nav{display:flex!important;position:fixed;bottom:0;left:0;right:0;background:var(--cs-bg);border-top:1px solid var(--cs-border);padding:4px 8px;padding-bottom:calc(4px + env(safe-area-inset-bottom,0px));gap:2px;z-index:10;overflow-x:auto;-webkit-overflow-scrolling:touch}
    .cs-dash-mobile-nav-item{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 2px;border:none;background:none;color:var(--cs-text-secondary);font-size:9px;cursor:pointer;border-radius:6px;transition:color .15s ease,background-color .15s ease}
    .cs-dash-mobile-nav-item.cs-nav-active{color:var(--cs-accent);background:color-mix(in srgb,var(--cs-accent)10%,transparent)}
    .cs-dash-mobile-nav-icon{font-size:16px;display:flex;align-items:center;justify-content:center}
    .cs-dash-mobile-nav-icon svg{width:18px;height:18px}
    .cs-dash-main{padding-bottom:calc(52px + env(safe-area-inset-bottom,0px))}
    /* Chat Panel Mobile Responsive */
    .cs-chat-header{padding:8px 10px}
    .cs-chat-header-icon{width:28px;height:28px}
    .cs-chat-header-icon svg{width:16px;height:16px}
    .cs-chat-header-title{font-size:13px}
    .cs-chat-header-subtitle{display:none}
    .cs-chat-history-toggle{width:26px;height:26px}
    .cs-chat-header-btn{width:26px;height:26px}
    .cs-chat-header-btn svg{width:13px;height:13px}
    .cs-chat-messages{padding:10px 12px}
    .cs-chat-input-area{padding:8px 10px;padding-bottom:calc(8px + env(safe-area-inset-bottom,0px))}
    .cs-chat-input-hint{display:none}
    .cs-chat-bubble{padding:8px 12px;font-size:13px}
    .cs-chat-avatar{width:28px;height:28px}
    .cs-chat-avatar svg{width:14px;height:14px}
    .cs-chat-bubble-user{max-width:85%}
    .cs-chat-bubble-ai{max-width:95%}
    .cs-chat-welcome{padding:32px 16px}
    .cs-welcome-drop-wrap{width:80px;height:80px;margin-bottom:20px}
    .cs-chat-quick-area{padding:8px 16px 6px}
    .cs-chat-quick-area .cs-welcome-drop-wrap{width:48px;height:48px;margin-bottom:10px}
    .cs-welcome-title{font-size:22px}
    .cs-welcome-tagline{font-size:12px}
    .cs-welcome-desc{font-size:13px}
    .cs-suggestion-btn{padding:10px 16px;font-size:12px}
  }

  /* ─── Hot Topics 热点规则面板 ─────────────────────────── */
  .cs-stat-pill{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--cs-bg-body);border:1px solid var(--cs-border);border-radius:12px;font-size:12px;color:var(--cs-text-secondary)}
  .cs-stat-pill strong{color:var(--cs-text);font-weight:600}

  /* 视图切换 — 统一分段按钮（与 .cs-rules-tab 一致） */
  .cs-hot-topic-view-toggle{
    display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;
  }
  .cs-hot-topic-view-btn{
    background:none;border:1px solid var(--cs-border);border-radius:var(--cs-radius-sm);
    padding:7px 14px;color:var(--cs-text-secondary);cursor:pointer;
    font-size:var(--cs-fz-base);font-weight:500;transition:all .2s var(--cs-transition);
    display:inline-flex;align-items:center;gap:5px;
  }
  .cs-hot-topic-view-btn svg{width:13px;height:13px}
  .cs-hot-topic-view-btn:hover{background:var(--cs-accent-soft);color:var(--cs-text);border-color:var(--cs-border-strong)}
  .cs-hot-topic-view-btn.cs-active{
    background:var(--cs-accent);color:#fff;font-weight:600;border-color:var(--cs-accent);
    box-shadow:0 2px 8px var(--cs-accent-glow);
  }
  .cs-hot-topic-view-btn.cs-active svg{filter:drop-shadow(0 0 3px rgba(255,255,255,.4))}

  .cs-hot-topic-group{margin-bottom:12px}
  .cs-hot-topic-group-title{font-size:11px;font-weight:700;color:var(--cs-text-secondary);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--cs-border)}

  .cs-hot-topic-card{background:var(--cs-bg-body);border:1px solid var(--cs-border);border-radius:12px;padding:12px 14px;margin-bottom:8px;transition:all .2s cubic-bezier(0.4,0,0.2,1)}
  .cs-hot-topic-card:hover{border-color:color-mix(in srgb,var(--cs-accent)30%,var(--cs-border))}
  .cs-hot-topic-card.cs-hot-topic-expired{opacity:.65}
  .cs-hot-topic-card.cs-hot-topic-disabled{opacity:.5}

  .cs-hot-topic-card-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
  .cs-hot-topic-label{font-weight:600;font-size:14px;color:var(--cs-text)}
  .cs-hot-topic-status{font-size:11px;padding:2px 8px;border-radius:10px;font-weight:500}
  .cs-hot-topic-status-active{background:color-mix(in srgb,var(--cs-success)15%,transparent);color:var(--cs-success)}
  .cs-hot-topic-status-expired{background:color-mix(in srgb,var(--cs-text-secondary)15%,transparent);color:var(--cs-text-secondary)}
  .cs-hot-topic-status-disabled{background:color-mix(in srgb,var(--cs-warning)15%,transparent);color:var(--cs-warning)}

  .cs-hot-topic-card-body{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}
  .cs-hot-topic-row{display:flex;gap:8px;font-size:12px;line-height:1.5}
  .cs-hot-topic-row-label{color:var(--cs-text-secondary);min-width:80px;flex-shrink:0}
  .cs-hot-topic-row-value{color:var(--cs-text);flex:1;word-break:break-all}

  .cs-hot-topic-card-actions{display:flex;gap:6px;flex-wrap:wrap}

  .cs-hot-topic-cards-wrap{display:flex;flex-direction:column;gap:8px}
  .cs-hot-topic-cards-wrap.cs-hot-topic-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  @media(max-width:860px){.cs-hot-topic-cards-wrap.cs-hot-topic-grid{grid-template-columns:1fr}}

  .cs-hot-topic-category-chip{border:none;background:color-mix(in srgb,var(--cs-accent)10%,transparent);color:var(--cs-accent);font-size:11px;padding:1px 8px;border-radius:10px;cursor:pointer;font-weight:500;transition:all .15s ease}
  .cs-hot-topic-category-chip:hover{background:var(--cs-accent);color:#fff;box-shadow:0 1px 4px var(--cs-accent-glow)}

  .cs-hot-topic-flash{animation:csHotTopicFlash 1.1s ease-in-out 2}
  @keyframes csHotTopicFlash{
    0%,100%{border-color:color-mix(in srgb,var(--cs-accent)30%,var(--cs-border));box-shadow:none}
    50%{border-color:var(--cs-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--cs-accent)30%,transparent)}
  }

  .cs-hot-topic-form-inner{padding:14px;background:var(--cs-bg-body);border:1px solid var(--cs-border);border-radius:10px;margin-top:8px}
  .cs-form-row{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}
  .cs-form-label{font-size:12px;color:var(--cs-text-secondary);font-weight:600}
  .cs-form-actions{display:flex;gap:8px;margin-top:8px}
  .cs-btn-ghost{background:transparent;border:1px solid var(--cs-border);color:var(--cs-text-secondary)}
  .cs-btn-ghost:hover{background:var(--cs-bg-body);color:var(--cs-text)}

  .cs-scope-list{display:flex;flex-wrap:wrap;gap:8px}
  .cs-scope-check{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--cs-text);cursor:pointer}
  .cs-scope-check input{margin:0}

  /* ═══════════════════════════════════════════════════════════
     赛博朋克深色模式增强 — ROG 酷炫灯光风格
     仅在深色主题下激活，传达"科技守护"的视觉语言
  ═══════════════════════════════════════════════════════════ */
  #cs-dashboard.cs-theme-dark .cs-dash-panel,
  html.cs-dash-theme-dark .cs-modal-inner,
  html.cs-dash-theme-dark .cs-topic-detail-panel{
    background-image:var(--cs-scanline,none);
    background-size:100% 100%;
  }
  /* 主面板霓虹边框 */
  #cs-dashboard.cs-theme-dark .cs-dash-panel{
    border:1px solid rgba(56,189,248,.12);
    box-shadow:0 0 0 1px rgba(56,189,248,.05),0 0 40px rgba(56,189,248,.08),var(--cs-shadow-lg);
  }
  /* 品牌标题霓虹发光 */
  #cs-dashboard.cs-theme-dark .cs-dash-title{
    text-shadow:var(--cs-neon-text);
  }
  /* 侧边栏暗色增强 */
  #cs-dashboard.cs-theme-dark .cs-dash-sidebar{
    border-right-color:rgba(56,189,248,.12);
    background:linear-gradient(180deg,rgba(56,189,248,.03),var(--cs-bg-body));
  }
  #cs-dashboard.cs-theme-dark .cs-dash-brand{
    border-bottom-color:rgba(56,189,248,.12);
  }
  #cs-dashboard.cs-theme-dark .cs-nav-item:hover{
    background:rgba(56,189,248,.08);
  }
  #cs-dashboard.cs-theme-dark .cs-nav-item:hover::before{
    box-shadow:inset 0 0 20px rgba(56,189,248,.08);
  }
  #cs-dashboard.cs-theme-dark .cs-nav-active{
    box-shadow:0 0 12px rgba(56,189,248,.3),0 2px 8px var(--cs-accent-glow);
  }
  #cs-dashboard.cs-theme-dark .cs-nav-active::before{
    border-color:rgba(56,189,248,.25);
    box-shadow:inset 0 0 24px rgba(56,189,248,.08),0 0 12px rgba(56,189,248,.15);
  }
  #cs-dashboard.cs-theme-dark .cs-dash-sidebar-footer{
    border-top-color:rgba(56,189,248,.12);
  }
  #cs-dashboard.cs-theme-dark .cs-lang-btn:hover{
    background:rgba(56,189,248,.08);
    border-color:rgba(56,189,248,.2);
    box-shadow:0 2px 8px rgba(56,189,248,.1);
  }
  #cs-dashboard.cs-theme-dark .cs-quota-item{border-color:rgba(56,189,248,.12)}
  #cs-dashboard.cs-theme-dark .cs-quota-item:hover{border-color:rgba(56,189,248,.3);box-shadow:0 0 16px rgba(56,189,248,.1),0 0 0 1px rgba(56,189,248,.05)}
  #cs-dashboard.cs-theme-dark .cs-quota-fill::after{background:linear-gradient(90deg,transparent 20%,rgba(255,255,255,.35) 45%,rgba(255,255,255,.12) 55%,transparent 80%)}
  #cs-dashboard.cs-theme-dark .cs-quota-limit-input:focus{box-shadow:0 0 0 3px var(--cs-accent-soft),0 0 12px rgba(56,189,248,.2)}
  /* 概览数字霓虹发光 */
  #cs-dashboard.cs-theme-dark .cs-ov-num{
    text-shadow:0 0 8px rgba(56,189,248,.4),0 0 16px rgba(56,189,248,.2);
  }
  #cs-dashboard.cs-theme-dark .cs-ov-card-toxic .cs-ov-num{
    text-shadow:0 0 8px rgba(248,113,113,.4),0 0 16px rgba(248,113,113,.2);
  }
  /* 统计数字发光 */
  #cs-dashboard.cs-theme-dark .cs-stat-num,
  html.cs-dash-theme-dark .cs-stat-num{
    text-shadow:0 0 6px rgba(56,189,248,.3);
  }
  /* 卡片边缘霓虹 */
  #cs-dashboard.cs-theme-dark .cs-ov-card{
    border-color:rgba(56,189,248,.1);
  }
  #cs-dashboard.cs-theme-dark .cs-ov-card:hover{
    border-color:rgba(56,189,248,.3);
    box-shadow:0 0 16px rgba(56,189,248,.15),var(--cs-shadow-md);
  }
  /* 输入框聚焦霓虹 */
  #cs-dashboard.cs-theme-dark .cs-input:focus,
  html.cs-dash-theme-dark .cs-input:focus{
    border-color:var(--cs-accent);
    box-shadow:0 0 0 3px var(--cs-accent-soft),0 0 12px rgba(56,189,248,.2);
  }
  /* 按钮霓虹 */
  #cs-dashboard.cs-theme-dark .cs-btn-accent{
    box-shadow:0 0 12px rgba(56,189,248,.3);
  }
  #cs-dashboard.cs-theme-dark .cs-btn-accent:hover{
    box-shadow:0 0 20px rgba(56,189,248,.5);
  }
  /* 浮动按钮增强霓虹 */
  #cs-dashboard.cs-theme-dark .cs-shield-btn,
  #cs-overlay .cs-shield-btn{
    border-color:rgba(56,189,248,.5);
  }
  /* 日志条目左边框发光 */
  #cs-dashboard.cs-theme-dark .cs-log-entry.v-toxic{
    border-left-color:var(--cs-signal-danger);
    box-shadow:inset 3px 0 8px -3px rgba(248,113,113,.4);
  }
  #cs-dashboard.cs-theme-dark .cs-log-entry.v-suspicious{
    border-left-color:var(--cs-warning);
    box-shadow:inset 3px 0 8px -3px rgba(251,191,36,.4);
  }
  #cs-dashboard.cs-theme-dark .cs-log-entry.v-safe{
    border-left-color:var(--cs-success);
    box-shadow:inset 3px 0 8px -3px rgba(34,211,238,.4);
  }
  /* 状态点增强脉冲 */
  #cs-dashboard.cs-theme-dark .cs-dot-on{
    box-shadow:0 0 8px var(--cs-toggle-on),0 0 16px var(--cs-accent-glow);
  }
  /* 风险条发光 */
  #cs-dashboard.cs-theme-dark .cs-risk-edge{
    box-shadow:0 0 8px var(--edge-clr,#22d3ee),0 0 16px var(--edge-clr,#22d3ee);
  }
  /* 模态框霓虹边框 */
  html.cs-dash-theme-dark .cs-modal-inner{
    border:1px solid rgba(56,189,248,.15);
    box-shadow:0 0 0 1px rgba(56,189,248,.05),0 0 60px rgba(56,189,248,.1),var(--cs-shadow-lg);
  }
  /* 主题切换按钮霓虹 */
  #cs-dashboard.cs-theme-dark .cs-dash-theme-toggle{
    border:1px solid rgba(56,189,248,.2);
    box-shadow:0 0 8px rgba(56,189,248,.15);
  }
  #cs-dashboard.cs-theme-dark .cs-dash-lock-toggle:hover{background:rgba(56,189,248,.1);color:var(--cs-accent);border-color:rgba(56,189,248,.2);box-shadow:0 0 8px rgba(56,189,248,.15)}
  #cs-dashboard.cs-theme-dark.cs-drag-enabled .cs-dash-lock-toggle{color:var(--cs-accent);border-color:rgba(56,189,248,.3);background:rgba(56,189,248,.08);box-shadow:0 0 8px rgba(56,189,248,.15)}
  #cs-dashboard.cs-theme-dark .cs-dash-dragging{box-shadow:0 0 0 1px rgba(56,189,248,.2),0 0 40px rgba(56,189,248,.12),var(--cs-shadow-lg)}
  #cs-dashboard.cs-theme-dark .cs-overlay-learn{border-color:rgba(56,189,248,.15)}
  #cs-dashboard.cs-theme-dark .cs-learn-stat{border-color:rgba(56,189,248,.1)}
  #cs-dashboard.cs-theme-dark .cs-learn-stat:hover{border-color:rgba(56,189,248,.25);box-shadow:0 0 8px rgba(56,189,248,.1)}
  #cs-dashboard.cs-theme-dark .cs-learn-suggest{border-color:rgba(251,191,36,.2);background:rgba(251,191,36,.06)}
  /* 关闭按钮增强 */
  #cs-dashboard.cs-theme-dark .cs-dash-close-btn{
    border:1px solid rgba(255,255,255,.1);
  }
  /* ═══ AI Chat 深色模式霓虹增强 ═══ */
  /* AI 气泡文字纯白 */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai{
    color:#ffffff;
    border-color:rgba(229,57,53,.12);
  }
  /* AI 气泡内链接用 ROG 橙色高亮 */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai a{
    color:var(--cs-rog-orange);
  }
  /* 用户输入框 ROG 红光聚焦 */
  #cs-dashboard.cs-theme-dark .cs-chat-input-wrap:focus-within{
    border-color:var(--cs-rog-red);
    box-shadow:0 0 0 3px rgba(229,57,53,.1),var(--cs-rog-glow);
  }
  /* 发送按钮 ROG 渐变 */
  #cs-dashboard.cs-theme-dark .cs-send-pause-btn:not(.cs-idle){
    background:linear-gradient(135deg,var(--cs-rog-red),var(--cs-rog-orange));
    box-shadow:0 2px 12px rgba(229,57,53,.3);
  }
  #cs-dashboard.cs-theme-dark .cs-chat-header{
    background:linear-gradient(135deg,var(--cs-bg),var(--cs-bg-elevated));
    border-bottom-color:rgba(56,189,248,.15);
  }
  #cs-dashboard.cs-theme-dark .cs-chat-header::after{
    background:linear-gradient(90deg,transparent,rgba(56,189,248,.6),transparent);
    opacity:.6;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-header-drop{
    filter:drop-shadow(0 0 6px rgba(56,189,248,.5));
  }
  #cs-dashboard.cs-theme-dark .cs-chat-header-title{
    text-shadow:0 0 8px rgba(56,189,248,.4);
  }
  #cs-dashboard.cs-theme-dark .cs-chat-header-actions{
    background:color-mix(in srgb,rgba(56,189,248,.06),transparent);
    border-color:rgba(56,189,248,.12);
  }
  #cs-dashboard.cs-theme-dark .cs-chat-header-btn:hover{
    background:rgba(56,189,248,.1);
    color:var(--cs-accent);
    box-shadow:0 0 8px rgba(56,189,248,.2);
  }
  #cs-dashboard.cs-theme-dark .cs-chat-status-dot{
    box-shadow:0 0 8px var(--cs-success),0 0 16px rgba(56,189,248,.3);
  }
  /* 输入框霓虹聚焦 */
  #cs-dashboard.cs-theme-dark .cs-chat-input-wrap{
    border-color:rgba(56,189,248,.1);
    background:color-mix(in srgb,rgba(56,189,248,.03),var(--cs-bg-body));
  }
  #cs-dashboard.cs-theme-dark .cs-chat-input-wrap:focus-within{
    border-color:var(--cs-accent);
    box-shadow:0 0 0 3px var(--cs-accent-soft),0 0 16px rgba(56,189,248,.2);
  }
  /* 用户消息气泡霓虹 */
  #cs-dashboard.cs-theme-dark .cs-chat-msg-user .cs-chat-bubble{
    box-shadow:0 2px 12px rgba(56,189,248,.25),0 0 0 1px rgba(56,189,248,.15);
  }
  /* 历史面板霓虹边框 */
  #cs-dashboard.cs-theme-dark .cs-chat-history-panel{
    border-right-color:rgba(56,189,248,.12);
    background:linear-gradient(180deg,var(--cs-bg-body),var(--cs-bg));
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-item-active{
    background:color-mix(in srgb,rgba(56,189,248,.1),transparent);
    box-shadow:inset 2px 0 0 var(--cs-accent);
  }
  /* 调试面板霓虹 */
  #cs-dashboard.cs-theme-dark .cs-chat-debug-panel{
    border-left-color:rgba(56,189,248,.12);
    background:linear-gradient(180deg,var(--cs-bg),var(--cs-bg-elevated));
  }
  #cs-dashboard.cs-theme-dark .cs-chat-debug-title svg{
    filter:drop-shadow(0 0 4px rgba(56,189,248,.4));
  }
  /* 快捷区域霓虹 */
  #cs-dashboard.cs-theme-dark .cs-chat-quick-area{
    border-top:1px solid rgba(56,189,248,.08);
  }
  #cs-dashboard.cs-theme-dark .cs-chat-quick-area .cs-welcome-drop{
    filter:drop-shadow(0 4px 16px rgba(56,189,248,.3));
  }
  /* 欢迎建议按钮霓虹 + ROG 红色点缀 */
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn{
    border-color:rgba(56,189,248,.15);
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn:hover{
    border-color:var(--cs-rog-red);
    box-shadow:0 0 12px rgba(229,57,53,.2);
    color:var(--cs-rog-orange);
  }
  /* 回到顶部按钮霓虹 */
  #cs-dashboard.cs-theme-dark .cs-dash-scroll-top{
    border-color:rgba(56,189,248,.3);
    box-shadow:0 4px 16px rgba(0,0,0,.4),0 0 12px rgba(56,189,248,.15);
  }
  #cs-dashboard.cs-theme-dark .cs-dash-scroll-top:hover{
    border-color:var(--cs-accent);
    box-shadow:0 6px 24px rgba(56,189,248,.3),0 0 0 1px var(--cs-accent);
  }
  #cs-dashboard.cs-theme-dark .cs-scroll-top-drop{
    filter:drop-shadow(0 0 6px rgba(56,189,248,.5));
  }
  /* ═══ 全局页面统一霓虹增强 ═══ */
  /* Section title 霓虹 */
  #cs-dashboard.cs-theme-dark .cs-dash-section-title::before{
    box-shadow:0 0 8px rgba(56,189,248,.5),0 0 16px rgba(56,189,248,.3);
  }
  /* Dash block 霓虹边框 */
  #cs-dashboard.cs-theme-dark .cs-dash-block{
    border-color:rgba(56,189,248,.08);
  }
  #cs-dashboard.cs-theme-dark .cs-dash-block:hover{
    border-color:rgba(56,189,248,.3);
    box-shadow:0 4px 16px rgba(0,0,0,.3),0 0 0 1px rgba(56,189,248,.1),0 0 16px rgba(56,189,248,.08);
  }
  #cs-dashboard.cs-theme-dark .cs-dash-block::before{
    background:linear-gradient(90deg,transparent,rgba(56,189,248,.5),transparent);
  }
  /* Block label 发光 */
  #cs-dashboard.cs-theme-dark .cs-dash-block-label{
    text-shadow:0 0 4px rgba(56,189,248,.2);
  }
  /* 热点卡片霓虹 */
  #cs-dashboard.cs-theme-dark .cs-hot-topic-card{
    border-color:rgba(56,189,248,.08);
  }
  #cs-dashboard.cs-theme-dark .cs-hot-topic-card:hover{
    border-color:rgba(56,189,248,.3);
    box-shadow:0 4px 16px rgba(0,0,0,.3),0 0 12px rgba(56,189,248,.1);
  }
  /* 视图切换按钮霓虹 */
  #cs-dashboard.cs-theme-dark .cs-hot-topic-view-btn.cs-active{
    box-shadow:0 0 12px rgba(56,189,248,.3);
  }
  /* 统计 pill 霓虹 */
  #cs-dashboard.cs-theme-dark .cs-stat-pill{
    border-color:rgba(56,189,248,.1);
  }
  #cs-dashboard.cs-theme-dark .cs-stat-pill strong{
    text-shadow:0 0 4px rgba(56,189,248,.3);
  }
  /* 交互卡片霓虹 */
  #cs-dashboard.cs-theme-dark .cs-interactive-card{
    border-color:rgba(56,189,248,.1);
  }
  #cs-dashboard.cs-theme-dark .cs-interactive-card:hover{
    border-color:rgba(56,189,248,.3);
    box-shadow:0 4px 16px rgba(0,0,0,.3),0 0 12px rgba(56,189,248,.1);
  }
  #cs-dashboard.cs-theme-dark .cs-interactive-card-icon{
    filter:drop-shadow(0 0 4px rgba(56,189,248,.4));
  }
  /* Guide card 霓虹 */
  #cs-dashboard.cs-theme-dark .cs-guide-card{
    border-color:rgba(56,189,248,.1);
  }
  #cs-dashboard.cs-theme-dark .cs-guide-card-icon{
    filter:drop-shadow(0 0 4px rgba(56,189,248,.4));
  }
  /* 空状态图标发光 */
  #cs-dashboard.cs-theme-dark .cs-empty-state-icon svg{
    filter:drop-shadow(0 0 8px rgba(56,189,248,.2));
  }

  /* ─── Gradient Text System (Dark Mode) ─────────────── */
  #cs-dashboard.cs-theme-dark .cs-text-gradient-main {
    background: var(--cs-text-gradient-main);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    text-shadow: 0 0 20px rgba(125, 211, 252, 0.08);
  }
  #cs-dashboard.cs-theme-dark .cs-text-gradient-heading {
    background: var(--cs-text-gradient-heading);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    text-shadow: 0 0 24px rgba(56, 189, 248, 0.12);
  }
  #cs-dashboard.cs-theme-dark .cs-text-gradient-accent {
    background: var(--cs-text-gradient-accent);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    text-shadow: 0 0 24px rgba(56, 189, 248, 0.15);
  }
  #cs-dashboard.cs-theme-dark .cs-text-gradient-brand {
    background: var(--cs-text-gradient-brand);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    text-shadow: 0 0 30px rgba(56, 189, 248, 0.2);
  }

  /* ─── Chat Bubble Gradient Text (Dark Mode) ────────── */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai {
    position: relative;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, #0c1222 0%, #0a0f1a 100%);
    border: 1px solid rgba(56, 189, 248, 0.15);
    border-radius: inherit;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(56, 189, 248, 0.05);
    z-index: 0;
    pointer-events: none;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai > * {
    position: relative;
    z-index: 1;
  }
  /* 正文文字渐变 */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai {
    color: transparent;
    background-image: var(--cs-text-gradient-main);
    background-clip: text;
    -webkit-background-clip: text;
    text-shadow: 0 0 24px rgba(125, 211, 252, 0.1);
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h1 {
    color: transparent;
    background-image: var(--cs-text-gradient-heading);
    background-clip: text;
    -webkit-background-clip: text;
    font-weight: 800;
    text-shadow: 0 0 28px rgba(56, 189, 248, 0.18);
    margin: 16px 0 10px;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h2 {
    color: transparent;
    background-image: var(--cs-text-gradient-heading);
    background-clip: text;
    -webkit-background-clip: text;
    font-weight: 700;
    text-shadow: 0 0 24px rgba(56, 189, 248, 0.15);
    margin: 14px 0 8px;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h3,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h4 {
    color: transparent;
    background-image: var(--cs-text-gradient-accent);
    background-clip: text;
    -webkit-background-clip: text;
    font-weight: 600;
    text-shadow: 0 0 20px rgba(56, 189, 248, 0.12);
    margin: 12px 0 6px;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai strong,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai b {
    color: transparent;
    background-image: var(--cs-text-gradient-accent);
    background-clip: text;
    -webkit-background-clip: text;
    font-weight: 700;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai em,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai i {
    font-style: italic;
    opacity: 0.9;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai a {
    color: #38bdf8 !important;
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
    text-shadow: 0 0 16px rgba(56, 189, 248, 0.35);
    border-bottom: 1px solid rgba(56, 189, 248, 0.3);
    text-decoration: none;
    transition: all .2s ease;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai a:hover {
    color: #7dd3fc !important;
    border-bottom-color: #7dd3fc;
    text-shadow: 0 0 20px rgba(125, 211, 252, 0.4);
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai code {
    background: rgba(56, 189, 248, 0.12);
    color: #7dd3fc !important;
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
    border: 1px solid rgba(56, 189, 248, 0.15);
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 0.9em;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai pre {
    position: relative;
    background: #080c16 !important;
    background-image: none !important;
    border: 1px solid rgba(56, 189, 248, 0.15);
    box-shadow: inset 0 0 30px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.3);
    border-radius: 12px;
    padding: 16px;
    margin: 12px 0;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai pre::before {
    display: none;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai pre code {
    background: transparent;
    color: #bae6fd !important;
    background-image: none !important;
    border: none;
    padding: 0;
    text-shadow: none;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai ul,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai ol {
    padding-left: 24px;
    margin: 10px 0;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai li {
    margin: 6px 0;
    line-height: 1.7;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai blockquote {
    border-left: 3px solid rgba(56, 189, 248, 0.4);
    margin: 12px 0;
    background: rgba(56, 189, 248, 0.05);
    padding: 12px 16px;
    border-radius: 0 10px 10px 0;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai blockquote p {
    margin: 0;
    opacity: 0.85;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai p {
    margin: 8px 0;
    line-height: 1.75;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai hr {
    border: none;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.3), transparent);
    margin: 16px 0;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    border: 1px solid rgba(56, 189, 248, 0.15);
    border-radius: 10px;
    overflow: hidden;
    background: rgba(0,0,0,0.2) !important;
    background-image: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai table::before {
    display: none;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai th {
    background: rgba(56, 189, 248, 0.1);
    background-image: none !important;
    color: #7dd3fc !important;
    font-weight: 600;
    padding: 10px 14px;
    text-align: left;
    border-bottom: 1px solid rgba(56, 189, 248, 0.15);
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai td {
    padding: 10px 14px;
    border-bottom: 1px solid rgba(56, 189, 248, 0.08);
    color: var(--cs-text-main-fallback, #e0f2fe) !important;
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai img {
    max-width: 100%;
    border-radius: 10px;
    border: 1px solid rgba(56, 189, 248, 0.15);
  }

  /* ─── Welcome Page Optimization ───────────────────── */
  #cs-dashboard.cs-theme-dark .cs-welcome-title {
    background: var(--cs-text-gradient-brand);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -0.03em;
    text-shadow: 0 0 40px rgba(56, 189, 248, 0.2);
  }
  #cs-dashboard.cs-theme-dark .cs-welcome-tagline {
    background: var(--cs-text-gradient-accent);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    opacity: 1;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-size: 12px;
  }
  #cs-dashboard.cs-theme-dark .cs-welcome-desc {
    color: var(--cs-text-secondary);
    opacity: 0.85;
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn {
    position: relative;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    overflow: hidden;
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, #0c1222 0%, #0a0f1a 100%);
    border: 1px solid rgba(56, 189, 248, 0.15);
    border-radius: inherit;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 0;
    transition: all .25s var(--cs-transition);
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn > * {
    position: relative;
    z-index: 1;
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn span,
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn {
    color: transparent;
    background-clip: text;
    -webkit-background-clip: text;
    background-image: var(--cs-text-gradient-main);
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn:hover::before {
    border-color: rgba(56, 189, 248, 0.4);
    box-shadow: 0 8px 32px rgba(56, 189, 248, 0.15), 0 0 0 1px rgba(56, 189, 248, 0.1);
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn svg {
    color: #38bdf8 !important;
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
  }

  /* ─── Header Title Gradient (Dark Mode) ───────────── */
  #cs-dashboard.cs-theme-dark .cs-chat-header-title {
    background: var(--cs-text-gradient-brand);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-status-text {
    color: var(--cs-text-secondary);
  }

  /* ─── Message Action Buttons (Dark Mode) ──────────── */
  #cs-dashboard.cs-theme-dark .cs-msg-action-btn {
    color: var(--cs-text-tertiary);
  }
  #cs-dashboard.cs-theme-dark .cs-msg-action-btn:hover {
    background: rgba(56, 189, 248, 0.1);
    color: var(--cs-accent);
  }
  #cs-dashboard.cs-theme-dark .cs-msg-actions {
    opacity: 0.5;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-msg-user:hover .cs-msg-actions,
  #cs-dashboard.cs-theme-dark .cs-chat-msg-ai:hover .cs-msg-actions {
    opacity: 1;
  }

  /* ─── User Bubble Enhancement (Dark Mode) ─────────── */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-user {
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
    border: 1px solid rgba(125, 211, 252, 0.3);
    box-shadow: 0 4px 20px rgba(56, 189, 248, 0.25), 0 0 0 1px rgba(125, 211, 252, 0.1);
    color: #ffffff;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-user code {
    background: rgba(255, 255, 255, 0.15);
    color: #e0f2fe;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-user a {
    color: #ffffff;
    border-bottom-color: rgba(255, 255, 255, 0.4);
  }

  /* ─── History Panel Enhancement (Dark Mode) ───────── */
  #cs-dashboard.cs-theme-dark .cs-chat-history-item-active {
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(129, 140, 248, 0.08) 100%);
    border-color: rgba(56, 189, 248, 0.25);
    box-shadow: 0 2px 12px rgba(56, 189, 248, 0.1);
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-item-active .cs-chat-history-item-preview {
    background: var(--cs-text-gradient-accent);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-weight: 600;
  }

  /* ─── Touch Device Optimization ───────────────────── */
  /* ─── Section Titles & Navigation (Dark Mode) ─────── */
  #cs-dashboard.cs-theme-dark .cs-dash-section-title,
  #cs-dashboard.cs-theme-dark .cs-topic-group-label,
  #cs-dashboard.cs-theme-dark .cs-block-label {
    background: var(--cs-text-gradient-heading);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-weight: 700;
  }
  #cs-dashboard.cs-theme-dark .cs-dash-block {
    background: linear-gradient(180deg, #0c1222 0%, #0a0f1a 100%);
    border-color: rgba(56, 189, 248, 0.12);
  }
  #cs-dashboard.cs-theme-dark .cs-dash-block::before {
    background: linear-gradient(90deg, transparent, var(--cs-accent), transparent);
  }
  #cs-dashboard.cs-theme-dark .cs-block-val,
  #cs-dashboard.cs-theme-dark .cs-topic-label,
  #cs-dashboard.cs-theme-dark .cs-topic-stat-num {
    background: var(--cs-text-gradient-main);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  #cs-dashboard.cs-theme-dark .cs-topic-stat-num {
    background: var(--cs-text-gradient-accent);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-weight: 800;
  }
  #cs-dashboard.cs-theme-dark .cs-topic-chip.cs-topic-on .cs-topic-chip-label,
  #cs-dashboard.cs-theme-dark .cs-option-chip.cs-option-selected,
  #cs-dashboard.cs-theme-dark .cs-scope-card.cs-scope-selected {
    background: var(--cs-text-gradient-accent);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-weight: 600;
  }
  #cs-dashboard.cs-theme-dark .cs-hot-topic-card {
    background: linear-gradient(180deg, #0c1222 0%, #0a0f1a 100%);
    border-color: rgba(56, 189, 248, 0.12);
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  #cs-dashboard.cs-theme-dark .cs-hot-topic-card:hover {
    border-color: rgba(56, 189, 248, 0.3);
    box-shadow: 0 6px 20px rgba(56, 189, 248, 0.12), 0 0 0 1px rgba(56, 189, 248, 0.08);
    transform: translateY(-2px);
  }
  #cs-dashboard.cs-theme-dark .cs-hot-topic-label {
    background: var(--cs-text-gradient-heading);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    font-weight: 700;
  }
  #cs-dashboard.cs-theme-dark .cs-hot-topic-row-value,
  #cs-dashboard.cs-theme-dark .cs-hot-topic-row-label {
    background: var(--cs-text-gradient-main);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  #cs-dashboard.cs-theme-dark .cs-hot-topic-row-label {
    opacity: 0.7;
  }
  #cs-dashboard.cs-theme-dark .cs-rules-tab-active {
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
    box-shadow: 0 4px 16px rgba(56, 189, 248, 0.3);
  }
  #cs-dashboard.cs-theme-dark .cs-guardian-hero {
    background: linear-gradient(135deg, #0c1222 0%, #0a0f1a 100%);
    border-color: rgba(56, 189, 248, 0.15);
  }
  #cs-dashboard.cs-theme-dark .cs-custom-item,
  #cs-dashboard.cs-theme-dark .cs-topic-stats,
  #cs-dashboard.cs-theme-dark .cs-interactive-card {
    background: linear-gradient(180deg, #0c1222 0%, #0a0f1a 100%);
    border-color: rgba(56, 189, 248, 0.12);
  }
  #cs-dashboard.cs-theme-dark .cs-keyword-tag,
  #cs-dashboard.cs-theme-dark .cs-topic-chip,
  #cs-dashboard.cs-theme-dark .cs-option-chip,
  #cs-dashboard.cs-theme-dark .cs-scope-card {
    background: rgba(12, 18, 34, 0.8);
    border-color: rgba(56, 189, 248, 0.12);
  }
  #cs-dashboard.cs-theme-dark .cs-keyword-tag:hover,
  #cs-dashboard.cs-theme-dark .cs-topic-chip:hover,
  #cs-dashboard.cs-theme-dark .cs-option-chip:hover,
  #cs-dashboard.cs-theme-dark .cs-scope-card:hover {
    border-color: rgba(56, 189, 248, 0.3);
    background: rgba(56, 189, 248, 0.08);
  }
  #cs-dashboard.cs-theme-dark .cs-btn-accent {
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
    box-shadow: 0 4px 16px rgba(56, 189, 248, 0.3), 0 0 0 1px rgba(125, 211, 252, 0.2);
  }
  #cs-dashboard.cs-theme-dark .cs-btn-accent:hover {
    background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%);
    box-shadow: 0 6px 24px rgba(56, 189, 248, 0.4), 0 0 0 1px rgba(125, 211, 252, 0.3);
  }
  #cs-dashboard.cs-theme-dark .cs-chat-messages {
    background: #050810;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-input-area {
    background: linear-gradient(180deg, #050810 0%, #0a0f1a 100%);
    border-top-color: rgba(56, 189, 248, 0.12);
  }
  #cs-dashboard.cs-theme-dark .cs-chat-input-wrap {
    background: #0c1222;
    border-color: rgba(56, 189, 248, 0.15);
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  }
  #cs-dashboard.cs-theme-dark .cs-chat-input-wrap:focus-within {
    border-color: var(--cs-accent);
    box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1), 0 0 24px rgba(56, 189, 248, 0.15), 0 4px 16px rgba(0,0,0,0.3);
  }

  /* ─── Touch Device Optimization ───────────────────── */
  @media (hover: none) and (pointer: coarse) {
    .cs-chat-header-btn,
    .cs-chat-history-toggle {
      width: 48px;
      height: 48px;
    }
    .cs-chat-header-btn svg,
    .cs-chat-history-toggle svg {
      width: 20px;
      height: 20px;
    }
    .cs-msg-actions {
      opacity: 0.8 !important;
    }
  }

  /* ─── FINAL COLOR FIX: 正文一律实色，保证可读性 ────── */
  /* ═══ 浅色模式（默认）：深灰文字，浅色背景，完全清晰 ═══ */
  #cs-dashboard.cs-theme-light .cs-chat-bubble-user {
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%) !important;
    color: #ffffff !important;
    border: 1px solid rgba(125, 211, 252, 0.3) !important;
    box-shadow: 0 4px 16px rgba(2, 132, 199, 0.25) !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-user code {
    background: rgba(255,255,255,0.2) !important;
    color: #ffffff !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-user a {
    color: #ffffff !important;
    border-bottom-color: rgba(255,255,255,0.4) !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai {
    background: var(--cs-bg) !important;
    color: var(--cs-text) !important;
    border: 1px solid var(--cs-border) !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai * {
    color: inherit !important;
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
    text-shadow: none !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai a {
    color: var(--cs-accent) !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai code {
    background: var(--cs-bg-body) !important;
    color: var(--cs-accent) !important;
  }

  /* ═══ 深色模式：冰蓝实色文字，深蓝背景，渐变只用于标题 ═══ */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-user {
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%) !important;
    color: #ffffff !important;
    border: 1px solid rgba(125, 211, 252, 0.3) !important;
    box-shadow: 0 4px 20px rgba(56, 189, 248, 0.3), 0 0 0 1px rgba(125, 211, 252, 0.1) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-user code {
    background: rgba(255,255,255,0.15) !important;
    color: #e0f2fe !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-user a {
    color: #ffffff !important;
    border-bottom-color: rgba(255,255,255,0.4) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai {
    position: relative !important;
    background: #0c1222 !important;
    color: #e0f2fe !important;
    border: 1px solid rgba(56, 189, 248, 0.15) !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai::before {
    display: none !important;
  }
  /* 正文所有元素一律冰蓝实色，不搞渐变，保证清晰 */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai p,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai li,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai td,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai span:not([class*="cs-"]),
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai div:not([class]) {
    color: #e0f2fe !important;
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
    text-shadow: 0 0 12px rgba(125, 211, 252, 0.15) !important;
  }
  /* 标题用渐变，装饰性 */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h1,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h2 {
    background: linear-gradient(135deg, #7dd3fc 0%, #38bdf8 50%, #0ea5e9 100%) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    color: transparent !important;
    font-weight: 700;
    text-shadow: 0 0 24px rgba(56, 189, 248, 0.2) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h3,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h4,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai strong,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai b {
    background: linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    color: transparent !important;
    font-weight: 600;
  }
  /* 链接：天蓝实色+发光 */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai a {
    color: #38bdf8 !important;
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
    text-shadow: 0 0 12px rgba(56, 189, 248, 0.4) !important;
    border-bottom: 1px solid rgba(56, 189, 248, 0.3) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai a:hover {
    color: #7dd3fc !important;
    border-bottom-color: #7dd3fc !important;
  }
  /* 行内代码：天蓝实色 */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai code {
    background: rgba(56, 189, 248, 0.12) !important;
    color: #7dd3fc !important;
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
    border: 1px solid rgba(56, 189, 248, 0.15) !important;
  }
  /* 代码块：深黑背景+浅冰蓝代码 */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai pre {
    background: #080c16 !important;
    background-image: none !important;
    border: 1px solid rgba(56, 189, 248, 0.15) !important;
    box-shadow: inset 0 0 30px rgba(0,0,0,0.6) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai pre code {
    background: transparent !important;
    color: #bae6fd !important;
    background-image: none !important;
    border: none !important;
    text-shadow: none !important;
  }
  /* 引用块 */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai blockquote {
    border-left: 3px solid rgba(56, 189, 248, 0.4) !important;
    background: rgba(56, 189, 248, 0.05) !important;
    color: #bae6fd !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai blockquote * {
    color: #bae6fd !important;
    background-image: none !important;
  }
  /* 表格 */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai table {
    background: rgba(0,0,0,0.2) !important;
    background-image: none !important;
    border-color: rgba(56, 189, 248, 0.15) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai th {
    background: rgba(56, 189, 248, 0.1) !important;
    background-image: none !important;
    color: #7dd3fc !important;
    border-bottom-color: rgba(56, 189, 248, 0.15) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai td {
    color: #e0f2fe !important;
    background-image: none !important;
    border-bottom-color: rgba(56, 189, 248, 0.08) !important;
  }
  /* 列表 */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai ul,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai ol {
    color: #e0f2fe !important;
  }

  /* ═══ 装饰性文字可以用渐变（欢迎页/标题/品牌）════ */
  #cs-dashboard.cs-theme-dark .cs-welcome-title {
    background: linear-gradient(135deg, #7dd3fc 0%, #38bdf8 33%, #0ea5e9 66%, #818cf8 100%) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    color: transparent !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-header-title {
    background: linear-gradient(135deg, #7dd3fc 0%, #38bdf8 100%) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    color: transparent !important;
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn {
    position: relative;
    overflow: hidden;
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, #0c1222 0%, #0a0f1a 100%);
    border: 1px solid rgba(56, 189, 248, 0.15);
    border-radius: inherit;
    z-index: 0;
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn > * {
    position: relative;
    z-index: 1;
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn {
    color: #bae6fd !important;
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn svg {
    color: #38bdf8 !important;
  }

  /* ═══ 输入框和背景 ═══ */
  #cs-dashboard.cs-theme-dark .cs-chat-messages {
    background: #050810 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-input-area {
    background: #050810 !important;
    border-top-color: rgba(56, 189, 248, 0.12) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-input-wrap {
    background: #0c1222 !important;
    border-color: rgba(56, 189, 248, 0.15) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-input {
    color: #e0f2fe !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-input {
    color: var(--cs-text) !important;
  }

  /* ═══ 浅色模式全局：确保所有文字都是实色，除了品牌标题 ═══ */
  #cs-dashboard.cs-theme-light .cs-dash-section-title,
  #cs-dashboard.cs-theme-light .cs-topic-group-label,
  #cs-dashboard.cs-theme-light .cs-block-label,
  #cs-dashboard.cs-theme-light .cs-block-val,
  #cs-dashboard.cs-theme-light .cs-topic-label,
  #cs-dashboard.cs-theme-light .cs-topic-stat-num,
  #cs-dashboard.cs-theme-light .cs-hot-topic-label,
  #cs-dashboard.cs-theme-light .cs-hot-topic-row-value,
  #cs-dashboard.cs-theme-light .cs-hot-topic-row-label,
  #cs-dashboard.cs-theme-light .cs-chat-history-item-title,
  #cs-dashboard.cs-theme-light .cs-chat-history-item-preview,
  #cs-dashboard.cs-theme-light .cs-chat-welcome-subtitle,
  #cs-dashboard.cs-theme-light .cs-chat-welcome-desc {
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
    color: var(--cs-text) !important;
    text-shadow: none !important;
  }
  #cs-dashboard.cs-theme-light .cs-dash-title,
  #cs-dashboard.cs-theme-light .cs-chat-header-title {
    background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    color: transparent !important;
  }
  #cs-dashboard.cs-theme-light .cs-welcome-title {
    background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 50%, #6366f1 100%) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    color: transparent !important;
  }

  /* ═══ 状态胶囊统一样式 ═══ */
  /* 浅色模式 */
  #cs-dashboard.cs-theme-light .cs-chat-header-status {
    background: rgba(14, 165, 233, 0.08) !important;
    border-color: rgba(14, 165, 233, 0.2) !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-status-text {
    color: #0284c7 !important;
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
    font-weight: 600 !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-status-dot.cs-online {
    background: #10b981 !important;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.6) !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-status-dot.cs-offline {
    background: #94a3b8 !important;
  }
  /* 深色模式 */
  #cs-dashboard.cs-theme-dark .cs-chat-header-status {
    background: rgba(56, 189, 248, 0.08) !important;
    border-color: rgba(56, 189, 248, 0.2) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-status-text {
    color: #7dd3fc !important;
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
    text-shadow: 0 0 12px rgba(125, 211, 252, 0.3) !important;
    font-weight: 600 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-status-dot.cs-online {
    background: #22c55e !important;
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.7), 0 0 20px rgba(56, 189, 248, 0.3) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-status-dot.cs-offline {
    background: #64748b !important;
  }

  /* ─── Scrollbar (Dark Mode) ───────────────────────── */
  #cs-dashboard.cs-theme-dark ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  #cs-dashboard.cs-theme-dark ::-webkit-scrollbar-track {
    background: transparent;
  }
  #cs-dashboard.cs-theme-dark ::-webkit-scrollbar-thumb {
    background: rgba(56, 189, 248, 0.2);
    border-radius: 4px;
  }
  #cs-dashboard.cs-theme-dark ::-webkit-scrollbar-thumb:hover {
    background: rgba(56, 189, 248, 0.35);
  }

  /* ═══════════════════════════════════════════════════
     ULTIMATE COLOR FIX - 最高优先级，确保永远正确
     ═══════════════════════════════════════════════════ */
  /* ─── 浅色模式：深灰/黑色文字，白底，高对比度 ─── */
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai > *,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai p,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai li,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai td,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai th,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai span,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai div {
    color: #1f2937 !important;
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
    text-shadow: none !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai h1,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai h2,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai h3,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai h4,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai strong,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai b {
    color: #111827 !important;
    background-image: none !important;
    font-weight: 700 !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai a {
    color: #0284c7 !important;
    background-image: none !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai code {
    color: #0284c7 !important;
    background-image: none !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai pre code {
    color: #1f2937 !important;
    background-image: none !important;
  }

  /* ─── 深色模式：冰蓝色文字，深蓝底，永远清晰 ─── */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai > *,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai p,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai li,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai td,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai span:not([class*="cs-mermaid"]),
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai div:not([class]) {
    color: #e0f2fe !important;
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
    text-shadow: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai {
    background: #0c1222 !important;
    border-color: rgba(56, 189, 248, 0.15) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h1,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h2 {
    background: linear-gradient(135deg, #7dd3fc 0%, #38bdf8 100%) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    color: transparent !important;
    font-weight: 700 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h3,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h4,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai strong,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai b {
    background: linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    color: transparent !important;
    font-weight: 600 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai a {
    color: #38bdf8 !important;
    background-image: none !important;
    text-decoration: underline !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai code {
    color: #7dd3fc !important;
    background: rgba(56, 189, 248, 0.1) !important;
    background-image: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai pre {
    background: #080c16 !important;
    background-image: none !important;
    border-color: rgba(56, 189, 248, 0.15) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai pre code {
    color: #bae6fd !important;
    background: transparent !important;
    background-image: none !important;
    border: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai blockquote {
    color: #bae6fd !important;
    background: rgba(56, 189, 248, 0.05) !important;
    border-left-color: rgba(56, 189, 248, 0.4) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai blockquote * {
    color: #bae6fd !important;
    background-image: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai ul,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai ol {
    color: #e0f2fe !important;
  }

  /* ─── 欢迎页建议按钮渐变文字 ─── */
  #cs-dashboard.cs-theme-light .cs-suggestion-btn {
    background: rgba(255,255,255,0.8) !important;
    border-color: rgba(2, 132, 199, 0.2) !important;
    color: #0284c7 !important;
  }
  #cs-dashboard.cs-theme-light .cs-suggestion-btn:hover {
    background: rgba(14, 165, 233, 0.08) !important;
    border-color: rgba(2, 132, 199, 0.4) !important;
    color: #0369a1 !important;
    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.15) !important;
  }
  #cs-dashboard.cs-theme-light .cs-suggestion-btn svg {
    color: #0ea5e9 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn {
    background: #0c1222 !important;
    border-color: rgba(56, 189, 248, 0.15) !important;
    color: #bae6fd !important;
    background-image: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn::before { display: none !important; }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn:hover {
    background: rgba(56, 189, 248, 0.1) !important;
    border-color: rgba(56, 189, 248, 0.3) !important;
    color: #7dd3fc !important;
    box-shadow: 0 4px 20px rgba(56, 189, 248, 0.15) !important;
    transform: translateY(-2px) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn svg {
    color: #38bdf8 !important;
  }

  /* ─── 欢迎页文字颜色 ─── */
  #cs-dashboard.cs-theme-light .cs-welcome-tagline {
    background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    color: transparent !important;
  }
  #cs-dashboard.cs-theme-light .cs-welcome-desc {
    color: #64748b !important;
  }
  #cs-dashboard.cs-theme-dark .cs-welcome-tagline {
    background: linear-gradient(135deg, #7dd3fc 0%, #38bdf8 50%, #0ea5e9 100%) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    color: transparent !important;
    letter-spacing: 0.1em;
  }
  #cs-dashboard.cs-theme-dark .cs-welcome-desc {
    color: #94a3b8 !important;
    background-image: none !important;
  }

  /* ─── 输入框 & 历史记录 ─── */
  #cs-dashboard.cs-theme-dark .cs-chat-input::placeholder {
    color: #64748b !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-input::placeholder {
    color: #94a3b8 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-item-title {
    color: #e0f2fe !important;
    background-image: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-item-preview {
    color: #94a3b8 !important;
    background-image: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-empty {
    color: #64748b !important;
    background-image: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-new-btn {
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%) !important;
    color: #ffffff !important;
    border: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-title {
    background: linear-gradient(135deg, #7dd3fc 0%, #38bdf8 100%) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    color: transparent !important;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-size: 11px;
  }

  /* ═══════════════════════════════════════════════════
     FINAL CLEAR COLOR SCHEME - 高对比度，可读性第一
     原则：正文永远实色，渐变只用于标题/装饰
     ═══════════════════════════════════════════════════ */

  /* ━━━━━━━━━━━ 头像修复 ━━━━━━━━━━━ */
  #cs-dashboard.cs-theme-light .cs-chat-avatar-user {
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%) !important;
    color: #ffffff !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-avatar-ai {
    background: #e0f2fe !important;
    color: #0369a1 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-avatar-user {
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%) !important;
    color: #ffffff !important;
    box-shadow: 0 2px 12px rgba(56, 189, 248, 0.3) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-avatar-ai {
    background: rgba(56, 189, 248, 0.15) !important;
    color: #38bdf8 !important;
    border: 1px solid rgba(56, 189, 248, 0.2) !important;
  }

  /* ━━━━━━━━━━━ 浅色模式（白底黑字，最高对比度）━━━━━━━━━━━ */
  #cs-dashboard.cs-theme-light {
    --cs-chat-bg: #ffffff;
    --cs-chat-bg-input: #f8fafc;
  }
  #cs-dashboard.cs-theme-light .cs-chat-messages {
    background: #ffffff !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-input-area {
    background: #ffffff !important;
    border-top-color: #e2e8f0 !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-input-wrap {
    background: #f8fafc !important;
    border-color: #e2e8f0 !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-input {
    color: #1e293b !important;
  }
  /* AI气泡 - 浅灰底，深黑字 */
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai {
    background: #f1f5f9 !important;
    border: 1px solid #e2e8f0 !important;
    color: #1e293b !important;
    box-shadow: none !important;
  }
  /* 用户气泡 - 蓝底白字 */
  #cs-dashboard.cs-theme-light .cs-chat-bubble-user {
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%) !important;
    color: #ffffff !important;
    border: none !important;
    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.2) !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-user code {
    background: rgba(255,255,255,0.2) !important;
    color: #ffffff !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-user a {
    color: #ffffff !important;
  }
  /* AI内所有文字：深黑灰色，实色！ */
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai *,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai p,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai li,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai td,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai th,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai span,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai div,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai ul,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai ol {
    color: #1e293b !important;
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
    text-shadow: none !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai a {
    color: #0284c7 !important;
    text-decoration: underline !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai code {
    color: #0369a1 !important;
    background: #e0f2fe !important;
    border: none !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai pre {
    background: #0f172a !important;
    border: none !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai pre code {
    color: #e2e8f0 !important;
    background: transparent !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai blockquote {
    color: #475569 !important;
    background: #f8fafc !important;
    border-left-color: #0ea5e9 !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai blockquote * {
    color: #475569 !important;
  }
  /* 标题加粗，比正文更深一点 */
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai h1,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai h2,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai h3,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai h4,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai strong,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai b {
    color: #0f172a !important;
    font-weight: 700 !important;
    background-image: none !important;
  }

  /* ━━━━━━━━━━━ 深色模式（深灰蓝底，浅冰蓝字，高对比度）━━━━━━━━━━━ */
  #cs-dashboard.cs-theme-dark .cs-chat-messages {
    background: #0f172a !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-input-area {
    background: #0f172a !important;
    border-top-color: rgba(148, 163, 184, 0.15) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-input-wrap {
    background: #1e293b !important;
    border-color: rgba(148, 163, 184, 0.2) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-input {
    color: #f1f5f9 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-input::placeholder {
    color: #64748b !important;
  }
  /* AI气泡 - 深蓝灰底，浅冰蓝字 */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai {
    background: #1e293b !important;
    border: 1px solid rgba(148, 163, 184, 0.15) !important;
    color: #f1f5f9 !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2) !important;
  }
  /* 用户气泡 - 亮蓝底白字 */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-user {
    background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%) !important;
    color: #ffffff !important;
    border: none !important;
    box-shadow: 0 4px 16px rgba(14, 165, 233, 0.3) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-user code {
    background: rgba(255,255,255,0.15) !important;
    color: #ffffff !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-user a {
    color: #ffffff !important;
  }
  /* AI内所有文字：浅冰蓝色，实色！ */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai *,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai p,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai li,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai td,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai th,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai span,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai div,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai ul,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai ol {
    color: #f1f5f9 !important;
    background-image: none !important;
    background-clip: initial !important;
    -webkit-background-clip: initial !important;
    text-shadow: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai a {
    color: #38bdf8 !important;
    text-decoration: underline !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai code {
    color: #7dd3fc !important;
    background: rgba(56, 189, 248, 0.12) !important;
    border: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai pre {
    background: #0b1120 !important;
    border: 1px solid rgba(56, 189, 248, 0.1) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai pre code {
    color: #e2e8f0 !important;
    background: transparent !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai blockquote {
    color: #cbd5e1 !important;
    background: rgba(56, 189, 248, 0.06) !important;
    border-left-color: #38bdf8 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai blockquote * {
    color: #cbd5e1 !important;
  }
  /* 标题加粗，比正文更亮一点 - 简单实色，不用渐变！ */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h1,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h2,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h3,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai h4,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai strong,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai b {
    color: #ffffff !important;
    font-weight: 700 !important;
    background-image: none !important;
  }

  /* ━━━━━━━━━━━ 建议按钮 ━━━━━━━━━━━ */
  #cs-dashboard.cs-theme-light .cs-suggestion-btn {
    background: #ffffff !important;
    border: 1px solid #e2e8f0 !important;
    color: #334155 !important;
    background-image: none !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;
  }
  #cs-dashboard.cs-theme-light .cs-suggestion-btn::before { display: none !important; }
  #cs-dashboard.cs-theme-light .cs-suggestion-btn:hover {
    background: #f0f9ff !important;
    border-color: #7dd3fc !important;
    color: #0369a1 !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(14, 165, 233, 0.1) !important;
  }
  #cs-dashboard.cs-theme-light .cs-suggestion-btn svg {
    color: #0ea5e9 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn {
    background: #1e293b !important;
    border: 1px solid rgba(148, 163, 184, 0.15) !important;
    color: #e2e8f0 !important;
    background-image: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn::before { display: none !important; }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn:hover {
    background: rgba(56, 189, 248, 0.1) !important;
    border-color: rgba(56, 189, 248, 0.3) !important;
    color: #7dd3fc !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 16px rgba(56, 189, 248, 0.15) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-suggestion-btn svg {
    color: #38bdf8 !important;
  }

  /* ━━━━━━━━━━━ 欢迎页文字 ━━━━━━━━━━━ */
  #cs-dashboard.cs-theme-light .cs-welcome-title {
    background: linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    color: transparent !important;
  }
  #cs-dashboard.cs-theme-light .cs-welcome-tagline {
    color: #0369a1 !important;
    background-image: none !important;
    font-weight: 600 !important;
  }
  #cs-dashboard.cs-theme-light .cs-welcome-desc {
    color: #64748b !important;
    background-image: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-welcome-title {
    background: linear-gradient(135deg, #7dd3fc 0%, #38bdf8 50%, #0ea5e9 100%) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    color: transparent !important;
  }
  #cs-dashboard.cs-theme-dark .cs-welcome-tagline {
    color: #38bdf8 !important;
    background-image: none !important;
    font-weight: 600 !important;
    letter-spacing: 0.05em;
  }
  #cs-dashboard.cs-theme-dark .cs-welcome-desc {
    color: #94a3b8 !important;
    background-image: none !important;
  }

  /* ━━━━━━━━━━━ 思考卡片样式 ━━━━━━━━━━━ */
  .cs-thinking-block {
    margin: 0;
    border-radius: 12px;
    overflow: hidden;
    flex: 1;
    min-width: 0;
  }
  .cs-thinking-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    user-select: none;
    transition: all 0.2s ease;
  }
  .cs-thinking-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .cs-thinking-label svg {
    width: 14px;
    height: 14px;
  }
  .cs-thinking-header .cs-thinking-arrow {
    transition: transform 0.2s ease;
    font-size: 10px;
    opacity: 0.7;
  }
  .cs-thinking-block.cs-thinking-collapsed .cs-thinking-arrow {
    transform: rotate(-90deg);
  }
  .cs-thinking-body {
    font-size: 13px;
    line-height: 1.7;
    padding: 4px 14px 14px;
    max-height: 240px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .cs-thinking-block.cs-thinking-collapsed .cs-thinking-body {
    display: none;
  }
  .cs-thinking-time {
    font-size: 11px;
    margin-left: auto;
    opacity: 0.7;
  }
  /* 浅色模式思考卡片 */
  #cs-dashboard.cs-theme-light .cs-thinking-block {
    background: #f8fafc !important;
    border: 1px solid #e2e8f0 !important;
  }
  #cs-dashboard.cs-theme-light .cs-thinking-header {
    color: #475569 !important;
    background: #f1f5f9 !important;
  }
  #cs-dashboard.cs-theme-light .cs-thinking-header:hover {
    background: #e2e8f0 !important;
  }
  #cs-dashboard.cs-theme-light .cs-thinking-block-thinking .cs-thinking-header {
    color: #0369a1 !important;
    background: #f0f9ff !important;
  }
  #cs-dashboard.cs-theme-light .cs-thinking-body {
    color: #64748b !important;
    border-top: 1px solid #e2e8f0;
  }
  /* 深色模式思考卡片 */
  #cs-dashboard.cs-theme-dark .cs-thinking-block {
    background: #0f172a !important;
    border: 1px solid rgba(56, 189, 248, 0.15) !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-thinking-header {
    color: #94a3b8 !important;
    background: rgba(56, 189, 248, 0.05) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-thinking-header:hover {
    background: rgba(56, 189, 248, 0.1) !important;
    color: #7dd3fc !important;
  }
  #cs-dashboard.cs-theme-dark .cs-thinking-block-thinking .cs-thinking-header {
    color: #38bdf8 !important;
    background: rgba(56, 189, 248, 0.08) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-thinking-body {
    color: #94a3b8 !important;
    border-top: 1px solid rgba(56, 189, 248, 0.1);
  }

  /* ━━━━━━━━━━━ Header & 整体背景 ━━━━━━━━━━━ */
  /* 浅色模式 */
  #cs-dashboard.cs-theme-light .cs-chat-header {
    background: #ffffff !important;
    border-bottom-color: #e2e8f0 !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-header-title {
    background: linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    color: transparent !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-header-btn {
    color: #64748b !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-header-btn:hover {
    background: #f1f5f9 !important;
    color: #0ea5e9 !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-header-status {
    background: #f0f9ff !important;
    border-color: #bae6fd !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-status-text {
    color: #0369a1 !important;
    background-image: none !important;
    font-weight: 600 !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-status-dot.cs-online {
    background: #10b981 !important;
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.5) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-header-status {
    background: rgba(56, 189, 248, 0.1) !important;
    border-color: rgba(56, 189, 248, 0.2) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-status-text {
    color: #7dd3fc !important;
    background-image: none !important;
    font-weight: 600 !important;
  }
  /* 深色模式 */
  #cs-dashboard.cs-theme-dark .cs-chat-header {
    background: #0f172a !important;
    border-bottom-color: rgba(148, 163, 184, 0.15) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-header-title {
    background: linear-gradient(135deg, #7dd3fc 0%, #38bdf8 100%) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    color: transparent !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-header-btn {
    color: #94a3b8 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-header-btn:hover {
    background: rgba(56, 189, 248, 0.1) !important;
    color: #38bdf8 !important;
  }

  /* ━━━━━━━━━━━ 欢迎页发光动画 ━━━━━━━━━━━ */
  #cs-dashboard.cs-theme-light .cs-welcome-glow {
    background: radial-gradient(circle at center, rgba(14, 165, 233, 0.08) 0%, transparent 70%) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-welcome-glow {
    background: radial-gradient(circle at center, rgba(56, 189, 248, 0.12) 0%, transparent 70%) !important;
  }

  /* ━━━━━━━━━━━ 历史记录 ━━━━━━━━━━━ */
  /* 浅色模式 */
  #cs-dashboard.cs-theme-light .cs-chat-history-panel {
    background: #ffffff !important;
    border-right-color: #e2e8f0 !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-history-title {
    color: #0f172a !important;
    background-image: none !important;
    font-weight: 700 !important;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.08em;
  }
  #cs-dashboard.cs-theme-light .cs-chat-history-item {
    color: #334155 !important;
    border-radius: 8px;
  }
  #cs-dashboard.cs-theme-light .cs-chat-history-item:hover {
    background: #f1f5f9 !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-history-item-active {
    background: #f0f9ff !important;
    border-left: 3px solid #0ea5e9 !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-history-item-title {
    color: #1e293b !important;
    background-image: none !important;
    font-weight: 500;
    font-size: 13px;
  }
  #cs-dashboard.cs-theme-light .cs-chat-history-item-preview {
    color: #64748b !important;
    background-image: none !important;
    font-size: 11px;
  }
  #cs-dashboard.cs-theme-light .cs-chat-history-empty {
    color: #94a3b8 !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-history-new-btn {
    background: #ffffff !important;
    border: 1px solid #e2e8f0 !important;
    color: #0ea5e9 !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-history-new-btn:hover {
    background: #f0f9ff !important;
    border-color: #7dd3fc !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-history-item-del:hover {
    background: #fee2e2 !important;
    color: #ef4444 !important;
  }
  /* 深色模式 */
  #cs-dashboard.cs-theme-dark .cs-chat-history-panel {
    background: #0f172a !important;
    border-right-color: rgba(148, 163, 184, 0.15) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-title {
    color: #38bdf8 !important;
    background-image: none !important;
    font-weight: 700 !important;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.08em;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-item {
    color: #cbd5e1 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-item:hover {
    background: rgba(56, 189, 248, 0.08) !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-item-active {
    background: rgba(56, 189, 248, 0.12) !important;
    border-left: 3px solid #38bdf8 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-item-title {
    color: #f1f5f9 !important;
    background-image: none !important;
    font-weight: 500;
    font-size: 13px;
    display: block;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-item-preview {
    color: #94a3b8 !important;
    background-image: none !important;
    font-size: 11px;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-empty {
    color: #64748b !important;
    background-image: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-new-btn {
    background: #1e293b !important;
    border: 1px solid rgba(56, 189, 248, 0.3) !important;
    color: #38bdf8 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-new-btn:hover {
    background: rgba(56, 189, 248, 0.1) !important;
    border-color: #38bdf8 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-history-item-del:hover {
    background: rgba(239, 68, 68, 0.15) !important;
    color: #f87171 !important;
  }

  /* ═══ 终局颜色修复：AI 气泡所有文字统一实色，拒绝渐变/透明 ═══ */
  /* 浅色模式：深灰色文字，确保可读 */
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai * {
    color: #1e293b !important;
    background-image: none !important;
    -webkit-text-fill-color: initial !important;
    text-shadow: none !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai code {
    background: #e2e8f0 !important;
    color: #0f172a !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai a {
    color: #0284c7 !important;
  }
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai strong,
  #cs-dashboard.cs-theme-light .cs-chat-bubble-ai b {
    color: #0f172a !important;
  }
  /* 深色模式：浅冰蓝色文字 */
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai * {
    color: #e0f2fe !important;
    background-image: none !important;
    -webkit-text-fill-color: initial !important;
    text-shadow: none !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai code {
    background: #1e293b !important;
    color: #7dd3fc !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai a {
    color: #38bdf8 !important;
  }
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai strong,
  #cs-dashboard.cs-theme-dark .cs-chat-bubble-ai b {
    color: #f1f5f9 !important;
  }

  /* ─── Command Layer (Ctrl+K palette + context menu) ── */
  .cs-cmd-overlay { position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,0.3);display:flex;align-items:flex-start;justify-content:center;padding-top:15vh; }
  .cs-cmd-overlay.cs-hidden { display:none; }
  .cs-cmd-palette { background:var(--cs-bg,#fff);border:1px solid var(--cs-border,#e5e7eb);border-radius:14px;width:420px;max-height:50vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,0.2);overflow:hidden; }
  .cs-cmd-input { width:100%;padding:14px 18px;font-size:15px;border:none;border-bottom:1px solid var(--cs-divider,#eee);background:transparent;color:var(--cs-text,#333);outline:none;box-sizing:border-box; }
  .cs-cmd-input::placeholder { color:var(--cs-text-secondary,#888); }
  .cs-cmd-list { overflow-y:auto;padding:6px; }
  .cs-cmd-item { padding:10px 14px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:14px;color:var(--cs-text,#333); }
  .cs-cmd-item:hover,.cs-cmd-item.cs-cmd-highlight { background:var(--cs-accent,#2563eb);color:#fff; }
  .cs-cmd-item .cs-cmd-key { margin-left:auto;font-size:11px;opacity:0.5;font-family:monospace; }

  #__CS_DEBUG_PANEL_CSS_PLACEHOLDER__
`;
