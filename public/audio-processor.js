class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.port.onmessage = (e) => {
      if (e.data.type === "start") this.isRecording = true;
      if (e.data.type === "stop") this.isRecording = false;
    };
  }

  process(inputs) {
    if (this.isRecording && inputs[0] && inputs[0][0]) {
      const samples = new Float32Array(inputs[0][0]);
      this.port.postMessage({ type: "audio", samples });
    }
    return true;
  }
}

registerProcessor("recorder-processor", RecorderProcessor);
