import React, { useState, useRef, useEffect } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import throttle from 'lodash.throttle';
import '../styles/Home.css'

export default function Home({ username }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [duplicated, setDuplicated] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [csrfToken, setCsrfToken] = useState("");

  const scrl = useRef(null);
  const WS_URL = 'ws://localhost:3001';

  useEffect(() => {
    scrl.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]) // messages arrayine giriş çıkış olduğunda display edilen veriyi takip et. scrollIntoView.

  
  const { sendMessage } = useWebSocket(WS_URL, {
    queryParams: { username },
    onMessage: (event) => {
      const data = JSON.parse(event.data);
      if (data.event === "message-server") {
        setMessages((prevMessages) => [...prevMessages, `${event.data}`])
      } else if (data.event === 'duplicated') {
        setDuplicated(data.isDuplicated);
      } else if (data.event === 'users') {
        setActiveUsers(data.users)
      } else if (data.event === 'auth') {
        setCsrfToken(data.csrfToken)
      }
    }
  });

  useEffect(() => {
    window.onbeforeunload = () => {return '';}
  }, []) // Herhangi bir şey tetiklemez.
  
  useEffect(() => {
    if (ReadyState.OPEN) {
      sendMessage(JSON.stringify({type: 'authToken', csrfToken: csrfToken}));
    }
  }, [])

  
  const THROTTLE = 500; // server'a en hızlı 500 ms aralıklarla mesaj gönderebiliriz.
  const sendMessageThrottled = useRef(throttle((msg) => { // useRef optimizasyon sağlar ve throttle'ın tekrar create edilerek ms sınırının bozulmasını engeller.
    sendMessage(JSON.stringify({type: 'chat-message', msg: msg}));
  }, THROTTLE));

  const handleSendMessage = () => {
    if (message.trim()) { // message'ın başındaki ve sonundaki boş karakterleri sil.
      sendMessageThrottled.current(message);
      setMessage(""); // mesaj kutusunu sıfırlamak için.
    }
  };

  const handleKeyPress = (e) => { // Enter ile gönderim sağlama.
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };



  return (
    <div>
      {duplicated ? (<div></div>) : (
        <>
          <p className='text-left pl-2'>logged as {username} <a href="/">logout</a></p>
        </>
      )}
      <div className='flex space-x-4'>
        <div className='bg-gray-900 w-1/4 px-4 float-left overflow-y-auto container scroll-smooth rounded-xl text-center my-3 '>
          <h2 className='font-bold my-4'>Online Users</h2>
          <div className='border-b-white border mb-5'/>
          {Object.values(activeUsers).map((user) => (
            <>
              <p className='font-bold first:mt-6'>{user.username}</p>
            </>
          ))}
        </div>
        <div className="bg-gray-950 w-3/4 float-left overflow-y-auto scroll-smooth rounded-xl max-w-full text-center mx-auto my-3 container message">
          {/* Eğer duplicated true dönerse yani bir kullanıcı adı iki clientte de kullanılmaya çalışılıyorsa ikinci clientteki görüntüleneck olan: */}
          {duplicated ? (
            <div className='bg-red-600 first:mt-4 my-2 max-w-full text-left  rounded mx-4 mt-2'>
              <p className='text-sm font-bold pl-1 bg-red-800 max-w-fit mx-1 px-1 rounded py-0 text-white'><code>SERVER</code></p>
              <p className='text-md pl-3 pb-2'><b>Another user is active now with this username :) You can reload and choose a unique username</b></p>
            </div>
          ) : (
            <>
              {/* 'iki noktadan sonrası' duplicated false dönerse, messages arrayinin içerisindeki verileri gez, index ile sıralanacak div'in içerisine mesaj verilerini yerleştir. */}
              {messages.map((msg, index) => (
                <div key={index} className='bg-gray-800 overflow-hidden first:mt-4 my-2 min-h-max:  max-w-full text-left  rounded mx-4 mt-2'>
                  {/* msg parametresinden dönen JSON tipi veriyi parse et ve disconnectedUser field'ını oku, eğer boşsa normal şekilde mesaj verilerini yazdır. */}
                  {JSON.parse(msg).disconnectedUser === '' ? (
                    <>
                      <p className='text-sm font-bold pl-1 bg-cyan-600 max-w-fit mx-1 px-1 rounded py-0 text-white'><code>{JSON.parse(msg).author}</code></p>
                      <p className='text-lg pl-3 pb-2 float-left'>{JSON.parse(msg).mesg.replace(/['"]+/g, '')}</p>
                      <p className='text-sm p-2 max-w-fit rounded float-right text-white'>{JSON.parse(msg).time}</p>
                    </>
                  ) : (
                    <>
                      {/* Boş değilse disconnectedUser'ın username'ini (servardan oto gönderim) ve mesaj author olarak (SERVER) yazısı ile birlikte kanaldan bağlantısı kesildi mesajı display et */}
                      <p className='text-sm font-bold pl-1 bg-red-400 max-w-fit mx-1 px-1 rounded py-0 text-white'><code>{JSON.parse(msg).author}</code></p>
                      <p className='text-md pl-3 pb-2'>{JSON.parse(msg).disconnectedUser} disconnected from channel</p>
                      <p className='text-sm font-bold pl-1 float-right bg-blue-400 max-w-fit mx-1 px-1 rounded py-0 text-black'><code>{JSON.parse(msg).time}</code></p>
                    </>
                  )}
                </div>
              ))}
              {/* referans kullanılarak takip edilecek div: */}
              <div ref={scrl} />
            </>
          )}
        </div>
      </div>

      {/* Eğer duplicated true dönerse, form alanını oluşturma. */}
      {duplicated ? (
        <div>
        </div>
      ) : (
        <>
          {/* Eğer duplicated false dönerse, formu oluştur. */}
          <form className='align-bottom flex'>
            <input
              type="text"
              id="messageBox"
              placeholder="Enter text"
              value={message}
              className='mx-2 text-lg  focus:outline-none w-full'
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              autoComplete='off'
            />
            <button
              id="sendBtn"
              type="button"
              className='bg-blue-900 '
              onClick={handleSendMessage}
            >
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}
