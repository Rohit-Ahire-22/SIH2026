import { useState, useEffect, useRef } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { MessageCircle, X, Send, Bot, AlertCircle } from 'lucide-react';
import { API_URL } from '../config';

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  'inspection-history': 'Inspection History',
  'new-inspection': 'New Inspection',
  'inspection-analysis': 'Inspection Analysis',
  'inspection-result': 'Inspection Result',
  'ocr-inspection': 'OCR Review',
  complaints: 'Complaints',
  'violation-map': 'Violation Intelligence Map',
  'nutrition-scanner': 'Nutrition Scanner',
  general: 'General',
};

function getPageContext(pathname, params) {
  // Inspection result — attach the inspection context so answers are data-grounded.
  if (pathname.startsWith('/inspections/') && pathname.endsWith('/result') && params.id) {
    return { productId: params.id, page: 'inspection-result', summary: 'Understanding the current inspection result.' };
  }
  if (pathname === '/inspections/new') return { page: 'new-inspection', summary: 'Starting a new packaging compliance inspection.' };
  if (pathname.startsWith('/inspections/') && pathname.endsWith('/analyze')) return { page: 'inspection-analysis', summary: 'Waiting for compliance analysis to complete.' };
  if (pathname.startsWith('/products/') && pathname.endsWith('/ocr')) return { page: 'ocr-inspection', summary: 'Reviewing OCR-extracted fields.' };
  if (pathname === '/history') return { page: 'inspection-history', summary: 'Browsing inspection history.' };
  if (pathname.startsWith('/complaints')) return { page: 'complaints', summary: 'Managing compliance complaints.' };
  if (pathname === '/violations/map') return { page: 'violation-map', summary: 'Exploring the inspection intelligence map.' };
  if (pathname === '/nutrition') return { page: 'nutrition-scanner', summary: 'Using the nutrition label scanner.' };
  if (pathname === '/') return { page: 'dashboard', summary: 'Reviewing the compliance dashboard.' };
  return { page: 'general', summary: 'General platform question.' };
}

function GlobalAiAssistant() {
  const location = useLocation();
  const params = useParams();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const bottomRef = useRef(null);
  const routeKey = `${location.pathname}${location.search}`;

  // Reset the conversation when the page changes — old page context must not
  // leak into a different page's chat.
  useEffect(() => {
    setMessages([]);
    setUnavailable(false);
  }, [routeKey]);

  useEffect(() => {
    if (open && messages.length === 0) {
      const ctx = getPageContext(location.pathname, params);
      setMessages([{
        role: 'assistant',
        content: `Hello! I'm the compliance assistant. I can help you understand inspection results, the nutrition scanner, complaints, and the violation map. Right now we're on the ${PAGE_TITLES[ctx.page] || ctx.page} page. Note: my answers are based on the data provided and are not a legal determination.`,
      }]);
    }
  }, [open, messages.length, location.pathname, params]);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const pageContext = getPageContext(location.pathname, params);

  const send = async () => {
    const question = input.trim();
    if (!question || sending) return;

    const userMsg = { role: 'user', content: question };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setSending(true);
    setUnavailable(false);

    try {
      const body = { question };
      if (pageContext.productId) {
        body.productId = pageContext.productId;
      } else {
        body.context = { page: pageContext.page, summary: pageContext.summary };
      }

      const res = await fetch(`${API_URL}/chat/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.available === false) {
        setUnavailable(true);
        setMessages([...history, {
          role: 'assistant',
          content: json.message || 'The AI assistant is temporarily unavailable. Please try again later.',
        }]);
        return;
      }

      setMessages([...history, { role: 'assistant', content: json.answer || '(No response received.)' }]);
    } catch (err) {
      setUnavailable(true);
      setMessages([...history, {
        role: 'assistant',
        content: 'The AI assistant is temporarily unavailable. Please try again later.',
      }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating launcher button — bottom right, hidden on no-auth pages */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Toggle AI assistant"
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg transition-all ${
          open ? 'bg-gray-800 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {open ? <X size={20} /> : <><Bot size={20} /> Assistant</>}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[min(24rem,calc(100vw-2rem))] h-[30rem] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-blue-600 text-white flex items-center gap-2">
            <Bot size={18} />
            <div className="flex-1">
              <div className="font-bold text-sm leading-tight">AI Compliance Assistant</div>
              <div className="text-[11px] text-blue-100">
                {PAGE_TITLES[pageContext.page] || pageContext.page}
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-blue-700 transition-colors" aria-label="Close assistant">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {unavailable && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                <AlertCircle size={12} /> Provider unavailable or rate-limited — answers may not be generated right now.
              </div>
            )}
            {sending && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl bg-white border border-gray-200 text-sm text-gray-400">Thinking…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t bg-white">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                placeholder="Ask about inspections, nutrition, complaints…"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                aria-label="Send"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">
              Responses are AI-generated and not a legal determination.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default GlobalAiAssistant;