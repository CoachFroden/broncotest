(() => {
  const STYLE_ID = 'bronco-player-picker-style';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .filter-select { position: relative; }
      .filter-select > select#playerFilter {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        opacity: 0 !important;
        pointer-events: none !important;
        overflow: hidden !important;
        clip: rect(0 0 0 0) !important;
        clip-path: inset(50%) !important;
      }
      .bronco-player-picker { position: relative; width: 100%; }
      .bronco-picker-trigger {
        width: 100%; min-height: 46px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 0 14px; border: 1px solid rgba(83,232,255,.42); border-radius: 15px;
        background: rgba(12,20,31,.96); color: var(--text); font-size: 13px; font-weight: 850;
        text-align: left; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(83,232,255,.035);
        -webkit-tap-highlight-color: transparent;
      }
      .bronco-picker-trigger:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }
      .bronco-picker-chevron { color: var(--cyan); font-size: 13px; transition: transform .18s ease; }
      .bronco-player-picker.open .bronco-picker-chevron { transform: rotate(180deg); }
      .bronco-picker-menu {
        position: absolute; z-index: 80; top: calc(100% + 7px); left: 0; right: 0;
        max-height: min(58vh, 410px); overflow-y: auto; overscroll-behavior: contain;
        padding: 7px; border: 1px solid rgba(83,232,255,.25); border-radius: 17px;
        background: rgba(8,14,23,.985); box-shadow: 0 24px 70px rgba(0,0,0,.58), inset 0 0 0 1px rgba(255,255,255,.025);
        backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
        opacity: 0; transform: translateY(-6px) scale(.985); pointer-events: none;
        transition: opacity .16s ease, transform .16s ease;
        scrollbar-width: thin;
      }
      .bronco-player-picker.open .bronco-picker-menu { opacity: 1; transform: none; pointer-events: auto; }
      .bronco-picker-option {
        width: 100%; min-height: 44px; display: flex; align-items: center; justify-content: space-between;
        padding: 0 12px; border: 0; border-radius: 12px; background: transparent; color: #dce5f2;
        font-size: 13px; font-weight: 800; text-align: left; cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .bronco-picker-option + .bronco-picker-option { margin-top: 2px; }
      .bronco-picker-option:active { background: rgba(255,255,255,.06); }
      .bronco-picker-option.selected {
        color: var(--lime); background: linear-gradient(135deg, rgba(200,255,61,.12), rgba(83,232,255,.07));
        box-shadow: inset 0 0 0 1px rgba(200,255,61,.19);
      }
      .bronco-picker-option.selected::after { content: '✓'; color: var(--lime); font-weight: 1000; }
      @media (max-width: 600px) {
        .filter-select { width: 100% !important; }
        .bronco-picker-trigger { min-height: 50px; font-size: 14px; border-radius: 14px; }
        .bronco-picker-menu { max-height: 52vh; border-radius: 16px; }
        .bronco-picker-option { min-height: 48px; font-size: 14px; }
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceSelect() {
    const select = document.getElementById('playerFilter');
    if (!select || select.dataset.customPicker === '1') return;

    injectStyles();
    select.dataset.customPicker = '1';

    const picker = document.createElement('div');
    picker.className = 'bronco-player-picker';
    picker.innerHTML = `
      <button type="button" class="bronco-picker-trigger" aria-haspopup="listbox" aria-expanded="false">
        <span class="bronco-picker-label">Alle</span><span class="bronco-picker-chevron">⌄</span>
      </button>
      <div class="bronco-picker-menu" role="listbox"></div>`;
    select.insertAdjacentElement('afterend', picker);

    const trigger = picker.querySelector('.bronco-picker-trigger');
    const label = picker.querySelector('.bronco-picker-label');
    const menu = picker.querySelector('.bronco-picker-menu');

    function close() {
      picker.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }

    function open() {
      picker.classList.add('open');
      trigger.setAttribute('aria-expanded', 'true');
      requestAnimationFrame(() => menu.querySelector('.selected')?.scrollIntoView({ block: 'nearest' }));
    }

    function sync() {
      const options = [...select.options];
      label.textContent = select.selectedOptions[0]?.textContent || 'Alle';
      menu.innerHTML = options.map(option => {
        const selected = option.value === select.value;
        return `<button type="button" class="bronco-picker-option${selected ? ' selected' : ''}" role="option" aria-selected="${selected}" data-value="${option.value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}">${option.textContent.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</button>`;
      }).join('');
    }

    trigger.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      picker.classList.contains('open') ? close() : open();
    });

    menu.addEventListener('click', event => {
      const option = event.target.closest('.bronco-picker-option');
      if (!option) return;
      select.value = option.dataset.value;
      sync();
      close();
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    select.addEventListener('change', sync);

    new MutationObserver(sync).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['selected'] });

    document.addEventListener('click', event => {
      if (!picker.contains(event.target)) close();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') close();
    });

    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceSelect, { once: true });
  } else {
    enhanceSelect();
  }
})();
