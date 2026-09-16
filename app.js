import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

const ffmpeg = new FFmpeg();
const $ = (id) => document.getElementById(id);

const fileInput = $('fileInput');
const dropZone  = $('dropZone');
const processBtn = $('processBtn');
const btnText   = $('btnText');
const statusEl  = $('status');
const progress  = $('progress');
const output    = $('output');
const downloadLink = $('downloadLink');
const resultBox = $('resultBox');

let currentFile = null;
let ffmpegReady = false;

/* ===== أدوات مساعدة ===== */
function toArabicNumber(n) {
  return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}
function formatSize(bytes) {
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) return toArabicNumber(mb.toFixed(1)) + ' ميجابايت';
  return toArabicNumber((mb / 1024).toFixed(2)) + ' جيجابايت';
}
function setStatus(text) { statusEl.textContent = text; }

/* ===== اختيار الملف ===== */
fileInput.addEventListener('change', (e) => setFile(e.target.files[0]));
['dragover', 'dragleave', 'drop'].forEach(evt => {
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.toggle('dragover', evt === 'dragover');
    if (evt === 'drop' && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  });
});

function setFile(file) {
  if (!file || !file.type.startsWith('video/')) {
    setStatus('⚠️ الرجاء اختيار ملف فيديو صالح.');
    return;
  }
  currentFile = file;
  processBtn.disabled = false;
  resultBox.hidden = true;
  progress.hidden = true;
  setStatus(`📁 تم اختيار: ${file.name} — الحجم: ${formatSize(file.size)}`);
}

/* ===== تحميل FFmpeg ===== */
async function initFFmpeg() {
  if (ffmpegReady) return;
  setStatus('⏳ جاري تحميل محرّك المعالجة (يحدث مرة واحدة فقط)...');
  await ffmpeg.load({
    coreURL: await toBlobURL(
      'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
      'text/javascript'
    ),
    wasmURL: await toBlobURL(
      'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
      'application/wasm'
    ),
  });
  ffmpegReady = true;
}

ffmpeg.on('progress', ({ progress: p }) => {
  const percent = Math.max(0, Math.min(100, p * 100));
  progress.hidden = false;
  progress.value = percent;
  setStatus(`🔧 جاري التحسين... ${toArabicNumber(percent.toFixed(0))}٪`);
});

/* ===== بدء المعالجة ===== */
processBtn.addEventListener('click', async () => {
  if (!currentFile) return;

  processBtn.disabled = true;
  btnText.textContent = '⏳ جاري المعالجة...';
  downloadLink.hidden = true;
  resultBox.hidden = true;
  progress.hidden = false;
  progress.value = 0;

  try {
    await initFFmpeg();

    setStatus('📥 جاري تحضير الفيديو...');
    await ffmpeg.writeFile('input.mp4', await fetchFile(currentFile));

    const filters = buildFilters();
    setStatus('🚀 جاري تطبيق التحسينات بالذكاء الاصطناعي...');

    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-vf', filters.join(','),
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      'output.mp4'
    ]);

    setStatus('📤 جاري تجهيز النتيجة النهائية...');
    const data = await ffmpeg.readFile('output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    const url  = URL.createObjectURL(blob);

    output.src = url;
    downloadLink.href = url;
    downloadLink.download =
      'محسّن_' + currentFile.name.replace(/\.[^.]+$/, '') + '.mp4';

    resultBox.hidden = false;
    progress.hidden = true;
    setStatus('✅ تمت المعالجة بنجاح! يمكنك الآن تحميل الفيديو.');
  } catch (err) {
    console.error(err);
    setStatus('❌ حدث خطأ أثناء المعالجة: ' + (err.message || 'خطأ غير معروف'));
    progress.hidden = true;
  } finally {
    processBtn.disabled = false;
    btnText.textContent = '🚀 ابدأ التحسين';
  }
});

/* ===== بناء الفلاتر ===== */
function buildFilters() {
  const scale    = $('scale').value;
  const aiUp     = $('aiUpscale').checked;
  const denoise  = $('denoise').checked;
  const colorFix = $('colorFix').checked;
  const sharpen  = $('sharpen').checked;
  const stab     = $('stabilize').checked;

  const f = [];

  if (stab) {
    f.push('deshake=rx=32:ry=32');
  }

  if (scale !== '1') {
    f.push(`scale=iw*${scale}:ih*${scale}:flags=lanczos`);
  }

  if (aiUp) {
    f.push('unsharp=5:5:1.5:5:5:0.0');
  }

  if (denoise) {
    f.push('hqdn3d=2:2:6:6');
  }

  if (colorFix) {
    f.push('eq=contrast=1.06:saturation=1.12:brightness=0.02:gamma=1.02');
    f.push('colorbalance=rs=.02:gs=.01:bs=-.02');
  }

  if (sharpen) {
    f.push('unsharp=5:5:1.2:5:5:0.0');
  }

  return f.length ? f : ['null'];
}
