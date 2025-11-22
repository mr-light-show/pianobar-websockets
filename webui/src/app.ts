import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SocketService } from './services/socket-service';

import './components/album-art';
import './components/progress-bar';
import './components/playback-controls';
import './components/volume-control';
import './components/stations-menu';

@customElement('pianobar-app')
export class PianobarApp extends LitElement {
  private socket = new SocketService();
  
  @state() private albumArt = '';
  @state() private songTitle = 'Not Playing';
  @state() private artistName = '—';
  @state() private playing = false;
  @state() private currentTime = 0;
  @state() private totalTime = 0;
  @state() private volume = 100;
  @state() private stations: any[] = [];
  @state() private currentStation = '';
  
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--background);
      color: var(--on-background);
      padding-bottom: 5rem;
    }
    
    .song-info {
      text-align: center;
      padding: 1rem 2rem;
      max-width: 32rem;
      margin: 0 auto;
    }
    
    h1 {
      font-size: 1.5rem;
      font-weight: 500;
      margin: 0.5rem 0;
    }
    
    .artist {
      color: var(--on-surface-variant);
      margin: 0;
    }
  `;
  
  connectedCallback() {
    super.connectedCallback();
    this.setupSocketListeners();
  }
  
  setupSocketListeners() {
    this.socket.on('start', (data) => {
      this.albumArt = data.coverArt;
      this.songTitle = data.title;
      this.artistName = data.artist;
      this.totalTime = data.duration;
      this.playing = true;
    });
    
    this.socket.on('progress', (data) => {
      this.currentTime = data.elapsed;
      this.totalTime = data.duration;
    });
    
    this.socket.on('stations', (data) => {
      this.stations = data.stations;
    });
  }
  
  handlePlayPause() {
    this.socket.emit('action', { action: 'playback.toggle' });
  }
  
  handleNext() {
    this.socket.emit('action', { action: 'playback.next' });
  }
  
  handleVolumeChange(e: CustomEvent) {
    const { volume } = e.detail;
    this.volume = volume;
    // TODO: Implement volume command
  }
  
  render() {
    return html`
      <album-art src="${this.albumArt}"></album-art>
      
      <div class="song-info">
        <h1>${this.songTitle}</h1>
        <p class="artist">${this.artistName}</p>
      </div>
      
      <progress-bar 
        current="${this.currentTime}"
        total="${this.totalTime}"
      ></progress-bar>
      
      <playback-controls 
        ?playing="${this.playing}"
        @play=${this.handlePlayPause}
        @next=${this.handleNext}
      ></playback-controls>
      
      <volume-control 
        volume="${this.volume}"
        @volume-change=${this.handleVolumeChange}
      ></volume-control>
    `;
  }
}

