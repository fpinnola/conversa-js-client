import { useEffect, useState } from 'react'
import './App.css'
import { ConversaClient } from 'conversa-client';

const sdk = new ConversaClient('localhost:8000');

function App() {
  const [recordStarted, setRecordStarted] = useState(false);
  const [setup, setSetup] = useState(false);

  useEffect(() => {
    if (recordStarted && setup) {
      console.log('Stopping Conversation');
      sdk.exitCall();
    } else if (setup) {
      console.log('Starting Conversation');
      sdk.joinCall({
        callId: 'test123',
        sampleRate: 16000
      });
    }
    setSetup(true);

  }, [recordStarted]);

  return (
    <>
      <button onClick={() => setRecordStarted(!recordStarted)}>{recordStarted ? 'Start' : 'Stop'}</button>
    </>
  )
}

export default App
