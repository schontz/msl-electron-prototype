
export default class InsertableStreamWorker {
  private currentCryptoKey: string;
  private useCryptoOffset: boolean = true;
  private currentKeyIdentifier: number = 0;
  private scount = 0;
  private rcount = 0;


  private readonly frameTypeToCryptoOffset = {
    key: 10,
    delta: 3,
    undefined: 1,
  };

  dump(encodedFrame: any, direction: any, max = 16): void {
    console.log('*** dump::direction:', direction)
    const data = new Uint8Array(encodedFrame.data);
    let bytes = '';
    for (let j = 0; j < data.length && j < max; j++) {
      bytes += (data[j] < 16 ? '0' : '') + data[j].toString(16) + ' ';
    }
    const metadata = encodedFrame.getMetadata();
    console.log(
      performance.now().toFixed(2),
      direction,
      bytes.trim(),
      'len=' + encodedFrame.data.byteLength,
      'type=' + (encodedFrame.type || 'audio'),
      'ts=' + encodedFrame.timestamp,
      'ssrc=' + metadata.synchronizationSource,
      'pt=' + (metadata.payloadType || '(unknown)'),
      'mimeType=' + (metadata.mimeType || '(unknown)')
    );
  }

  encodeFunction(encodedFrame: any, controller: any): void{
    if (this.scount++ < 30) {
      // dump the first 30 packets.
      this.dump(encodedFrame, 'send');
    }
    if (this.currentCryptoKey) {
      const view = new DataView(encodedFrame.data);
      // Any length that is needed can be used for the new buffer.
      const newData = new ArrayBuffer(encodedFrame.data.byteLength + 5);
      const newView = new DataView(newData);
      const frameTypeToCryptoOffset = this.frameTypeToCryptoOffset;

      const cryptoOffset = this.useCryptoOffset
        ? frameTypeToCryptoOffset[
            encodedFrame.type as keyof typeof frameTypeToCryptoOffset
          ]
        : 0;
      for (let i = 0; i < cryptoOffset && i < encodedFrame.data.byteLength; ++i) {
        newView.setInt8(i, view.getInt8(i));
      }
      // This is a bitwise xor of the key with the payload. This is not strong encryption, just a demo.
      for (let i = cryptoOffset; i < encodedFrame.data.byteLength; ++i) {
        const keyByte = this.currentCryptoKey.charCodeAt(i % this.currentCryptoKey.length);
        newView.setInt8(i, view.getInt8(i) ^ keyByte);
      }
      // Append keyIdentifier.
      newView.setUint8(encodedFrame.data.byteLength, this.currentKeyIdentifier % 0xff);
      // Append checksum
      newView.setUint32(encodedFrame.data.byteLength + 1, 0xdeadbeef);

      encodedFrame.data = newData;
    }
    controller.enqueue(encodedFrame);
  }

  decodeFunction(encodedFrame: any, controller: any) {
    if (this.rcount++ < 30) {
      // dump the first 30 packets
      this.dump(encodedFrame, 'recv');
    }
    const view = new DataView(encodedFrame.data);
    const checksum =
      encodedFrame.data.byteLength > 4 ? view.getUint32(encodedFrame.data.byteLength - 4) : false;
    if (this.currentCryptoKey) {
      if (checksum !== 0xdeadbeef) {
        console.log('Corrupted frame received, checksum ' + checksum.toString(16));
        return; // This can happen when the key is set and there is an unencrypted frame in-flight.
      }
      const keyIdentifier = view.getUint8(encodedFrame.data.byteLength - 5);
      if (keyIdentifier !== this.currentKeyIdentifier) {
        console.log(
          `Key identifier mismatch, got ${keyIdentifier} expected ${this.currentKeyIdentifier}.`
        );
        return;
      }

      const newData = new ArrayBuffer(encodedFrame.data.byteLength - 5);
      const newView = new DataView(newData);
      const frameTypeToCryptoOffset = this.frameTypeToCryptoOffset;
      const cryptoOffset = this.useCryptoOffset
        ? frameTypeToCryptoOffset[
            encodedFrame.type as keyof typeof frameTypeToCryptoOffset
          ]
        : 0;

      for (let i = 0; i < cryptoOffset; ++i) {
        newView.setInt8(i, view.getInt8(i));
      }
      for (let i = cryptoOffset; i < encodedFrame.data.byteLength - 5; ++i) {
        const keyByte = this.currentCryptoKey.charCodeAt(i % this.currentCryptoKey.length);
        newView.setInt8(i, view.getInt8(i) ^ keyByte);
      }
      encodedFrame.data = newData;
    } else if (checksum === 0xdeadbeef) {
      return; // encrypted in-flight frame but we already forgot about the key.
    }
    controller.enqueue(encodedFrame);
  }

  handleTransform(operation: any, readable: any, writable: any) {
    if (operation === 'encode') {
      const transformStream = new TransformStream({
        transform: (encodedFrame, controller) => this.encodeFunction(encodedFrame, controller),
      });
      readable.pipeThrough(transformStream).pipeTo(writable);
    } else if (operation === 'decode') {
      const transformStream = new TransformStream({
        transform: (encodedFrame, controller) => this.decodeFunction(encodedFrame, controller),
      });
      readable.pipeThrough(transformStream).pipeTo(writable);
    }
  }

  static initializeWorker(): void {
    console.log(`Insertable stream worker initializing`)
    const worker = new InsertableStreamWorker();
    self.onmessage = (event: MessageEvent) => {
      if (event.data.operation === 'encode' || event.data.operation === 'decode') {
        return worker.handleTransform(
          event.data.operation,
          event.data.readable,
          event.data.writable
        );
      }
      if (event.data.operation === 'setCryptoKey') {
        if (event.data.currentCryptoKey !== worker.currentCryptoKey) {
          worker.currentKeyIdentifier++;
        }
        worker.currentCryptoKey = event.data.currentCryptoKey;
        worker.useCryptoOffset = event.data.useCryptoOffset;
      }
    };

    // @ts-ignore
    if (self.RTCTransformEvent) {
      // @ts-ignore
      self.onrtctransform = event => {
        const transformer = event.transformer;
        worker.handleTransform(
          transformer.options.operation,
          transformer.readable,
          transformer.writable
        );
      };
    }
  }
}
