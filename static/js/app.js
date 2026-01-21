/**
 * Painting Journal - Frontend Application
 */

// Auth module for token management
const Auth = {
    getToken() {
        return localStorage.getItem('auth_token');
    },

    getUser() {
        const user = localStorage.getItem('auth_user');
        return user ? JSON.parse(user) : null;
    },

    isLoggedIn() {
        return !!this.getToken();
    },

    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        window.location.href = '/login';
    },

    getAuthHeaders() {
        const token = this.getToken();
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    },

    // Handle 401 responses
    handle401() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        window.location.href = '/login';
    },

    // Initialize header UI
    initHeader() {
        const loginLink = document.getElementById('loginLink');
        const userLoggedIn = document.getElementById('userLoggedIn');
        const userEmail = document.getElementById('userEmail');
        const logoutBtn = document.getElementById('logoutBtn');

        if (!loginLink || !userLoggedIn) return;

        if (this.isLoggedIn()) {
            const user = this.getUser();
            loginLink.style.display = 'none';
            userLoggedIn.style.display = 'flex';
            userEmail.textContent = user?.email || 'Account';

            logoutBtn.addEventListener('click', async () => {
                try {
                    await fetch('/api/auth/logout', {
                        method: 'POST',
                        headers: this.getAuthHeaders()
                    });
                } catch (e) {}
                this.logout();
            });
        } else {
            loginLink.style.display = 'block';
            userLoggedIn.style.display = 'none';
        }
    }
};

// Lightbox for fullscreen image viewing
const Lightbox = {
    element: null,

    init() {
        // Create lightbox element if it doesn't exist
        if (!document.getElementById('lightbox')) {
            const lightbox = document.createElement('div');
            lightbox.id = 'lightbox';
            lightbox.className = 'lightbox';
            lightbox.innerHTML = `
                <button class="lightbox__close">&times;</button>
                <img class="lightbox__image" src="" alt="">
                <div class="lightbox__info">
                    <div class="lightbox__title"></div>
                    <div class="lightbox__artist"></div>
                </div>
                <div class="lightbox__hint">Press ESC or click anywhere to close</div>
            `;
            document.body.appendChild(lightbox);
            this.element = lightbox;

            // Close on click
            lightbox.addEventListener('click', () => this.close());

            // Prevent close when clicking image
            lightbox.querySelector('.lightbox__image').addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Close button
            lightbox.querySelector('.lightbox__close').addEventListener('click', () => this.close());

            // Close on ESC
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen()) {
                    this.close();
                }
            });
        }
        this.element = document.getElementById('lightbox');
    },

    open(imageUrl, title, artist) {
        if (!this.element) this.init();

        const img = this.element.querySelector('.lightbox__image');
        img.src = imageUrl;
        img.alt = title;

        this.element.querySelector('.lightbox__title').textContent = title;
        this.element.querySelector('.lightbox__artist').textContent = artist;

        this.element.classList.add('is-active');
        document.body.style.overflow = 'hidden';
    },

    close() {
        if (this.element) {
            this.element.classList.remove('is-active');
            document.body.style.overflow = '';
        }
    },

    isOpen() {
        return this.element && this.element.classList.contains('is-active');
    }
};

