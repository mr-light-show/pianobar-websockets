import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('play-station-modal')
export class PlayStationModal extends LitElement {
  @property({ type: Boolean }) open = false;
  @property({ type: String }) stationName = '';
  
  handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      this.handleCancel();
    }
  }
  
  handlePlay() {
    this.dispatchEvent(new CustomEvent('play'));
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
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .message {
      font-size: 16px;
      color: var(--on-surface);
      text-align: center;
      line-height: 1.5;
    }
    
    .station-name {
      font-weight: 600;
      color: var(--primary);
    }
    
    .buttons {
      display: flex;
      gap: 12px;
      margin-top: 8px;
    }
    
    button {
      flex: 1;
      padding: 14px 20px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .play-button {
      background: var(--primary);
      color: var(--on-primary);
    }
    
    .play-button:hover {
      background: var(--primary-container);
      color: var(--on-primary-container);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
    
    .cancel-button {
      background: var(--surface-variant);
      color: var(--on-surface);
    }
    
    .cancel-button:hover {
      background: var(--surface-container-high);
    }
  `;
  
  render() {
    return html`
      <div class="backdrop" @click=${this.handleBackdropClick}></div>
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Station Created!</h2>
        </div>
        <div class="modal-body">
          <p class="message">
            Play <span class="station-name">${this.stationName}</span> now?
          </p>
          <div class="buttons">
            <button class="cancel-button" @click=${this.handleCancel}>
              Later
            </button>
            <button class="play-button" @click=${this.handlePlay}>
              Play Now
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

