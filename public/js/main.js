/**
 * Hudson Paine - Theme JS
 * Handles: category switching, chip filtering, MT themes
 */

(function () {
    'use strict';

    // --- Category-to-theme mapping ---
    var CATEGORY_THEMES = {
        writing: 'iceberg_light',
        photos:  'iceberg_light',
        misc:    'serika'
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
    var validCategories = ['writing', 'photos', 'misc'];
    var savedCategory = localStorage.getItem('hud-category') || 'writing';
    var currentCategory = validCategories.includes(savedCategory) ? savedCategory : 'writing';
    var currentTheme = localStorage.getItem('hud-theme') || null;
    var manualOverride = localStorage.getItem('hud-theme-manual') === 'true';

    // --- DOM refs ---
    var body = document.body;
    var html = document.documentElement;
    var chips = document.querySelectorAll('.chip[data-category]');
    var cards = document.querySelectorAll('.card[data-categories]');
    var heroTagline = document.querySelector('.hero-tagline');
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

    // --- Chip filtering ---
    function setCategory(cat) {
        currentCategory = cat;
        localStorage.setItem('hud-category', cat);
        body.setAttribute('data-category', cat);

        // Update active chip
        chips.forEach(function (chip) {
            chip.classList.toggle('active', chip.dataset.category === cat);
        });

        // Update hero tagline
        if (heroTagline) {
            heroTagline.textContent = getRandomTagline();
        }

        // Filter cards
        cards.forEach(function (card) {
            var catArr = (card.dataset.categories || '').split(' ');
            var show;
            if (cat === 'writing') {
                show = catArr.some(function (c) { return c === 'writing' || c === 'stories'; });
            } else if (cat === 'photos') {
                show = catArr.some(function (c) { return c === 'photos' || c === 'photography'; });
            } else {
                show = catArr.some(function (c) { return c === 'misc' || c === 'experiments' || c === 'projects'; });
            }
            card.classList.toggle('hidden', !show);
        });

        // Apply category default theme unless manual override
        if (!manualOverride) {
            applyCategoryTheme();
        }
    }

    chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
            setCategory(chip.dataset.category);
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
        applyMtTheme(currentTheme);
    } else if (chips.length) {
        setCategory(currentCategory);
    } else {
        applyCategoryTheme();
    }
})();
