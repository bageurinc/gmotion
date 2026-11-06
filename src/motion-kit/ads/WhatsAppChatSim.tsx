'use client';

import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'customer' | 'ai';
  text: string;
  time: string;
  delayFrames?: number;
  status?: 'sent' | 'delivered' | 'read' | 'ghosted';
}

export interface WhatsAppChatSimProps {
  contactName?: string;
  contactStatus?: string;
  avatarBg?: string;
  messages: ChatMessage[];
  showTypingAfterFrame?: number;
  showGhostingAlert?: boolean;
  style?: React.CSSProperties;
}

export const WhatsAppChatSim: React.FC<WhatsAppChatSimProps> = ({
  contactName = 'Customer Calon Buyer',
  contactStatus = 'Online',
  avatarBg = '#10B981',
  messages = [],
  showTypingAfterFrame,
  showGhostingAlert = false,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#0B141A',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        ...style,
      }}
    >
      {/* WhatsApp Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          backgroundColor: '#1F2C34',
          borderBottom: '1px solid #2A3942',
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: avatarBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: 17,
            flexShrink: 0,
          }}
        >
          {contactName.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: '#E9EDEF',
              fontWeight: 600,
              fontSize: 15,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {contactName}
          </div>
          <div style={{ color: '#00A884', fontSize: 12 }}>{contactStatus}</div>
        </div>
        <div style={{ display: 'flex', gap: 14, color: '#AEBAC1' }}>
          {/* WhatsApp call icons */}
          <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1 1 0 0 0-1.02.24l-2.2 2.2a15.05 15.05 0 0 1-6.59-6.59l2.2-2.21a1 1 0 0 0 .25-1A11.36 11.36 0 0 1 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z" />
          </svg>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflow: 'hidden',
          backgroundImage:
            'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        {messages.map((msg, idx) => {
          const delay = msg.delayFrames ?? idx * 18;
          if (frame < delay) return null;

          const msgSpring = spring({
            frame: frame - delay,
            fps,
            config: { damping: 13, stiffness: 140 },
          });

          const isOutgoing = msg.sender === 'user' || msg.sender === 'ai';
          const translateY = interpolate(msgSpring, [0, 1], [25, 0]);
          const scale = interpolate(msgSpring, [0, 1], [0.85, 1]);

          return (
            <div
              key={msg.id || idx}
              style={{
                display: 'flex',
                justifyContent: isOutgoing ? 'flex-end' : 'flex-start',
                transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
                opacity: msgSpring,
              }}
            >
              <div
                style={{
                  maxWidth: '78%',
                  backgroundColor: isOutgoing ? '#005C4B' : '#202C33',
                  color: '#E9EDEF',
                  borderRadius: isOutgoing ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                  padding: '10px 14px',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                  position: 'relative',
                }}
              >
                {/* AI Badge for automated fast reply */}
                {msg.sender === 'ai' && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: 'rgba(56, 189, 248, 0.2)',
                      color: '#38BDF8',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6,
                      marginBottom: 6,
                      textTransform: 'uppercase',
                    }}
                  >
                    ⚡ AI Fast Response (0.5s)
                  </div>
                )}

                <div style={{ fontSize: 14, lineHeight: 1.4 }}>{msg.text}</div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 4,
                    marginTop: 4,
                    fontSize: 11,
                    color: '#8696A0',
                  }}
                >
                  <span>{msg.time}</span>
                  {isOutgoing && (
                    <svg
                      width="16"
                      height="11"
                      viewBox="0 0 16 11"
                      fill="none"
                      style={{ color: msg.status === 'read' ? '#53BDEB' : '#8696A0' }}
                    >
                      {/* Double Blue Check */}
                      <path
                        d="M11.04 1.5L5.75 6.79L3.96 5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M14.54 1.5L9.25 6.79L8.46 6"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* 3 Bouncing Dots Typing Indicator */}
        {showTypingAfterFrame !== undefined && frame >= showTypingAfterFrame && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              backgroundColor: '#202C33',
              borderRadius: '16px 16px 16px 4px',
              padding: '10px 16px',
              width: 'fit-content',
            }}
          >
            {[0, 1, 2].map((dot) => {
              const bounce = Math.sin((frame / fps) * 8 + dot * 1.2) * 4;
              return (
                <div
                  key={dot}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: '#8696A0',
                    transform: `translateY(${bounce}px)`,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Ghosting Alert Banner */}
        {showGhostingAlert && (
          <div
            style={{
              marginTop: 'auto',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1.5px solid #EF4444',
              borderRadius: 14,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.25)',
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 16,
              }}
            >
              !
            </div>
            <div>
              <div style={{ color: '#F87171', fontWeight: 700, fontSize: 13 }}>
                GHOSTED: 4 Jam Tanpa Balasan!
              </div>
              <div style={{ color: '#94A3B8', fontSize: 11 }}>
                83% Calon Pembeli Pindah ke Kompetitor
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
