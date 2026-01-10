/**
 * Painting Journal - Frontend Application
 */

const API = {
    async search(query, museum = null, page = 1) {
        const params = new URLSearchParams({ q: query, page });
        if (museum) params.set('museum', museum);
        const response = await fetch(`/api/search?${params}`);
        return response.json();
    },

    async getPainting(museum, externalId) {
        const response = await fetch(`/api/painting/${museum}/${externalId}`);
        return response.json();
    },

    async getPaintingOfTheDay() {
        const response = await fetch('/api/painting-of-the-day');
        return response.json();
    },

    async getFavorites(filters = {}) {
        const params = new URLSearchParams(filters);
        const response = await fetch(`/api/favorites?${params}`);
        return response.json();
    },

    async addFavorite(paintingData) {
        const response = await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paintingData)
        });
        return response.json();
    },

    async removeFavorite(favoriteId) {
        const response = await fetch(`/api/favorites/${favoriteId}`, {
            method: 'DELETE'
        });
        return response.json();
    },

    async getFavorite(favoriteId) {
        const response = await fetch(`/api/favorites/${favoriteId}`);
        return response.json();
    },

    async getTags() {
        const response = await fetch('/api/tags');
        return response.json();
    },

    async addTag(favoriteId, tag) {
        const response = await fetch(`/api/favorites/${favoriteId}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag })
        });
        return response.json();
    },

    async removeTag(favoriteId, tag) {
        const response = await fetch(`/api/favorites/${favoriteId}/tags/${tag}`, {
            method: 'DELETE'
        });
        return response.json();
    },

    async addJournalEntry(favoriteId, entryText) {
        const response = await fetch(`/api/favorites/${favoriteId}/journal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry_text: entryText })
        });
        return response.json();
    },

    async updateJournalEntry(entryId, entryText) {
        const response = await fetch(`/api/journal/${entryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry_text: entryText })
        });
        return response.json();
    },

    async deleteJournalEntry(entryId) {
        const response = await fetch(`/api/journal/${entryId}`, {
            method: 'DELETE'
        });
        return response.json();
    }
};

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function createPaintingCard(painting) {
    const card = document.createElement('article');
    card.className = 'painting-card';
    card.onclick = () => {
        window.location.href = `/painting/${painting.museum}/${painting.external_id}`;
    };

    card.innerHTML = `
        <div class="painting-card__image-container">
            <img class="painting-card__image"
                 src="${painting.thumbnail_url || painting.image_url}"
                 alt="${painting.title}"
                 loading="lazy">
        </div>
        <div class="painting-card__info">
            <h3 class="painting-card__title">${painting.title}</h3>
            <p class="painting-card__artist">${painting.artist}</p>
            <p class="painting-card__museum">${painting.museum_name || painting.museum}</p>
        </div>
    `;

    return card;
}

// Home page - Painting of the Day
async function initHome() {
    const container = document.getElementById('painting-of-day');
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading</div>';

    const data = await API.getPaintingOfTheDay();

    if (data.message) {
        container.innerHTML = `
            <div class="hero__empty">
                <p>${data.message}</p>
                <a href="/search" class="btn btn--primary">Start Exploring</a>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <a href="/painting/${data.museum}/${data.external_id}" class="hero__painting">
            <div class="hero__image-container">
                <img class="hero__image" src="${data.image_url}" alt="${data.title}">
            </div>
            <h2 class="hero__title">${data.title}</h2>
            <p class="hero__artist">${data.artist}</p>
            <p class="hero__meta">${data.date_display} | ${data.museum_name || data.museum}</p>
        </a>
    `;
}

// Search page
let searchState = {
    query: '',
    museum: null,
    page: 1,
    loading: false,
    hasMore: true
};

async function initSearch() {
    const form = document.getElementById('search-form');
    const input = document.getElementById('search-input');
    const museumSelect = document.getElementById('museum-select');
    const resultsContainer = document.getElementById('search-results');
    const loadMoreBtn = document.getElementById('load-more');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        searchState.query = input.value.trim();
        searchState.museum = museumSelect.value || null;
        searchState.page = 1;
        searchState.hasMore = true;

        if (!searchState.query) return;

        resultsContainer.innerHTML = '<div class="loading">Searching</div>';
        loadMoreBtn.style.display = 'none';

        await performSearch(resultsContainer, loadMoreBtn, false);
    });

    loadMoreBtn.addEventListener('click', async () => {
        if (searchState.loading || !searchState.hasMore) return;
        searchState.page++;
        await performSearch(resultsContainer, loadMoreBtn, true);
    });
}

async function performSearch(container, loadMoreBtn, append) {
    if (searchState.loading) return;
    searchState.loading = true;

    try {
        const data = await API.search(
            searchState.query,
            searchState.museum,
            searchState.page
        );

        if (!append) {
            container.innerHTML = '';

            // Show spelling suggestion if available
            if (data.suggestion) {
                const suggestionEl = document.createElement('div');
                suggestionEl.className = 'spelling-suggestion';
                suggestionEl.innerHTML = `
                    Did you mean: <a href="#" class="suggestion-link">${data.suggestion}</a>?
                `;
                container.appendChild(suggestionEl);

                // Handle click on suggestion
                suggestionEl.querySelector('.suggestion-link').addEventListener('click', (e) => {
                    e.preventDefault();
                    const input = document.getElementById('search-input');
                    input.value = data.suggestion;
                    searchState.query = data.suggestion;
                    searchState.page = 1;
                    performSearch(container, loadMoreBtn, false);
                });
            }
        }

        if (data.paintings && data.paintings.length > 0) {
            const grid = append
                ? container.querySelector('.painting-grid')
                : document.createElement('div');

            if (!append) {
                grid.className = 'painting-grid';
                container.appendChild(grid);
            }

            data.paintings.forEach(painting => {
                grid.appendChild(createPaintingCard(painting));
            });

            searchState.hasMore = data.paintings.length >= 20;
            loadMoreBtn.style.display = searchState.hasMore ? 'block' : 'none';
        } else if (!append) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'empty-state';
            emptyEl.innerHTML = `
                <p>No paintings found for "${searchState.query}"</p>
                <p>Try a different search term</p>
            `;
            container.appendChild(emptyEl);
            loadMoreBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Search error:', error);
        if (!append) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Something went wrong. Please try again.</p>
                </div>
            `;
        }
    } finally {
        searchState.loading = false;
    }
}

