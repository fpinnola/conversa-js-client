import { EventEmitter } from "eventemitter3";

interface WebSocketClientConfig {
    endpointURL: string,
    callId: string,
    useSsl: boolean,
    organization?: string
}

export class WebSocketClient extends EventEmitter {
    private websocket: WebSocket | null = null;
    private url: string;

    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private intentionalClose: boolean = false;

    constructor(config: WebSocketClientConfig) {
        super();
        const path = `/audio-ws/${config.organization ? config.organization + '/' : ''}${config.callId}`;
        this.url = `ws${config.useSsl ? 's' : ''}://` + config.endpointURL + path;
        this.connect();
    }

    // Open WebSocket connection
    public connect(): void {
        this.websocket = new WebSocket(this.url);
        this.websocket.binaryType = 'arraybuffer';
        this.intentionalClose = false;

        this.websocket.onopen = () => {
            this.emit("opened");
        };

        this.websocket.onmessage = (event) => {
            this.handleMessage(event.data);
        };

        this.websocket.onclose = (event) => {
            this.websocket = null;

            if (!this.intentionalClose) {
                this.attemptReconnect();
            }
        };

        this.websocket.onerror = (event: any) => {
            this.emit("error", event.error);
        };
    }

    // Close WebSocket connection
    public disconnect(): void {
        this.intentionalClose = true;
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
    }

    // Send a message through the WebSocket
    public sendMessage(message: Uint8Array): void {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(message);
        } else {
            console.error('WebSocket is not open. Cannot send message.');
        }
    }

    // Handle incoming messages (to be overridden by subclasses or instances)
    protected handleMessage(data: any): void {
        // Handle received data
        if (data instanceof ArrayBuffer) {
            // Audio Data received
            const audio = new Uint8Array(data);
            this.emit("audio-data", audio);
        } else {
            this.emit("error", "Received unexpected data form server");
            this.websocket.close(1002, "Received unexpected data form server");
        }
    }

    // Attempt to reconnect with a delay
    private attemptReconnect(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            let delay = this.calculateReconnectDelay();
            console.log(`Attempting to reconnect in ${delay}ms...`);
            setTimeout(() => {
                this.reconnectAttempts++;
                this.connect();
            }, delay);
        } else {
            this.emit("closed");
        }
    }

    // Calculate the delay before attempting to reconnect, using exponential backoff
    private calculateReconnectDelay(): number {
        return Math.min(1000 * (2 ** this.reconnectAttempts), 30000); 
    }
    
}