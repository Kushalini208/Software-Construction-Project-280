import { initAuth } from './auth.js';
import { loadNotes, renderNotes } from './notes.js';

(async () => {
  await initAuth();
})();

const observer = new MutationObserver(() => {
  const appPage = document.getElementById('page-app');
  if (appPage.classList.contains('active')) {
    loadNotes();
    setupSidebarToggle();
    setupSearchAndSort();
    observer.disconnect();
  }
});
observer.observe(document.getElementById('page-app'), { attributes: true, attributeFilter: ['class'] });

function setupSearchAndSort() {
  let searchTimer;
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderNotes, 220);
    });
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', renderNotes);
  }
}

function setupSidebarToggle() {
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarHide = document.getElementById('sidebar-hide');
  const sidebar = document.getElementById('app-sidebar');

  function updateToggleButton() {
    if (sidebar.classList.contains('collapsed')) {
      sidebarToggle.style.display = 'flex';
    } else {
      sidebarToggle.style.display = 'none';
    }
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.remove('collapsed');
      updateToggleButton();
    });
  }

  if (sidebarHide) {
    sidebarHide.addEventListener('click', () => {
      sidebar.classList.add('collapsed');
      updateToggleButton();
    });
  }

  const navItems = sidebar.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      sidebar.classList.add('collapsed');
      updateToggleButton();
    });
  });

  // Initial state
  updateToggleButton();
}

export function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}