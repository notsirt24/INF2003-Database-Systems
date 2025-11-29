// frontend/src/api/chatbotApi.js

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export async function sendChatMessage(message) {
  const token =
    sessionStorage.getItem('token') || localStorage.getItem('token') || null;

  const body = {
    message,
  };

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/chatbot`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Chatbot request failed');
  }

  return res.json();
}