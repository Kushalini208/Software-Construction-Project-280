// ─── UPLOAD ───────────────────────────────────────────────────────────
import { supabase, BUCKET } from './supabase.js';
import { currentUser } from './auth.js';
import { loadNotes } from './notes.js';
import { showToast } from './app.js';

const modal    = document.getElementById('upload-modal');
const form     = document.getElementById('upload-form');
const fileInput = document.getElementById('upload-file');
const fileLabel = document.getElementById('file-drop-label');
const errEl    = document.getElementById('upload-error');
const btnText  = document.getElementById('upload-btn-text');
const spinner  = document.getElementById('upload-spinner');
const submitBtn = document.getElementById('btn-upload-submit');

// Open / close
document.getElementById('btn-open-upload').addEventListener('click', () => openModal());
document.getElementById('close-upload').addEventListener('click', closeModal);
document.getElementById('cancel-upload').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

function openModal() {
  modal.classList.add('open');
  form.reset();
  fileLabel.textContent = 'Drop PDF here or click to browse';
  errEl.textContent = '';
}
function closeModal() {
  modal.classList.remove('open');
}

// File label update
fileInput.addEventListener('change', () => {
  const f = fileInput.files[0];
  fileLabel.textContent = f ? `${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)` : 'Drop PDF here or click to browse';
});

// Submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errEl.textContent = '';

  const file    = fileInput.files[0];
  const title   = document.getElementById('upload-title').value.trim();
  const subject = document.getElementById('upload-subject').value.trim();
  const year    = document.getElementById('upload-year').value.trim();
  const desc    = document.getElementById('upload-desc').value.trim();
  const rawTags = document.getElementById('upload-tags').value;
  const tags    = rawTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

  if (!file) { errEl.textContent = 'Please select a PDF file.'; return; }
  if (file.type !== 'application/pdf') { errEl.textContent = 'Only PDF files are allowed.'; return; }
  if (file.size > 20 * 1024 * 1024) { errEl.textContent = 'File must be under 20 MB.'; return; }

  // UI loading state
  btnText.textContent = 'Uploading…';
  spinner.style.display = 'inline-block';
  submitBtn.disabled = true;

  try {
    // 1. Upload PDF to storage
    const ext = 'pdf';
    const filePath = `${currentUser.id}/${Date.now()}.${ext}`;
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, { contentType: 'application/pdf', upsert: false });

    if (storageError) throw storageError;

    // 2. Insert note record
    const { error: dbError } = await supabase.from('notes').insert({
      user_id:     currentUser.id,
      title,
      subject,
      year:        year || null,
      description: desc || null,
      tags,
      file_path:   filePath,
    });

    if (dbError) {
      // Clean up orphaned file
      await supabase.storage.from(BUCKET).remove([filePath]);
      throw dbError;
    }

    closeModal();
    showToast('Notes uploaded successfully!');
    await loadNotes();

  } catch (err) {
    errEl.textContent = err.message || 'Upload failed. Please try again.';
  } finally {
    btnText.textContent = 'Upload notes';
    spinner.style.display = 'none';
    submitBtn.disabled = false;
  }
});
