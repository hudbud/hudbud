import { useState, useCallback, useRef, useEffect } from 'react';
import exifr from 'exifr';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageFile {
  file: File;
  thumbnail: string;
  dateTime: Date | null;
}

interface Moment {
  id: string;
  images: ImageFile[];
  caption: string;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  container: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '40px 24px 120px',
  } as React.CSSProperties,
  heading: {
    fontSize: 28,
    fontWeight: 500,
    color: 'var(--accent)',
    marginBottom: 32,
  } as React.CSSProperties,
  section: {
    marginBottom: 32,
    padding: 20,
    background: 'var(--bg-inner)',
    borderRadius: 6,
    border: '1px solid var(--rule)',
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: 11,
    color: 'var(--fg-dim)',
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--rule)',
    borderRadius: 4,
    color: 'var(--fg)',
    fontSize: 14,
    fontFamily: 'var(--font)',
    outline: 'none',
  } as React.CSSProperties,
  select: {
    padding: '8px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--rule)',
    borderRadius: 4,
    color: 'var(--fg)',
    fontSize: 14,
    fontFamily: 'var(--font)',
    outline: 'none',
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--bg)',
    border: '1px solid var(--rule)',
    borderRadius: 4,
    color: 'var(--fg)',
    fontSize: 14,
    fontFamily: 'var(--font)',
    outline: 'none',
    minHeight: 60,
    resize: 'vertical' as const,
  } as React.CSSProperties,
  row: {
    display: 'flex',
    gap: 16,
    marginBottom: 16,
  } as React.CSSProperties,
  field: {
    flex: 1,
  } as React.CSSProperties,
  dropzone: {
    border: '2px dashed var(--rule)',
    borderRadius: 8,
    padding: '48px 24px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.2s',
    color: 'var(--fg-dim)',
    fontSize: 14,
  } as React.CSSProperties,
  dropzoneActive: {
    borderColor: 'var(--accent)',
    background: 'rgba(208,135,112,0.05)',
  } as React.CSSProperties,
  thumbnailGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 16,
  } as React.CSSProperties,
  thumbnail: {
    width: 80,
    height: 80,
    objectFit: 'cover' as const,
    borderRadius: 4,
    border: '1px solid var(--rule)',
  } as React.CSSProperties,
  momentCard: {
    padding: 16,
    background: 'var(--tile)',
    borderRadius: 6,
    marginBottom: 12,
    border: '1px solid var(--rule)',
  } as React.CSSProperties,
  momentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    fontSize: 11,
    color: 'var(--fg-dim)',
  } as React.CSSProperties,
  momentImages: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
    marginBottom: 10,
  } as React.CSSProperties,
  momentThumb: {
    width: 64,
    height: 64,
    objectFit: 'cover' as const,
    borderRadius: 3,
    border: '1px solid var(--rule)',
    position: 'relative' as const,
  } as React.CSSProperties,
  thumbWrapper: {
    position: 'relative' as const,
    display: 'inline-block',
  } as React.CSSProperties,
  deleteThumb: {
    position: 'absolute' as const,
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: 'var(--accent)',
    color: 'var(--bg)',
    border: 'none',
    fontSize: 11,
    lineHeight: '18px',
    textAlign: 'center' as const,
    cursor: 'pointer',
    fontFamily: 'var(--font)',
    padding: 0,
  } as React.CSSProperties,
  captionInput: {
    width: '100%',
    padding: '6px 10px',
    background: 'var(--bg)',
    border: '1px solid var(--rule)',
    borderRadius: 4,
    color: 'var(--fg)',
    fontSize: 13,
    fontFamily: 'var(--font)',
    outline: 'none',
  } as React.CSSProperties,
  btn: {
    padding: '8px 16px',
    background: 'var(--accent)',
    color: 'var(--bg)',
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    fontFamily: 'var(--font)',
    cursor: 'pointer',
    fontWeight: 500,
  } as React.CSSProperties,
  btnSmall: {
    padding: '4px 10px',
    background: 'transparent',
    color: 'var(--fg-dim)',
    border: '1px solid var(--rule)',
    borderRadius: 3,
    fontSize: 11,
    fontFamily: 'var(--font)',
    cursor: 'pointer',
  } as React.CSSProperties,
  btnDanger: {
    padding: '4px 10px',
    background: 'transparent',
    color: '#bf616a',
    border: '1px solid #bf616a44',
    borderRadius: 3,
    fontSize: 11,
    fontFamily: 'var(--font)',
    cursor: 'pointer',
  } as React.CSSProperties,
  toggle: {
    display: 'flex',
    gap: 0,
    borderRadius: 4,
    overflow: 'hidden',
    border: '1px solid var(--rule)',
  } as React.CSSProperties,
  toggleBtn: {
    padding: '6px 14px',
    background: 'var(--bg)',
    color: 'var(--fg-dim)',
    border: 'none',
    fontSize: 12,
    fontFamily: 'var(--font)',
    cursor: 'pointer',
  } as React.CSSProperties,
  toggleBtnActive: {
    background: 'var(--accent)',
    color: 'var(--bg)',
  } as React.CSSProperties,
  status: {
    marginTop: 16,
    padding: 12,
    borderRadius: 4,
    fontSize: 13,
  } as React.CSSProperties,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function createThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 200 / img.width;
      canvas.width = 200;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };
    img.src = url;
  });
}