const API = {
    // Helper to make authenticated requests
    async _fetch(url, options = {}) {
        const headers = {
            ...Auth.getAuthHeaders(),
            ...options.headers
        };
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            Auth.handle401();
            throw new Error('Authentication required');
        }
        return response;
    },

    async search(query, museum = null, page = 1) {
        const params = new URLSearchParams({ q: query, page });
        if (museum) params.set('museum', museum);
        const response = await fetch(`/api/search?${params}`);
        return response.json();
    },

    async getPainting(museum, externalId) {
        const response = await this._fetch(`/api/painting/${museum}/${externalId}`);
        return response.json();
    },

    async getPaintingOfTheDay() {
        const response = await this._fetch('/api/painting-of-the-day');
        return response.json();
    },

    async getFavorites(filters = {}) {
        const params = new URLSearchParams(filters);
        const response = await this._fetch(`/api/favorites?${params}`);
        return response.json();
    },

    async addFavorite(paintingData) {
        const response = await this._fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paintingData)
        });
        return response.json();
    },

    async removeFavorite(favoriteId) {
        const response = await this._fetch(`/api/favorites/${favoriteId}`, {
            method: 'DELETE'
        });
        return response.json();
    },

    async getFavorite(favoriteId) {
        const response = await this._fetch(`/api/favorites/${favoriteId}`);
        return response.json();
    },

    async getTags() {
        const response = await this._fetch('/api/tags');
        return response.json();
    },

    async addTag(favoriteId, tag) {
        const response = await this._fetch(`/api/favorites/${favoriteId}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag })
        });
        return response.json();
    },

    async removeTag(favoriteId, tag) {
        const response = await this._fetch(`/api/favorites/${favoriteId}/tags/${tag}`, {
            method: 'DELETE'
        });
        return response.json();
    },

    async addJournalEntry(favoriteId, entryText) {
        const response = await this._fetch(`/api/favorites/${favoriteId}/journal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry_text: entryText })
        });
        return response.json();
    },

    async updateJournalEntry(entryId, entryText) {
        const response = await this._fetch(`/api/journal/${entryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry_text: entryText })
        });
        return response.json();
    },

    async deleteJournalEntry(entryId) {
        const response = await this._fetch(`/api/journal/${entryId}`, {
            method: 'DELETE'
        });
        return response.json();
    },

    // Explore API methods (public, no auth required)
    async getCategories() {
        const response = await fetch('/api/explore/categories');
        return response.json();
    },

    async exploreCategory(categoryType, categoryKey, page = 1, limit = 12) {
        const params = new URLSearchParams({ page, limit });
        const response = await fetch(`/api/explore/${categoryType}/${categoryKey}?${params}`);
        return response.json();
    },

    async getSurprise() {
        const response = await fetch('/api/explore/surprise');
        return response.json();
    },

    async getArtistWorks(artistName, limit = 12) {
        const params = new URLSearchParams({ limit });
        const response = await fetch(`/api/explore/artist/${encodeURIComponent(artistName)}?${params}`);
        return response.json();
    },

    async getPreview() {
        const response = await fetch('/api/explore/preview');
        return response.json();
    },

    async getStats() {
        const response = await fetch('/api/stats');
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

// Truncate text with ellipsis
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
}

// Animated counter - eases from fast to slow
function animateCounter(element, target, duration = 2500) {
    const start = 0;
    const startTime = performance.now();

    function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutQuart(progress);
        const current = Math.floor(start + (target - start) * easedProgress);

        element.textContent = current.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target.toLocaleString();
        }
    }

    requestAnimationFrame(update);
}

// Create skeleton loading grid
function createSkeletonGrid(count = 6) {
    let html = '<div class="skeleton-grid">';
    for (let i = 0; i < count; i++) {
        html += `
            <div class="skeleton-card">
                <div class="skeleton-card__frame"></div>
                <div class="skeleton-card__placard">
                    <div class="skeleton-card__title"></div>
                    <div class="skeleton-card__artist"></div>
                </div>
            </div>
        `;
    }
    html += '</div>';
    return html;
}

// Create elegant loading message
function createLoading(message = 'Curating your gallery') {
    return `<div class="loading">${message}</div>`;
}

function createPaintingCard(painting) {
    const card = document.createElement('article');
    card.className = 'painting-card';
    card.onclick = () => {
        // URL-encode the external_id to handle IDs with slashes (e.g., Europeana)
        window.location.href = `/painting/${painting.museum}/${encodeURIComponent(painting.external_id)}`;
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

    // Add fade-in effect when image loads
    const img = card.querySelector('.painting-card__image');
    if (img.complete) {
        img.classList.add('loaded');
    } else {
        img.addEventListener('load', () => img.classList.add('loaded'));
    }

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
        <a href="/painting/${data.museum}/${encodeURIComponent(data.external_id)}" class="hero__painting">
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

    // Restore search state from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const savedQuery = urlParams.get('q');
    const savedMuseum = urlParams.get('museum');

    if (savedQuery) {
        input.value = savedQuery;
        searchState.query = savedQuery;
        if (savedMuseum) {
            museumSelect.value = savedMuseum;
            searchState.museum = savedMuseum;
        }
        resultsContainer.innerHTML = '<div class="loading">Searching</div>';
        await performSearch(resultsContainer, loadMoreBtn, false);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        searchState.query = input.value.trim();
        searchState.museum = museumSelect.value || null;
        searchState.page = 1;
        searchState.hasMore = true;

        if (!searchState.query) return;

        // Update URL with search params
        const params = new URLSearchParams({ q: searchState.query });
        if (searchState.museum) params.set('museum', searchState.museum);
        history.replaceState(null, '', `/search?${params}`);

        resultsContainer.innerHTML = createSkeletonGrid(8);
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
        container.innerHTML = createSkeletonGrid(6);

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
    const isLoggedIn = Auth.isLoggedIn();
    const isFavorite = painting.is_favorite;
    const favoriteId = painting.favorite_id;
    const artistName = painting.artist || 'Unknown Artist';

    // For guests, show lock icon on save button
    const saveButtonText = isLoggedIn
        ? (isFavorite ? 'Saved' : 'Save to Collection')
        : '<span class="lock-icon">&#128274;</span> Save to Collection';
    const saveButtonClass = isLoggedIn
        ? `btn btn--favorite ${isFavorite ? 'is-favorite' : ''}`
        : 'btn btn--favorite btn--locked';

    container.innerHTML = `
        <div class="painting-detail__main">
            <div class="painting-detail__image-container">
                <img class="painting-detail__image" src="${painting.image_url}" alt="${painting.title}">
                <span class="click-hint">Click to view full size</span>
            </div>
            <div class="painting-detail__sidebar">
                <h1 class="painting-detail__title">${painting.title}</h1>
                <p class="painting-detail__artist">
                    <a href="/explore/artist/${encodeURIComponent(artistName)}" class="artist-link">${artistName}</a>
                </p>

                <div class="painting-actions">
                    <button class="${saveButtonClass}"
                            id="favorite-btn"
                            data-painting='${JSON.stringify(painting).replace(/'/g, "&#39;")}'>
                        ${saveButtonText}
                    </button>
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
                    <div class="painting-detail__meta-item">
                        <span class="painting-detail__meta-label">Museum</span>
                        <span class="painting-detail__meta-value">${painting.museum_name}</span>
                    </div>
                </div>

                ${isFavorite ? `
                    <div class="journal-section journal-section--sidebar" id="journal-section">
                        <h3 class="journal-section__title">Your Notes</h3>
                        <div class="journal-form">
                            <textarea class="journal-textarea" id="new-entry-text"
                                      placeholder="What do you notice? How does it make you feel?"></textarea>
                            <button class="btn btn--primary" id="add-entry-btn">Add Note</button>
                        </div>
                        <div class="journal-entries" id="journal-entries">
                            <div class="loading">Loading notes</div>
                        </div>
                    </div>

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

        ${painting.description ? `
            <div class="painting-detail__description">
                ${isLoggedIn ? `
                    <p>${painting.description}</p>
                ` : `
                    <p>${truncateText(painting.description, 200)}</p>
                    <p class="description-signup-prompt">
                        <a href="/login">Create an account</a> to read the full description and save to your collection.
                    </p>
                `}
            </div>
        ` : ''}

        <section class="more-by-artist" id="more-by-artist">
            <h2 class="more-by-artist__title">More by ${artistName}</h2>
            <div class="more-by-artist__grid" id="more-by-artist-grid">
                <div class="loading">Loading...</div>
            </div>
            <a href="/explore/artist/${encodeURIComponent(artistName)}" class="more-by-artist__link">
                View all works by ${artistName} &rarr;
            </a>
        </section>
    `;

    // Set up favorite button
    const favoriteBtn = document.getElementById('favorite-btn');
    favoriteBtn.addEventListener('click', async () => {
        // If not logged in, redirect to login
        if (!isLoggedIn) {
            window.location.href = '/login';
            return;
        }

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

    // Set up tags and journal if favorite
    if (isFavorite) {
        setupTags(painting.favorite_id, painting.tags || []);
        loadJournalEntries(painting.favorite_id);
    }

    // Load more by this artist
    loadMoreByArtist(artistName, painting.external_id);

    // Initialize lightbox for image click
    Lightbox.init();
    const imageContainer = container.querySelector('.painting-detail__image-container');
    if (imageContainer) {
        imageContainer.addEventListener('click', () => {
            Lightbox.open(painting.image_url, painting.title, artistName);
        });
    }
}

async function loadMoreByArtist(artistName, currentPaintingId) {
    const grid = document.getElementById('more-by-artist-grid');
    const section = document.getElementById('more-by-artist');

    if (!artistName || artistName === 'Unknown Artist' || artistName === 'Unknown') {
        section.style.display = 'none';
        return;
    }

    try {
        const data = await API.getArtistWorks(artistName, 6);
        const paintings = (data.paintings || []).filter(p => p.external_id !== currentPaintingId);

        if (paintings.length === 0) {
            section.style.display = 'none';
            return;
        }

        grid.innerHTML = '';
        paintings.slice(0, 4).forEach(painting => {
            const card = createPaintingCard(painting);
            card.classList.add('painting-card--small');
            grid.appendChild(card);
        });
    } catch (error) {
        console.error('Error loading more by artist:', error);
        section.style.display = 'none';
    }
}

async function setupTags(favoriteId, existingTags) {
    const tagsList = document.getElementById('tags-list');
    const newTagInput = document.getElementById('new-tag-input');
    const addTagBtn = document.getElementById('add-tag-btn');
    const tagsSection = document.getElementById('tags-section');

    // Remove tag
    tagsList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('tag__remove')) {
            const tag = e.target.dataset.tag;
            await API.removeTag(favoriteId, tag);
            e.target.parentElement.remove();
            // Show the tag again in suggestions
            const suggestionEl = tagsSection.querySelector(`.tag-suggestion[data-tag="${tag}"]`);
            if (suggestionEl) suggestionEl.style.display = '';
        }
    });

    // Add tag function
    const addTag = async (tag) => {
        tag = tag.trim().toLowerCase();
        if (!tag) return;

        // Check if already added
        if (tagsList.querySelector(`.tag__remove[data-tag="${tag}"]`)) return;

        await API.addTag(favoriteId, tag);

        const tagEl = document.createElement('span');
        tagEl.className = 'tag';
        tagEl.innerHTML = `${tag}<span class="tag__remove" data-tag="${tag}">&times;</span>`;
        tagsList.appendChild(tagEl);

        newTagInput.value = '';

        // Hide from suggestions if present
        const suggestionEl = tagsSection.querySelector(`.tag-suggestion[data-tag="${tag}"]`);
        if (suggestionEl) suggestionEl.style.display = 'none';
    };

    addTagBtn.addEventListener('click', () => addTag(newTagInput.value));
    newTagInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTag(newTagInput.value);
    });

    // Load and display existing tags as suggestions
    try {
        const { tags } = await API.getTags();
        if (tags && tags.length > 0) {
            // Filter out tags already on this painting
            const availableTags = tags.filter(t => !existingTags.includes(t.name));

            if (availableTags.length > 0) {
                const suggestionsContainer = document.createElement('div');
                suggestionsContainer.className = 'tag-suggestions';
                suggestionsContainer.innerHTML = `
                    <p class="tag-suggestions__label">Quick add:</p>
                    <div class="tag-suggestions__list">
                        ${availableTags.map(t => `
                            <button type="button" class="tag-suggestion" data-tag="${t.name}">${t.name}</button>
                        `).join('')}
                    </div>
                `;
                tagsSection.appendChild(suggestionsContainer);

                // Handle clicking suggestions
                suggestionsContainer.addEventListener('click', (e) => {
                    if (e.target.classList.contains('tag-suggestion')) {
                        addTag(e.target.dataset.tag);
                    }
                });
            }
        }
    } catch (e) {
        console.error('Failed to load tag suggestions:', e);
    }
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

