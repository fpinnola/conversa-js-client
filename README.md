# Conversa

## Getting Started

Make sure you have an instance of the Conversa backend running. You can find that [here](https://github.com/fpinnola/conversa).

Install the Conversa client from npm.
```
npm install conversa-client
```

First create an instance of the Conversa Client
```
// Import the ConversaClient
import { ConversaClient } from 'conversa-client';

// Pass the domain for your Conversa backend
const sdk = new ConversaClient('localhost:8000', false);

```

### Create a call
```
// Pass the 'voiceId' you would like to use for the call
callId = await sdk.createCall({
    "voiceId": "21m00Tcm4TlvDq8ikWAM"
});
```

### Join a call
```
sdk.joinCall({
  callId: callId,
  sampleRate: 16000,
});
```

### Exit a call
```
sdk.exitCall();
```

