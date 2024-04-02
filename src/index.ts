import { EventEmitter } from "eventemitter3";
import { WebSocketClient } from "./WebsocketClient";
import { captureWorklet } from "./captureWorklet";
import { playbackWorklet } from "./playbackWorklet";

export interface JoinCallConfig {
    callId: string;
    sampleRate: number;
    organization?: string;
    customStream?: MediaStream;
}

export interface CreateCallConfig {
    voiceId: string,
    organization?: string,
    useSsl?: boolean
}
  
export class ConversaClient extends EventEmitter {
    private callWs: WebSocketClient;
    private userStream: MediaStream;
    private audioContext: AudioContext;
    private endpointURL: string;
    private organization: string;
    private inCall: boolean = false;
    private secureWebsocket: boolean;
    private captureNode: AudioWorkletNode;
    private playbackNode: AudioWorkletNode;

    constructor(endpointURL: string, secureWebsocket: boolean = true, organization?: string) {
        super();
        this.endpointURL = endpointURL;
        this.secureWebsocket = secureWebsocket
        if (organization) this.organization = organization;
    }

    public async getAvailableVoices(
        useSsl?: boolean
    ): Promise<any[]> {
        try {
            let security = useSsl !== undefined ? useSsl : true
            const path = `http${security ? 's': ''}://${this.endpointURL}/voices`;
            let response = await fetch(path, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
            });
            if (!response.ok) {
                throw new Error('Network response was not ok.');
            }
            const data = await response.json();
            return data.voices;
        } catch (err) {
            throw err;
        }
    }

    public async createCall(
        createCallConfig: CreateCallConfig
    ): Promise<string> {
        try {
            let security = createCallConfig.useSsl !== undefined ? createCallConfig.useSsl : true
            const path = `http${security ? 's': ''}://${this.endpointURL}/call`;
            const body = {
                voiceId: createCallConfig.voiceId
            }
            let response = await fetch(path, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                throw new Error('Network response was not ok.');
            }
            const data = await response.json();
            return data.callObject.callId;
        } catch (err) {
            throw err;
        }
    }

    public async joinCall(
        joinCallConfig: JoinCallConfig
    ): Promise<void> {
        if (this.inCall) {
            throw new Error("Already in a call.")
        }
        try {
            await this.setupUserAudio(
                joinCallConfig.sampleRate,
                joinCallConfig.customStream,
            );
            this.callWs = new WebSocketClient({
                callId: joinCallConfig.callId,
                endpointURL: this.endpointURL,
                organization: this.organization,
                useSsl: this.secureWebsocket
            });
            this.inCall = true;
            this.handleWebsocketEvents();
        } catch (err) {
            this.emit("error", err.message);
        }
    }

    public async exitCall() {
        // Mark the inCall flag as false to indicate the call has ended
        this.inCall = false;
    
        // Disconnect the WebSocket client if it exists
        if (this.callWs) {
            this.callWs.disconnect();
            this.callWs = null; // Immediately release the reference for garbage collection
        }
    
        // Stop all tracks on the userStream to release the camera and/or microphone
        if (this.userStream) {
            this.userStream.getTracks().forEach(track => track.stop());
            this.userStream = null; // Release the reference to allow for garbage collection
        }
    
        // Properly close the AudioContext to release system audio resources
        if (this.audioContext) {
            await this.audioContext.suspend(); // Suspend any ongoing audio processing
            await this.audioContext.close(); // Close the AudioContext
            this.audioContext = null; // Release the reference for garbage collection
        }
    
        // Disconnect and nullify the audio worklet nodes to free up resources
        this.disconnectAndCleanupNode(this.captureNode);
        this.disconnectAndCleanupNode(this.playbackNode);
    }
    
    // Helper method to disconnect an AudioWorkletNode and release its reference
    private disconnectAndCleanupNode(node: AudioWorkletNode | null) {
        if (node) {
            node.disconnect();
            node = null; // Ensure the reference is released for garbage collection
        }
    }
    

    private handleWebsocketEvents() {

        this.callWs.on("opened", () => {
            this.emit("conversationStarted");
        });

        this.callWs.on("closed", () => {
            if (this.inCall) {
            this.exitCall();
            }
            this.emit("conversationEnded");
        });

        this.callWs.on("audio-data", (audioData: Uint8Array) => {
            this.playbackNode.port.postMessage(audioData);
            this.emit("audio-data", audioData);
        });

        this.callWs.on("error", (error) => {
            this.emit("error", error);
            if (this.inCall) {
                this.exitCall();
            }
        })

    }

    private async setupUserAudio(sampleRate: number, customStream?: MediaStream) {
        try {
            // Initialize AudioContext with the specified sample rate
            this.audioContext = new AudioContext({ sampleRate });

            // Attempt to use the customStream if provided, otherwise request access to the user's microphone
            this.userStream = customStream || await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                },
            });

            // Restart context if suspended
            await this.audioContext.resume(); 

            // Load audio worklets
            const captureWorkletBlob = new Blob([captureWorklet], { type: 'application/javascript' });
            await this.audioContext.audioWorklet.addModule(URL.createObjectURL(captureWorkletBlob));

            const playbackWorkletBlob = new Blob([playbackWorklet], { type: 'application/javascript' });
            await this.audioContext.audioWorklet.addModule(URL.createObjectURL(playbackWorkletBlob));

            this.captureNode = new AudioWorkletNode(this.audioContext, 'capture-processor');
            this.playbackNode = new AudioWorkletNode(this.audioContext, 'playback-processor');


            this.captureNode.port.onmessage = (event) => {
                if (this.callWs) {
                    this.callWs.sendMessage(event.data);
                }
            }
    
            // Connect the user's audio stream to the audio worklet node, and then to the destination
            const source = this.audioContext.createMediaStreamSource(this.userStream);
            source.connect(this.captureNode);
            this.captureNode.connect(this.audioContext.destination);

            source.connect(this.playbackNode);
            this.playbackNode.connect(this.audioContext.destination);

        } catch (error) {
            // Handle errors (e.g., user denied microphone access or audio worklet module failed to load)
            throw new Error("Error setting up user audio: " + error.message);
        }
    }


}