// Explore page
async function initExplore() {
    const loadingEl = document.getElementById('explore-loading');
    const previewMode = document.getElementById('preview-mode');
    const fullExploreMode = document.getElementById('full-explore-mode');
    const erasGrid = document.getElementById('eras-grid');

    if (!loadingEl && !previewMode && !erasGrid) return;

    // Hide loading state
    if (loadingEl) loadingEl.style.display = 'none';

    // Check if user is logged in
    if (!Auth.isLoggedIn()) {
        // Show preview mode for guests
        await initPreviewMode();
        return;
    }

    // Show full explore mode for logged-in users
    if (previewMode) previewMode.style.display = 'none';
    if (fullExploreMode) fullExploreMode.style.display = 'block';

    // Load and animate collection stats
    loadCollectionStats();

    const themesGrid = document.getElementById('themes-grid');
    const moodsGrid = document.getElementById('moods-grid');
    const surpriseBtn = document.getElementById('surprise-btn');

    if (!erasGrid) return;

    try {
        const data = await API.getCategories();

        // Populate featured artist
        if (data.featured_artist) {
            const artist = data.featured_artist;
            document.getElementById('featured-name').textContent = artist.full_name;
            document.getElementById('featured-bio').textContent = artist.bio;
            document.getElementById('featured-link').href = `/explore/artist/${encodeURIComponent(artist.name)}`;
        }

        // Populate weekly spotlight
        if (data.weekly_spotlight) {
            const spotlight = data.weekly_spotlight;
            document.getElementById('spotlight-name').textContent = spotlight.name;
            document.getElementById('spotlight-years').textContent = spotlight.years;
            document.getElementById('spotlight-desc').textContent = spotlight.description;
            document.getElementById('spotlight-link').href = `/explore/era/${spotlight.key}`;
        }

        // Populate eras
        erasGrid.innerHTML = '';
        Object.entries(data.eras).forEach(([key, era]) => {
            const card = document.createElement('a');
            card.href = `/explore/era/${key}`;
            card.className = 'category-card category-card--era';
            card.style.setProperty('--card-accent', era.wall_color);
            card.innerHTML = `
                <h3 class="category-card__name">${era.name}</h3>
                <p class="category-card__years">${era.years}</p>
                <p class="category-card__description">${era.description}</p>
            `;
            erasGrid.appendChild(card);
        });

        // Populate themes
        themesGrid.innerHTML = '';
        Object.entries(data.themes).forEach(([key, theme]) => {
            const card = document.createElement('a');
            card.href = `/explore/theme/${key}`;
            card.className = 'category-card';
            card.innerHTML = `
                <div class="category-card__icon">${theme.icon || ''}</div>
                <h3 class="category-card__name">${theme.name}</h3>
                <p class="category-card__description">${theme.description}</p>
            `;
            themesGrid.appendChild(card);
        });

        // Populate moods
        moodsGrid.innerHTML = '';
        Object.entries(data.moods).forEach(([key, mood]) => {
            const btn = document.createElement('a');
            btn.href = `/explore/mood/${key}`;
            btn.className = 'mood-btn';
            btn.textContent = mood.name;
            moodsGrid.appendChild(btn);
        });

    } catch (error) {
        console.error('Error loading categories:', error);
        erasGrid.innerHTML = '<p>Failed to load categories</p>';
    }

    // Surprise Me button
    if (surpriseBtn) {
        surpriseBtn.addEventListener('click', async () => {
            surpriseBtn.disabled = true;
            surpriseBtn.querySelector('.surprise-btn__text').textContent = 'Finding...';

            try {
                const painting = await API.getSurprise();
                if (painting && painting.museum && painting.external_id) {
                    window.location.href = `/painting/${painting.museum}/${encodeURIComponent(painting.external_id)}`;
                } else {
                    alert('Could not find a painting. Try again!');
                    surpriseBtn.disabled = false;
                    surpriseBtn.querySelector('.surprise-btn__text').textContent = 'Surprise Me';
                }
            } catch (error) {
                console.error('Surprise error:', error);
                surpriseBtn.disabled = false;
                surpriseBtn.querySelector('.surprise-btn__text').textContent = 'Surprise Me';
            }
        });
    }
}

