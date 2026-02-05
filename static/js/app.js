/**
 * Art Stuff - Frontend Application
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

// Toast notification for simple feedback
function showToast(message, linkText, linkHref) {
    // Remove existing toast if any
    const existing = document.getElementById('toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.innerHTML = `
        <span class="toast__message">${message}</span>
        ${linkText && linkHref ? `<a href="${linkHref}" class="toast__link">${linkText}</a>` : ''}
        <button class="toast__close">&times;</button>
    `;

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('is-visible'));

    // Close handlers
    const closeToast = () => {
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('.toast__close').addEventListener('click', closeToast);

    // Auto-dismiss after 5 seconds
    setTimeout(closeToast, 5000);
}

// Bottom sheet collect picker — Spotify-style "Save to..." tray
async function showCollectSheet(painting, triggerBtn) {
    // Remove existing sheet if any
    const existing = document.getElementById('collect-sheet');
    if (existing) existing.remove();

    // Fetch user's collections
    let collections = [];
    try {
        const result = await API.getCollections();
        collections = result.collections || [];
    } catch (e) {
        console.error('Failed to fetch collections:', e);
    }

    const isSaved = !!painting.is_favorite;
    const paintingCollectionIds = (painting.collections || []).map(c => c.id);

    const sheet = document.createElement('div');
    sheet.id = 'collect-sheet';
    sheet.className = 'collect-sheet';
    sheet.innerHTML = `
        <div class="collect-sheet__backdrop"></div>
        <div class="collect-sheet__tray">
            <div class="collect-sheet__handle"></div>
            <h3 class="collect-sheet__title">Save to...</h3>

            <div class="collect-sheet__list">
                <button class="collect-sheet__item ${isSaved ? 'is-added' : ''}" data-action="saved">
                    <span class="collect-sheet__item-check">${isSaved ? '✓' : ''}</span>
                    <span class="collect-sheet__item-name">Saved</span>
                    <span class="collect-sheet__item-note">Your library</span>
                </button>

                ${collections.map(c => {
                    const isIn = paintingCollectionIds.includes(c.id);
                    return `
                        <button class="collect-sheet__item ${isIn ? 'is-added' : ''}" data-action="collection" data-id="${c.id}">
                            <span class="collect-sheet__item-check">${isIn ? '✓' : ''}</span>
                            <span class="collect-sheet__item-name">${c.name}</span>
                            <span class="collect-sheet__item-note">${c.item_count} paintings</span>
                        </button>
                    `;
                }).join('')}
            </div>

            <div class="collect-sheet__create">
                <input type="text" placeholder="+ New collection..." class="collect-sheet__input" id="sheet-new-collection">
            </div>

            <button class="btn btn--primary collect-sheet__done" id="sheet-done-btn">Done</button>
        </div>
    `;

    document.body.appendChild(sheet);
    document.body.style.overflow = 'hidden';

    // Animate in
    requestAnimationFrame(() => sheet.classList.add('is-open'));

    // Close logic
    const closeSheet = () => {
        sheet.classList.remove('is-open');
        setTimeout(() => {
            sheet.remove();
            document.body.style.overflow = '';
        }, 300);
        updateCollectButton(painting, triggerBtn);
    };

    sheet.querySelector('.collect-sheet__backdrop').addEventListener('click', closeSheet);
    sheet.querySelector('#sheet-done-btn').addEventListener('click', closeSheet);

    // "Saved" item click — uses favorites API
    const savedItem = sheet.querySelector('[data-action="saved"]');
    savedItem.addEventListener('click', async () => {
        const isCurrentlySaved = savedItem.classList.contains('is-added');
        const checkEl = savedItem.querySelector('.collect-sheet__item-check');

        if (isCurrentlySaved) {
            if (painting.favorite_id) {
                try {
                    await API.removeFavorite(painting.favorite_id);
                    painting.is_favorite = false;
                    painting.favorite_id = null;
                    savedItem.classList.remove('is-added');
                    checkEl.textContent = '';
                    if (window.ArtStuffNative) window.ArtStuffNative.haptic();
                } catch (e) {
                    console.error('Failed to remove from Saved:', e);
                    if (window.ArtStuffNative) window.ArtStuffNative.hapticError();
                }
            }
        } else {
            try {
                const result = await API.addFavorite(painting);
                painting.is_favorite = true;
                painting.favorite_id = result.id;
                savedItem.classList.add('is-added');
                checkEl.textContent = '✓';
                if (window.ArtStuffNative) window.ArtStuffNative.hapticSuccess();
            } catch (e) {
                console.error('Failed to save:', e);
                if (window.ArtStuffNative) window.ArtStuffNative.hapticError();
            }
        }
    });

    // Collection item click handlers
    sheet.querySelectorAll('[data-action="collection"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const isAdded = btn.classList.contains('is-added');
            const checkEl = btn.querySelector('.collect-sheet__item-check');

            if (isAdded) return;

            try {
                await API.addToCollection(id, painting);
                btn.classList.add('is-added');
                checkEl.textContent = '✓';
                if (!painting.collections) painting.collections = [];
                const name = btn.querySelector('.collect-sheet__item-name').textContent;
                painting.collections.push({ id: parseInt(id) || id, name: name });
                if (window.ArtStuffNative) window.ArtStuffNative.haptic();
            } catch (e) {
                console.error('Failed to add to collection:', e);
                if (window.ArtStuffNative) window.ArtStuffNative.hapticError();
            }
        });
    });

    // Create new collection
    const nameInput = sheet.querySelector('#sheet-new-collection');
    nameInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const name = nameInput.value.trim();
            if (!name) return;
            try {
                const newCollection = await API.createCollection(name);
                if (newCollection && newCollection.id) {
                    await API.addToCollection(newCollection.id, painting);
                    const list = sheet.querySelector('.collect-sheet__list');
                    const newItem = document.createElement('button');
                    newItem.className = 'collect-sheet__item is-added';
                    newItem.dataset.action = 'collection';
                    newItem.dataset.id = newCollection.id;
                    newItem.innerHTML = `
                        <span class="collect-sheet__item-check">✓</span>
                        <span class="collect-sheet__item-name">${name}</span>
                        <span class="collect-sheet__item-note">1 painting</span>
                    `;
                    list.appendChild(newItem);
                    nameInput.value = '';
                    if (!painting.collections) painting.collections = [];
                    painting.collections.push({ id: newCollection.id, name: name });
                    if (window.ArtStuffNative) window.ArtStuffNative.hapticSuccess();
                }
            } catch (e) {
                console.error('Failed to create collection:', e);
                if (window.ArtStuffNative) window.ArtStuffNative.hapticError();
            }
        }
    });
}

// Update Collect button and "In: ..." info after sheet closes
function updateCollectButton(painting, triggerBtn) {
    if (!triggerBtn) return;

    const isSaved = painting.is_favorite;
    const collections = painting.collections || [];

    if (isSaved || collections.length > 0) {
        triggerBtn.classList.add('is-collected');
        triggerBtn.textContent = '✓ Collected';
    } else {
        triggerBtn.classList.remove('is-collected');
        triggerBtn.textContent = '+ Collect';
    }

    // Rebuild "In: ..." info text
    const actionsDiv = triggerBtn.closest('.painting-actions');
    if (!actionsDiv) return;
    let infoEl = actionsDiv.querySelector('.painting-actions__info');

    const names = [];
    if (isSaved) names.push('Saved');
    collections.forEach(c => names.push(c.name));

    if (names.length > 0) {
        const listText = names.length === 1
            ? names[0]
            : names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];

        if (infoEl) {
            infoEl.innerHTML = `In: <a href="/collection">${listText}</a>`;
        } else {
            infoEl = document.createElement('p');
            infoEl.className = 'painting-actions__info';
            infoEl.innerHTML = `In: <a href="/collection">${listText}</a>`;
            actionsDiv.appendChild(infoEl);
        }
    } else if (infoEl) {
        infoEl.remove();
    }
}

// Collection modal for organizing paintings into collections (used from Collections page)
async function showCollectionModal(painting, triggerBtn, excludeCollectionId) {
    // Remove existing modal if any
    const existing = document.getElementById('collection-modal');
    if (existing) existing.remove();

    // Fetch user's collections
    let collections = [];
    try {
        const result = await API.getCollections();
        collections = result.collections || [];
    } catch (e) {
        console.error('Failed to fetch collections:', e);
    }

    // Get IDs of collections this painting is already in
    const paintingCollectionIds = (painting.collections || []).map(c => c.id);

    // Filter out the collection we're currently viewing
    if (excludeCollectionId) {
        collections = collections.filter(c => String(c.id) !== String(excludeCollectionId));
    }

    // Separate into "already in" and "not in" for Spotify-style display
    const inCollections = collections.filter(c => paintingCollectionIds.includes(c.id));
    const otherCollections = collections.filter(c => !paintingCollectionIds.includes(c.id));

    const modal = document.createElement('div');
    modal.id = 'collection-modal';
    modal.className = 'collection-modal';
    modal.innerHTML = `
        <div class="collection-modal__backdrop"></div>
        <div class="collection-modal__content">
            <button class="collection-modal__close">&times;</button>
            <h3 class="collection-modal__title">Add to Collection</h3>
            <p class="collection-modal__subtitle">Choose a collection for this painting</p>

            <div class="collection-modal__list">
                ${inCollections.length > 0 ? `
                    <p class="collection-modal__section-label">Already in</p>
                    ${inCollections.map(c => `
                        <button class="collection-modal__item is-added" data-id="${c.id}">
                            <span class="collection-modal__item-check">✓</span>
                            <span class="collection-modal__item-name">${c.name}</span>
                            <span class="collection-modal__item-count">${c.item_count} paintings</span>
                        </button>
                    `).join('')}
                ` : ''}
                ${otherCollections.length > 0 ? `
                    ${inCollections.length > 0 ? '<p class="collection-modal__section-label">Add to</p>' : ''}
                    ${otherCollections.map(c => `
                        <button class="collection-modal__item" data-id="${c.id}">
                            <span class="collection-modal__item-check"></span>
                            <span class="collection-modal__item-name">${c.name}</span>
                            <span class="collection-modal__item-count">${c.item_count} paintings</span>
                        </button>
                    `).join('')}
                ` : ''}
                ${collections.length === 0 ? `
                    <p class="collection-modal__empty">No collections yet. Create one below!</p>
                ` : ''}
            </div>

            <div class="collection-modal__create">
                <input type="text" id="new-collection-name" placeholder="+ New collection..." class="collection-modal__input">
            </div>

            <div class="collection-modal__done">
                <button class="btn btn--primary" id="done-btn">Done</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Close handlers
    const closeModal = () => {
        modal.remove();
        document.body.style.overflow = '';
    };
    modal.querySelector('.collection-modal__backdrop').addEventListener('click', closeModal);
    modal.querySelector('.collection-modal__close').addEventListener('click', closeModal);
    modal.querySelector('#done-btn').addEventListener('click', closeModal);

    // Add to collection
    modal.querySelectorAll('.collection-modal__item').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.id;
            const isAdded = btn.classList.contains('is-added');
            const checkEl = btn.querySelector('.collection-modal__item-check');

            if (isAdded) return; // Already added

            try {
                await API.addToCollection(id, painting);
                btn.classList.add('is-added');
                checkEl.textContent = '✓';
                if (window.ArtStuffNative) window.ArtStuffNative.haptic();
            } catch (e) {
                console.error('Failed to add to collection:', e);
                if (window.ArtStuffNative) window.ArtStuffNative.hapticError();
            }
        });
    });

    // Create new collection
    const nameInput = modal.querySelector('#new-collection-name');
    nameInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const name = nameInput.value.trim();
            if (!name) return;
            try {
                const newCollection = await API.createCollection(name);
                if (newCollection && newCollection.id) {
                    await API.addToCollection(newCollection.id, painting);
                    // Add new item to the list
                    const list = modal.querySelector('.collection-modal__list');
                    // Remove empty message if present
                    const emptyMsg = list.querySelector('.collection-modal__empty');
                    if (emptyMsg) emptyMsg.remove();

                    const newItem = document.createElement('button');
                    newItem.className = 'collection-modal__item is-added';
                    newItem.dataset.id = newCollection.id;
                    newItem.innerHTML = `
                        <span class="collection-modal__item-check">✓</span>
                        <span class="collection-modal__item-name">${name}</span>
                        <span class="collection-modal__item-count">1 painting</span>
                    `;
                    list.appendChild(newItem);
                    nameInput.value = '';
                    if (window.ArtStuffNative) window.ArtStuffNative.hapticSuccess();
                }
            } catch (e) {
                console.error('Failed to create collection:', e);
                if (window.ArtStuffNative) window.ArtStuffNative.hapticError();
            }
        }
    });
}

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

    async addJournalEntry(favoriteId, entryText, isPublic = false) {
        const response = await this._fetch(`/api/favorites/${favoriteId}/journal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry_text: entryText, is_public: isPublic })
        });
        return response.json();
    },

    async updateJournalEntry(entryId, entryText, isPublic = null) {
        const body = { entry_text: entryText };
        if (isPublic !== null) body.is_public = isPublic;
        const response = await this._fetch(`/api/journal/${entryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
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
    },

    // Collections API methods
    async getCollections() {
        const response = await this._fetch('/api/collections');
        return response.json();
    },

    async createCollection(name, description) {
        const response = await this._fetch('/api/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });
        return response.json();
    },

    async getCollection(collectionId) {
        const response = await this._fetch(`/api/collections/${collectionId}`);
        return response.json();
    },

    async deleteCollection(collectionId) {
        const response = await this._fetch(`/api/collections/${collectionId}`, {
            method: 'DELETE'
        });
        return response.json();
    },

    async addToCollection(collectionId, paintingData) {
        const response = await this._fetch(`/api/collections/${collectionId}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paintingData)
        });
        return response.json();
    },

    async removeFromCollection(collectionId, itemId) {
        const response = await this._fetch(`/api/collections/${collectionId}/items/${itemId}`, {
            method: 'DELETE'
        });
        return response.json();
    },

    async renameCollection(collectionId, newName) {
        const response = await this._fetch(`/api/collections/${collectionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
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
    const resultsContainer = document.getElementById('search-results');
    const loadMoreBtn = document.getElementById('load-more');

    if (!form) return;

    // Restore search state from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const savedQuery = urlParams.get('q');

    if (savedQuery) {
        input.value = savedQuery;
        searchState.query = savedQuery;
        searchState.museum = null;
        resultsContainer.innerHTML = '<div class="loading">Searching</div>';
        await performSearch(resultsContainer, loadMoreBtn, false);
    }

    // Handle search suggestion clicks
    document.querySelectorAll('.search-suggestion').forEach(btn => {
        btn.addEventListener('click', async () => {
            const query = btn.dataset.query;
            input.value = query;
            searchState.query = query;
            searchState.museum = null;
            searchState.page = 1;
            searchState.hasMore = true;

            history.replaceState(null, '', `/search?q=${encodeURIComponent(query)}`);
            resultsContainer.innerHTML = createSkeletonGrid(8);
            loadMoreBtn.style.display = 'none';

            await performSearch(resultsContainer, loadMoreBtn, false);
        });
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        searchState.query = input.value.trim();
        searchState.museum = null;
        searchState.page = 1;
        searchState.hasMore = true;

        if (!searchState.query) return;

        // Update URL with search params
        const params = new URLSearchParams({ q: searchState.query });
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

// Collection/Collect page - Playlist Hub
async function initCollection() {
    let playlistsGrid = document.getElementById('playlists-grid');
    const createBtn = document.getElementById('create-playlist-btn');

    console.log('initCollection called, playlistsGrid:', playlistsGrid);
    if (!playlistsGrid) return;

    async function loadPlaylists() {
        console.log('loadPlaylists called');
        // Re-query the DOM in case it was replaced
        playlistsGrid = document.getElementById('playlists-grid');
        if (!playlistsGrid) {
            console.error('playlistsGrid not found');
            return;
        }
        try {
            // Fetch both favorites count and user's playlists
            const [favoritesData, collectionsData] = await Promise.all([
                API.getFavorites(),
                API.getCollections()
            ]);
            console.log('API data:', { favoritesData, collectionsData });

            const favorites = favoritesData.favorites || [];
            const collections = collectionsData.collections || [];

            // Build the grid HTML
            let html = '';

            // "Saved" playlist card (favorites) - always first
            const savedCoverImages = favorites.slice(0, 4).map(f => f.thumbnail_url || f.image_url);
            html += createPlaylistCard({
                id: 'saved',
                name: 'Saved',
                count: favorites.length,
                coverImages: savedCoverImages,
                isSaved: true,
                isShareable: false
            });

            // Other playlists
            collections.forEach(c => {
                html += createPlaylistCard({
                    id: c.id,
                    name: c.name,
                    count: c.item_count,
                    coverImages: c.cover_images || [],
                    slug: c.slug,
                    isShareable: true
                });
            });

            playlistsGrid.innerHTML = html || `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <p>No collections yet. Start discovering and collecting art!</p>
                    <a href="/explore" class="btn btn--primary">Discover Art</a>
                </div>
            `;

            // Attach event listeners
            attachPlaylistCardListeners();

        } catch (e) {
            console.error('Failed to load playlists:', e);
            console.error('Error stack:', e.stack);
            playlistsGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <p>Failed to load playlists: ${e.message}</p>
                </div>
            `;
        }
    }

    function createPlaylistCard({ id, name, count, coverImages, isSaved, isShareable, slug }) {
        const coverClass = coverImages.length === 1 ? 'playlist-card__cover--single' :
                          coverImages.length === 0 ? 'playlist-card__cover--empty' : '';

        // Create a 2x2 grid of images, or a placeholder frame icon if no images
        let coverContent;
        if (coverImages.length > 0) {
            // Show up to 4 images in a grid
            coverContent = coverImages.slice(0, 4).map(url => `<img src="${url}" alt="" loading="lazy">`).join('');
        } else {
            // Frame/painting placeholder icon
            coverContent = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
        }

        // Privacy indicator
        const privacyBadge = isSaved
            ? '<span class="playlist-card__privacy playlist-card__privacy--private"><svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M12 1C8.676 1 6 3.676 6 7v2H4v14h16V9h-2V7c0-3.324-2.676-6-6-6zm0 2c2.276 0 4 1.724 4 4v2H8V7c0-2.276 1.724-4 4-4z"/></svg> Private</span>'
            : '<span class="playlist-card__privacy playlist-card__privacy--public"><svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg> Public</span>';

        return `
            <div class="playlist-card ${isSaved ? 'playlist-card--saved' : ''}" data-id="${id}">
                <div class="playlist-card__cover ${coverClass}">
                    ${coverContent}
                </div>
                <div class="playlist-card__info">
                    <h3 class="playlist-card__name">${name}</h3>
                    <p class="playlist-card__meta">${count} painting${count !== 1 ? 's' : ''} ${privacyBadge}</p>
                    <div class="playlist-card__actions">
                        ${isSaved ? '' : `
                            <button class="playlist-card__action rename-btn" data-id="${id}" data-name="${name}">Rename</button>
                            ${isShareable ? `<button class="playlist-card__action share-btn" data-slug="${slug}" data-name="${name}">Share</button>` : ''}
                            <button class="playlist-card__action playlist-card__action--danger delete-btn" data-id="${id}">Delete</button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    function attachPlaylistCardListeners() {
        // Click on Saved card - show saved paintings
        const savedCard = playlistsGrid.querySelector('[data-id="saved"]');
        if (savedCard) {
            savedCard.addEventListener('click', (e) => {
                if (e.target.closest('.playlist-card__actions')) return;
                showSavedPaintings();
            });
        }

        // Click on other playlist cards - show paintings inside
        playlistsGrid.querySelectorAll('.playlist-card:not([data-id="saved"])').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.playlist-card__actions')) return;
                const collectionId = card.dataset.id;
                const collectionName = card.querySelector('.playlist-card__name').textContent;
                const slug = card.querySelector('.share-btn')?.dataset.slug;
                showCollectionPaintings(collectionId, collectionName, slug);
            });
        });

        // Share buttons (uses native share on mobile, copy link on desktop)
        playlistsGrid.querySelectorAll('.share-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const slug = btn.dataset.slug;
                const name = btn.dataset.name;
                const url = `${window.location.origin}/s/${slug}`;

                // Try native share API first (works on mobile)
                if (navigator.share) {
                    try {
                        await navigator.share({
                            title: `${name} - Art Stuff`,
                            text: `Check out my art collection: ${name}`,
                            url: url
                        });
                    } catch (err) {
                        // User cancelled or share failed - that's ok
                        if (err.name !== 'AbortError') {
                            console.log('Share failed, falling back to copy');
                            copyToClipboard(url, btn);
                        }
                    }
                } else {
                    // Fallback to copy link
                    copyToClipboard(url, btn);
                }
            });
        });

        function copyToClipboard(url, btn) {
            navigator.clipboard.writeText(url).then(() => {
                const original = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = original, 1500);
            });
        }

        // Delete buttons
        playlistsGrid.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('Delete this collection?')) return;
                try {
                    await API.deleteCollection(btn.dataset.id);
                    loadPlaylists();
                } catch (err) {
                    alert('Failed to delete collection');
                }
            });
        });

        // Rename buttons
        playlistsGrid.querySelectorAll('.rename-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const currentName = btn.dataset.name;
                const newName = prompt('Rename collection:', currentName);
                if (!newName || newName.trim() === '' || newName === currentName) return;
                try {
                    await API.renameCollection(btn.dataset.id, newName.trim());
                    loadPlaylists();
                } catch (err) {
                    alert('Failed to rename collection');
                }
            });
        });
    }

    // Create a painting card with actions for collection views (mobile-friendly)
    function createPaintingCardWithMenu(painting, options = {}) {
        console.log('[Art Stuff] createPaintingCardWithMenu called with:', painting, options);
        const card = document.createElement('article');
        card.className = 'painting-card painting-card--with-actions';

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
            </div>
            <div class="painting-card__bottom-actions">
                <button class="painting-card__action-btn" data-action="add-to-collection">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                        <path d="M12 5v14M5 12h14"/>
                    </svg>
                    Add
                </button>
                ${options.showRemove ? `
                    <button class="painting-card__action-btn painting-card__action-btn--danger" data-action="remove">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                            <path d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                        Remove
                    </button>
                ` : ''}
            </div>
        `;

        // Click on card image/info to go to painting detail
        const imageContainer = card.querySelector('.painting-card__image-container');
        const infoContainer = card.querySelector('.painting-card__info');

        [imageContainer, infoContainer].forEach(el => {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
                window.location.href = `/painting/${painting.museum}/${encodeURIComponent(painting.external_id)}`;
            });
        });

        // Action button clicks
        card.querySelectorAll('.painting-card__action-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;

                if (action === 'add-to-collection') {
                    showCollectionModal(painting, null, options.collectionId);
                } else if (action === 'remove' && options.onRemove) {
                    options.onRemove(painting);
                }
            });
        });

        // Add fade-in effect when image loads
        const img = card.querySelector('.painting-card__image');
        if (img.complete) {
            img.classList.add('loaded');
        } else {
            img.addEventListener('load', () => img.classList.add('loaded'));
        }

        return card;
    }

    async function showSavedPaintings() {
        // Replace grid with saved paintings view
        const section = document.getElementById('playlists-section');
        section.innerHTML = `
            <button class="btn" id="back-to-playlists" style="margin-bottom: var(--spacing-lg);">&larr; Back to Collections</button>
            <h2 style="font-family: var(--font-serif); margin-bottom: 0.5rem;">Saved</h2>
            <p class="saved-hint" style="font-size: 0.8125rem; color: var(--color-text-muted); margin-bottom: var(--spacing-lg);">
                Use the Add button to organize into collections.
            </p>
            <div id="saved-paintings-grid" class="painting-grid">
                <div class="loading">Loading saved paintings</div>
            </div>
        `;

        document.getElementById('back-to-playlists').addEventListener('click', () => {
            section.innerHTML = '<div class="playlists-grid" id="playlists-grid"><div class="loading">Loading</div></div>';
            loadPlaylists();
        });

        try {
            const data = await API.getFavorites();
            console.log('[Art Stuff] Favorites data:', data);
            const grid = document.getElementById('saved-paintings-grid');
            console.log('[Art Stuff] Saved paintings grid:', grid);

            if (data.favorites && data.favorites.length > 0) {
                grid.innerHTML = '';
                console.log('[Art Stuff] Rendering', data.favorites.length, 'favorites');
                data.favorites.forEach((painting, index) => {
                    console.log('[Art Stuff] Creating card for:', painting.title, painting);
                    const card = createPaintingCardWithMenu(painting, {
                        showRemove: true,
                        removeLabel: 'Saved',
                        onRemove: async (p) => {
                            if (!confirm(`Remove "${p.title}" from Saved?`)) return;
                            try {
                                await API.removeFavorite(p.id);
                                card.remove();
                                // Check if grid is empty
                                if (grid.children.length === 0) {
                                    grid.innerHTML = `
                                        <div class="empty-state" style="grid-column: 1 / -1;">
                                            <p>No saved paintings yet</p>
                                            <a href="/explore" class="btn btn--primary">Discover Art</a>
                                        </div>
                                    `;
                                }
                            } catch (err) {
                                alert('Failed to remove painting');
                            }
                        }
                    });
                    grid.appendChild(card);
                });
            } else {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <p>No saved paintings yet</p>
                        <a href="/explore" class="btn btn--primary">Discover Art</a>
                    </div>
                `;
            }
        } catch (e) {
            console.error('Failed to load saved paintings:', e);
        }
    }

    async function showCollectionPaintings(collectionId, collectionName, slug) {
        // Replace grid with collection paintings view
        const section = document.getElementById('playlists-section');
        section.innerHTML = `
            <button class="btn" id="back-to-playlists" style="margin-bottom: var(--spacing-lg);">&larr; Back to Collections</button>
            <div class="collection-header-row">
                <h2 style="font-family: var(--font-serif); margin-bottom: 0;">${collectionName}</h2>
                ${slug ? `<button class="btn btn--small collection-share-btn" data-slug="${slug}" data-name="${collectionName}" style="margin-left: auto;">Share</button>` : ''}
            </div>
            <div id="collection-paintings-grid" class="painting-grid">
                <div class="loading">Loading paintings</div>
            </div>
        `;

        document.getElementById('back-to-playlists').addEventListener('click', () => {
            section.innerHTML = '<div class="playlists-grid" id="playlists-grid"><div class="loading">Loading</div></div>';
            loadPlaylists();
        });

        // Share button for collection
        const shareBtn = document.querySelector('.collection-share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', async () => {
                const url = `${window.location.origin}/s/${slug}`;
                if (navigator.share) {
                    try {
                        await navigator.share({
                            title: `${collectionName} - Art Stuff`,
                            text: `Check out my art collection: ${collectionName}`,
                            url: url
                        });
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            navigator.clipboard.writeText(url);
                            shareBtn.textContent = 'Copied!';
                            setTimeout(() => shareBtn.textContent = 'Share', 1500);
                        }
                    }
                } else {
                    navigator.clipboard.writeText(url);
                    shareBtn.textContent = 'Copied!';
                    setTimeout(() => shareBtn.textContent = 'Share', 1500);
                }
            });
        }

        try {
            const collection = await API.getCollection(collectionId);
            const grid = document.getElementById('collection-paintings-grid');
            const items = collection.items || [];

            if (items.length > 0) {
                grid.innerHTML = '';
                items.forEach(item => {
                    // Map collection item to painting format
                    const painting = {
                        external_id: item.external_id,
                        museum: item.museum,
                        title: item.title,
                        artist: item.artist,
                        image_url: item.image_url,
                        thumbnail_url: item.image_url
                    };

                    const card = createPaintingCardWithMenu(painting, {
                        showRemove: true,
                        removeLabel: collectionName,
                        collectionId: collectionId,
                        itemId: item.id,
                        onRemove: async (p) => {
                            if (!confirm(`Remove "${p.title}" from ${collectionName}?`)) return;
                            try {
                                await API.removeFromCollection(collectionId, item.id);
                                card.remove();
                                if (window.ArtStuffNative) window.ArtStuffNative.haptic();
                                // Check if grid is empty
                                if (grid.children.length === 0) {
                                    grid.innerHTML = `
                                        <div class="empty-state" style="grid-column: 1 / -1;">
                                            <p>No paintings in this collection yet</p>
                                            <a href="/explore" class="btn btn--primary">Discover Art</a>
                                        </div>
                                    `;
                                }
                            } catch (err) {
                                alert('Failed to remove painting');
                                if (window.ArtStuffNative) window.ArtStuffNative.hapticError();
                            }
                        }
                    });
                    grid.appendChild(card);
                });
            } else {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <p>No paintings in this collection yet</p>
                        <a href="/explore" class="btn btn--primary">Discover Art</a>
                    </div>
                `;
            }
        } catch (e) {
            console.error('Failed to load collection paintings:', e);
        }
    }

    // Create collection button
    if (createBtn) {
        createBtn.addEventListener('click', async () => {
            const name = prompt('Collection name:');
            if (!name || !name.trim()) return;
            try {
                await API.createCollection(name.trim());
                loadPlaylists();
            } catch (e) {
                alert('Failed to create collection');
            }
        });
    }

    await loadPlaylists();
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
    const collections = painting.collections || [];
    const artistName = painting.artist || 'Unknown Artist';

    // Collect button
    const isCollected = isFavorite || collections.length > 0;
    const collectButtonText = isLoggedIn
        ? (isCollected ? '✓ Collected' : '+ Collect')
        : '+ Collect';
    const collectButtonClass = isLoggedIn
        ? `btn btn--collect ${isCollected ? 'is-collected' : ''}`
        : 'btn btn--collect';

    // Build list of all collections this painting is in
    let collectionInfo = '';
    if (isLoggedIn && (isFavorite || collections.length > 0)) {
        const collectionNames = [];
        if (isFavorite) collectionNames.push('Saved');
        collections.forEach(c => collectionNames.push(c.name));

        const collectionList = collectionNames.length === 1
            ? collectionNames[0]
            : collectionNames.slice(0, -1).join(', ') + ' & ' + collectionNames[collectionNames.length - 1];

        collectionInfo = `<p class="painting-actions__info">In: <a href="/collection">${collectionList}</a></p>`;
    }

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
                    <button class="${collectButtonClass}"
                            id="collect-btn"
                            data-painting='${JSON.stringify(painting).replace(/'/g, "&#39;")}'>
                        ${collectButtonText}
                    </button>
                    ${collectionInfo}
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

            </div>
        </div>

        ${painting.description ? `
            <div class="painting-detail__description">
                ${isLoggedIn ? `
                    <p>${painting.description}</p>
                ` : `
                    <p>${truncateText(painting.description, 300)}</p>
                    <p class="description-signup-prompt">
                        <a href="/login?signup">Create an account</a> to start building your own art playlists.
                    </p>
                `}
            </div>
        ` : ''}

        ${isLoggedIn && isFavorite ? `
            <section class="painting-detail__personal" id="personal-section">
                <h3 class="painting-detail__section-title">Your Notes</h3>

                <div class="tags-section" id="tags-section">
                    <div class="tags-list" id="tags-list">
                        ${(painting.tags || []).map(tag => `
                            <span class="tag">${tag}<span class="tag__remove" data-tag="${tag}">&times;</span></span>
                        `).join('')}
                    </div>
                    <div class="tag-input-group">
                        <input type="text" id="new-tag-input" placeholder="Add tag..." class="tag-input">
                        <button class="btn btn--small" id="add-tag-btn">Add</button>
                    </div>
                </div>

                <div class="journal-section" id="journal-section">
                    <h4 class="journal-section__title">Journal</h4>
                    <div class="journal-entries" id="journal-entries">
                        <div class="loading">Loading notes...</div>
                    </div>
                    <div class="journal-new">
                        <textarea id="new-entry-text" placeholder="Write your thoughts about this painting..." class="journal-textarea"></textarea>
                        <div class="journal-new__options">
                            <label class="visibility-toggle">
                                <input type="checkbox" id="note-is-public">
                                <span class="visibility-toggle__slider"></span>
                                <span class="visibility-toggle__label" id="visibility-label">Private note</span>
                            </label>
                            <span class="visibility-toggle__help">Public notes appear on shared collections</span>
                        </div>
                        <button class="btn btn--primary" id="add-entry-btn">Add Note</button>
                    </div>
                </div>
            </section>
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

    // Set up Collect button — opens bottom sheet picker
    const collectBtn = document.getElementById('collect-btn');
    collectBtn.addEventListener('click', async () => {
        if (!isLoggedIn) {
            window.location.href = '/login?signup';
            return;
        }
        showCollectSheet(painting, collectBtn);
    });

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

    // Initialize tags and journal if user has saved this painting
    if (isLoggedIn && isFavorite && painting.favorite_id) {
        setupTags(painting.favorite_id, painting.tags || []);
        loadJournalEntries(painting.favorite_id);
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
    const isPublicCheckbox = document.getElementById('note-is-public');
    const visibilityLabel = document.getElementById('visibility-label');

    // Toggle label update
    if (isPublicCheckbox && visibilityLabel) {
        isPublicCheckbox.addEventListener('change', () => {
            visibilityLabel.textContent = isPublicCheckbox.checked ? 'Public note' : 'Private note';
        });
    }

    // Add new entry
    addEntryBtn.addEventListener('click', async () => {
        const text = newEntryText.value.trim();
        if (!text) return;

        const isPublic = isPublicCheckbox ? isPublicCheckbox.checked : false;
        const result = await API.addJournalEntry(favoriteId, text, isPublic);
        newEntryText.value = '';
        if (isPublicCheckbox) isPublicCheckbox.checked = false;
        if (visibilityLabel) visibilityLabel.textContent = 'Private note';
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
            <article class="journal-entry ${entry.is_public ? 'journal-entry--public' : ''}" data-id="${entry.id}" data-is-public="${entry.is_public || false}">
                <div class="journal-entry__header">
                    <p class="journal-entry__date">${formatDate(entry.created_at)}</p>
                    <span class="journal-entry__visibility ${entry.is_public ? 'journal-entry__visibility--public' : ''}">
                        ${entry.is_public ? '🌐 Public' : '🔒 Private'}
                    </span>
                </div>
                <p class="journal-entry__text">${entry.entry_text}</p>
                <div class="journal-entry__actions">
                    <button class="btn btn-toggle-visibility">${entry.is_public ? 'Make Private' : 'Make Public'}</button>
                    <button class="btn btn-edit-entry">Edit</button>
                    <button class="btn btn-delete-entry">Delete</button>
                </div>
            </article>
        `).join('');

        // Set up edit/delete/visibility handlers
        entriesContainer.querySelectorAll('.journal-entry').forEach(entryEl => {
            const entryId = parseInt(entryEl.dataset.id);
            const textEl = entryEl.querySelector('.journal-entry__text');
            const editBtn = entryEl.querySelector('.btn-edit-entry');
            const deleteBtn = entryEl.querySelector('.btn-delete-entry');
            const toggleVisibilityBtn = entryEl.querySelector('.btn-toggle-visibility');
            const visibilitySpan = entryEl.querySelector('.journal-entry__visibility');

            // Toggle visibility handler
            toggleVisibilityBtn.addEventListener('click', async () => {
                const currentIsPublic = entryEl.dataset.isPublic === 'true';
                const newIsPublic = !currentIsPublic;
                const currentText = textEl.textContent;

                await API.updateJournalEntry(entryId, currentText, newIsPublic);

                // Update UI
                entryEl.dataset.isPublic = newIsPublic;
                entryEl.classList.toggle('journal-entry--public', newIsPublic);
                visibilitySpan.className = `journal-entry__visibility ${newIsPublic ? 'journal-entry__visibility--public' : ''}`;
                visibilitySpan.innerHTML = newIsPublic ? '🌐 Public' : '🔒 Private';
                toggleVisibilityBtn.textContent = newIsPublic ? 'Make Private' : 'Make Public';
            });

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
    const erasTrackCheck = document.getElementById('eras-track');

    if (!loadingEl && !previewMode && !erasTrackCheck) return;

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

    const erasTrack = document.getElementById('eras-track');
    const themesTrack = document.getElementById('themes-track');
    const featuredTrack = document.getElementById('featured-track');
    const moodsGrid = document.getElementById('moods-grid');
    const surpriseBtn = document.getElementById('surprise-btn');

    if (!erasTrack) return;

    // Helper: create a framed carousel card
    function createCarouselCard(href, imageUrl, title, subtitle, description, accentColor) {
        const card = document.createElement('a');
        card.href = href;
        card.className = 'carousel-card';
        if (accentColor) card.style.setProperty('--card-accent', accentColor);
        card.innerHTML = `
            <div class="carousel-card__frame">
                <img class="carousel-card__img" src="${imageUrl || ''}" alt="${title}" loading="lazy">
            </div>
            <h3 class="carousel-card__title">${title}</h3>
            ${subtitle ? `<p class="carousel-card__subtitle">${subtitle}</p>` : ''}
            <p class="carousel-card__desc">${description}</p>
        `;
        return card;
    }

    try {
        const data = await API.getCategories();
        const reps = data.representatives || {};

        // Populate eras carousel
        erasTrack.innerHTML = '';
        Object.entries(data.eras).forEach(([key, era]) => {
            const rep = reps.eras && reps.eras[key];
            const imageUrl = rep ? rep.image_url : '';
            const card = createCarouselCard(
                `/explore/era/${key}`,
                imageUrl,
                era.name,
                era.years,
                era.description,
                era.wall_color
            );
            erasTrack.appendChild(card);
        });

        // Populate themes carousel
        themesTrack.innerHTML = '';
        Object.entries(data.themes).forEach(([key, theme]) => {
            const rep = reps.themes && reps.themes[key];
            const imageUrl = rep ? rep.image_url : '';
            const card = createCarouselCard(
                `/explore/theme/${key}`,
                imageUrl,
                theme.name,
                null,
                theme.description
            );
            themesTrack.appendChild(card);
        });

        // Populate featured carousel (Today's Artist + This Week's Focus)
        featuredTrack.innerHTML = '';
        if (data.featured_artist) {
            const artist = data.featured_artist;
            const rep = reps.featured_artist;
            const imageUrl = rep ? rep.image_url : '';
            const card = createCarouselCard(
                `/explore/artist/${encodeURIComponent(artist.name)}`,
                imageUrl,
                artist.full_name,
                "Today's Artist",
                artist.bio
            );
            featuredTrack.appendChild(card);
        }
        if (data.weekly_spotlight) {
            const spotlight = data.weekly_spotlight;
            const rep = reps.eras && reps.eras[spotlight.key];
            const imageUrl = rep ? rep.image_url : '';
            const card = createCarouselCard(
                `/explore/era/${spotlight.key}`,
                imageUrl,
                spotlight.name,
                "This Week's Focus — " + spotlight.years,
                spotlight.description
            );
            featuredTrack.appendChild(card);
        }

        // Populate moods
        if (moodsGrid) {
            moodsGrid.innerHTML = '';
            Object.entries(data.moods).forEach(([key, mood]) => {
                const btn = document.createElement('a');
                btn.href = `/explore/mood/${key}`;
                btn.className = 'mood-btn';
                btn.textContent = mood.name;
                moodsGrid.appendChild(btn);
            });
        }

    } catch (error) {
        console.error('Error loading categories:', error);
        erasTrack.innerHTML = '<p>Failed to load categories</p>';
    }

    // Carousel navigation
    document.querySelectorAll('.carousel__btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const trackId = btn.dataset.carousel;
            const track = document.getElementById(trackId);
            if (!track) return;
            const cardWidth = track.querySelector('.carousel-card')?.offsetWidth || 300;
            const gap = 24;
            const scrollAmount = cardWidth + gap;
            if (btn.classList.contains('carousel__btn--prev')) {
                track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
            } else {
                track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            }
        });
    });

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
    console.log('[Art Stuff] loadCollectionStats called');
    const statsContainer = document.getElementById('collection-stats');
    console.log('[Art Stuff] statsContainer:', statsContainer);
    if (!statsContainer) {
        console.log('[Art Stuff] No stats container found, returning');
        return;
    }

    try {
        const stats = await API.getStats();
        console.log('[Art Stuff] Stats received:', stats);

        // Animate each stat with a slight delay between them
        const paintingsEl = document.getElementById('stat-paintings');
        const artistsEl = document.getElementById('stat-artists');
        const museumsEl = document.getElementById('stat-museums');

        console.log('[Art Stuff] Stat elements:', { paintingsEl, artistsEl, museumsEl });

        if (paintingsEl) animateCounter(paintingsEl, stats.paintings, 2500);
        if (artistsEl) setTimeout(() => animateCounter(artistsEl, stats.artists, 2500), 200);
        if (museumsEl) setTimeout(() => animateCounter(museumsEl, stats.museums, 2500), 400);
    } catch (error) {
        console.error('[Art Stuff] Error loading stats:', error);
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
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Art Stuff] DOMContentLoaded, initializing...');

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

    // Initialize page-specific functionality with error handling
    try {
        if (document.getElementById('painting-of-day')) {
            console.log('[Art Stuff] Initializing home page');
            await initHome();
        }
        if (document.getElementById('search-form')) {
            console.log('[Art Stuff] Initializing search page');
            initSearch();
        }
        if (document.getElementById('playlists-grid')) {
            console.log('[Art Stuff] Initializing collection/playlists page');
            await initCollection();
        }
        if (document.getElementById('painting-detail')) {
            console.log('[Art Stuff] Initializing painting detail page');
            await initPaintingDetail();
        }
        if (document.getElementById('explore-loading') || document.getElementById('preview-mode')) {
            console.log('[Art Stuff] Initializing explore page');
            await initExplore();
        }
        if (document.querySelector('.browse-page')) {
            console.log('[Art Stuff] Initializing browse page');
            await initBrowse();
        }
        if (document.querySelector('.artist-page')) {
            console.log('[Art Stuff] Initializing artist page');
            await initArtist();
        }
    } catch (err) {
        console.error('[Art Stuff] Initialization error:', err);
    }
});
