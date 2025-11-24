import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('info-menu')
export class InfoMenu extends LitElement {
  @state() private menuOpen = false;
  
  connectedCallback() {
    super.connectedCallback();
    // Listen for clicks on document to close menu
    document.addEventListener('click', this.handleClickOutside);
  }
  
  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up listener
    document.removeEventListener('click', this.handleClickOutside);
  }
  
  private handleClickOutside = (event: MouseEvent) => {
    // Check if click is outside this component
    if (this.menuOpen && !event.composedPath().includes(this)) {
      this.menuOpen = false;
    }
  };
  
  static styles = css`
    :host {
      position: relative;
      display: inline-block;
    }
    
    .menu-popup {
      position: absolute;
      bottom: 64px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--surface);
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 100;
      min-width: 220px;
    }
    
    .menu-popup.hidden {
      display: none;
    }
    
    .action-button {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--on-surface);
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
      font-size: 14px;
    }
    
    .action-button:hover {
      background: var(--surface-variant);
    }
    
    .material-icons {
      font-family: 'Material Icons';
      font-weight: normal;
      font-style: normal;
      font-size: 20px;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      -webkit-font-feature-settings: 'liga';
      -moz-font-feature-settings: 'liga';
      font-feature-settings: 'liga';
      -webkit-font-smoothing: antialiased;
    }
  `;
  
  toggleMenu(e?: MouseEvent) {
    if (e) {
      e.stopPropagation(); // Prevent immediate close from document click
    }
    this.menuOpen = !this.menuOpen;
  }
  
  closeMenu() {
    this.menuOpen = false;
  }
  
  handleExplain() {
    this.dispatchEvent(new CustomEvent('info-explain'));
    this.closeMenu();
  }
  
  handleUpcoming() {
    this.dispatchEvent(new CustomEvent('info-upcoming'));
    this.closeMenu();
  }
  
  render() {
    return html`
      <div class="menu-popup ${this.menuOpen ? '' : 'hidden'}">
        <button class="action-button" @click=${this.handleExplain}>
          <span class="material-icons">help_outline</span>
          <span>Explain why this song is playing</span>
        </button>
        <button class="action-button" @click=${this.handleUpcoming}>
          <span class="material-icons">queue_music</span>
          <span>Show upcoming songs</span>
        </button>
      </div>
    `;
  }
}

