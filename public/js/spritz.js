(function () {
    'use strict';

    function getPivotIndex(word) {
        var len = word.length;
        if (len <= 1) return 0;
        if (len <= 5) return Math.floor(len / 2) - 1;
        if (len <= 9) return Math.floor(len / 2) - 1;
        return Math.floor(len / 2) - 1;
    }

    function renderWord(container, word) {
        if (!word) {
            container.innerHTML = '';
            return;
        }
        var pivot = getPivotIndex(word);
        var before = word.slice(0, pivot);
        var letter = word[pivot];
        var after = word.slice(pivot + 1);
        container.innerHTML =
            '<span class="spritz-before">' + before + '</span>' +
            '<span class="spritz-pivot">' + letter + '</span>' +
            '<span class="spritz-after">' + after + '</span>';
    }

    function getDelay(word, baseMs) {
        if (!word) return baseMs;
        if (word.length > 8) return baseMs * 1.4;
        if (/[.!?;]$/.test(word)) return baseMs * 2;
        if (/[,:]$/.test(word)) return baseMs * 1.5;
        return baseMs;
    }

    function extractText(html) {
        var div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    window.SpritzReader = {
        create: function (containerEl, html) {
            var text = extractText(html);
            var words = text.split(/\s+/).filter(Boolean);
            var wpm = 300;
            var baseMs = 60000 / wpm;
            var index = 0;
            var timer = null;
            var playing = false;

            var ui = document.createElement('div');
            ui.className = 'spritz-ui';
            ui.innerHTML =
                '<div class="spritz-display">' +
                    '<div class="spritz-word-container">' +
                        '<div class="spritz-focus-line"></div>' +
                        '<div class="spritz-word"></div>' +
                    '</div>' +
                '</div>' +
                '<div class="spritz-controls">' +
                    '<button class="spritz-btn spritz-play">&#9654;</button>' +
                    '<input class="spritz-progress" type="range" min="0" max="' + (words.length - 1) + '" value="0">' +
                    '<select class="spritz-wpm">' +
                        '<option value="200">200 wpm</option>' +
                        '<option value="300" selected>300 wpm</option>' +
                        '<option value="400">400 wpm</option>' +
                        '<option value="500">500 wpm</option>' +
                        '<option value="600">600 wpm</option>' +
                    '</select>' +
                    '<button class="spritz-btn spritz-close-btn">Done</button>' +
                '</div>';

            containerEl.innerHTML = '';
            containerEl.appendChild(ui);

            var wordEl = ui.querySelector('.spritz-word');
            var playBtn = ui.querySelector('.spritz-play');
            var progress = ui.querySelector('.spritz-progress');
            var wpmSelect = ui.querySelector('.spritz-wpm');
            var closeBtn = ui.querySelector('.spritz-close-btn');

            function showWord() {
                renderWord(wordEl, words[index]);
                progress.value = index;
            }

            function step() {
                if (index >= words.length) {
                    stop();
                    return;
                }
                showWord();
                var delay = getDelay(words[index], baseMs);
                index++;
                timer = setTimeout(step, delay);
            }

            function play() {
                if (index >= words.length) index = 0;
                playing = true;
                playBtn.innerHTML = '&#9646;&#9646;';
                step();
            }

            function stop() {
                playing = false;
                playBtn.innerHTML = '&#9654;';
                if (timer) { clearTimeout(timer); timer = null; }
            }

            playBtn.addEventListener('click', function () {
                if (playing) stop(); else play();
            });

            progress.addEventListener('input', function () {
                index = parseInt(progress.value, 10);
                if (playing) { stop(); }
                showWord();
            });

            wpmSelect.addEventListener('change', function () {
                wpm = parseInt(wpmSelect.value, 10);
                baseMs = 60000 / wpm;
            });

            closeBtn.addEventListener('click', function () {
                stop();
                containerEl.innerHTML = '';
                containerEl.hidden = true;
            });

            showWord();
            return { play: play, stop: stop };
        }
    };
})();
