export const playbackWorklet = `
class PlaybackProcessor extends AudioWorkletProcessor {
  audioQueue = [];

  constructor() {
      super();
      this.port.onmessage = (event) => {
          // Convert incoming Int16 data to Float32 and enqueue
          const float32Array = this.convertInt16ToFloat32(event.data);
          this.audioQueue.push(...float32Array);
      };
  }
  
  convertInt16ToFloat32(array) {
    const out = new Float32Array(array.byteLength / 2);
    const dataView = new DataView(array.buffer);
    out.forEach((val, i) => {
      out[i] = dataView.getInt16(i * 2, true) / 32767;
    });
    return out;
  }

  process(_, outputs) {
    const output = outputs[0];
    const channel = output[0]; // Assuming mono for simplicity

    for (let i = 0; i < channel.length; i++) {
        if (this.audioQueue.length > 0) {
            // Dequeue audio data to fill the output buffer
            channel[i] = this.audioQueue.shift();
        } else {
            // Fill with silence if the queue is empty
            channel[i] = 0;
        }
    }

    return true;
  }
}


registerProcessor('playback-processor', PlaybackProcessor);
`