// Load and animate collection stats
async function loadCollectionStats() {
    const statsContainer = document.getElementById('collection-stats');
    if (!statsContainer) return;

    try {
        const stats = await API.getStats();

        // Animate each stat with a slight delay between them
        const paintingsEl = document.getElementById('stat-paintings');
        const artistsEl = document.getElementById('stat-artists');
        const museumsEl = document.getElementById('stat-museums');

        if (paintingsEl) animateCounter(paintingsEl, stats.paintings, 2500);
        if (artistsEl) setTimeout(() => animateCounter(artistsEl, stats.artists, 2500), 200);
        if (museumsEl) setTimeout(() => animateCounter(museumsEl, stats.museums, 2500), 400);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Preview mode for guests
async function initPreviewMode() {
    const loadingEl = document.getElementById('explore-loading');
    const previewMode = document.getElementById('preview-mode');
    const fullExploreMode = document.getElementById('full-explore-mode');
    const previewGrid = document.getElementById('preview-grid');

    if (!previewMode || !previewGrid) return;

    // Hide loading, show preview, hide full explore
    if (loadingEl) loadingEl.style.display = 'none';
    previewMode.style.display = 'block';
    if (fullExploreMode) fullExploreMode.style.display = 'none';

    // Show skeleton loading
    previewGrid.innerHTML = createSkeletonGrid(12);

    try {
        const data = await API.getPreview();

        previewGrid.innerHTML = '';

        if (data.paintings && data.paintings.length > 0) {
            data.paintings.forEach(painting => {
                previewGrid.appendChild(createPaintingCard(painting));
            });
        } else {
            previewGrid.innerHTML = '<p class="empty-state">No paintings available</p>';
        }
    } catch (error) {
        console.error('Error loading preview:', error);
        previewGrid.innerHTML = '<p class="empty-state">Failed to load paintings</p>';
    }
}

// Browse page (category view)
let browseState = {
    categoryType: '',
    categoryKey: '',
    page: 1,
    loading: false,
    hasMore: true
};

async function initBrowse() {
    const browsePage = document.querySelector('.browse-page');
    if (!browsePage) return;

    browseState.categoryType = browsePage.dataset.categoryType;
    browseState.categoryKey = browsePage.dataset.categoryKey;

    const grid = document.getElementById('paintings-grid');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const loadMoreContainer = document.getElementById('load-more');

    await loadBrowsePaintings(grid, loadMoreContainer, false);

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', async () => {
            if (browseState.loading || !browseState.hasMore) return;
            browseState.page++;
            await loadBrowsePaintings(grid, loadMoreContainer, true);
        });
    }
}

