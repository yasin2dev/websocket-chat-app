import React, { useState } from 'react'
import useWebSocket from 'react-use-websocket';
import '../styles/Login.css'

export default function Login({ onSubmit }) {
    const [username, setUsername] = useState("")


    return (
        <div className='mt-32'>
            <h1 className='text-2xl'>Welcome to  <code>realtime chat app</code></h1>
            <h3 className='font-bold mb-2 mt-4'>Please enter your username</h3>
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    onSubmit(username)
                }}
                className='my-8'
            >
                <input
                    type="text"
                    value={username}
                    placeholder='Username'
                    style={{ width: "70%" }}
                    onChange={(e) => setUsername(e.target.value)}
                    className='usernameBox'
                />
                <br />
                <button type='submit' style={{ width: '71%', marginTop: "12px" }}>Join</button>
            </form>
        </div>
    )
}
