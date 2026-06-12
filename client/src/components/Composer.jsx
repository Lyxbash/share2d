import { useRef, useEffect, useCallback } from 'react';
import './Composer.css';

export default function Composer({ onSend, onPasteImage, onPasteFiles, onFilesSelected }) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = textareaRef.current?.value.trim();
      if (text) {
        onSend(text);
        textareaRef.current.value = '';
        autoResize();
      }
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) onPasteImage(blob);
        return;
      }
    }

    const files = [...e.clipboardData.files];
    if (files.length > 0) {
      e.preventDefault();
      onPasteFiles(files);
    }
  };

  const handleSendClick = () => {
    const text = textareaRef.current?.value.trim();
    if (text) {
      onSend(text);
      textareaRef.current.value = '';
      autoResize();
    }
  };

  return (
    <div className="composer">
      <div className="composer-inner">
        <button
          type="button"
          className="composer-attach"
          onClick={() => fileInputRef.current?.click()}
          title="Upload file"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            for (const file of e.target.files) onFilesSelected(file);
            e.target.value = '';
          }}
        />
        <textarea
          ref={textareaRef}
          className="composer-input"
          placeholder="Type something, or paste text / screenshots..."
          rows={1}
          onInput={autoResize}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />
        <button className="composer-send" onClick={handleSendClick} title="Send (Enter)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
      <p className="composer-hint">
        <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> new line · <kbd>Ctrl+V</kbd> paste anywhere
      </p>
    </div>
  );
}
