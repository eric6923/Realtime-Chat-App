import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageSquare, Send, Users } from 'lucide-react';

interface Message {
  id: string;
  room: string;
  username: string;
  content: string;
  timestamp: Date;
}

function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io('http://localhost:3000', {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket']
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    // Socket event handlers
    const handleConnect = () => {
      console.log('Connected to server');
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    };

    const handleError = (error: Error) => {
      console.error('Socket error:', error);
      setIsConnected(false);
    };

    newSocket.on('connect', handleConnect);
    newSocket.on('disconnect', handleDisconnect);
    newSocket.on('connect_error', handleError);

    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('disconnect', handleDisconnect);
      newSocket.off('connect_error', handleError);
      newSocket.close();
    };
  }, []);

  // Handle messages
  useEffect(() => {
    if (!socket) return;

    const handleMessageHistory = (history: Message[]) => {
      setMessages(history);
    };

    const handleReceiveMessage = (message: Message) => {
      setMessages(prev => [...prev, message]);
    };

    socket.on('message_history', handleMessageHistory);
    socket.on('receive_message', handleReceiveMessage);

    return () => {
      socket.off('message_history', handleMessageHistory);
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [socket]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Join room handler
  const joinRoom = useCallback(() => {
    if (!socket || !username.trim() || !room.trim()) return;

    socket.emit('join_room', { room, username });
    setIsJoined(true);
    
    // Store room info in localStorage for reconnection
    localStorage.setItem('chatRoom', room);
    localStorage.setItem('chatUsername', username);
  }, [socket, username, room]);

  // Send message handler
  const sendMessage = useCallback(() => {
    if (!socket || !message.trim() || !isConnected) return;

    const messageData = {
      room,
      username,
      content: message,
    };

    socket.emit('send_message', messageData);
    setMessage('');
  }, [socket, message, room, username, isConnected]);

  // Login screen
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <MessageSquare className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold text-gray-800">Chat Room</h1>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose a Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter your username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room Name
              </label>
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter room name"
              />
            </div>
            <button
              onClick={joinRoom}
              disabled={!isConnected}
              className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnected ? 'Join Room' : 'Connecting...'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-7 h-7 text-blue-500" />
            <h1 className="text-2xl font-bold text-gray-800">Chat Room</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
              <Users className="w-5 h-5 text-blue-500" />
              <span className="font-medium text-blue-700">{room}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-5xl w-full mx-auto p-4">
        <div className="bg-white rounded-xl shadow-md h-[calc(100vh-12rem)] border">
          <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={msg.id || index}
                  className={`flex ${
                    msg.username === username ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-6 py-3 ${
                      msg.username === 'System'
                        ? 'bg-gray-100 text-gray-600 text-center text-sm italic mx-auto'
                        : msg.username === username
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {msg.username !== username && msg.username !== 'System' && (
                      <div className="text-xs font-medium text-gray-600 mb-1">
                        {msg.username}
                      </div>
                    )}
                    <div>{msg.content}</div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t bg-gray-50">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder={isConnected ? "Type your message..." : "Reconnecting..."}
                  disabled={!isConnected}
                />
                <button
                  onClick={sendMessage}
                  disabled={!isConnected || !message.trim()}
                  className="bg-blue-500 text-white px-6 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;