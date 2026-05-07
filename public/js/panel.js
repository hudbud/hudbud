(function () {
    'use strict';

    var panel = document.getElementById('detail-panel');
    var panelContent = document.getElementById('detail-panel-content');
    var panelClose = document.getElementById('detail-panel-close');
    if (!panel || !panelContent) return;

    function openPanel(card) {
        var title = card.dataset.title;
        var image = card.dataset.image;
        var html = decodeURIComponent(card.dataset.html || '');

        var markup = '<div class="panel-post">';
        markup += '<h1 class="panel-post-title">' + title + '</h1>';
        markup += '<div class="panel-post-actions">';
        markup += '<button class="spritz-trigger" id="spritz-trigger">Speed Read</button>';
        markup += '</div>';
        if (image) {
            markup += '<figure class="panel-post-image"><img src="' + image + '" alt="' + title + '"></figure>';
        }
        markup += '<div class="spritz-container" id="spritz-container" hidden></div>';
        markup += '<div class="panel-post-content">' + html + '</div>';
        markup += '</div>';

        panelContent.innerHTML = markup;
        panel.hidden = false;
        panel.scrollTop = 0;

        var trigger = document.getElementById('spritz-trigger');
        var spritzContainer = document.getElementById('spritz-container');
        if (trigger && spritzContainer && window.SpritzReader) {
            trigger.addEventListener('click', function () {
                spritzContainer.hidden = false;
                window.SpritzReader.create(spritzContainer, html);
            });
        }
    }

    function closePanel() {
        panel.hidden = true;
        panelContent.innerHTML = '';
    }

    if (panelClose) {
        panelClose.addEventListener('click', closePanel);
    }

    document.addEventListener('click', function (e) {
        var card = e.target.closest('.card[data-html]');
        if (card) {
            e.preventDefault();
            openPanel(card);
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !panel.hidden) {
            closePanel();
        }
    });
})();
