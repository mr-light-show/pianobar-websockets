import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('volume-control')
export class VolumeControl extends LitElement {
  @property({ type: Number }) volume = 100;
  
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 1rem;
      max-width: 32rem;
      margin: 0 auto;
      padding: 0 2rem;
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
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--primary-color);
      cursor: pointer;
    }
    
    input[type="range"]::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--primary-color);
      cursor: pointer;
      border: none;
    }
    
    .volume-value {
      min-width: 3rem;
      text-align: right;
      color: var(--on-surface-variant);
    }
  `;
  
  handleVolumeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    this.volume = parseInt(target.value);
    this.dispatchEvent(new CustomEvent('volume-change', {
      detail: { volume: this.volume }
    }));
  }
  
  render() {
    return html`
      <span class="material-icons">volume_up</span>
      <input 
        type="range" 
        min="0" 
        max="100" 
        step="5"
        .value="${this.volume}"
        @input=${this.handleVolumeChange}
      >
      <span class="volume-value">${this.volume}%</span>
    `;
  }
}

