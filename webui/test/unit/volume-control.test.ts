import { describe, it, expect } from 'vitest';
import { fixture, html } from '@open-wc/testing';
import '../../src/components/volume-control';
import type { VolumeControl } from '../../src/components/volume-control';

describe('VolumeControl', () => {
  describe('rendering', () => {
    it('renders volume icon', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control></volume-control>
      `);

      const icon = element.shadowRoot!.querySelector('.material-icons');
      expect(icon).toBeTruthy();
      expect(icon!.textContent).toContain('volume_up');
    });

    it('renders slider input', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control></volume-control>
      `);

      const slider = element.shadowRoot!.querySelector('input[type="range"]');
      expect(slider).toBeTruthy();
    });

    it('renders volume value display', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control></volume-control>
      `);

      const valueDisplay = element.shadowRoot!.querySelector('.volume-value');
      expect(valueDisplay).toBeTruthy();
    });

    it('displays default volume of 50%', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control></volume-control>
      `);

      const valueDisplay = element.shadowRoot!.querySelector('.volume-value');
      expect(valueDisplay!.textContent).toBe('50%');
    });

    it('displays custom volume value', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control volume="75"></volume-control>
      `);

      const valueDisplay = element.shadowRoot!.querySelector('.volume-value');
      expect(valueDisplay!.textContent).toBe('75%');
    });

    it('sets slider min to 0', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control></volume-control>
      `);

      const slider = element.shadowRoot!.querySelector('input[type="range"]') as HTMLInputElement;
      expect(slider.min).toBe('0');
    });

    it('sets slider max to 100', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control></volume-control>
      `);

      const slider = element.shadowRoot!.querySelector('input[type="range"]') as HTMLInputElement;
      expect(slider.max).toBe('100');
    });

    it('sets slider value to volume prop', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control volume="60"></volume-control>
      `);

      const slider = element.shadowRoot!.querySelector('input[type="range"]') as HTMLInputElement;
      expect(slider.value).toBe('60');
    });
  });

  describe('slider interaction', () => {
    it('updates volume when slider is changed', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control volume="50"></volume-control>
      `);

      const slider = element.shadowRoot!.querySelector('input[type="range"]') as HTMLInputElement;
      slider.value = '75';
      slider.dispatchEvent(new Event('input'));
      await element.updateComplete;

      expect(element.volume).toBe(75);
    });

    it('updates display when slider is changed', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control volume="50"></volume-control>
      `);

      const slider = element.shadowRoot!.querySelector('input[type="range"]') as HTMLInputElement;
      slider.value = '75';
      slider.dispatchEvent(new Event('input'));
      await element.updateComplete;

      const valueDisplay = element.shadowRoot!.querySelector('.volume-value');
      expect(valueDisplay!.textContent).toBe('75%');
    });

    it('dispatches volume-change event with volume', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control volume="50"></volume-control>
      `);

      let eventDetail: any;
      element.addEventListener('volume-change', ((e: CustomEvent) => {
        eventDetail = e.detail;
      }) as EventListener);

      const slider = element.shadowRoot!.querySelector('input[type="range"]') as HTMLInputElement;
      slider.value = '75';
      slider.dispatchEvent(new Event('input'));

      expect(eventDetail.volume).toBe(75);
    });
  });

  describe('updateFromServer method', () => {
    it('updates volume from server value', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control volume="50"></volume-control>
      `);

      element.updateFromServer(75);
      await element.updateComplete;

      expect(element.volume).toBe(75);
    });

    it('updates display when updated from server', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control volume="50"></volume-control>
      `);

      element.updateFromServer(30);
      await element.updateComplete;

      const valueDisplay = element.shadowRoot!.querySelector('.volume-value');
      expect(valueDisplay!.textContent).toBe('30%');
    });

    it('clamps values below 0 to 0', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control volume="50"></volume-control>
      `);

      element.updateFromServer(-10);
      await element.updateComplete;

      expect(element.volume).toBe(0);
    });

    it('clamps values above 100 to 100', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control volume="50"></volume-control>
      `);

      element.updateFromServer(150);
      await element.updateComplete;

      expect(element.volume).toBe(100);
    });

    it('rounds fractional values', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control volume="50"></volume-control>
      `);

      element.updateFromServer(33.7);
      await element.updateComplete;

      expect(element.volume).toBe(34);
    });

    it('handles edge case: 0%', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control volume="50"></volume-control>
      `);

      element.updateFromServer(0);
      await element.updateComplete;

      expect(element.volume).toBe(0);
      const valueDisplay = element.shadowRoot!.querySelector('.volume-value');
      expect(valueDisplay!.textContent).toBe('0%');
    });

    it('handles edge case: 100%', async () => {
      const element: VolumeControl = await fixture(html`
        <volume-control volume="50"></volume-control>
      `);

      element.updateFromServer(100);
      await element.updateComplete;

      expect(element.volume).toBe(100);
      const valueDisplay = element.shadowRoot!.querySelector('.volume-value');
      expect(valueDisplay!.textContent).toBe('100%');
    });
  });
});
