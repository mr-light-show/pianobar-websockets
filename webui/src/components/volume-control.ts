import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Convert slider percentage (0-100) to decibels (-40 to maxGain)
 * Uses perceptual curve: squared for bottom half, linear for top half
 * Only used in player mode.
 */
function sliderToDb(sliderPercent: number, maxGain: number = 10): number {
  if (sliderPercent <= 50) {
    // Bottom half: -40 to 0 dB
    const normalized = sliderPercent / 50;
    return -40 * Math.pow(1 - normalized, 2);
  } else {
    // Top half: 0 to maxGain dB
    const normalized = (sliderPercent - 50) / 50;
    return maxGain * normalized;
  }
}

/**
 * Convert decibels (-40 to maxGain) to slider percentage (0-100)
 * Only used in player mode.
 */
function dbToSlider(db: number, maxGain: number = 10): number {
  if (db <= 0) {
    // Bottom half: -40 to 0 dB maps to 0-50%
    const normalized = 1 - Math.sqrt(db / -40);
    return normalized * 50;
  } else {
    // Top half: 0 to maxGain dB maps to 50-100%
    const normalized = db / maxGain;
    return 50 + (normalized * 50);
  }
}

@customElement('volume-control')
export class VolumeControl extends LitElement {
  @property({ type: Number }) volume = 50;
  @property({ type: Number }) maxGain = 10;
  @property({ type: String }) volumeMode: 'player' | 'system' = 'player';
  
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
    const sliderPercent = parseInt(target.value);
    this.volume = sliderPercent;
    
    this.dispatchEvent(new CustomEvent('volume-change', {
      detail: { 
        percent: sliderPercent,
        // In system mode, percent is the actual value; in player mode, include dB
        db: this.volumeMode === 'system' ? null : Math.round(sliderToDb(sliderPercent, this.maxGain))
      }
    }));
  }
  
  // Method to update from server value
  // In player mode: value is dB, needs conversion to slider position
  // In system mode: value is already percentage, use directly
  updateFromServer(value: number) {
    if (this.volumeMode === 'system') {
      // System mode: value is 0-100%, use directly
      this.volume = Math.max(0, Math.min(100, value));
    } else {
      // Player mode: value is dB, convert to slider position
      this.volume = Math.round(dbToSlider(value, this.maxGain));
    }
  }
  
  // Legacy method for compatibility
  updateFromDb(db: number) {
    if (this.volumeMode === 'system') {
      // In system mode, treat as percentage
      this.volume = Math.max(0, Math.min(100, db));
    } else {
      this.volume = Math.round(dbToSlider(db, this.maxGain));
    }
  }
  
  render() {
    let displayValue: string;
    
    if (this.volumeMode === 'system') {
      // System mode: just show percentage
      displayValue = `${this.volume}%`;
    } else {
      // Player mode: show percentage and dB
      const db = Math.round(sliderToDb(this.volume, this.maxGain));
      const dbDisplay = db >= 0 ? `+${db}` : `${db}`;
      displayValue = `${this.volume}% (${dbDisplay}dB)`;
    }
    
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
      <span class="volume-value">${displayValue}</span>
    `;
  }
}

