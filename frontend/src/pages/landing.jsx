import React from 'react'
import "../App.css"
import { Link, useNavigate } from 'react-router-dom'

export default function LandingPage() {
    const router = useNavigate();

    const handleJoinAsGuest = () => {
        // Generate random abc-def-ghi code
        const chars = 'abcdefghijklmnopqrstuvwxyz';
        let code = '';
        for (let i = 0; i < 9; i++) {
            if (i === 3 || i === 6) code += '-';
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        router(`/${code}`);
    };

    return (
        <div className='landingPageContainer' style={{ background: 'linear-gradient(rgba(10, 11, 14, 0.4), rgba(10, 11, 14, 0.7)), url("/background.png") no-repeat center/cover' }}>
            <nav>
                <div className='navHeader'>
                    <h2>MeetSpace</h2>
                </div>
                <div className='navlist'>
                    <p onClick={handleJoinAsGuest}>Join as Guest</p>
                    <p onClick={() => {
                        router("/auth")
                    }}>Register</p>
                    <div onClick={() => {
                        router("/auth")

                    }} role='button'>
                        <p>Login</p>
                    </div>
                </div>
            </nav>


            <div className="landingMainContainer">
                <div>
                    <h1><span style={{ color: "#FF9839" }}>Connect</span> with your loved Ones</h1>

                    <p>Cover a distance by MeetSpace</p>
                    <div role='button'>
                        <Link to={"/auth"}>Get Started</Link>
                    </div>
                </div>
                <div>

                    <img src="/mobile.png" alt="" />

                </div>
            </div>



        </div>
    )
}