import React, { useState, useEffect, useRef } from 'react';
import Navigation from '../components/Navigation';
import { sendChatMessage } from '../api/chatbotApi';
import { Sparkles, Send, Loader2, MessageCircle, Info } from 'lucide-react';

// COMPREHENSIVE sample prompts - covering ALL chatbot functions
const samplePrompts = [
  'Show me 4-room transactions in Tampines',
  'Predict 4-room price in Bedok in 10 years',
  'Compare Punggol and Sengkang',
  'What are the cheapest past HDB sales?',
  'Which towns had most transactions in 2018?',
  'Price trend for 4-room in Bishan',
  'Most expensive 5-room flats in 2022'
];

export default function ChatbotPage() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: `Hi! I'm your HDB Resale Analytics Assistant 🏠

I help you analyze PAST HDB resale transactions (historical data, not current listings).

I can help you with:
• Search past transactions - "Show me 4-room flats in Tampines"
• Compare towns - "Compare Punggol and Sengkang"
• Price trends - "Price trend for 4-room in Bishan"
• Popular towns - "Which towns had most transactions in 2018?"
• Cheapest transactions - "What are the cheapest past HDB sales?"
• Most expensive - "Most expensive 5-room in 2022"
• Filter by year/price - "4-room under 500k in Bedok in 2020"

Try clicking the sample prompts below or ask your own question!`,
      isIntro: true
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const handleSend = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text) return;

    setInput('');

    const userMessage = { role: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      // Removed sessionId parameter
      const res = await sendChatMessage(text);

      let botMessage;
      
      if (res.success && res.answer) {
        const hasTableData = res.data && (
          (res.data.flats && res.data.flats.length > 0) ||
          (res.data.towns && res.data.towns.length > 0) ||
          (res.data.points && res.data.points.length > 0) ||
          (res.data.prediction) ||
          (res.data.predictions && res.data.predictions.length > 0)
        );

        botMessage = {
          role: 'assistant',
          text: res.answer,
          data: hasTableData ? res.data : null,
          intent: res.intent
        };
      } else if (!res.success && res.error) {
        botMessage = {
          role: 'assistant',
          text: res.error,
          isInfo: true
        };
      } else {
        botMessage = {
          role: 'assistant',
          text: 'Sorry, I ran into an issue. Please try again.',
          isInfo: true
        };
      }

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error(err);
      
      const errorMessage = {
        role: 'assistant',
        text: `I'm having trouble connecting to the server right now. Please try again in a moment.

You can ask me about:
• Past HDB transactions
• Price comparisons
• Popular towns
• Cheapest/Most expensive transactions`,
        isInfo: true
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSampleClick = (prompt) => {
    setInput('');
    handleSend(prompt);
  };

  // Render price prediction card
  const renderPredictionCard = (prediction) => {
    return (
      <div className="mt-3 p-4 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-purple-900">Price Prediction</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-600">Location</p>
            <p className="font-semibold text-slate-900">{prediction.town}</p>
          </div>
          <div>
            <p className="text-slate-600">Flat Type</p>
            <p className="font-semibold text-slate-900">{prediction.flat_type}</p>
          </div>
          <div>
            <p className="text-slate-600">Year</p>
            <p className="font-semibold text-slate-900">{prediction.prediction_year}</p>
          </div>
          <div>
            <p className="text-slate-600">Predicted Price</p>
            <p className="font-bold text-lg text-purple-700">
              ${parseInt(prediction.predicted_price).toLocaleString()}
            </p>
          </div>
          {prediction.confidence_lower && prediction.confidence_upper && (
            <div className="col-span-2">
              <p className="text-slate-600">Confidence Range</p>
              <p className="font-semibold text-slate-700">
                ${parseInt(prediction.confidence_lower).toLocaleString()} - ${parseInt(prediction.confidence_upper).toLocaleString()}
              </p>
            </div>
          )}
          {prediction.yoy_growth_rate && (
            <div>
              <p className="text-slate-600">YoY Growth Rate</p>
              <p className="font-semibold text-slate-900">{prediction.yoy_growth_rate}%</p>
            </div>
          )}
          {prediction.base_price && (
            <div>
              <p className="text-slate-600">Current Base Price</p>
              <p className="font-semibold text-slate-900">
                ${parseInt(prediction.base_price).toLocaleString()}
              </p>
            </div>
          )}
        </div>
        {prediction.note && (
          <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
            <p className="text-xs text-blue-800">{prediction.note}</p>
          </div>
        )}
      </div>
    );
  };

  // Render table for flat data
  const renderFlatsTable = (flats) => {
    const topFlats = flats.slice(0, 5);
    
    return (
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Block</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Street</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Town</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Type</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Price</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Year</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {topFlats.map((flat, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-900">{flat.block}</td>
                <td className="px-3 py-2 text-slate-700">{flat.street_name}</td>
                <td className="px-3 py-2 text-slate-700">{flat.town}</td>
                <td className="px-3 py-2">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                    {flat.flat_type}
                  </span>
                </td>
                <td className="px-3 py-2 font-semibold text-slate-900">
                  ${parseInt(flat.resale_price).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {flat.year || (flat.contract_date ? new Date(flat.contract_date).getFullYear() : 'N/A')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {flats.length > 5 && (
          <p className="text-xs text-slate-500 mt-2 text-center">
            Showing top 5 of {flats.length} results
          </p>
        )}
      </div>
    );
  };

  // Render table for town comparison/popular towns
  const renderTownsTable = (towns) => {
    return (
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Town</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Avg Price</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Min Price</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Max Price</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Transactions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {towns.map((town, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-semibold text-slate-900">{town.town}</td>
                <td className="px-3 py-2 text-slate-900">
                  ${parseInt(town.avg_resale_price || town.avg_price).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  ${parseInt(town.min_price).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  ${parseInt(town.max_price).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {parseInt(town.transactions || town.transaction_count).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render table for price trends
  const renderTrendTable = (points) => {
    const topPoints = points.slice(0, 5);
    
    return (
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Year</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Avg Price</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Min Price</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Max Price</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700">Transactions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {topPoints.map((point, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-3 py-2 font-semibold text-slate-900">{point.year}</td>
                <td className="px-3 py-2 text-slate-900">
                  ${parseInt(point.avg_resale_price).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  ${parseInt(point.min_price).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  ${parseInt(point.max_price).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {parseInt(point.transactions).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {points.length > 5 && (
          <p className="text-xs text-slate-500 mt-2 text-center">
            Showing 5 most recent years of {points.length} total
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50">
      <Navigation />

      <main className="pt-24 pb-10 max-w-6xl mx-auto px-4 md:px-6">
        {/* Header */}
        <section className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                AI Chatbot
              </h1>
              <p className="text-sm md:text-base text-slate-500">
                Analyze Singapore&apos;s HDB past resale transactions with AI
              </p>
            </div>
          </div>
        </section>

        {/* Chat container */}
        <section className="bg-white/80 backdrop-blur rounded-3xl shadow-lg border border-slate-100 flex flex-col h-[70vh]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm md:text-base shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-sm'
                      : msg.isInfo
                      ? 'bg-blue-50 text-blue-900 rounded-bl-sm border border-blue-200'
                      : 'bg-slate-50 text-slate-900 rounded-bl-sm border border-slate-100'
                  }`}
                >
                  {/* Message text */}
                  <div className="whitespace-pre-line">{msg.text}</div>

                  {/* Render data visualizations */}
                  {msg.data && (
                    <>
                      {msg.data.flats && msg.data.flats.length > 0 && renderFlatsTable(msg.data.flats)}
                      {msg.data.towns && msg.data.towns.length > 0 && renderTownsTable(msg.data.towns)}
                      {msg.data.points && msg.data.points.length > 0 && renderTrendTable(msg.data.points)}
                      {msg.data.prediction && renderPredictionCard(msg.data.prediction)}
                      {msg.data.predictions && msg.data.predictions.length > 0 && 
                        msg.data.predictions.map((pred, i) => (
                          <div key={i}>{renderPredictionCard(pred)}</div>
                        ))
                      }
                    </>
                  )}

                  {/* Show fallback note if exists */}
                  {msg.data && msg.data.fallback && (
                    <div className="mt-2 flex items-start gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                      <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-800">{msg.data.fallback}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 border border-slate-100 text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing data…
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input + sample prompts */}
          <div className="border-t border-slate-100 bg-white/90 rounded-b-3xl px-4 md:px-6 py-3 space-y-2">
            {/* Sample prompts */}
            <div className="flex flex-wrap gap-2">
              {samplePrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSampleClick(p)}
                  className="text-xs md:text-sm px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors whitespace-nowrap"
                  type="button"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Input row */}
            <div className="flex items-center gap-2">
              <textarea
                rows={1}
                className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ask about past HDB transactions, trends, or comparisons..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transition-shadow"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}