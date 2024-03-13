export const captureWorklet = `
class CaptureProcessor extends AudioWorkletProcessor {

  constructor() {
    super();
  }
  
  convertFloat32ToInt16(array) {
    const buffer = new ArrayBuffer(array.length * 2);
    const dataView = new DataView(buffer);
  
    array.forEach((val, i) => {
      const value = val * 32768;
      dataView.setInt16(i * 2,  val * 32768, true);
    });

    return new Int16Array(buffer); // Return as Int16Array
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const inputChannel = input[0]; // Sticking with mono for now (1 channel)
    this.port.postMessage(this.convertFloat32ToInt16(inputChannel));
    return true;
  }
}

registerProcessor('capture-processor', CaptureProcessor);
`