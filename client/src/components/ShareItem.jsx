import './ShareItem.css';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fileIcon(mime) {
  if (mime?.includes('pdf')) return '📄';
  if (mime?.includes('zip') || mime?.includes('rar')) return '📦';
  if (mime?.includes('json') || mime?.includes('javascript') || mime?.includes('typescript')) return '📜';
  return '📁';
}

function DeleteButton({ onClick }) {
  return (
    <button className="delete-btn" onClick={onClick} title="Delete">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}

function ItemToolbar({ timestamp, children }) {
  return (
    <div className="item-toolbar">
      <div className="item-toolbar-actions">{children}</div>
      <span className="item-time">{formatTime(timestamp)}</span>
    </div>
  );
}

export default function ShareItem({ item, deleting, onImageClick, onDelete, showToast }) {
  const copyText = () => {
    navigator.clipboard.writeText(item.content);
    showToast('Copied');
  };

  const copyImage = async () => {
    try {
      const res = await fetch(item.url);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      showToast('Image copied');
    } catch {
      try {
        await navigator.clipboard.writeText(`${window.location.origin}${item.url}`);
        showToast('Image link copied');
      } catch {
        showToast('Could not copy image');
      }
    }
  };

  const handleDelete = () => onDelete(item.id);

  if (item.type === 'text' || item.type === 'code') {
    return (
      <div className={`share-item ${item.type} ${deleting ? 'deleting' : ''}`}>
        <div className="item-header">
          <span className="item-type">{item.type === 'code' ? 'Code' : 'Text'}</span>
          <ItemToolbar timestamp={item.timestamp}>
            <button className="action-btn" onClick={copyText} title="Copy">Copy</button>
            <DeleteButton onClick={handleDelete} />
          </ItemToolbar>
        </div>
        <pre className="item-content">{item.content}</pre>
      </div>
    );
  }

  if (item.type === 'image') {
    return (
      <div className={`share-item image ${deleting ? 'deleting' : ''}`}>
        <div className="item-header">
          <span className="item-type">Image</span>
          <ItemToolbar timestamp={item.timestamp}>
            <button className="action-btn" onClick={copyImage} title="Copy image">Copy</button>
            <DeleteButton onClick={handleDelete} />
          </ItemToolbar>
        </div>
        <div className="image-wrap">
          <img
            src={item.url}
            alt={item.filename}
            className="item-image"
            onClick={() => onImageClick(item.url)}
          />
        </div>
        <div className="item-footer">
          <span>{item.filename}</span>
          <span>{formatSize(item.size)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`share-item file ${deleting ? 'deleting' : ''}`}>
      <div className="item-header">
        <span className="item-type">File</span>
        <ItemToolbar timestamp={item.timestamp}>
          <DeleteButton onClick={handleDelete} />
        </ItemToolbar>
      </div>
      <a href={item.url} download={item.filename} className="file-card">
        <span className="file-icon">{fileIcon(item.mimeType)}</span>
        <div className="file-info">
          <span className="file-name">{item.filename}</span>
          <span className="file-size">{formatSize(item.size)}</span>
        </div>
        <span className="download-icon">↓</span>
      </a>
    </div>
  );
}
