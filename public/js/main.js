/**
 * Hudson Paine - Theme JS
 * Handles: category switching, segmented control, content filtering, MT themes
 */

(function () {
    'use strict';

    // --- Category-to-theme mapping (single theme per category, no dark mode) ---
    var CATEGORY_THEMES = {
        stories:  'iceberg_light',
        products: 'serika'
    };

    // --- Rotating taglines ---
    var TAGLINES = [
        'tinkerer',
        'collector of hobbies',
        'probably biking with my dog',
        'i like software and designing it',
        'i like bikes and building them',
        'presentation is everything\u2014especially with food',
        'design leader',
        'design technologist',
        'tokensmith',
        'brand designer and enthusiast',
        'fledgling graphic artist',
        'product designer',
        'figma teacher',
        'icon designer',
        'people person',
        'connection forger',
        'parity purveyor',
        'clarity creator',
        'motion magician',
        '3d experimenter',
        'fly fisher',
        'cyclist',
        'surf caster',
        'wannabe outdoorsman',
        'rock enjoyer',
        'psychedelic rock enjoyer',
        'concert goer',
        'friend'
    ];
    var lastTaglineIndex = -1;

    function getRandomTagline() {
        var idx;
        do {
            idx = Math.floor(Math.random() * TAGLINES.length);
        } while (idx === lastTaglineIndex && TAGLINES.length > 1);
        lastTaglineIndex = idx;
        return TAGLINES[idx];
    }

    // All CSS custom properties that themes control
    var THEME_PROPS = [
        '--bg', '--bg-hero', '--text', '--text-hero', '--accent',
        '--card-bg', '--card-title', '--segment-bg', '--segment-text',
        '--segment-inactive', '--cta-bg', '--cta-text', '--nav-home'
    ];

    // --- State ---
    var currentCategory = localStorage.getItem('hud-category') || 'stories';
    var currentTheme = localStorage.getItem('hud-theme') || null;
    var manualOverride = localStorage.getItem('hud-theme-manual') === 'true';

    // --- DOM refs ---
    var body = document.body;
    var html = document.documentElement;
    var segments = document.querySelectorAll('.segment');
    var indicator = document.querySelector('.segment-indicator');
    var cards = document.querySelectorAll('.card[data-categories]');
    var heroTagline = document.querySelector('.hero-tagline');
    var ctaBanner = document.querySelector('.cta-banner');
    var ctaText = document.querySelector('.cta-text');
    var themeBtn = document.querySelector('.theme-selector-btn');
    var themeDropdown = document.querySelector('.theme-dropdown');
    var themeList = document.querySelector('.theme-list');
    var themeSearch = document.querySelector('.theme-search');
    var themeNameEl = document.querySelector('.theme-selector-name');

    // --- Theme application (inline styles on body) ---
    function applyMtTheme(name) {
        if (!name) {
            clearMtTheme();
            return;
        }
        var t = (typeof MT_THEMES !== 'undefined') ? MT_THEMES[name] : null;
        if (!t) return;

        html.setAttribute('data-mt-theme', name);

        body.style.setProperty('--bg', t.bg);
        body.style.setProperty('--bg-hero', t.subAlt);
        body.style.setProperty('--text', t.text);
        body.style.setProperty('--text-hero', t.text);
        body.style.setProperty('--accent', t.main);
        body.style.setProperty('--card-bg', t.subAlt);
        body.style.setProperty('--card-title', t.text);
        body.style.setProperty('--segment-bg', t.main);
        body.style.setProperty('--segment-text', t.bg);
        body.style.setProperty('--segment-inactive', t.sub);
        body.style.setProperty('--cta-bg', t.subAlt);
        body.style.setProperty('--cta-text', t.text);
        body.style.setProperty('--nav-home', t.main);

        currentTheme = name;
        localStorage.setItem('hud-theme', name);
        if (themeNameEl) themeNameEl.textContent = name;
    }

    function clearMtTheme() {
        html.removeAttribute('data-mt-theme');
        THEME_PROPS.forEach(function (prop) {
            body.style.removeProperty(prop);
        });
        currentTheme = null;
        localStorage.removeItem('hud-theme');
        if (themeNameEl) themeNameEl.textContent = 'Default';
    }

    function applyCategoryTheme() {
        var themeName = CATEGORY_THEMES[currentCategory];
        if (themeName) {
            applyMtTheme(themeName);
        }
    }

    // --- Segmented control ---
    function updateIndicator() {
        if (!indicator) return;
        var activeBtn = document.querySelector('.segment.active');
        if (!activeBtn) return;
        indicator.style.left = activeBtn.offsetLeft + 'px';
        indicator.style.width = activeBtn.offsetWidth + 'px';
    }

    function setCategory(cat) {
        currentCategory = cat;
        localStorage.setItem('hud-category', cat);
        body.setAttribute('data-category', cat);

        // Update segments
        segments.forEach(function (s) {
            s.classList.toggle('active', s.dataset.category === cat);
        });
        updateIndicator();

        // Update hero tagline (random on each switch)
        if (heroTagline) {
            heroTagline.textContent = getRandomTagline();
        }

        // Update hero images
        document.querySelectorAll('.hero-img').forEach(function (img) {
            img.style.display = img.classList.contains('hero-img-' + cat) ? '' : 'none';
        });

        // Update CTA
        if (ctaBanner) {
            if (cat === 'stories') {
                ctaBanner.classList.remove('visible');
            } else {
                ctaBanner.classList.add('visible');
                if (ctaText) {
                    ctaText.textContent = ctaBanner.dataset['cta' + cat.charAt(0).toUpperCase() + cat.slice(1)] || '';
                }
            }
        }

        // Filter cards — stories category also shows projects-tagged posts
        cards.forEach(function (card) {
            var cats = card.dataset.categories || '';
            var show;
            if (cat === 'stories') {
                show = cats.indexOf('stories') !== -1 || cats.indexOf('projects') !== -1;
            } else {
                show = cats.indexOf(cat) !== -1;
            }
            card.classList.toggle('hidden', !show);
        });

        // Apply category default theme unless manual override
        if (!manualOverride) {
            applyCategoryTheme();
        }
    }

    segments.forEach(function (btn) {
        btn.addEventListener('click', function () {
            setCategory(btn.dataset.category);
        });
    });

    // --- Theme selector dropdown ---
    function buildThemeList(filter) {
        if (!themeList) return;
        themeList.innerHTML = '';
        var frag = document.createDocumentFragment();

        // "Reset to default" option
        var defBtn = document.createElement('button');
        defBtn.className = 'theme-option' + (!manualOverride ? ' active' : '');
        defBtn.innerHTML = '<span class="theme-option-dots"><span class="theme-option-dot" style="background:#1a1a1a"></span><span class="theme-option-dot" style="background:#fff"></span><span class="theme-option-dot" style="background:#e8e8e8"></span></span><span>Reset to default</span>';
        defBtn.addEventListener('click', function () {
            manualOverride = false;
            localStorage.removeItem('hud-theme-manual');
            applyCategoryTheme();
            closeDropdown();
        });
        if (!filter) frag.appendChild(defBtn);

        if (typeof MT_THEMES === 'undefined') return;
        var names = Object.keys(MT_THEMES);
        var lowerFilter = (filter || '').toLowerCase();
        names.forEach(function (name) {
            if (lowerFilter && name.toLowerCase().indexOf(lowerFilter) === -1) return;
            var t = MT_THEMES[name];
            var btn = document.createElement('button');
            btn.className = 'theme-option' + (currentTheme === name && manualOverride ? ' active' : '');
            btn.innerHTML = '<span class="theme-option-dots">' +
                '<span class="theme-option-dot" style="background:' + t.bg + ';border:1px solid ' + t.sub + '"></span>' +
                '<span class="theme-option-dot" style="background:' + t.main + '"></span>' +
                '<span class="theme-option-dot" style="background:' + t.text + '"></span>' +
                '</span><span>' + name + '</span>';
            btn.addEventListener('click', function () {
                manualOverride = true;
                localStorage.setItem('hud-theme-manual', 'true');
                applyMtTheme(name);
                closeDropdown();
            });
            frag.appendChild(btn);
        });
        themeList.appendChild(frag);
    }

    function closeDropdown() {
        if (themeDropdown) themeDropdown.hidden = true;
    }

    if (themeBtn && themeDropdown) {
        themeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var isOpen = !themeDropdown.hidden;
            if (isOpen) {
                closeDropdown();
            } else {
                themeDropdown.hidden = false;
                buildThemeList('');
                if (themeSearch) {
                    themeSearch.value = '';
                    themeSearch.focus();
                }
            }
        });

        document.addEventListener('click', function (e) {
            if (!themeDropdown.hidden && !themeDropdown.contains(e.target) && !themeBtn.contains(e.target)) {
                closeDropdown();
            }
        });

        if (themeSearch) {
            themeSearch.addEventListener('input', function () {
                buildThemeList(themeSearch.value);
            });
        }
    }

    // --- Post detail page: set category from data attribute ---
    var postArticle = document.querySelector('.post-article[data-post-category]');
    if (postArticle) {
        var postCat = postArticle.dataset.postCategory;
        currentCategory = postCat;
        body.setAttribute('data-category', postCat);
    }

    // --- Init ---
    if (manualOverride && currentTheme) {
        // Restore manual theme
        applyMtTheme(currentTheme);
    } else if (segments.length) {
        // Homepage: setCategory handles theme
        setCategory(currentCategory);
    } else {
        // Post/other pages: apply category default
        applyCategoryTheme();
    }

    // Recalculate indicator on resize
    window.addEventListener('resize', updateIndicator);
})();
