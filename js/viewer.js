// ─── VIEWER ───────────────────────────────────────────────────────────
// ─── Top of viewer.js ───
import { supabase, getPublicUrl } from './supabase.js'; // Changed source
import { currentUser } from './auth.js';
import { showToast } from './app.js';

const modal       = document.getElementById('viewer-modal');
const iframe      = document.getElementById('pdf-iframe');
const titleEl     = document.getElementById('viewer-title');
const metaEl      = document.getElementById('viewer-meta');
const downloadBtn = document.getElementById('viewer-download');
const commentsList = document.getElementById('comments-list');
const commentInput = document.getElementById('comment-input');
const postBtn     = document.getElementById('btn-post-comment');
const closeBtn    = document.getElementById('close-viewer');

let currentNote = null;
let commentsChannel = null;

export function openViewer(note) {
  currentNote = note;
  const url = getPublicUrl(note.file_path);

  titleEl.textContent = note.title;
  iframe.src = url;
  downloadBtn.href = url;

  // Meta line
  const parts = [];
  if (note.subject) parts.push(note.subject);
  if (note.year) parts.push(note.year);
  const uploaderName = note.profiles?.full_name || note.profiles?.email?.split('@')[0] || 'Unknown';
  const date = new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  parts.push(`by ${uploaderName}`);
  parts.push(date);
  metaEl.textContent = parts.join(' · ');

  modal.classList.add('open');
  loadComments(note.id);
  subscribeComments(note.id);
}

closeBtn.addEventListener('click', closeViewer);
modal.addEventListener('click', e => { if (e.target === modal) closeViewer(); });

function closeViewer() {
  modal.classList.remove('open');
  iframe.src = '';
  if (commentsChannel) {
    supabase.removeChannel(commentsChannel);
    commentsChannel = null;
  }
}

// ── Load comments
async function loadComments(noteId) {
  commentsList.innerHTML = '<div class="comments-loading">Loading…</div>';

  const { data, error } = await supabase
    .from('comments')
    .select(`
      id, body, created_at,
      profiles:user_id ( full_name, email )
    `)
    .eq('note_id', noteId)
    .order('created_at', { ascending: true });

  if (error) {
    commentsList.innerHTML = `<div class="comments-loading">Error: ${error.message}</div>`;
    return;
  }

  renderComments(data || []);
}

function renderComments(comments) {
  if (comments.length === 0) {
    commentsList.innerHTML = '<div class="no-comments">No comments yet. Be the first!</div>';
    return;
  }
  commentsList.innerHTML = '';
  comments.forEach(c => commentsList.appendChild(buildCommentEl(c)));
  commentsList.scrollTop = commentsList.scrollHeight;
}

function buildCommentEl(comment) {
  const name = comment.profiles?.full_name || 'User';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const time = new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const el = document.createElement('div');
  el.className = 'comment-item';
  el.innerHTML = `
    <div class="comment-author">
      <div class="comment-avatar">${escHtml(initials)}</div>
      <span class="comment-name">${escHtml(name)}</span>
      <span class="comment-time">${time}</span>
    </div>
    <div class="comment-body">${escHtml(comment.body)}</div>
  `;
  return el;
}
// ── Realtime comments
function subscribeComments(noteId) {
  if (commentsChannel) supabase.removeChannel(commentsChannel);
  commentsChannel = supabase
    .channel(`comments-${noteId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'comments',
      filter: `note_id=eq.${noteId}`
    }, payload => {
      // Fetch full profile data for new comment
      supabase
        .from('comments')
        .select('id, body, created_at, profiles:user_id ( full_name, email )')
        .eq('id', payload.new.id)
        .single()
        .then(({ data }) => {
          if (data) {
            const noComments = commentsList.querySelector('.no-comments');
            if (noComments) noComments.remove();
            commentsList.appendChild(buildCommentEl(data));
            commentsList.scrollTop = commentsList.scrollHeight;
          }
        });
    })
    .subscribe();
}

// ── Post comment
postBtn.addEventListener('click', postComment);
commentInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) postComment();
});

async function postComment() {
  const body = commentInput.value.trim();
  if (!body || !currentNote) return;
  if (!currentUser) { showToast('Please sign in to comment'); return; }

  postBtn.disabled = true;
  postBtn.textContent = 'Posting…';

  const { error } = await supabase.from('comments').insert({
    note_id: currentNote.id,
    user_id: currentUser.id,
    body,
  });

  postBtn.disabled = false;
  postBtn.textContent = 'Post';

  if (error) {
    showToast('Failed to post comment');
  } else {
    commentInput.value = '';
  }
}

function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
