import React, { useEffect, useState, useMemo, useRef } from 'react';
import './Tile.css';

function getTrackUnavailableMessage(kind, trackState) {
  if (!trackState) return;
  switch (trackState.state) {
    case 'blocked':
      if (trackState.blocked.byPermissions) {
        return `${kind} permission denied`;
      } else if (trackState.blocked.byDeviceMissing) {
        return `${kind} device missing`;
      }
      return `${kind} blocked`;
    case 'off':
      if (trackState.off.byUser) {
        return `${kind} muted`;
      } else if (trackState.off.byBandwidth) {
        return `${kind} muted to save bandwidth`;
      }
      return `${kind} off`;
    case 'sendable':
      return `${kind} not subscribed`;
    case 'loading':
      return `${kind} loading...`;
    case 'interrupted':
      return `${kind} interrupted`;
    case 'playable':
      return null;
  }
}

export default function Tile(props) {
  const videoEl = useRef(null);
  const audioEl = useRef(null);
  const canvasRef = useRef();
  const imageRef = useRef(null);

  const [result, setResult] = useState("");

  const videoTrack = useMemo(() => {
    return props.videoTrackState && props.videoTrackState.state === 'playable'
      ? props.videoTrackState.track
      : null;
  }, [props.videoTrackState]);

  const audioTrack = useMemo(() => {
    return props.audioTrackState && props.audioTrackState.state === 'playable'
      ? props.audioTrackState.track
      : null;
  }, [props.audioTrackState]);

  const videoUnavailableMessage = useMemo(() => {
    return getTrackUnavailableMessage('video', props.videoTrackState);
  }, [props.videoTrackState]);

  const audioUnavailableMessage = useMemo(() => {
    return getTrackUnavailableMessage('audio', props.audioTrackState);
  }, [props.audioTrackState]);

  const captureImageFromCamera = () => {
    if(videoEl.current){
    const { videoWidth, videoHeight } = videoEl.current;
    
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;
    const context = canvasRef.current.getContext('2d');

    context.drawImage(videoEl.current, 0, 0, videoWidth, videoHeight);

    canvasRef.current.toBlob((blob) => {
      imageRef.current = blob;
    })
  }
  };
  useEffect(() => {
    videoEl.current &&
      (videoEl.current.srcObject = new MediaStream([videoTrack]));
  }, [videoTrack]);

  useEffect(() => {
    audioEl.current &&
      (audioEl.current.srcObject = new MediaStream([audioTrack]));
  }, [audioTrack]);

  useEffect(() => {
    const interval = setInterval(async () => {
      captureImageFromCamera();

      if (imageRef.current) {
        const formData = new FormData();
        formData.append('image', imageRef.current);

        const response = await fetch('https://realtimeemotiondetection.herokuapp.com/getemotion', {
          method: "POST",
          body: formData,
        });

        if (response.status === 200) {
          const text = await response.text();
          setResult(text);
          console.log(text)
        } else {
          setResult("Error from API.");
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  function getVideoComponent() {
    if (videoEl.current){
      console.log('Video emotion',videoEl.current.srcObject)
      
    }
    var emotion = "Sad"
    fetch('https://realtimeemotiondetection.herokuapp.com/test')
      .then(res => res.json())
      .then(data => {console.log(data);});
        
    return videoTrack && 
    <div>
      <p className="overlaytile">{result.toUpperCase()}</p>
      <video autoPlay muted playsInline ref={videoEl} /> 
      <canvas ref={canvasRef} hidden></canvas>
    </div>
  }

  function getAudioComponent() {
    return (
      !props.isLocalPerson &&
      audioTrack && <audio autoPlay playsInline ref={audioEl} />
    );
  }

  function getOverlayComponent() {
    return (
      videoUnavailableMessage && (
        <p className="overlay">
          {videoUnavailableMessage}
          {audioUnavailableMessage && (
            <>
              <br />
              {audioUnavailableMessage}
            </>
          )}
        </p>
      )
    );
  }

  function getCornerMessageComponent() {
    return (
      !props.disableCornerMessage &&
      audioUnavailableMessage &&
      !videoUnavailableMessage && (
        <p className="corner">{audioUnavailableMessage}</p>
      )
    );
  }

  function getClassNames() {
    let classNames = 'tile';
    classNames += props.isLarge ? ' large' : ' small';
    props.isLocalPerson && (classNames += ' local');
    return classNames;
  }

  return (
    <div className={getClassNames()} onClick={props.onClick}>
      <div className="background" />
      {getOverlayComponent()}
      {getVideoComponent()}
      {getAudioComponent()}
      {getCornerMessageComponent()}
    </div>
  );
}
