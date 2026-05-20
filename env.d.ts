/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'qrcode' {
  const QRCode: {
    toCanvas(
      canvas: HTMLCanvasElement,
      text: string,
      options?: { width?: number; errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }
    ): Promise<void>
    toDataURL(text: string, options?: { width?: number; errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }): Promise<string>
  }
  export default QRCode
}

declare module 'html5-qrcode' {
  export class Html5Qrcode {
    constructor(elementId: string)
    start(
      cameraIdOrConfig: string | { facingMode: string },
      config: { fps: number; qrbox: { width: number; height: number } },
      onScanSuccess: (decodedText: string) => void,
      onScanFailure: () => void
    ): Promise<void>
    stop(): Promise<void>
  }
}
