import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('create-station-modal')
export class CreateStationModal extends LitElement {
  @property({ type: Boolean }) open = false;
  
  handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      this.handleCancel();
    }
  }
  
  handleSong() {
    this.dispatchEvent(new CustomEvent('select-song'));
  }
  
  handleArtist() {
    this.dispatchEvent(new CustomEvent('select-artist'));
  }
  
  handleCancel() {
    this.dispatchEvent(new CustomEvent('cancel'));
  }
  
  static styles = css`
    :host {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 2000;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 80px;
    }
    
    :host([open]) {
      display: flex;
    }
    
    .backdrop {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
    }
    
    .modal {
      position: relative;
      background: var(--surface);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      max-width: 400px;
      width: 90%;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--outline);
      overflow: hidden;
    }
    
    .modal-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--outline);
    }
    
    .modal-title {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
      color: var(--on-surface);
    }
    
    .modal-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .action-button {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border: none;
      border-radius: 8px;
      background: var(--surface-variant);
      color: var(--on-surface);
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
      font-size: 16px;
    }
    
    .action-button:hover {
      background: var(--surface-container-highest);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
    
    .action-button.cancel {
      color: var(--error);
      background: transparent;
      border: 1px solid var(--outline);
    }
    
    .action-button.cancel:hover {
      background: rgba(255, 0, 0, 0.1);
      border-color: var(--error);
    }
    
    .material-icons {
      font-family: 'Material Icons';
      font-weight: normal;
      font-style: normal;
      font-size: 24px;
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
  
  render() {
    return html`
      <div class="backdrop" @click=${this.handleBackdropClick}></div>
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Create Station From</h2>
        </div>
        <div class="modal-body">
          <button class="action-button" @click=${this.handleSong}>
            <span class="material-icons">music_note</span>
            <span>Song</span>
          </button>
          <button class="action-button" @click=${this.handleArtist}>
            <span class="material-icons">person</span>
            <span>Artist</span>
          </button>
          <button class="action-button cancel" @click=${this.handleCancel}>
            <span class="material-icons">close</span>
            <span>Cancel</span>
          </button>
        </div>
      </div>
    `;
  }
}