// Collection page
async function initCollection() {
    const container = document.getElementById('collection-grid');
    const filterArtist = document.getElementById('filter-artist');
    const filterMuseum = document.getElementById('filter-museum');
    const filterTag = document.getElementById('filter-tag');

    if (!container) return;

    async function loadCollection() {
        container.innerHTML = '<div class="loading">Loading collection</div>';

        const filters = {};
        if (filterArtist && filterArtist.value) filters.artist = filterArtist.value;
        if (filterMuseum && filterMuseum.value) filters.museum = filterMuseum.value;
        if (filterTag && filterTag.value) filters.tag = filterTag.value;

        try {
            const data = await API.getFavorites(filters);

            if (data.favorites && data.favorites.length > 0) {
                container.innerHTML = '';
                const grid = document.createElement('div');
                grid.className = 'painting-grid';

                data.favorites.forEach(painting => {
                    const card = createPaintingCard(painting);
                    grid.appendChild(card);
                });

                container.appendChild(grid);
            } else {
                container.innerHTML = `
                    <div class="empty-state">
                        <p>No paintings in your collection yet</p>
                        <a href="/search" class="btn btn--primary">Start Exploring</a>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading collection:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <p>Failed to load collection</p>
                </div>
            `;
        }
    }

    // Load tags for filter
    if (filterTag) {
        try {
            const { tags } = await API.getTags();
            tags.forEach(tag => {
                const option = document.createElement('option');
                option.value = tag.name;
                option.textContent = `${tag.name} (${tag.count})`;
                filterTag.appendChild(option);
            });
        } catch (e) {
            console.error('Failed to load tags:', e);
        }
    }

    // Set up filter listeners
    [filterArtist, filterMuseum, filterTag].forEach(el => {
        if (el) el.addEventListener('change', loadCollection);
    });

    await loadCollection();
}

// Painting detail page
async function initPaintingDetail() {
    const container = document.getElementById('painting-detail');
    if (!container) return;

    const museum = container.dataset.museum;
    const externalId = container.dataset.externalId;

    container.innerHTML = '<div class="loading">Loading painting</div>';

    try {
        const painting = await API.getPainting(museum, externalId);

        if (painting.error) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Painting not found</p>
                    <a href="/search" class="btn">Back to Search</a>
                </div>
            `;
            return;
        }

        renderPaintingDetail(container, painting);
    } catch (error) {
        console.error('Error loading painting:', error);
        container.innerHTML = `
            <div class="empty-state">
                <p>Failed to load painting</p>
            </div>
        `;
    }
}

function renderPaintingDetail(container, painting) {
    const isFavorite = painting.is_favorite;
    const favoriteId = painting.favorite_id;

    container.innerHTML = `
        <div class="painting-detail__main">
            <div class="painting-detail__image-container">
                <img class="painting-detail__image" src="${painting.image_url}" alt="${painting.title}">
            </div>
            <div class="painting-detail__sidebar">
                <h1 class="painting-detail__title">${painting.title}</h1>
                <p class="painting-detail__artist">${painting.artist}</p>

                <div class="painting-actions">
                    <button class="btn btn--favorite ${isFavorite ? 'is-favorite' : ''}"
                            id="favorite-btn"
                            data-painting='${JSON.stringify(painting).replace(/'/g, "&#39;")}'>
                        ${isFavorite ? 'Saved' : 'Save to Collection'}
                    </button>
                    <a href="${painting.museum_url}" target="_blank" class="btn">
                        View at Museum
                    </a>
                </div>

                <div class="painting-detail__meta">
                    ${painting.date_display ? `
                        <div class="painting-detail__meta-item">
                            <span class="painting-detail__meta-label">Date</span>
                            <span class="painting-detail__meta-value">${painting.date_display}</span>
                        </div>
                    ` : ''}
                    ${painting.medium ? `
                        <div class="painting-detail__meta-item">
                            <span class="painting-detail__meta-label">Medium</span>
                            <span class="painting-detail__meta-value">${painting.medium}</span>
                        </div>
                    ` : ''}
                    ${painting.dimensions ? `
                        <div class="painting-detail__meta-item">
                            <span class="painting-detail__meta-label">Dimensions</span>
                            <span class="painting-detail__meta-value">${painting.dimensions}</span>
                        </div>
                    ` : ''}
                    <div class="painting-detail__meta-item">
                        <span class="painting-detail__meta-label">Museum</span>
                        <span class="painting-detail__meta-value">${painting.museum_name}</span>
                    </div>
                </div>

                ${painting.description ? `
                    <div class="painting-detail__description">
                        <p>${painting.description}</p>
                    </div>
                ` : ''}

                ${isFavorite ? `
                    <div class="tags-section" id="tags-section">
                        <p class="tags-section__title">Tags</p>
                        <div class="tags-list" id="tags-list">
                            ${(painting.tags || []).map(tag => `
                                <span class="tag">
                                    ${tag}
                                    <span class="tag__remove" data-tag="${tag}">&times;</span>
                                </span>
                            `).join('')}
                        </div>
                        <div class="tag-input">
                            <input type="text" id="new-tag-input" placeholder="Add tag...">
                            <button class="btn" id="add-tag-btn">Add</button>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>

        ${isFavorite ? `
            <div class="journal-section" id="journal-section">
                <h2 class="journal-section__title">Journal</h2>
                <div class="journal-form">
                    <textarea class="journal-textarea" id="new-entry-text"
                              placeholder="Write your thoughts, observations, or analysis..."></textarea>
                    <button class="btn btn--primary" id="add-entry-btn">Add Entry</button>
                </div>
                <div class="journal-entries" id="journal-entries">
                    <div class="loading">Loading journal entries</div>
                </div>
            </div>
        ` : ''}
    `;

    // Set up favorite button
    const favoriteBtn = document.getElementById('favorite-btn');
    favoriteBtn.addEventListener('click', async () => {
        if (painting.is_favorite) {
            await API.removeFavorite(painting.favorite_id);
            painting.is_favorite = false;
            painting.favorite_id = null;
            favoriteBtn.classList.remove('is-favorite');
            favoriteBtn.textContent = 'Save to Collection';

            // Remove tags and journal sections
            const tagsSection = document.getElementById('tags-section');
            const journalSection = document.getElementById('journal-section');
            if (tagsSection) tagsSection.remove();
            if (journalSection) journalSection.remove();
        } else {
            const result = await API.addFavorite(painting);
            painting.is_favorite = true;
            painting.favorite_id = result.id;
            favoriteBtn.classList.add('is-favorite');
            favoriteBtn.textContent = 'Saved';

            // Refresh to show tags and journal
            renderPaintingDetail(container, painting);
        }
    });

    // Set up tags if favorite
    if (isFavorite) {
        setupTags(painting.favorite_id, painting.tags || []);
        loadJournalEntries(painting.favorite_id);
    }
}

function setupTags(favoriteId, existingTags) {
    const tagsList = document.getElementById('tags-list');
    const newTagInput = document.getElementById('new-tag-input');
    const addTagBtn = document.getElementById('add-tag-btn');

    // Remove tag
    tagsList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('tag__remove')) {
            const tag = e.target.dataset.tag;
            await API.removeTag(favoriteId, tag);
            e.target.parentElement.remove();
        }
    });

    // Add tag
    const addTag = async () => {
        const tag = newTagInput.value.trim().toLowerCase();
        if (!tag) return;

        await API.addTag(favoriteId, tag);

        const tagEl = document.createElement('span');
        tagEl.className = 'tag';
        tagEl.innerHTML = `${tag}<span class="tag__remove" data-tag="${tag}">&times;</span>`;
        tagsList.appendChild(tagEl);

        newTagInput.value = '';
    };

    addTagBtn.addEventListener('click', addTag);
    newTagInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTag();
    });
}

