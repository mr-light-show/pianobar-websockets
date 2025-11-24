import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface Station {
  id: string;
  name: string;
  isQuickMix: boolean;
  isQuickMixed: boolean;
}

@customElement('quickmix-modal')
export class QuickMixModal extends LitElement {
  @property({ type: Array }) stations: Station[] = [];
  @property({ type: Boolean }) open = false;
  @state() private selectedStationIds: Set<string> = new Set();
  
  connectedCallback() {
    super.connectedCallback();
    // Initialize selected stations from current QuickMix state
    this.initializeSelection();
  }
  
  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('stations') || changedProperties.has('open')) {
      this.initializeSelection();
    }
  }
  
  initializeSelection() {
    this.selectedStationIds = new Set(
      this.stations
        .filter(s => s.isQuickMixed && !s.isQuickMix)
        .map(s => s.id)
    );
  }
  
  handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      this.handleCancel();
    }
  }
  
  handleCheckboxChange(stationId: string, checked: boolean) {
    if (checked) {
      this.selectedStationIds.add(stationId);
    } else {
      this.selectedStationIds.delete(stationId);
    }
    this.requestUpdate();
  }
  
  handleCancel() {
    this.dispatchEvent(new CustomEvent('cancel'));
  }
  
  handleSave() {
    const stationIds = Array.from(this.selectedStationIds);
    this.dispatchEvent(new CustomEvent('save', {
      detail: { stationIds }
    }));
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
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--outline);
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
    
    .station-item label {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      flex: 1;
      user-select: none;
    }
    
    .station-item input[type="checkbox"] {
      width: 20px;
      height: 20px;
      cursor: pointer;
      accent-color: var(--primary);
    }
    
    .station-name {
      font-size: 14px;
      color: var(--on-surface);
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
    
    .button-save {
      background: var(--primary);
      color: var(--on-primary);
    }
    
    .button-save:hover {
      background: var(--primary-container);
      color: var(--on-primary-container);
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
    // Filter out the QuickMix station itself
    const selectableStations = this.stations.filter(s => !s.isQuickMix);
    
    return html`
      <div class="backdrop" @click=${this.handleBackdropClick}></div>
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">Select QuickMix Stations</h2>
        </div>
        <div class="modal-body">
          <div class="station-list">
            ${selectableStations.map(station => html`
              <div class="station-item">
                <label>
                  <input
                    type="checkbox"
                    .checked=${this.selectedStationIds.has(station.id)}
                    @change=${(e: Event) => 
                      this.handleCheckboxChange(station.id, (e.target as HTMLInputElement).checked)
                    }
                  />
                  <span class="station-name">${station.name}</span>
                </label>
              </div>
            `)}
          </div>
        </div>
        <div class="modal-footer">
          <button class="button-cancel" @click=${this.handleCancel}>
            Cancel
          </button>
          <button class="button-save" @click=${this.handleSave}>
            Save
          </button>
        </div>
      </div>
    `;
  }
}