async function readExifDate(file: File): Promise<Date | null> {
  try {
    const exif = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate'] });
    if (exif?.DateTimeOriginal) return new Date(exif.DateTimeOriginal);
    if (exif?.CreateDate) return new Date(exif.CreateDate);
    return null;
  } catch {
    return null;
  }
}

function groupIntoMoments(images: ImageFile[]): Moment[] {
  const THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

  const withDates = images.filter((img) => img.dateTime !== null);
  const withoutDates = images.filter((img) => img.dateTime === null);

  // Sort by date
  withDates.sort((a, b) => a.dateTime!.getTime() - b.dateTime!.getTime());

  // Transitive clustering
  const moments: Moment[] = [];
  let current: ImageFile[] = [];

  for (const img of withDates) {
    if (current.length === 0) {
      current.push(img);
    } else {
      const lastInGroup = current[current.length - 1];
      const diff = img.dateTime!.getTime() - lastInGroup.dateTime!.getTime();
      if (diff <= THRESHOLD_MS) {
        current.push(img);
      } else {
        moments.push({ id: generateId(), images: current, caption: '' });
        current = [img];
      }
    }
  }
  if (current.length > 0) {
    moments.push({ id: generateId(), images: current, caption: '' });
  }

  // Each no-date image gets its own moment at the end
  for (const img of withoutDates) {
    moments.push({ id: generateId(), images: [img], caption: '' });
  }

  return moments;
}

