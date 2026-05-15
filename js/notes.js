// ─── NOTES MODULE ───────────────────────────────────────────────────
import { supabase } from './supabase.js'; // Removed BUCKET
import { openViewer } from './viewer.js';   // Direct import

let allNotes = [];
let activeSubject = '';
let activeTag = '';
let realtimeChannel = null; 

/**
 * Fetches all notes and joins with profile data
 */
export async function loadNotes() {
    const grid = document.getElementById('notes-grid');
    grid.innerHTML = '<div class="notes-loading">Gathering your library...</div>';

    const { data, error } = await supabase
        .from('notes')
        .select(`
            id, title, subject, description, tags, year, file_path, created_at,
            profiles:user_id ( full_name, email )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        grid.innerHTML = `<div class="notes-error">Error: ${error.message}</div>`;
        return;
    }

    allNotes = data || [];
    buildFilters();
    renderNotes();
    subscribeRealtime();
}

/**
 * Builds the sidebar filter buttons based on existing data
 */
function buildFilters() {
    // 1. Subjects Filter
    const subjects = [...new Set(allNotes.map(n => n.subject).filter(Boolean))].sort();
    const subjectEl = document.getElementById('subject-filters');
    if (subjectEl) {
        subjectEl.innerHTML = `<button class="filter-chip active" data-subject="">All subjects</button>`;
        subjects.forEach(s => {
            const btn = document.createElement('button');
            btn.className = 'filter-chip';
            btn.dataset.subject = s;
            btn.textContent = s;
            subjectEl.appendChild(btn);
        });

        subjectEl.querySelectorAll('.filter-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                subjectEl.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeSubject = btn.dataset.subject;
                renderNotes();
            });
        });
    }

    // 2. Tags Filter (Popular tags)
    const tagCounts = {};
    allNotes.forEach(n => (n.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const tagEl = document.getElementById('tag-filters');
    if (tagEl) {
        tagEl.innerHTML = '';
        topTags.forEach(([tag]) => {
            const pill = document.createElement('button');
            pill.className = 'filter-chip'; // Changed to match sidebar style
            pill.textContent = '#' + tag;
            pill.onclick = () => {
                const wasActive = pill.classList.contains('active');
                tagEl.querySelectorAll('.filter-chip').forEach(p => p.classList.remove('active'));
                activeTag = wasActive ? '' : tag;
                if (!wasActive) pill.classList.add('active');
                renderNotes();
            };
            tagEl.appendChild(pill);
        });
    }
}

/**
 * Filters and Sorts notes, then injects them into the grid
 */
export function renderNotes() {
    const grid = document.getElementById('notes-grid');
    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const sort = document.getElementById('sort-select').value;
    const titleHeader = document.getElementById('notes-title');

    let notes = [...allNotes];

    // Filter Logic
    if (activeSubject) notes = notes.filter(n => n.subject === activeSubject);
    if (activeTag)     notes = notes.filter(n => (n.tags || []).includes(activeTag));
    if (query) {
        notes = notes.filter(n =>
            n.title.toLowerCase().includes(query) ||
            (n.subject || '').toLowerCase().includes(query) ||
            (n.description || '').toLowerCase().includes(query) ||
            (n.tags || []).some(t => t.toLowerCase().includes(query))
        );
    }

    // Sort Logic
    if (sort === 'oldest') notes.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    else if (sort === 'title') notes.sort((a, b) => a.title.localeCompare(b.title));
    else notes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Update UI Header
    titleHeader.textContent = activeSubject || (query ? `Results for "${query}"` : 'All notes');

    grid.innerHTML = '';

    if (notes.length === 0) {
        grid.innerHTML = `
            <div class="notes-empty">
                <p>No notes found in this category.</p>
            </div>`;
        return;
    }

    notes.forEach((note, index) => {
        grid.appendChild(createNoteCard(note, index));
    });
}

/**
 * Creates a single note card element with click events
 */
function createNoteCard(note, index) {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.style.animationDelay = `${index * 50}ms`;

    const uploaderName = note.profiles?.full_name || note.profiles?.email?.split('@')[0] || 'User';
    const initials = uploaderName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const date = new Date(note.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    
    // Ensure tags are an array
    const tagsArray = Array.isArray(note.tags) ? note.tags : [];
    const tagsHtml = tagsArray.slice(0, 3).map(t => `<span class="note-tag">#${esc(t)}</span>`).join('');

    card.innerHTML = `
        <div class="note-card-top">
            <div class="note-pdf-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            </div>
            <span class="note-subject-badge">${esc(note.subject || 'General')}</span>
        </div>
        <div class="note-title">${esc(note.title)}</div>
        <p class="note-desc">${esc(note.description || 'No description.')}</p>
        <div class="note-tags">${tagsHtml}</div>
        <div class="note-footer">
            <div class="note-uploader">
                <span class="note-name">${esc(uploaderName)}</span>
            </div>
            <span class="note-date">${date}</span>
        </div>
    `;

    // CRITICAL: The click event to open the viewer
    card.addEventListener('click', (e) => {
        if (e.target.closest('.note-tag')) return; 
        openViewer(note); // Direct call, no .then() needed
    });

    return card;
}

/**
 * Syncs the page if someone else uploads a note
 */
function subscribeRealtime() {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    realtimeChannel = supabase
        .channel('notes-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' }, () => {
            loadNotes();
        })
        .subscribe();
}

/**
 * XSS Protection helper
 */
function esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}