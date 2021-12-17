import React, { useEffect, useState, useCallback } from 'react';
import Call from '../Call/Call';
import StartButton from '../StartButton/StartButton';
import api from '../../api';
import './App.css';
import Tray from '../Tray/Tray';
import CallObjectContext from '../../CallObjectContext';
import { roomUrlFromPageUrl, pageUrlFromRoomUrl } from '../../urlUtils';
import DailyIframe from '@daily-co/daily-js';
import { logDailyEvent } from '../../logUtils';

const STATE_IDLE = 'STATE_IDLE';
const STATE_CREATING = 'STATE_CREATING';
const STATE_JOINING = 'STATE_JOINING';
const STATE_JOINED = 'STATE_JOINED';
const STATE_LEAVING = 'STATE_LEAVING';
const STATE_ERROR = 'STATE_ERROR';

export default function App() {
  const [appState, setAppState] = useState(STATE_IDLE);
  const [roomUrl, setRoomUrl] = useState(null);
  const [callObject, setCallObject] = useState(null);
  
  const createCall = useCallback(() => {
    setAppState(STATE_CREATING);
    return api
      .createRoom()
      .then((room) => room.url)
      .catch((error) => {
        console.log('Error creating room', error);
        setRoomUrl(null);
        setAppState(STATE_IDLE);
      });
  }, []);

  const startJoiningCall = useCallback((url) => {
    const newCallObject = DailyIframe.createCallObject();
    setRoomUrl(url);
    setCallObject(newCallObject);
    setAppState(STATE_JOINING);
    newCallObject.join({ url });
  }, []);

  const startLeavingCall = useCallback(() => {
    if (!callObject) return;
    if (appState === STATE_ERROR) {
      callObject.destroy().then(() => {
        setRoomUrl(null);
        setCallObject(null);
        setAppState(STATE_IDLE);
      });
    } else {
      setAppState(STATE_LEAVING);
      callObject.leave();
    }
  }, [callObject, appState]);

  useEffect(() => {
    const url = roomUrlFromPageUrl();
    url && startJoiningCall(url);
  }, [startJoiningCall]);

  useEffect(() => {
    const pageUrl = pageUrlFromRoomUrl(roomUrl);
    if (pageUrl === window.location.href) return;
    window.history.replaceState(null, null, pageUrl);
  }, [roomUrl]);

  useEffect(() => {
    if (!callObject) return;

    const events = ['joined-meeting', 'left-meeting', 'error'];

    function handleNewMeetingState(event) {
      event && logDailyEvent(event);
      switch (callObject.meetingState()) {
        case 'joined-meeting':
          setAppState(STATE_JOINED);
          break;
        case 'left-meeting':
          callObject.destroy().then(() => {
            setRoomUrl(null);
            setCallObject(null);
            setAppState(STATE_IDLE);
          });
          break;
        case 'error':
          setAppState(STATE_ERROR);
          break;
        default:
          break;
      }
    }

    handleNewMeetingState();

    for (const event of events) {
      callObject.on(event, handleNewMeetingState);
    }

    return function cleanup() {
      for (const event of events) {
        callObject.off(event, handleNewMeetingState);
      }
    };
  }, [callObject]);

  useEffect(() => {
    if (!callObject) {
      return;
    }

    function handleAppMessage(event) {
      if (event) {
        logDailyEvent(event);
        console.log(`received app message from ${event.fromId}: `, event.data);
      }
    }

    callObject.on('app-message', handleAppMessage);

    return function cleanup() {
      callObject.off('app-message', handleAppMessage);
    };
  }, [callObject]);

  const showCall = [STATE_JOINING, STATE_JOINED, STATE_ERROR].includes(
    appState
  );

  const enableCallButtons = [STATE_JOINED, STATE_ERROR].includes(appState);

  const enableStartButton = appState === STATE_IDLE;

  return (
    <div className="app">
      {showCall ? (

        <CallObjectContext.Provider value={callObject}>
          <Call roomUrl={roomUrl} />
          <Tray
            disabled={!enableCallButtons}
            onClickLeaveCall={startLeavingCall}
          />
        </CallObjectContext.Provider>
      ) : (
        <StartButton
          disabled={!enableStartButton}
          onClick={() => {
            createCall().then((url) => startJoiningCall(url));
          }}
        />
      )}
    </div>
  );
}
