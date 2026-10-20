import { useEffect, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from '@/components/ai-elements/prompt-input';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { Button } from '@/components/ui/button';
import { RelaxOwl } from './owl';

const starters = ["What should I eat right now?", "When is check-out?", "Suggest a veg dish"];

export function OwlChat({ pending, onPendingSent }: { pending?: string; onPendingSent?: () => void }) {
  const { messages, sendMessage, status, stop, error } = useChat({ transport: new DefaultChatTransport({ api: '/api/chat' }) });
  const busy = status === 'submitted' || status === 'streaming';
  const box = useRef<HTMLDivElement>(null);
  const focus = () => box.current?.querySelector('textarea')?.focus();
  useEffect(() => { focus(); }, [status]);
  useEffect(() => { if (pending && !busy) { sendMessage({ text: pending }); onPendingSent?.(); } }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="owl-chat" ref={box}>
    <Conversation className="owl-chat-log">
      <ConversationContent>
        {messages.length === 0 ? <ConversationEmptyState>
          <div className="owl-chat-avatar"><RelaxOwl /></div><h3>Hoot! I'm Relax.</h3><p className="muted-copy">Ask me about food, timings or your stay.</p>
          <div className="owl-starters">{starters.map(s => <Button key={s} variant="hotelToggle" onClick={() => sendMessage({ text: s })}>{s}</Button>)}</div>
        </ConversationEmptyState> : messages.map(m => <Message from={m.role} key={m.id}><MessageContent className={m.role === 'user' ? 'owl-user' : 'owl-bot'}>
          {m.parts.map((p, i) => p.type === 'text' ? (m.role === 'assistant' ? <MessageResponse key={i}>{p.text}</MessageResponse> : <span key={i}>{p.text}</span>) : null)}
        </MessageContent></Message>)}
        {status === 'submitted' && <Shimmer>Relax is thinking...</Shimmer>}
        {error && <p className="owl-error" role="alert">{error.message || "Relax couldn't answer. Please ask the front desk."}</p>}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
    <PromptInput className="owl-input" onSubmit={({ text }) => { if (text.trim() && !busy) sendMessage({ text }); }}>
      <PromptInputTextarea placeholder="Ask Relax anything..." />
      <PromptInputFooter className="justify-end"><PromptInputSubmit status={status} onStop={stop} /></PromptInputFooter>
    </PromptInput>
  </div>;
}