async function loadBrowsePaintings(grid, loadMoreContainer, append) {
    if (browseState.loading) return;
    browseState.loading = true;

    // Show skeleton loading for initial load
    if (!append) {
        grid.innerHTML = createSkeletonGrid(8);
    }

    try {
        const data = await API.exploreCategory(
            browseState.categoryType,
            browseState.categoryKey,
            browseState.page
        );

        if (!append) {
            grid.innerHTML = '';
        }

        if (data.paintings && data.paintings.length > 0) {
            data.paintings.forEach(painting => {
                grid.appendChild(createPaintingCard(painting));
            });

            browseState.hasMore = data.paintings.length >= 12;
            loadMoreContainer.style.display = browseState.hasMore ? 'block' : 'none';
        } else if (!append) {
            grid.innerHTML = `
                <div class="empty-state">
                    <p>No paintings found in this category</p>
                    <a href="/explore" class="btn">Back to Explore</a>
                </div>
            `;
            loadMoreContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading paintings:', error);
        if (!append) {
            grid.innerHTML = `
                <div class="empty-state">
                    <p>Failed to load paintings</p>
                </div>
            `;
        }
    } finally {
        browseState.loading = false;
    }
}

// Artist page
async function initArtist() {
    const artistPage = document.querySelector('.artist-page');
    if (!artistPage) return;

    const artistName = artistPage.dataset.artistName;
    const grid = document.getElementById('artist-paintings-grid');

    // Show skeleton loading immediately
    grid.innerHTML = createSkeletonGrid(12);

    try {
        const data = await API.getArtistWorks(artistName, 24);

        grid.innerHTML = '';

        if (data.paintings && data.paintings.length > 0) {
            data.paintings.forEach(painting => {
                grid.appendChild(createPaintingCard(painting));
            });
        } else {
            grid.innerHTML = `
                <div class="empty-state">
                    <p>No paintings found for this artist</p>
                    <a href="/explore" class="btn">Back to Explore</a>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading artist works:', error);
        grid.innerHTML = `
            <div class="empty-state">
                <p>Failed to load works</p>
            </div>
        `;
    }
}

// Initialize based on page
document.addEventListener('DOMContentLoaded', () => {
    // Initialize auth header UI
    Auth.initHeader();

    // Highlight current nav link
    const path = window.location.pathname;
    document.querySelectorAll('.site-nav a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === path ||
            (path === '/' && href === '/explore') ||
            (path.startsWith('/explore') && href === '/explore') ||
            (path.startsWith('/search') && href === '/search') ||
            (path.startsWith('/collection') && href === '/collection')) {
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
    if (document.getElementById('eras-grid')) {
        initExplore();
    }
    if (document.querySelector('.browse-page')) {
        initBrowse();
    }
    if (document.querySelector('.artist-page')) {
        initArtist();
    }
});