function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PostCreator() {
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState<'life' | 'thoughts' | 'resources'>('life');
  const [excerpt, setExcerpt] = useState('');
  const [date, setDate] = useState(todayString());
  const [mode, setMode] = useState<'local' | 'blob'>('local');
  const [moments, setMoments] = useState<Moment[]>([]);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const validExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'];
    const fileArray = Array.from(files).filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return validExts.includes(ext);
    });

    if (fileArray.length === 0) return;

    setLoading(true);
    const newImages: ImageFile[] = [];

    for (const file of fileArray) {
      const [thumbnail, dateTime] = await Promise.all([
        createThumbnail(file),
        readExifDate(file),
      ]);
      newImages.push({ file, thumbnail, dateTime });
    }

    const allImages = [...images, ...newImages];
    setImages(allImages);
    setMoments(groupIntoMoments(allImages));
    setLoading(false);
  }, [images]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) processFiles(e.target.files);
    },
    [processFiles]
  );

  const updateCaption = useCallback((momentId: string, caption: string) => {
    setMoments((prev) =>
      prev.map((m) => (m.id === momentId ? { ...m, caption } : m))
    );
  }, []);

  const removeImageFromMoment = useCallback((momentId: string, imgIndex: number) => {
    setMoments((prev) => {
      const updated = prev.map((m) => {
        if (m.id !== momentId) return m;
        const newImages = m.images.filter((_, i) => i !== imgIndex);
        return { ...m, images: newImages };
      });
      // Remove empty moments
      return updated.filter((m) => m.images.length > 0);
    });
    setImages((prev) => {
      const moment = moments.find((m) => m.id === momentId);
      if (!moment) return prev;
      const removedFile = moment.images[imgIndex]?.file;
      return prev.filter((img) => img.file !== removedFile);
    });
  }, [moments]);

  const mergeMoments = useCallback((momentId: string, direction: 'up' | 'down') => {
    setMoments((prev) => {
      const idx = prev.findIndex((m) => m.id === momentId);
      if (idx < 0) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;

      const merged = [...prev];
      const target = merged[targetIdx];
      const source = merged[idx];
      merged[targetIdx] = {
        ...target,
        images: [...target.images, ...source.images],
        caption: target.caption || source.caption,
      };
      merged.splice(idx, 1);
      return merged;
    });
  }, []);

  const splitMoment = useCallback((momentId: string, atIndex: number) => {
    setMoments((prev) => {
      const idx = prev.findIndex((m) => m.id === momentId);
      if (idx < 0) return prev;
      const moment = prev[idx];
      if (atIndex <= 0 || atIndex >= moment.images.length) return prev;

      const first: Moment = {
        id: moment.id,
        images: moment.images.slice(0, atIndex),
        caption: moment.caption,
      };
      const second: Moment = {
        id: generateId(),
        images: moment.images.slice(atIndex),
        caption: '',
      };

      const updated = [...prev];
      updated.splice(idx, 1, first, second);
      return updated;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      setStatus({ type: 'error', message: 'Title is required.' });
      return;
    }
    if (moments.length === 0) {
      setStatus({ type: 'error', message: 'Add some images first.' });
      return;
    }

    setSubmitting(true);
    setStatus(null);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('tag', tag);
      formData.append('date', date);
      formData.append('excerpt', excerpt);
      formData.append('mode', mode);

      // Build moments metadata (caption + indexes into the flat file list)
      let fileIndex = 0;
      const momentsData: { caption: string; imageIndexes: number[] }[] = [];

      for (const moment of moments) {
        const indexes: number[] = [];
        for (const img of moment.images) {
          formData.append('images', img.file);
          indexes.push(fileIndex++);
        }
        momentsData.push({ caption: moment.caption, imageIndexes: indexes });
      }

      formData.append('moments', JSON.stringify(momentsData));

      const res = await fetch(`/api/create-post?mode=${mode}`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setStatus({ type: 'success', message: `Post created: ${data.path}` });
      } else {
        setStatus({ type: 'error', message: data.error || 'Unknown error' });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Network error' });
    } finally {
      setSubmitting(false);
    }
  }, [title, tag, date, excerpt, mode, moments]);

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>New Post</h1>

      {/* ─── Metadata ─────────────────────────────────────────────── */}
      <div style={styles.section}>
        <div style={styles.row}>
          <div style={{ ...styles.field, flex: 2 }}>
            <label style={styles.label}>Title</label>
            <input
              style={styles.input}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Tag</label>
            <select
              style={styles.select}
              value={tag}
              onChange={(e) => setTag(e.target.value as any)}
            >
              <option value="life">life</option>
              <option value="thoughts">thoughts</option>
              <option value="resources">resources</option>
            </select>
          </div>
        </div>
        <div style={styles.row}>
          <div style={{ ...styles.field, flex: 2 }}>
            <label style={styles.label}>Excerpt</label>
            <textarea
              style={styles.textarea}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Short description (optional)"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Date</label>
            <input
              style={styles.input}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Save Mode</label>
            <div style={styles.toggle}>
              <button
                style={{
                  ...styles.toggleBtn,
                  ...(mode === 'local' ? styles.toggleBtnActive : {}),
                }}
                onClick={() => setMode('local')}
              >
                Local
              </button>
              <button
                style={{
                  ...styles.toggleBtn,
                  ...(mode === 'blob' ? styles.toggleBtnActive : {}),
                }}
                onClick={() => setMode('blob')}
              >
                Vercel Blob
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Drop Zone ────────────────────────────────────────────── */}
      <div style={styles.section}>
        <label style={styles.label}>Images</label>
        <div
          style={{
            ...styles.dropzone,
            ...(dragOver ? styles.dropzoneActive : {}),
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          {loading
            ? 'Processing images...'
            : images.length > 0
            ? `${images.length} image${images.length !== 1 ? 's' : ''} loaded. Drop more or click to add.`
            : 'Drop images here, or click to select files'}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.heic,.gif"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        {images.length > 0 && (
          <div style={styles.thumbnailGrid}>
            {images.map((img, i) => (
              <img key={i} src={img.thumbnail} style={styles.thumbnail} alt="" />
            ))}
          </div>
        )}
      </div>

      {/* ─── Moments ──────────────────────────────────────────────── */}
      {moments.length > 0 && (
        <div style={styles.section}>
          <label style={styles.label}>Moments ({moments.length})</label>
          {moments.map((moment, mIdx) => (
            <div key={moment.id} style={styles.momentCard}>
              <div style={styles.momentHeader}>
                <span>
                  Moment {mIdx + 1} — {moment.images.length} image
                  {moment.images.length !== 1 ? 's' : ''}
                  {moment.images[0]?.dateTime && (
                    <> — {moment.images[0].dateTime.toLocaleString()}</>
                  )}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {mIdx > 0 && (
                    <button
                      style={styles.btnSmall}
                      onClick={() => mergeMoments(moment.id, 'up')}
                      title="Merge with moment above"
                    >
                      merge up
                    </button>
                  )}
                  {mIdx < moments.length - 1 && (
                    <button
                      style={styles.btnSmall}
                      onClick={() => mergeMoments(moment.id, 'down')}
                      title="Merge with moment below"
                    >
                      merge down
                    </button>
                  )}
                </div>
              </div>
              <div style={styles.momentImages}>
                {moment.images.map((img, iIdx) => (
                  <div key={iIdx} style={styles.thumbWrapper}>
                    <img src={img.thumbnail} style={styles.momentThumb} alt="" />
                    <button
                      style={styles.deleteThumb}
                      onClick={() => removeImageFromMoment(moment.id, iIdx)}
                      title="Remove image"
                    >
                      x
                    </button>
                    {moment.images.length > 1 && iIdx > 0 && (
                      <button
                        style={{
                          position: 'absolute',
                          bottom: -4,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          width: 18,
                          height: 14,
                          borderRadius: 2,
                          background: 'var(--rule)',
                          color: 'var(--fg-dim)',
                          border: 'none',
                          fontSize: 9,
                          cursor: 'pointer',
                          fontFamily: 'var(--font)',
                          padding: 0,
                          lineHeight: '14px',
                          textAlign: 'center',
                        }}
                        onClick={() => splitMoment(moment.id, iIdx)}
                        title="Split here"
                      >
                        |
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <input
                style={styles.captionInput}
                type="text"
                value={moment.caption}
                onChange={(e) => updateCaption(moment.id, e.target.value)}
                placeholder="Caption for this moment..."
              />
            </div>
          ))}
        </div>
      )}

      {/* ─── Submit ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          style={{
            ...styles.btn,
            opacity: submitting ? 0.6 : 1,
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Creating...' : 'Create Post'}
        </button>
        {status && (
          <div
            style={{
              ...styles.status,
              color: status.type === 'success' ? '#a3be8c' : '#bf616a',
              background:
                status.type === 'success'
                  ? 'rgba(163,190,140,0.1)'
                  : 'rgba(191,97,106,0.1)',
            }}
          >
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}
