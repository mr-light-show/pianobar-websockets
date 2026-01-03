import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('volume-control')
export class VolumeControl extends LitElement {
  @property({ type: Number }) volume = 50;  // 0-100%
  
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: clamp(0.5rem, 2vw, 1rem);
      max-width: clamp(16rem, 85vw, 32rem);
      margin: 0 auto;
      padding: 0 clamp(1rem, 4vw, 2rem);
    }
    
    .material-icons {
      font-family: 'Material Icons';
      font-weight: normal;
      font-style: normal;
      font-size: clamp(12px, 3vw, 24px);
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      color: var(--on-surface);
      -webkit-font-feature-settings: 'liga';
      -moz-font-feature-settings: 'liga';
      font-feature-settings: 'liga';
      -webkit-font-smoothing: antialiased;
    }
    
    input[type="range"] {
      flex: 1;
      height: 4px;
      -webkit-appearance: none;
      appearance: none;
      background: var(--surface-variant);
      border-radius: 2px;
      outline: none;
    }
    
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: clamp(8px, 2vw, 16px);
      height: clamp(8px, 2vw, 16px);
      border-radius: 50%;
      background: var(--primary-color);
      cursor: pointer;
    }
    
    input[type="range"]::-moz-range-thumb {
      width: clamp(8px, 2vw, 16px);
      height: clamp(8px, 2vw, 16px);
      border-radius: 50%;
      background: var(--primary-color);
      cursor: pointer;
      border: none;
    }
    
    .volume-value {
      min-width: clamp(1.5rem, 6vw, 3rem);
      text-align: right;
      color: var(--on-surface-variant);
      font-size: clamp(0.5rem, 2vw, 0.875rem);
    }
  `;
  
  handleVolumeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    this.volume = parseInt(target.value);
    
    this.dispatchEvent(new CustomEvent('volume-change', {
      detail: { volume: this.volume }
    }));
  }
  
  // Update volume from server value (0-100%)
  updateFromServer(value: number) {
    this.volume = Math.max(0, Math.min(100, Math.round(value)));
  }
  
  render() {
    return html`
      <span class="material-icons">volume_up</span>
      <input 
        type="range" 
        min="0" 
        max="100" 
        step="1"
        .value="${this.volume}"
        @input=${this.handleVolumeChange}
      >
      <span class="volume-value">${this.volume}%</span>
    `;
  }
}
