/**
 * Reusable, dynamic modal system for Project Synapse.
 * Generates Tailwind-styled modals with bright premium native app UI,
 * proper accessibility features, and keyboard/mouse listeners.
 */

class SynapseModal {
  constructor(options = {}) {
    this.title = options.title || 'Notification';
    this.body = options.body || '';
    this.buttons = options.buttons || [];
    this.onClose = options.onClose || null;
    
    // Internal DOM references
    this.backdropEl = null;
    this.modalEl = null;
    
    // Bind event handlers once for clean GC removal
    this._boundKeydown = this.handleKeyDown.bind(this);
    this.close = this.close.bind(this);
  }

  /**
   * Builds the modal and mounts it to the DOM
   */
  open() {
    // 1. Create the Backdrop Overlay
    this.backdropEl = document.createElement('div');
    this.backdropEl.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm opacity-0 transition-opacity duration-200';
    
    // Trigger entrance animation for backdrop
    requestAnimationFrame(() => {
      this.backdropEl.classList.remove('opacity-0');
      this.backdropEl.classList.add('opacity-100');
    });

    // Close on backdrop click (but not when clicking the modal card itself)
    this.backdropEl.addEventListener('click', (e) => {
      if (e.target === this.backdropEl) {
        this.close();
      }
    });

    // 2. Create the Modal Glass Panel
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'relative w-full max-w-md bg-white border border-gray-100 rounded-3xl shadow-xl shadow-gray-200/50 p-6 overflow-hidden transform scale-95 opacity-0 transition-all duration-300 flex flex-col gap-4';
    
    // Trigger entrance animation for modal card
    requestAnimationFrame(() => {
      this.modalEl.classList.remove('scale-95', 'opacity-0');
      this.modalEl.classList.add('scale-100', 'opacity-100');
    });

    // 3. Header Section (Title + Close Button)
    const headerEl = document.createElement('div');
    headerEl.className = 'flex items-center justify-between border-b border-gray-100 pb-3';

    const titleEl = document.createElement('h3');
    titleEl.className = 'text-xl font-bold text-gray-900 tracking-tight font-outfit';
    titleEl.textContent = this.title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'text-gray-400 hover:text-gray-900 hover:bg-gray-100 p-2 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50';
    closeBtn.setAttribute('aria-label', 'Close Modal');
    closeBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    `;
    closeBtn.addEventListener('click', this.close);

    headerEl.appendChild(titleEl);
    headerEl.appendChild(closeBtn);
    this.modalEl.appendChild(headerEl);

    // 4. Body Content Section (Supports HTML string or DOM node)
    const bodyEl = document.createElement('div');
    bodyEl.className = 'text-gray-600 text-sm leading-relaxed my-2 overflow-y-auto max-h-[60vh]';

    if (this.body instanceof HTMLElement) {
      bodyEl.appendChild(this.body);
    } else {
      bodyEl.innerHTML = this.body;
    }
    this.modalEl.appendChild(bodyEl);

    // 5. Footer Actions Section
    const footerEl = document.createElement('div');
    footerEl.className = 'flex items-center justify-end gap-3 mt-2 border-t border-gray-100 pt-4';

    // If no custom buttons, inject a default primary close button
    const buttonsToRender = this.buttons.length > 0 ? this.buttons : [{ text: 'Close', type: 'secondary' }];

    buttonsToRender.forEach(btnConfig => {
      const btn = document.createElement('button');
      btn.textContent = btnConfig.text;
      
      // Determine styling class based on button type
      let styleClass = '';
      if (btnConfig.type === 'primary') {
        styleClass = 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20';
      } else if (btnConfig.type === 'danger') {
        styleClass = 'bg-red-50 hover:bg-red-100 text-red-700';
      } else {
        // Default secondary button
        styleClass = 'bg-gray-100 hover:bg-gray-200 text-gray-700';
      }

      btn.className = `px-5 py-3 rounded-2xl text-sm font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 active:scale-95 ${styleClass}`;
      
      btn.addEventListener('click', (e) => {
        if (typeof btnConfig.onClick === 'function') {
          btnConfig.onClick(this, e);
        } else {
          this.close();
        }
      });
      
      footerEl.appendChild(btn);
    });

    this.modalEl.appendChild(footerEl);
    this.backdropEl.appendChild(this.modalEl);
    document.body.appendChild(this.backdropEl);

    // 6. Focus Trap & Key Listeners
    window.addEventListener('keydown', this._boundKeydown);

    // Prevent body scrolling (Android-compatible fixed pattern)
    this._savedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + this._savedScrollY + 'px';
    document.body.style.width = '100%';
  }

  /**
   * Dismisses and removes the modal with clean fade-out transitions
   */
  close() {
    if (!this.backdropEl) return;

    // Trigger exit animation styles
    this.backdropEl.classList.add('opacity-0');
    this.backdropEl.classList.remove('opacity-100');
    
    this.modalEl.classList.add('scale-95', 'opacity-0');
    this.modalEl.classList.remove('scale-100', 'opacity-100');

    // Wait for transition to complete before removing from DOM
    setTimeout(() => {
      if (this.backdropEl && this.backdropEl.parentNode) {
        this.backdropEl.parentNode.removeChild(this.backdropEl);
      }
      
      // Cleanup events
      window.removeEventListener('keydown', this._boundKeydown);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, this._savedScrollY || 0);
      
      // Trigger optional close callback
      if (typeof this.onClose === 'function') {
        this.onClose();
      }
    }, 200); // Matches duration-200 backdrop transition
  }

  /**
   * Catch key presses to dismiss on Escape
   */
  handleKeyDown(e) {
    if (e.key === 'Escape') {
      this.close();
    }
  }
}

/**
 * Convenience function to quickly trigger a modal
 * @param {Object} options - Modal options
 * @returns {SynapseModal}
 */
export function showModal(options) {
  const modal = new SynapseModal(options);
  modal.open();
  return modal;
}
