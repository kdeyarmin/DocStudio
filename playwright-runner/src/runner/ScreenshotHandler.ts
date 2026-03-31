import type { Page } from 'playwright';

export class ScreenshotHandler {
  constructor(private page: Page) {}

  async capture(): Promise<Buffer | null> {
    try {
      const bytes = await this.page.screenshot({ type: 'png', fullPage: false });
      return Buffer.from(bytes);
    } catch (err) {
      console.error('[ScreenshotHandler] capture failed:', err);
      return null;
    }
  }

  async captureFullPage(): Promise<Buffer | null> {
    try {
      const bytes = await this.page.screenshot({ type: 'png', fullPage: true });
      return Buffer.from(bytes);
    } catch (err) {
      console.error('[ScreenshotHandler] full-page capture failed:', err);
      return null;
    }
  }
}
