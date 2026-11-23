import React from 'react';import{createRoot}from'react-dom/client';import{ClerkProvider}from'@clerk/react';import App from'./App';import'./style.css';
const key=import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if(!key)throw new Error('Add VITE_CLERK_PUBLISHABLE_KEY to the root .env file.');
createRoot(document.getElementById('root')).render(<React.StrictMode><ClerkProvider publishableKey={key}><App/></ClerkProvider></React.StrictMode>);
