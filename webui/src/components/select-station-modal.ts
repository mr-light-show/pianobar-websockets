import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface Station {
  id: string;
  name: string;
  isQuickMix: boolean;
}

@customElement('select-station-modal')
export class SelectStationModal extends LitElement {
  @property({ type: Boolean }) open = false;
  @property({ type: String }) title = 'Select Station';
  @property({ type: String }) confirmText = 'Select';
  @property({ type: Boolean }) confirmDanger = false;
  @property({ type: Array }) stations: Station[] = [];
  @property({ type: Boolean}) excludeQuickMix = false;
  @state() private selectedStationId: string | null = null;
  
  handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      this.handleCancel();
    }
  }
  
  handleStationSelect(stationId: string) {
    this.selectedStationId = stationId;
  }
  
  handleConfirm() {
    if (this.selectedStationId) {
      this.dispatchEvent(new CustomEvent('station-select', {
        detail: { stationId: this.selectedStationId }
      }));
      this.selectedStationId = null;
    }
  }
  
  handleCancel() {
    this.dispatchEvent(new CustomEvent('cancel'));
    this.selectedStationId = null;
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
      max-width: 500px;
      width: 90%;
      max-height: 60vh;
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
      padding: 16px 24px;
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }
    
    .station-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .station-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: var(--surface-variant);
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .station-item:hover {
      background: var(--surface-container-high);
    }
    
    .station-item.selected {
      background: var(--primary-container);
      color: var(--on-primary-container);
    }
    
    .station-item input[type="radio"] {
      width: 20px;
      height: 20px;
      cursor: pointer;
      accent-color: var(--primary);
    }
    
    .station-name {
      flex: 1;
      font-size: 14px;
      color: var(--on-surface);
    }
    
    .station-item.selected .station-name {
      color: var(--on-primary-container);
    }
    
    .modal-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--outline);
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }
    
    button {
      padding: 10px 24px;
      border: none;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .button-cancel {
      background: var(--surface-variant);
      color: var(--on-surface);
    }
    
    .button-cancel:hover {
      background: var(--surface-container-high);
    }
    
    .button-confirm {
      background: var(--primary);
      color: var(--on-primary);
    }
    
    .button-confirm:hover {
      background: var(--primary-container);
      color: var(--on-primary-container);
    }
    
    .button-confirm.danger {
      background: var(--error);
      color: var(--on-error);
    }
    
    .button-confirm.danger:hover {
      background: var(--error-container);
      color: var(--on-error-container);
    }
    
    .button-confirm:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    /* Scrollbar styling */
    .modal-body::-webkit-scrollbar {
      width: 8px;
    }
    
    .modal-body::-webkit-scrollbar-track {
      background: transparent;
    }
    
    .modal-body::-webkit-scrollbar-thumb {
      background: var(--outline);
      border-radius: 4px;
    }
    
    .modal-body::-webkit-scrollbar-thumb:hover {
      background: var(--on-surface-variant);
    }
  `;
  
  render() {
    const selectableStations = this.excludeQuickMix 
      ? this.stations.filter(s => !s.isQuickMix)
      : this.stations;
      
    return html`
      <div class="backdrop" @click=${this.handleBackdropClick}></div>
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">${this.title}</h2>
        </div>
        <div class="modal-body">
          <div class="station-list">
            ${selectableStations.length === 0 ? html`<p>No stations available.</p>` : ''}
            ${selectableStations.map(station => html`
              <div 
                class="station-item ${this.selectedStationId === station.id ? 'selected' : ''}"
                @click=${() => this.handleStationSelect(station.id)}
              >
                <input
                  type="radio"
                  name="station"
                  .checked=${this.selectedStationId === station.id}
                  @change=${() => this.handleStationSelect(station.id)}
                >
                <span class="station-name">${station.name}</span>
              </div>
            `)}
          </div>
        </div>
        <div class="modal-footer">
          <button class="button-cancel" @click=${this.handleCancel}>
            Cancel
          </button>
          <button 
            class="button-confirm ${this.confirmDanger ? 'danger' : ''}" 
            @click=${this.handleConfirm}
            ?disabled=${!this.selectedStationId}
          >
            ${this.confirmText}
          </button>
        </div>
      </div>
    `;
  }
}

