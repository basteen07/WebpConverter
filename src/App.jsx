import React, { useEffect, useMemo, useRef, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function bytesToString(bytes) {
  if (bytes === 0) return '0 B';
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const fixed = n < 10 && i > 0 ? 1 : 0;
  return `${n.toFixed(fixed)} ${units[i]}`;
}

function filenameFromContentDisposition(dispo, fallback) {
  if (!dispo) return fallback;
  // Try RFC5987 then basic filename=
  const star = dispo.match(/filename\*=UTF-8''([^;]+)/i);
  if (star?.[1]) return decodeURIComponent(star[1].replace(/(^"|"$)/g, ''));
  const basic = dispo.match(/filename="?([^"]+)"?/i);
  return (basic?.[1] || fallback);
}

export default function App() {
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [output, setOutput] = useState('auto'); // auto | zip
  const [quality, setQuality] = useState(80);
  const [lossless, setLossless] = useState(false);
  const [nearLossless, setNearLossless] = useState(false);
  const [effort, setEffort] = useState(4);
  const [smartSubsample, setSmartSubsample] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadName, setDownloadName] = useState('');

  const inputRef = useRef(null);

  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  const hasFiles = files.length > 0;

  function addFiles(fileList) {
    const accepted = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (!accepted.length) return;
    setFiles((prev) => [...prev, ...accepted]);
    const newUrls = accepted.map((f) => URL.createObjectURL(f));
    setPreviews((prev) => [...prev, ...newUrls]);
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
    e.currentTarget.classList.remove('dz-hover');
  }

  function onDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dz-hover');
  }

  function onDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dz-hover');
  }

  function onBrowse(e) {
    if (e.target?.files?.length) addFiles(e.target.files);
  }

  function clearSelection() {
    setFiles([]);
    previews.forEach((u) => URL.revokeObjectURL(u));
    setPreviews([]);
    setError('');
    setDownloadUrl('');
    setDownloadName('');
    if (inputRef.current) inputRef.current.value = '';
  }

  const canSubmit = useMemo(() => {
    if (!files.length) return false;
    if (lossless && nearLossless) return false;
    return true;
  }, [files.length, lossless, nearLossless]);

  async function handleConvert() {
    setError('');
    setDownloadUrl('');
    setDownloadName('');

    if (!files.length) {
      setError('Please add at least one image.');
      return;
    }

    const fd = new FormData();
    files.forEach((f) => fd.append('images', f));

    const params = new URLSearchParams({
      output,
      quality: String(quality),
      lossless: String(lossless),
      nearLossless: String(nearLossless),
      effort: String(effort),
      smartSubsample: String(smartSubsample),
    });

    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/convert?${params.toString()}`, {
        method: 'POST',
        body: fd,
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(text || `HTTP ${resp.status}`);
      }
      const blob = await resp.blob();
      const dispo = resp.headers.get('Content-Disposition');
      const type = resp.headers.get('Content-Type') || '';
      const fallback = type.includes('zip') ? 'converted.zip' : 'converted.webp';
      const name = filenameFromContentDisposition(dispo, fallback);
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setDownloadName(name);
    } catch (err) {
      setError(err.message || 'Conversion failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <style>
        {`
          :root {
            --bg: #f8fafc;
            --card: #ffffff;
            --text: #0f172a;
            --muted: #64748b;
            --border: #e2e8f0;
            --primary: #2563eb;
            --primary-600: #1d4ed8;
            --success: #16a34a;
            --success-600: #15803d;
            --danger: #dc2626;
          }
          * { box-sizing: border-box; }
          html, body, #root { height: 100%; }
          body { margin: 0; background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
          a { color: var(--primary); text-decoration: none; }
          a:hover { text-decoration: underline; }

          .container { max-width: 1200px; margin: 0 auto; padding: 0 16px; }

          header {
            position: sticky; top: 0; z-index: 10;
            background: var(--card); border-bottom: 1px solid var(--border);
          }
          .header-inner {
            display: flex; align-items: center; justify-content: space-between;
            padding: 14px 0;
          }
          h1 { font-size: 20px; margin: 0; }

          main { padding: 24px 0; }
          .grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
          @media (min-width: 1024px) {
            .grid { grid-template-columns: 1fr 1fr; }
          }

          .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px;
          }

          .dropzone {
            border: 2px dashed var(--border);
            border-radius: 12px;
            padding: 24px;
            transition: border-color .2s ease, background-color .2s ease;
            background: var(--card);
          }
          .dz-hover { border-color: var(--primary); background: #eff6ff; }
          .dz-contents { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; }
          .note { color: var(--muted); font-size: 12px; }

          .btn {
            display: inline-flex; align-items: center; justify-content: center;
            gap: 8px; padding: 10px 14px; border-radius: 10px;
            border: 0; cursor: pointer; font-weight: 600;
          }
          .btn-primary { background: var(--primary); color: white; }
          .btn-primary:hover { background: var(--primary-600); }
          .btn-muted { background: #f1f5f9; color: #0f172a; }
          .btn-muted:hover { background: #e2e8f0; }
          .btn:disabled { opacity: .6; cursor: not-allowed; }

          .row { margin: 12px 0; }
          .label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
          .select, .input {
            width: 100%; background: white; border: 1px solid var(--border);
            border-radius: 10px; padding: 10px 12px; font-size: 14px;
          }
          .checkbox { margin-right: 8px; }

          .actions { display: flex; flex-direction: column; gap: 10px; }
          @media (min-width: 640px) {
            .actions { flex-direction: row; }
          }

          .previews { margin-top: 16px; }
          .previews-title { font-size: 14px; font-weight: 600; color: #334155; margin-bottom: 8px; }
          .preview-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          @media (min-width: 640px) { .preview-grid { grid-template-columns: repeat(3, 1fr); } }
          @media (min-width: 768px) { .preview-grid { grid-template-columns: repeat(4, 1fr); } }
          .preview-card { border: 1px solid var(--border); border-radius: 10px; padding: 8px; background: white; }
          .preview-media { position: relative; width: 100%; padding-bottom: 75%; background: #f1f5f9; border-radius: 8px; overflow: hidden; }
          .preview-media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
          .preview-name { font-size: 12px; font-weight: 600; margin-top: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .preview-size { font-size: 11px; color: var(--muted); }

          .help { font-size: 12px; color: var(--muted); margin-top: 10px; }

          .error {
            color: var(--danger); background: #fef2f2; border: 1px solid #fecaca;
            padding: 8px 10px; border-radius: 10px; font-size: 14px;
          }

          .success {
            border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 10px;
            padding: 10px; display: flex; align-items: center; justify-content: space-between;
          }
          .success .download { background: var(--success); color: white; padding: 8px 12px; border-radius: 8px; }
          .success .download:hover { background: var(--success-600); text-decoration: none; }

          .spin {
            width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.7);
            border-top-color: transparent; border-radius: 9999px;
            animation: spin .9s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}
      </style>

      <header>
        <div className="container header-inner">
          <h1>WebP Converter</h1>
          <a href={`${API_BASE_URL}/health`} target="_blank" rel="noreferrer">API Health</a>
        </div>
      </header>

      <main>
        <div className="container">
          <div className="grid">
            {/* Uploader */}
            <section>
              <div
                className="dropzone"
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
              >
                <div className="dz-contents">
                  <div style={{ width: 48, height: 48, borderRadius: 9999, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6H16a4 4 0 010 8H7z"/>
                    </svg>
                  </div>
                  <div style={{ color: '#475569', fontSize: 14 }}>
                    Drag and drop images here, or browse to select
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" type="button" onClick={() => inputRef.current?.click()}>
                      Choose files
                    </button>
                    {hasFiles && (
                      <button className="btn btn-muted" type="button" onClick={clearSelection}>
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={onBrowse}
                    style={{ display: 'none' }}
                  />
                  <div className="note">JPEG, PNG, TIFF, HEIC, BMP, SVG... up to 50MB each (default)</div>
                </div>
              </div>

              {hasFiles && (
                <div className="previews">
                  <div className="previews-title">Selected files ({files.length})</div>
                  <div className="preview-grid">
                    {files.map((f, i) => (
                      <div className="preview-card" key={i}>
                        <div className="preview-media">
                          {previews[i] && (
                            <img src={previews[i]} alt={f.name} />
                          )}
                        </div>
                        <div className="preview-name" title={f.name}>{f.name}</div>
                        <div className="preview-size">{bytesToString(f.size)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Options */}
            <section className="card">
              <h2 style={{ margin: '0 0 12px 0', fontSize: 18 }}>Options</h2>

              <div className="row">
                <label className="label">Output</label>
                <select className="select" value={output} onChange={(e) => setOutput(e.target.value)}>
                  <option value="auto">auto (1 file → .webp, many → .zip)</option>
                  <option value="zip">zip (always)</option>
                </select>
              </div>

              <div className="row">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label className="label" style={{ marginBottom: 0 }}>Quality</label>
                  <span style={{ fontSize: 14, color: '#334155' }}>{quality}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={quality}
                  disabled={lossless}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                {lossless && <div className="note" style={{ marginTop: 6 }}>Disabled in lossless mode</div>}
              </div>

              <div className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    className="checkbox"
                    type="checkbox"
                    checked={lossless}
                    onChange={(e) => {
                      setLossless(e.target.checked);
                      if (e.target.checked) setNearLossless(false);
                    }}
                  />
                  <span style={{ fontSize: 14 }}>Lossless</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    className="checkbox"
                    type="checkbox"
                    checked={nearLossless}
                    onChange={(e) => {
                      setNearLossless(e.target.checked);
                      if (e.target.checked) setLossless(false);
                    }}
                  />
                  <span style={{ fontSize: 14 }}>Near-lossless</span>
                </label>
              </div>

              <div className="row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label">Effort (0–6)</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={6}
                    value={effort}
                    onChange={(e) => setEffort(Number(e.target.value))}
                  />
                  <div className="note" style={{ marginTop: 6 }}>Higher = smaller files, slower</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    className="checkbox"
                    type="checkbox"
                    checked={smartSubsample}
                    onChange={(e) => setSmartSubsample(e.target.checked)}
                  />
                  <span style={{ fontSize: 14 }}>Smart subsample</span>
                </label>
              </div>

              {error && <div className="error">{error}</div>}

              <div className="actions row">
                <button
                  className="btn btn-primary"
                  onClick={handleConvert}
                  disabled={!canSubmit || loading}
                >
                  {loading && <span className="spin" />}
                  Convert
                </button>
                <button
                  className="btn btn-muted"
                  onClick={clearSelection}
                  disabled={loading || !hasFiles}
                >
                  Reset
                </button>
              </div>

              {downloadUrl && (
                <div className="success">
                  <div style={{ fontSize: 14, color: '#065f46' }}>
                    Ready: {downloadName}
                  </div>
                  <a className="download" href={downloadUrl} download={downloadName}>
                    Download
                  </a>
                </div>
              )}

              <div className="help">
                Tip: For multiple images, choose “zip” output for a single archive.
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer style={{ textAlign: 'center', fontSize: 12, color: '#64748b', padding: '24px 0' }}>
        Built with React · {new Date().getFullYear()}
      </footer>
    </div>
  );
}