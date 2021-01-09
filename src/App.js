import React, { useRef, useState } from 'react';
import './App.css';

import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import 'firebase/analytics';

import { useAuthState } from 'react-firebase-hooks/auth';
import { useDocumentData, useCollectionData } from 'react-firebase-hooks/firestore';

import { GCP_CREDENTIALS,  FIREBASE_CREDENTIALS } from './credentials'
const {Translate} = require('@google-cloud/translate').v2;

const translate = new Translate({credentials: GCP_CREDENTIALS});

async function detectLanguage(text) {
  let [detections] = await translate.detect(text);
  detections = Array.isArray(detections) ? detections : [detections];
  console.log('Detections:');
  return detections[0].language
}

async function translateText(text, lgCode) {

  // Translates some text into Russian
  const [translation] = await translate.translate(text, lgCode);
  
  return translation;
}

firebase.initializeApp(FIREBASE_CREDENTIALS)

const auth = firebase.auth();
const firestore = firebase.firestore();
const analytics = firebase.analytics();


function App() {
  const [user] = useAuthState(auth);
  const [language, setLanguageValue] = useState("en")
  return (
    <div className="App">
      <header>
        <h1>WhatTalkingYou</h1>
        <SignOut />
      </header>

      <section>
        {user ? <ChatRoom language={language}/> : <SignIn />}
      </section>

    </div>
  );
}

function SignIn() {

  const signInWithGoogle = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider);
  }

  return (
    <>
      <button className="sign-in" onClick={signInWithGoogle}>Sign in with Google</button>
    </>
  )

}

function SignOut() {
  return auth.currentUser && (
    <button className="sign-out" onClick={() => auth.signOut()}>Sign Out</button>
  )
}


function ChatRoom(props) {
  const {language} = props;
  const dummy = useRef();
  const messagesRef = firestore.collection('messages');
  const query = messagesRef.orderBy('createdAt');

  const [messages] = useCollectionData(query, { idField: 'id' });
  const [formValue, setFormValue] = useState('');


  const sendMessage = async (e) => {
    e.preventDefault();
    const { uid, photoURL } = auth.currentUser;
     
    let language_type = await detectLanguage(formValue);

    if (language_type == 'zh-CN') {
      language_type = await translateText(formValue, 'en');
    }
    else if (language_type == 'en') {
      language_type = await translateText(formValue, 'zh-CN');
    }
    await messagesRef.add({
      text: formValue,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      uid,
      photoURL,
      language: language_type
    })

    setFormValue('');
    dummy.current.scrollIntoView({ behavior: 'smooth' });
  }

  return (<>
    <main>

      {messages && messages.map(msg => <ChatMessage key={msg.id} message={msg} language={language}/>)}

      <span ref={dummy}></span>

    </main>

    <form onSubmit={sendMessage}>

      <input value={formValue} onChange={(e) => setFormValue(e.target.value)} placeholder="say something nice" />

      <button type="submit" disabled={!formValue}>🕊️</button>

    </form>
  </>)
}


function ChatMessage(props) {
  const { key, language } = props;
  const { text, uid, photoURL } = props.message;
  const textLang = props.message["language"]
  const messageClass = uid === auth.currentUser.uid ? 'sent' : 'received';
  const textRef = firestore.collection('messages').doc(key);
  // const translatedText = translateText(text, language).then(response => {
  //   return response;
  // });
  return (<>
    <div className={`message ${messageClass}`}>
      <img src={photoURL || 'https://api.adorable.io/avatars/23/abott@adorable.png'} />
      <p>translated: {textLang}<br></br>
      original : {text}
      </p>
    </div>
  </>)
}

export default App;