async function loadJournalEntries(favoriteId) {
    const entriesContainer = document.getElementById('journal-entries');
    const newEntryText = document.getElementById('new-entry-text');
    const addEntryBtn = document.getElementById('add-entry-btn');

    // Add new entry
    addEntryBtn.addEventListener('click', async () => {
        const text = newEntryText.value.trim();
        if (!text) return;

        const result = await API.addJournalEntry(favoriteId, text);
        newEntryText.value = '';
        await loadJournalEntries(favoriteId);
    });

    // Load entries
    try {
        const favorite = await API.getFavorite(favoriteId);
        const entries = favorite.journal_entries || [];

        if (entries.length === 0) {
            entriesContainer.innerHTML = `
                <div class="empty-state">
                    <p>No journal entries yet. Share your thoughts about this painting.</p>
                </div>
            `;
            return;
        }

        entriesContainer.innerHTML = entries.map(entry => `
            <article class="journal-entry" data-id="${entry.id}">
                <p class="journal-entry__date">${formatDate(entry.created_at)}</p>
                <p class="journal-entry__text">${entry.entry_text}</p>
                <div class="journal-entry__actions">
                    <button class="btn btn-edit-entry">Edit</button>
                    <button class="btn btn-delete-entry">Delete</button>
                </div>
            </article>
        `).join('');

        // Set up edit/delete handlers
        entriesContainer.querySelectorAll('.journal-entry').forEach(entryEl => {
            const entryId = parseInt(entryEl.dataset.id);
            const textEl = entryEl.querySelector('.journal-entry__text');
            const editBtn = entryEl.querySelector('.btn-edit-entry');
            const deleteBtn = entryEl.querySelector('.btn-delete-entry');

            editBtn.addEventListener('click', () => {
                const currentText = textEl.textContent;
                textEl.innerHTML = `
                    <textarea class="journal-textarea" style="min-height: 100px">${currentText}</textarea>
                    <div style="margin-top: 0.5rem">
                        <button class="btn btn--primary save-edit">Save</button>
                        <button class="btn cancel-edit">Cancel</button>
                    </div>
                `;

                const textarea = textEl.querySelector('textarea');
                const saveBtn = textEl.querySelector('.save-edit');
                const cancelBtn = textEl.querySelector('.cancel-edit');

                cancelBtn.addEventListener('click', () => {
                    textEl.textContent = currentText;
                });

                saveBtn.addEventListener('click', async () => {
                    const newText = textarea.value.trim();
                    if (newText) {
                        await API.updateJournalEntry(entryId, newText);
                        textEl.textContent = newText;
                    }
                });
            });

            deleteBtn.addEventListener('click', async () => {
                if (confirm('Delete this journal entry?')) {
                    await API.deleteJournalEntry(entryId);
                    entryEl.remove();

                    if (entriesContainer.querySelectorAll('.journal-entry').length === 0) {
                        entriesContainer.innerHTML = `
                            <div class="empty-state">
                                <p>No journal entries yet. Share your thoughts about this painting.</p>
                            </div>
                        `;
                    }
                }
            });
        });
    } catch (error) {
        console.error('Error loading journal:', error);
        entriesContainer.innerHTML = `
            <div class="empty-state">
                <p>Failed to load journal entries</p>
            </div>
        `;
    }
}

// Initialize based on page
document.addEventListener('DOMContentLoaded', () => {
    // Highlight current nav link
    const path = window.location.pathname;
    document.querySelectorAll('.site-nav a').forEach(link => {
        if (link.getAttribute('href') === path ||
            (path === '/' && link.getAttribute('href') === '/') ||
            (path.startsWith('/search') && link.getAttribute('href') === '/search') ||
            (path.startsWith('/collection') && link.getAttribute('href') === '/collection')) {
            link.classList.add('active');
        }
    });

    // Initialize page-specific functionality
    if (document.getElementById('painting-of-day')) {
        initHome();
    }
    if (document.getElementById('search-form')) {
        initSearch();
    }
    if (document.getElementById('collection-grid')) {
        initCollection();
    }
    if (document.getElementById('painting-detail')) {
        initPaintingDetail();
    }
});
