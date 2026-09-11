import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, AlertCircle, Bot, ChevronDown, ChevronUp } from 'lucide-react';
import { API_URL } from '../config';

const SUGGESTED_QUESTIONS = [
  'Why did this inspection receive REVIEW status?',
  'Which checks failed and why?',
  'What evidence was found for MRP?',
  'Which checks require manual review?',
  'Explain Rule 6 requirements for this product.',
];

function MessageBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center mr-2 mt-0.5 shrink-0">
          <Bot size={14} className="text-blue-600" />
        </div>
      )}
      <div className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
        isUser
          ? 'bg-blue-600 text-white rounded-tr-none'
          : 'bg-gray-100 text-gray-800 rounded-tl-none'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

export default function AiAssistantPanel({ productId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const [unavailableMsg, setUnavailableMsg] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: 'Hello! I can help explain this inspection result — what was checked, what evidence was found, and what the rule results mean. What would you like to know?',
      }]);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const question = text || input.trim();
    if (!question || loading) return;

    setInput('');
    const userMsg = { role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/chat/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ productId, question }),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.message || 'Request failed');

      if (json.available === false) {
        setAvailable(false);
        setUnavailableMsg(json.message || 'AI assistant is currently unavailable.');
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: json.message || 'AI assistant is currently unavailable. Please try again later.',
        }]);
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: json.answer }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'An error occurred while contacting the AI assistant. The compliance result is unaffected.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
        id="ai-assistant-toggle"
      >
        <span className="flex items-center gap-2 font-bold text-gray-800">
          <MessageSquare size={18} className="text-blue-500" />
          AI Compliance Assistant
          {!available && (
            <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Unavailable</span>
          )}
        </span>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>

      {open && (
        <div className="border-t">
          {/* Disclaimer */}
          <div className="flex items-start gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <span>
              AI responses explain existing inspection data only. They do not constitute a legal determination and do not change the compliance result.
            </span>
          </div>

          {/* Unavailable banner */}
          {!available && (
            <div className="px-4 py-3 bg-gray-50 border-b text-sm text-gray-500 text-center">
              {unavailableMsg}
            </div>
          )}

          {/* Messages */}
          <div className="h-64 overflow-y-auto px-4 py-3">
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
            {loading && (
              <div className="flex justify-start mb-3">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center mr-2 shrink-0">
                  <Bot size={14} className="text-blue-600" />
                </div>
                <div className="bg-gray-100 rounded-xl rounded-tl-none px-3.5 py-2.5 text-sm text-gray-500 italic">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested questions */}
          {messages.length <= 1 && available && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2.5 py-1 hover:bg-blue-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t px-3 py-3 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={available ? 'Ask about this inspection…' : 'AI assistant unavailable'}
              disabled={!available || loading}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!available || loading || !input.trim()}
              className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
